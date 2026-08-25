'use strict';
/* 음력 ↔ 양력 변환 고정.
   - lunarToSolar(y,m,d,isLeap): 음력 → 양력 Date(UTC 자정).
   - solarToLunar(Date): 양력 → {y,m,d,leap}.
   한국 명절(설날·추석·부처님오신날)의 알려진 양력 날짜로 검증하고,
   범위 전체를 왕복(round-trip)시켜 일관성을 고정한다. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'var LUNAR_INFO=[', '\nwindow.lunarToSolar=lunarToSolar;');

const sb = { window: {}, Date, Math, Number, String, Array };
vm.createContext(sb);
vm.runInContext(block, sb);

const t = runner('음력 ↔ 양력');

const l2s = sb.lunarToSolar;
const s2l = sb.solarToLunar;
const key = (dt) => dt.getUTCFullYear() + '-' + String(dt.getUTCMonth() + 1).padStart(2, '0') + '-' + String(dt.getUTCDate()).padStart(2, '0');

// ── 알려진 명절 (한국, KST) ──────────────────────────────────────────────────
{
  // 설날 = 음력 1.1
  t.ok('설날 2023 = 2023-01-22', key(l2s(2023, 1, 1, false)) === '2023-01-22', key(l2s(2023, 1, 1, false)));
  t.ok('설날 2024 = 2024-02-10', key(l2s(2024, 1, 1, false)) === '2024-02-10', key(l2s(2024, 1, 1, false)));
  t.ok('설날 2025 = 2025-01-29', key(l2s(2025, 1, 1, false)) === '2025-01-29', key(l2s(2025, 1, 1, false)));
  // 추석 = 음력 8.15
  t.ok('추석 2023 = 2023-09-29', key(l2s(2023, 8, 15, false)) === '2023-09-29', key(l2s(2023, 8, 15, false)));
  t.ok('추석 2024 = 2024-09-17', key(l2s(2024, 8, 15, false)) === '2024-09-17', key(l2s(2024, 8, 15, false)));
  // 부처님오신날 = 음력 4.8
  t.ok('부처님오신날 2024 = 2024-05-15', key(l2s(2024, 4, 8, false)) === '2024-05-15', key(l2s(2024, 4, 8, false)));
}

// ── 역방향: 양력 → 음력 ──────────────────────────────────────────────────────
{
  const a = s2l(new Date(2024, 1, 10)); // 2024-02-10
  t.ok('2024-02-10 → 음력 1.1', a.y === 2024 && a.m === 1 && a.d === 1 && a.leap === 0, JSON.stringify(a));
  const b = s2l(new Date(2024, 8, 17)); // 2024-09-17
  t.ok('2024-09-17 → 음력 8.15', b.m === 8 && b.d === 15, JSON.stringify(b));
}

// ── 윤달 처리: 2023년 윤2월이 존재 ──────────────────────────────────────────
{
  // 2023 has a leap 2nd month. The leap month must map to a solar date that
  // round-trips back to the same leap flag.
  const leapInfo = sb.lunarLeapMonth(2023);
  t.ok('2023 윤달 = 2월', leapInfo === 2, leapInfo);
  const solar = l2s(2023, 2, 1, true); // 윤2월 1일
  const back = s2l(solar);
  t.ok('윤2월 1일 왕복 유지', back.y === 2023 && back.m === 2 && back.d === 1 && back.leap === 1, JSON.stringify(back));
  // 평2월 1일과 윤2월 1일은 다른 양력 날짜
  t.ok('평2월 ≠ 윤2월', key(l2s(2023, 2, 1, false)) !== key(solar));
}

// ── 왕복 일관성: 2020-01-01 ~ 2030-12-31 매일 ───────────────────────────────
{
  let fail = null, count = 0;
  let dt = new Date(Date.UTC(2020, 0, 1));
  const end = Date.UTC(2030, 11, 31);
  while (dt.getTime() <= end && !fail) {
    const lu = s2l(dt);
    const round = l2s(lu.y, lu.m, lu.d, !!lu.leap);
    if (key(round) !== key(dt)) fail = key(dt) + ' → ' + JSON.stringify(lu) + ' → ' + key(round);
    count++;
    dt = new Date(dt.getTime() + 86400000);
  }
  t.ok('4018일 왕복 전부 일치', fail === null, fail || ('checked ' + count));
}

t.done();
