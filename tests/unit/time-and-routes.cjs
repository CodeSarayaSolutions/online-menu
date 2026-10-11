const {test}=require('node:test');
const assert=require('node:assert/strict');
const {reportWindow,venueInstant}=require('../../.local/unit/lib/venue-time');
const {isActiveRoute}=require('../../.local/unit/lib/route-matching');
test('venue-local day is independent of UTC day and uses exclusive next midnight',()=>{
 assert.deepEqual(reportWindow('today','Europe/Sarajevo',new Date('2026-10-09T23:30:00Z')),{from:'2026-10-09T22:00:00.000Z',to:'2026-10-10T22:00:00.000Z'});
});
test('this week means Monday to next Monday, not a rolling eight-day range',()=>{
 assert.deepEqual(reportWindow('week','Europe/Sarajevo',new Date('2026-10-10T12:00:00Z')),{from:'2026-10-04T22:00:00.000Z',to:'2026-10-11T22:00:00.000Z'});
});
test('spring and autumn DST days have 23 and 25 hours',()=>{
 const a=reportWindow('custom','Europe/Sarajevo',new Date(),'2026-03-29','2026-03-29');
 const b=reportWindow('custom','Europe/Sarajevo',new Date(),'2026-10-25','2026-10-25');
 assert.equal((Date.parse(a.to)-Date.parse(a.from))/3600000,23);
 assert.equal((Date.parse(b.to)-Date.parse(b.from))/3600000,25);
 assert.throws(()=>venueInstant('2026-03-29','02:30','Europe/Sarajevo'));
 assert.equal(venueInstant('2026-10-25','02:30','Europe/Sarajevo').toISOString(),'2026-10-25T00:30:00.000Z');
});
test('invalid calendar dates and reversed intervals are rejected',()=>{
 assert.throws(()=>reportWindow('custom','Europe/Sarajevo',new Date(),'2026-02-30','2026-03-01'));
 assert.throws(()=>reportWindow('custom','Europe/Sarajevo',new Date(),'2026-10-10','2026-10-09'));
});
test('Barista slug does not highlight the bar station',()=>{
 assert.equal(isActiveRoute('/admin/barista/products','/admin/barista/bar'),false);
 assert.equal(isActiveRoute('/admin/barista/bar','/admin/barista/bar'),true);
 assert.equal(isActiveRoute('/admin/barista/waiter/123','/admin/barista/waiter'),true);
});
