const L = require('./logic.js'); const assert = require('assert');
const h = 3600000, m = 60000;
const S = { autoBreak: true, targetHours: 35, days: [0,1,2,3,4,5,6].map(i => ({ work: i < 5, fixed: i === 4 ? 5 : null })) };
// Auto-Pause (gleitend)
assert.equal(L.autoBreakMs(6 * h), 0);
assert.equal(L.autoBreakMs(6 * h + 5 * m), 5 * m);
assert.equal(L.autoBreakMs(6 * h + 20 * m), 20 * m);
assert.equal(L.autoBreakMs(6 * h + 30 * m), 30 * m);
assert.equal(L.autoBreakMs(8 * h), 30 * m);
assert.equal(L.autoBreakMs(9 * h), 30 * m);
assert.equal(L.autoBreakMs(9 * h + 10 * m), 40 * m);
assert.equal(L.autoBreakMs(9 * h + 15 * m), 45 * m);
assert.equal(L.autoBreakMs(11 * h), 45 * m);
// Netto: 8h brutto, 0 erfasste Pause -> 7.5h; 60 min erfasst -> 7h
const t0 = new Date(2026, 9, 5, 8).getTime(); // Montag
assert.equal(L.netMs({ start: t0, end: t0 + 8 * h }, S), 7.5 * h);
assert.equal(L.netMs({ start: t0, end: t0 + 8 * h, breakMin: 60 }, S), 7 * h);
assert.equal(L.netMs({ start: t0, end: t0 + 8 * h }, { ...S, autoBreak: false }), 8 * h);
// Plan: Montag früh, nichts gearbeitet: Fr 5h fix, Rest 30h auf Mo-Do = 7.5h
let p = L.weekPlan([], S, null, t0, t0);
assert.equal(p.days[0].plan, 7.5 * h); assert.equal(p.days[4].plan, 5 * h);
// Montag 9h netto gearbeitet, jetzt Dienstag: Rest (35-9-5)=21h auf Di-Do = 7h
const mon = { start: t0, end: t0 + 9.75 * h, breakMin: 45 }; // 9.75-0.75 = 9h
const tue = L.addDays(t0, 1) + 9 * h;
p = L.weekPlan([mon], S, null, tue, tue);
assert.equal(p.days[0].worked, 9 * h); assert.equal(p.days[1].plan, 7 * h);
// Alle Tage fix, zu wenig -> shortfall
const S2 = { ...S, days: [0,1,2,3,4,5,6].map(i => ({ work: i < 5, fixed: 5 })) };
p = L.weekPlan([], S2, null, t0, t0); assert.equal(p.shortfall, 10 * h);
console.log('ok');
