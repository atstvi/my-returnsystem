'use strict';
/* 로드 워치독 + 편집중 재렌더 미루기 고정.
   - returnUserBusyEditing(): 모달/드래그/입력 포커스/일기 디바운스 중이면 true →
     fbApplyData가 재렌더로 편집 내용을 날리지 않도록 미루는 판단 기준.
   - __hydrateTimeoutMessage(): 불러오기 20s 초과 시 원인(용량/오프라인/지연)을
     구분해 명확한 조치를 안내. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const busyBlock = sliceBlock(html, 'function returnUserBusyEditing(){', '\nwindow.returnUserBusyEditing=');
const msgBlock = sliceBlock(html, 'function __hydrateTimeoutMessage(){', '\nasync function fbLoadAll(');

const t = runner('로드 워치독 · 편집중 재렌더 미루기');

// ── returnUserBusyEditing ────────────────────────────────────────────────────
function busySandbox(over){
  const doc = { querySelector: () => null, activeElement: null };
  const sb = {
    window: {}, document: doc, console: { warn() {} },
  };
  Object.assign(sb, over || {});
  vm.createContext(sb);
  vm.runInContext(busyBlock, sb);
  return sb;
}
{
  t.ok('한가하면 false', busySandbox().returnUserBusyEditing() === false);

  const modal = busySandbox();
  modal.document.querySelector = (sel) => (sel === '.overlay.open' ? {} : null);
  t.ok('모달 열림 → true', modal.returnUserBusyEditing() === true);

  const drag = busySandbox();
  drag.window._pjbDragging = true;
  t.ok('보드 드래그 → true', drag.returnUserBusyEditing() === true);

  const ta = busySandbox();
  ta.document.activeElement = { tagName: 'TEXTAREA' };
  t.ok('TEXTAREA 포커스 → true', ta.returnUserBusyEditing() === true);

  const inp = busySandbox();
  inp.document.activeElement = { tagName: 'INPUT' };
  t.ok('INPUT 포커스 → true', inp.returnUserBusyEditing() === true);

  const ce = busySandbox();
  ce.document.activeElement = { tagName: 'DIV', isContentEditable: true };
  t.ok('contentEditable → true', ce.returnUserBusyEditing() === true);

  const btn = busySandbox();
  btn.document.activeElement = { tagName: 'BUTTON' };
  t.ok('버튼 포커스는 편집 아님 → false', btn.returnUserBusyEditing() === false);

  const timer = busySandbox({ saveTimer: 123 });
  t.ok('일기 저장 디바운스 대기 → true', timer.returnUserBusyEditing() === true);
}

// ── __hydrateTimeoutMessage ──────────────────────────────────────────────────
function msgSandbox(over){
  const sb = { window: {}, console: { warn() {} }, Number, String };
  Object.assign(sb, over || {});
  vm.createContext(sb);
  vm.runInContext(msgBlock, sb);
  return sb;
}
{
  // 용량 거의 참(≥90%) → 용량 원인 + 정리 안내
  const full = msgSandbox({
    returnStorageReport: () => ({ usedPct: 94 }),
    navigator: { onLine: true },
  });
  const m1 = full.__hydrateTimeoutMessage();
  t.ok('용량 초과 안내', /저장 공간/.test(m1) && /94%/.test(m1), m1);

  // 오프라인 → 네트워크 원인
  const off = msgSandbox({
    returnStorageReport: () => ({ usedPct: 10 }),
    navigator: { onLine: false },
  });
  const m2 = off.__hydrateTimeoutMessage();
  t.ok('오프라인 안내', /연결이 끊/.test(m2), m2);

  // 정상 용량 + 온라인 → 서버 지연(안심 문구 + 새로고침)
  const slow = msgSandbox({
    returnStorageReport: () => ({ usedPct: 30 }),
    navigator: { onLine: true },
  });
  const m3 = slow.__hydrateTimeoutMessage();
  t.ok('서버 지연 안내', /응답이 늦어/.test(m3) && /새로고침/.test(m3), m3);

  // 모든 진단 도구가 없어도 안전한 기본 문구
  const bare = msgSandbox({});
  const m4 = bare.__hydrateTimeoutMessage();
  t.ok('진단 불가여도 문구 반환', typeof m4 === 'string' && m4.length > 0, m4);
  t.ok('기본 문구도 안심 안내', /이 기기에 저장/.test(m4), m4);
}

t.done();
