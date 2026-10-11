"""Run against the isolated localhost fixture server, never real accounts."""
import json, time, statistics, urllib.request, urllib.error, urllib.parse, http.cookiejar
BASE='http://localhost:3138'
def client():
 # Browsers permit Secure cookies on localhost; mirror that only in this local fixture client.
 assert urllib.parse.urlparse(BASE).hostname=='localhost'
 policy=http.cookiejar.DefaultCookiePolicy(secure_protocols=('https','wss','http'))
 return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar(policy=policy)))
def call(c,path,data=None):
 req=urllib.request.Request(BASE+path,data=json.dumps(data).encode() if data is not None else None,headers={'Content-Type':'application/json','Origin':BASE})
 try:
  with c.open(req,timeout=30) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:return e.code,json.load(e)
manager=client();admin=client();anonymous=client()
assert call(manager,'/api/auth/login',{'email':'ui-manager@onm.invalid','pin':'471'})[0]==200
assert call(admin,'/api/auth/login',{'email':'ui-admin@onm.invalid','pin':'471'})[0]==200
assert call(anonymous,'/api/reports?venue=onm-test-cafe')[0]==401
assert call(manager,'/api/admin/support')[0]==403
status,feed=call(admin,'/api/admin/support');assert status==200 and len(feed['rows'])>0
assert call(manager,'/api/actions',{'action':'venue.configure','venue':'onm-test-cafe','data':{'language':'en','timezone':'UTC','kitchenEnabled':True,'requestKey':'api-manager-config-denied'}})[0]==403
assert call(manager,'/api/reports?venue=not-a-member')[0]==403
assert call(manager,'/api/waiter/set-pin',{'userId':'10000000-0000-4000-a000-000000000001','pin':'000'})[0]==410
latencies=[]
for n in range(5):
 start=time.perf_counter();status,r=call(manager,'/api/reports?venue=onm-test-cafe&range=today');latencies.append(round((time.perf_counter()-start)*1000,1));assert status==200
 assert len(r['rows'])<=50 and 'summary' in r
 if r['rows']:assert 'tab_items' not in r['rows'][0]
print(json.dumps({'result':'PASS: custom-session HTTP authentication, manager/platform separation, denied config and legacy PIN bypass, scoped bounded reports','report_roundtrip_ms':latencies,'warm_median_ms':statistics.median(latencies[1:])},indent=2))

# Full guest-to-staff HTTP flow, using a dedicated test-only table.
import uuid, concurrent.futures
bar=client();waiter=client();guest=client()
assert call(bar,'/api/auth/login',{'email':'ui-bar@onm.invalid','pin':'471'})[0]==200
assert call(waiter,'/api/auth/login',{'email':'ui-waiter@onm.invalid','pin':'369'})[0]==200
status,session=call(guest,'/api/guest/session',{'venue':'onm-test-cafe','table':'http-concurrency-test'});assert status==200,(status,session)
status,stock_before=call(manager,'/api/inventory?venue=onm-test-cafe');assert status==200
bottle=next(r for r in stock_before['rows'] if r['name']=='Test boca');before_quantity=bottle['quantity'];assert bottle['tracked']
key=str(uuid.uuid4());body={'venue':'onm-test-cafe','tableId':session['tableId'],'requestKey':key,'items':[{'id':bottle['id'],'quantity':2,'price':0.01}],'note':'HTTP isolated regression'}
status,order=call(guest,'/api/guest/orders',body);assert status==200,(status,order);assert order['total']==7
assert call(guest,'/api/guest/orders',body)[1]['id']==order['id']
assert call(guest,'/api/guest/orders',{**body,'venue':'not-a-member'})[0]==401
assert call(manager,'/api/orders/decision',{'venue':'onm-test-cafe','orderId':order['id'],'accept':True,'minutes':10})[0]==403
status,decision=call(bar,'/api/orders/decision',{'venue':'onm-test-cafe','orderId':order['id'],'accept':True,'minutes':10});assert status==200,(status,decision)
bill=decision['tabId']
assert call(waiter,'/api/actions',{'action':'tab.claim','venue':'onm-test-cafe','data':{'tabId':bill,'requestKey':str(uuid.uuid4())}})[0]==200
# Two simultaneous settlements with different request keys must still settle once.
def settle(_):return call(waiter,'/api/actions',{'action':'tab.close','venue':'onm-test-cafe','data':{'tabId':bill,'paymentMethod':'cash','requestKey':str(uuid.uuid4())}})
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool: results=list(pool.map(settle,range(2)))
assert all(r[0]==200 and r[1]['result']['id']==bill for r in results),results
status,detail=call(manager,'/api/reports?venue=onm-test-cafe&options='+urllib.parse.quote(json.dumps({'detail':bill})))
assert status==200 and detail['detail']['total']==7 and len(detail['detail']['tab_items'])==1
print('PASS: HTTP QR session, authoritative pricing, idempotent order, cross-venue denial, bar acceptance, waiter claim, simultaneous settlement')

status,stock_after=call(manager,'/api/inventory?venue=onm-test-cafe');assert status==200
after_quantity=next(r for r in stock_after['rows'] if r['id']==bottle['id'])['quantity']
assert after_quantity==before_quantity-2,(before_quantity,after_quantity)
print('PASS: simultaneous HTTP settlement deducted counted stock exactly once')

# A previously valid cookie must stop working immediately after logout.
revoked=client();assert call(revoked,'/api/auth/login',{'email':'ui-manager@onm.invalid','pin':'471'})[0]==200
jar=next(h.cookiejar for h in revoked.handlers if isinstance(h,urllib.request.HTTPCookieProcessor))
cookie='; '.join(c.name+'='+c.value for c in jar)
assert call(revoked,'/api/reports?venue=onm-test-cafe')[0]==200
assert call(revoked,'/api/auth/logout',{})[0]==200
try:
 urllib.request.urlopen(urllib.request.Request(BASE+'/api/reports?venue=onm-test-cafe',headers={'Cookie':cookie}),timeout=30)
 raise AssertionError('Revoked session remained valid')
except urllib.error.HTTPError as e:assert e.code==401,e.code
print('PASS: production session revocation immediately rejects the previously valid cookie')
