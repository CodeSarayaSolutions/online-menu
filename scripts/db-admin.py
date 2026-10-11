"""Project-scoped Supabase pg-meta SQL runner. Credentials stay in .env.

Reads run inside a read-only transaction. Mutations require --write.
Do not use this tool to modify unrelated schemas on the shared instance.
"""
import argparse
import json
from pathlib import Path
import urllib.request
import urllib.error

ROOT = Path(__file__).resolve().parent.parent

def execute(query, write=False):
    env = {}
    for line in (ROOT / '.env').read_text(encoding='utf-8-sig').splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            key, value = line.split('=', 1)
            env[key.strip()] = value.strip().strip('"').strip("'")
    sql = query if write else 'BEGIN READ ONLY;\n' + query + '\nCOMMIT;'
    request = urllib.request.Request(
        env['NEXT_PUBLIC_SUPABASE_URL'].rstrip('/') + '/pg/query',
        data=json.dumps({'query': sql}).encode(),
        headers={'apikey': env['SUPABASE_SERVICE_ROLE_KEY'], 'Content-Type': 'application/json'},
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        # Never print request headers or credentials.
        raise RuntimeError(error.read().decode()[:2000]) from None

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('file', type=Path)
    parser.add_argument('--write', action='store_true')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    result = execute(args.file.read_text(encoding='utf-8-sig'), args.write)
    encoded = json.dumps(result, ensure_ascii=True, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(encoded, encoding='utf-8')
        print('Result saved to', args.output)
    else:
        print(encoded)
