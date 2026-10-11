"""Private, consistent sarayamenu snapshot and isolated migration rehearsal.

Uses the existing pg-meta connection. Never modifies the source schema. Backup
files contain private production records and must remain under ignored .local/.
This is an application-schema logical backup, not a cluster/storage backup.
"""
import argparse
import gzip
import hashlib
import importlib.util
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('db_admin', ROOT / 'scripts/db-admin.py')
db = importlib.util.module_from_spec(spec)
spec.loader.exec_module(db)
SOURCE = 'sarayamenu'

def qi(value):
    return '"' + value.replace('"', '""') + '"'

def qs(value):
    return "'" + value.replace("'", "''") + "'"

def dump_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=True, indent=2), encoding='utf-8')

def snapshot(directory):
    names = db.execute("SELECT tablename FROM pg_tables WHERE schemaname='sarayamenu' ORDER BY tablename;")
    tables = [r['tablename'] for r in names]
    data_sql = ','.join(qs(t) + ',(SELECT coalesce(jsonb_agg(to_jsonb(t)),\'[]\'::jsonb) FROM sarayamenu.' + qi(t) + ' t)' for t in tables)
    # One SQL statement means the definitions and every row share one MVCC snapshot.
    sql = """SELECT jsonb_build_object(
      'captured_at',clock_timestamp(),'server_version',version(),
      'tables',(SELECT jsonb_agg(jsonb_build_object('name',c.relname,'kind',c.relkind,
        'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity))
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='sarayamenu' AND c.relkind IN ('r','p','v','m','S')),
      'columns',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',a.attname,
        'position',a.attnum,'type',format_type(a.atttypid,a.atttypmod),'notnull',a.attnotnull,
        'default',pg_get_expr(d.adbin,d.adrelid),'identity',a.attidentity,'generated',a.attgenerated))
        FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
        LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
        WHERE n.nspname='sarayamenu' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped),
      'constraints',(SELECT jsonb_agg(jsonb_build_object('table',r.relname,'name',c.conname,
        'definition',pg_get_constraintdef(c.oid),'type',c.contype))
        FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname='sarayamenu'),
      'indexes',(SELECT jsonb_agg(pg_get_indexdef(i.indexrelid)) FROM pg_index i
        JOIN pg_class c ON c.oid=i.indrelid JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='sarayamenu' AND NOT EXISTS(SELECT 1 FROM pg_constraint x WHERE x.conindid=i.indexrelid)),
      'functions',(SELECT jsonb_agg(jsonb_build_object('name',p.proname,'args',pg_get_function_identity_arguments(p.oid),
        'owner',pg_get_userbyid(p.proowner),'definition',pg_get_functiondef(p.oid),
        'grants',(SELECT jsonb_agg(jsonb_build_object('role',CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END,
          'privilege',x.privilege_type,'grantable',x.is_grantable)) FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x)))
        FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='sarayamenu'),
      'policies',(SELECT jsonb_agg(to_jsonb(p)) FROM pg_policies p WHERE schemaname='sarayamenu'),
      'triggers',(SELECT jsonb_agg(pg_get_triggerdef(t.oid)) FROM pg_trigger t
        JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='sarayamenu' AND NOT t.tgisinternal),
      'grants',(SELECT jsonb_agg(to_jsonb(g)) FROM information_schema.table_privileges g WHERE table_schema='sarayamenu'),
      'column_grants',(SELECT jsonb_agg(to_jsonb(g)) FROM information_schema.column_privileges g WHERE table_schema='sarayamenu'),
      'schema_acl',(SELECT nspacl FROM pg_namespace WHERE nspname='sarayamenu'),
      'data',jsonb_build_object(DATA_SQL)
    ) AS snapshot;""".replace('DATA_SQL', data_sql)
    result = db.execute(sql)[0]['snapshot']
    assert all(t['kind']=='r' for t in result['tables']), 'Unsupported table kind; refuse incomplete backup'
    assert set(result['data']) == {t['name'] for t in result['tables']}
    assert not any(c['identity'] or c['generated'] or 'nextval(' in (c['default'] or '') for c in result['columns']), 'Sequence/generated columns need dedicated restore support'
    payload = json.dumps(result, ensure_ascii=True, separators=(',', ':')).encode()
    with gzip.open(directory / 'snapshot.json.gz', 'wb') as f:
        f.write(payload)
    manifest = {'captured_at':result['captured_at'],'source_schema':SOURCE,
      'sha256_uncompressed_json':hashlib.sha256(payload).hexdigest(),
      'tables':{name:len(rows) for name,rows in result['data'].items()}}
    dump_json(directory / 'manifest.json', manifest)
    print('Snapshot saved:', len(manifest['tables']), 'tables,', sum(manifest['tables'].values()), 'rows', flush=True)
    return result

