const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isTimeWithinSchedule: active } = require('../../.local/unit/lib/happy-hour');
test('Happy hour respects half-open venue time and overnight windows', () => {
  assert.equal(active(new Date('2026-10-10T20:00Z'),'22:00','02:00','Europe/Sarajevo'),true);
  assert.equal(active(new Date('2026-10-10T23:59Z'),'22:00','02:00','Europe/Sarajevo'),true);
  assert.equal(active(new Date('2026-10-11T00:00Z'),'22:00','02:00','Europe/Sarajevo'),false);
  assert.equal(active(new Date('2026-10-10T12:00Z'),'22:00','02:00','Europe/Sarajevo'),false);
  assert.equal(active(new Date('2026-10-10T12:00Z'),'14:00','16:00','Europe/Sarajevo'),true);
  assert.equal(active(new Date('2026-10-10T14:00Z'),'14:00','16:00','Europe/Sarajevo'),false);
  assert.equal(active(new Date('2026-10-10T12:00Z'),'14:00','14:00','Europe/Sarajevo'),false);
});