def restore_sql(snap, target):
    if not re.fullmatch(r'(sarayamenu|onm_rehearsal_[0-9_]+)',target):
        raise ValueError('Unexpected target schema')
    def remap(s):
        return s.replace(SOURCE,target).replace('x-'+target+'-session','x-sarayamenu-session')
    role = lambda r: 'PUBLIC' if r=='PUBLIC' else qi(r)
    prefix = qi(target)+'.'
    sql=['BEGIN;', 'SET LOCAL check_function_bodies=false;', 'SET LOCAL statement_timeout=\'120s\';',
         'SET LOCAL standard_conforming_strings=on;', 'CREATE SCHEMA '+qi(target)+';',
         'REVOKE ALL ON SCHEMA '+qi(target)+' FROM PUBLIC,anon,authenticated;']
    # Fail on existing target. No DROP or overwrite path, including for production.
    for t in sorted(snap['tables'],key=lambda t:t['name']):
        cols=[]
        for c in sorted([c for c in snap['columns'] if c['table']==t['name']],key=lambda c:c['position']):
            cols.append(qi(c['name'])+' '+remap(c['type'])+(' DEFAULT '+remap(c['default']) if c['default'] else '')+(' NOT NULL' if c['notnull'] else ''))
        sql.append('CREATE TABLE '+prefix+qi(t['name'])+' ('+', '.join(cols)+');')
    # Load rows before adding triggers and FKs, preserving original values exactly.
    for name,rows in snap['data'].items():
        if rows:
            data=json.dumps(rows,ensure_ascii=True,separators=(',',':'))
            sql.append('INSERT INTO '+prefix+qi(name)+' SELECT * FROM jsonb_populate_recordset(NULL::'+prefix+qi(name)+','+qs(data)+'::jsonb);')
    for f in snap['functions']:
        sql.append(remap(f['definition'])+';')
    for c in sorted(snap['constraints'],key=lambda c:c['type']=='f'):
        sql.append('ALTER TABLE '+prefix+qi(c['table'])+' ADD CONSTRAINT '+qi(c['name'])+' '+remap(c['definition'])+';')
    sql.extend(remap(i)+';' for i in snap['indexes'] or [])
    for p in snap['policies'] or []:
        roles=p['roles']
        if isinstance(roles,str): roles=roles.strip('{}').split(',')
        sql.append('CREATE POLICY '+qi(p['policyname'])+' ON '+prefix+qi(p['tablename'])+' AS '+p['permissive']+' FOR '+p['cmd']+' TO '+','.join(role(r.upper() if r.lower()=='public' else r) for r in roles)+(' USING ('+remap(p['qual'])+')' if p['qual'] else '')+(' WITH CHECK ('+remap(p['with_check'])+')' if p['with_check'] else '')+';')
    sql.extend(remap(t)+';' for t in snap['triggers'] or [])
    for t in snap['tables']:
        name=prefix+qi(t['name'])
        sql.append('ALTER TABLE '+name+' OWNER TO '+qi(t['owner'])+';')
        sql.append('REVOKE ALL ON '+name+' FROM PUBLIC,anon,authenticated,service_role;')
        if t['rls']: sql.append('ALTER TABLE '+name+' ENABLE ROW LEVEL SECURITY;')
        if t['force_rls']: sql.append('ALTER TABLE '+name+' FORCE ROW LEVEL SECURITY;')
    for g in snap['grants'] or []:
        sql.append('GRANT '+g['privilege_type']+' ON '+prefix+qi(g['table_name'])+' TO '+role(g['grantee'])+(' WITH GRANT OPTION' if g['is_grantable']=='YES' else '')+';')
    for g in snap['column_grants'] or []:
        sql.append('GRANT '+g['privilege_type']+' ('+qi(g['column_name'])+') ON '+prefix+qi(g['table_name'])+' TO '+role(g['grantee'])+(' WITH GRANT OPTION' if g['is_grantable']=='YES' else '')+';')
    for f in snap['functions']:
        name=prefix+qi(f['name'])+'('+remap(f['args'])+')'
        sql.append('ALTER FUNCTION '+name+' OWNER TO '+qi(f['owner'])+';')
        sql.append('REVOKE ALL ON FUNCTION '+name+' FROM PUBLIC,anon,authenticated,service_role;')
        for g in f['grants'] or []:
            sql.append('GRANT '+g['privilege']+' ON FUNCTION '+name+' TO '+role(g['role'])+(' WITH GRANT OPTION' if g['grantable'] else '')+';')
    # Intentionally keep a production-data copy inaccessible to browser roles.
    sql.extend(['REVOKE ALL ON SCHEMA '+qi(target)+' FROM PUBLIC,anon,authenticated;', 'COMMIT;'])
    return '\n'.join(sql)

def verify_rows(snap,target):
    # Canonical JSON equality includes every original column and row, not just counts.
    queries=[]
    for name,rows in snap['data'].items():
        cols=','.join(qi(c['name']) for c in sorted([c for c in snap['columns'] if c['table']==name],key=lambda c:c['position']))
        queries.append(qs(name)+',(SELECT coalesce(jsonb_agg(to_jsonb(t)),\'[]\'::jsonb) FROM (SELECT '+cols+' FROM '+qi(target)+'.'+qi(name)+') t)')
    copied=db.execute('SELECT jsonb_build_object('+','.join(queries)+') AS data;')[0]['data']
    canonical=lambda rows: sorted(json.dumps(r,sort_keys=True,separators=(',',':'),ensure_ascii=True) for r in rows)
    differences=[name for name,rows in snap['data'].items() if canonical(rows)!=canonical(copied[name])]
    return {'all_original_rows_equal':not differences,'differing_tables':differences,'tables':len(copied),'rows':sum(map(len,copied.values()))}

def apply_large_restore(sql,target):
    # pg-meta caps request size. Stage private SQL chunks then execute the whole
    # restore inside one database transaction, so no partial target is committed.
    staging=target+'_loader'
    db.execute('CREATE SCHEMA '+qi(staging)+'; REVOKE ALL ON SCHEMA '+qi(staging)+' FROM PUBLIC,anon,authenticated,service_role; CREATE TABLE '+qi(staging)+'.chunks (position integer PRIMARY KEY, body text NOT NULL);',write=True)
    body=sql.removeprefix('BEGIN;').removesuffix('COMMIT;')
    for i,start in enumerate(range(0,len(body),180000)):
        db.execute('INSERT INTO '+qi(staging)+'.chunks VALUES ('+str(i)+','+qs(body[start:start+180000])+');',write=True)
    db.execute('BEGIN; SET LOCAL statement_timeout=\'120s\'; DO $restore$ DECLARE s text; BEGIN SELECT string_agg(body,\'\' ORDER BY position) INTO s FROM '+qi(staging)+'.chunks; EXECUTE s; END $restore$; DROP TABLE '+qi(staging)+'.chunks; DROP SCHEMA '+qi(staging)+'; COMMIT;',write=True)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--directory',type=Path,required=True)
    parser.add_argument('--target',required=True)
    parser.add_argument('--stage',choices=['copy','restore','migrate','verify'],required=True)
    args=parser.parse_args()
    directory=args.directory.resolve()
    assert directory.is_relative_to((ROOT/'.local').resolve())
    assert re.fullmatch(r'onm_rehearsal_[0-9_]+',args.target)
    if args.stage=='copy':
        directory.mkdir(parents=True,exist_ok=False)
        snap=snapshot(directory)
        sql=restore_sql(snap,args.target)
        with gzip.open(directory/'restore-copy.sql.gz','wt',encoding='utf-8') as f: f.write(sql)
        apply_large_restore(sql,args.target)
        result=verify_rows(snap,args.target)
        dump_json(directory/'copy-verification.json',result)
        print(json.dumps(result),flush=True)
        assert result['all_original_rows_equal']
    else:
        with gzip.open(directory/'snapshot.json.gz','rt',encoding='utf-8') as f: snap=json.load(f)
        if args.stage=='restore':
            sql=restore_sql(snap,args.target)
            with gzip.open(directory/'restore-copy.sql.gz','wt',encoding='utf-8') as f: f.write(sql)
            apply_large_restore(sql,args.target)
        if args.stage=='migrate':
            results=[]
            for path in sorted((ROOT/'scripts').glob('hos-*.sql')):
                sql=path.read_text(encoding='utf-8').replace(SOURCE,args.target).replace('x-'+args.target+'-session','x-sarayamenu-session')
                try:
                    db.execute(sql,write=True)
                    results.append({'file':path.name,'status':'passed','sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
                    print(path.name,'passed',flush=True)
                except Exception as e:
                    results.append({'file':path.name,'status':'failed','error':str(e)})
                    dump_json(directory/'migration-results.json',results)
                    raise
                dump_json(directory/'migration-results.json',results)
        result=verify_rows(snap,args.target)
        dump_json(directory/('copy-verification.json' if args.stage=='restore' else 'post-migration-verification.json'),result)
        print(json.dumps(result),flush=True)
        assert result['all_original_rows_equal']

if __name__=='__main__': main()
