'use strict';
/* 일기 기능 제거 뒤 남아 있던 Notion '일기' 흔적 정리.
   남는 Notion 기능은 하나: 예약 시각에 오늘 할일·일정을 AI로 정리해 타임라인 속성으로 보내기.
   - 30초 타이머·앱 복귀(focus) 때 Notion→일기 가져오기(pull/sweep)를 부르지 않는다
     (가져오기는 이미 막혀 있어 'pull:skip'만 진단에 쌓였다).
   - 막힌 경로는 조용히 돌아간다(진단을 '건너뜀' 경고로 채우지 않음).
   - 진단은 타임라인 전송에 필요한 단계만(일기 섹션 속성·본문 블록·가져오기·sweep 없음). */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('일기 제거: Notion 일기 흔적 정리');

/* 예약 타이머: 시각 전엔 아무것도, 시각 후엔 하루 한 번 타임라인 전송만 */
async function runTick(nowHM, sentToday) {
  const calls = { push: 0, pull: 0, sweep: 0 };
  const store = sentToday ? { 'notion_ai_daily_2026-11-22': '1' } : {};
  let tick = null;
  const [h, m] = nowHM.split(':').map(Number);
  class FakeDate extends Date { constructor(...a) { if (a.length) super(...a); else super(2026, 10, 22, h, m, 0); } }
  const ctx = {
    Date: FakeDate, Number, String, console,
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    getNotionCfg: () => ({ autoSync: true, autoTime: '23:00' }),
    dateKey: () => '2026-11-22', TK: '2026-11-22', currentDate: '2026-11-22',
    runDiaryAiTimeline: async () => { calls.push++; },
    pullDiaryFromNotion: async () => { calls.pull++; },
    diaryNotionSweepRecent: async () => { calls.sweep++; },
    setTimeout: (fn) => { tick = fn; return 1; }, setInterval: () => 2, clearTimeout() {}, clearInterval() {},
    _diaryAutoInitTimer: null, _diaryAutoTimer: null, _diaryAutoBusy: false,
  };
  vm.createContext(ctx);
  vm.runInContext(sliceBlock(html, 'function scheduleDiaryAutoSync(){', '/* Notion→diary feels immediate'), ctx);
  ctx.scheduleDiaryAutoSync();
  await tick();
  return { calls, store };
}

(async () => {
  const before = await runTick('14:00', false);
  t.ok('예약 시각 전: 가져오기·sweep 안 부름, 전송도 없음', before.calls.pull === 0 && before.calls.sweep === 0 && before.calls.push === 0, before.calls);
  const after = await runTick('23:10', false);
  t.ok('예약 시각 후: 타임라인 전송 1번 + 오늘 표시', after.calls.push === 1 && after.calls.pull === 0 && after.store['notion_ai_daily_2026-11-22'] === '1', after.calls);
  const again = await runTick('23:40', true);
  t.ok('이미 보낸 날: 다시 안 보냄, 가져오기도 없음', again.calls.push === 0 && again.calls.pull === 0 && again.calls.sweep === 0, again.calls);

  /* 앱 복귀 때 가져오기 리스너 없음 */
  t.ok('visibilitychange/focus에 일기 가져오기 안 걸림',
    !/addEventListener\('visibilitychange', _diaryNotionFocusPull\)/.test(html) && !/addEventListener\('focus', _diaryNotionFocusPull\)/.test(html));

  /* 막힌 경로는 조용히 */
  const q = sliceBlock(html, 'function queueDiaryNotionSave(dateKey){', 'function queueDiaryNotionPull(');
  t.ok('편집 자동 전송(막힘): 기록 없이 반환', /NOTION_AUTOPUSH_EDIT_DISABLED\) return;/.test(q) && !/autopush-edit disabled/.test(q));
  t.ok('가져오기(막힘): 기록 없이 반환', /NOTION_PULL_DISABLED\) return;/.test(html) && !/'pull disabled \('/.test(html));

  /* 진단: 타임라인 전송 단계만 */
  const d = sliceBlock(html, 'async function runNotionDiagnostics(){', '/* ── callAI ──');
  t.ok('진단: 일기 섹션 속성 검사 없음', !/sleepProp|morningProp|resolutionProp|accomplishmentProp|nightProp|recapProp/.test(d));
  t.ok('진단: 본문 블록·가져오기·sweep·편집 경로 단계 없음', !/\/children/.test(d) && !/pullDiaryFromNotion\(/.test(d) && !/diaryNotionSweepRecent\(/.test(d) && !/실제 수정 경로 기록/.test(d));
  t.ok('진단: 타임라인 속성 + 매일 전송 + 오늘 전송 여부', /타임라인\(timelineProp\)/.test(d) && /'매일 타임라인 전송'/.test(d) && /'오늘 전송'/.test(d));
  t.ok('진단 문구에 일기 없음', !/일기/.test(d.replace(/\/\*[\s\S]*?\*\//g, '')));

  /* 설정 문구 */
  t.ok('하루 경계 설정: 루틴에만 적용', /루틴에만 적용되고, 할일·캘린더는 자정 기준 그대로예요\./.test(html) && !/루틴·일기에만 적용/.test(html));
  t.done();
})();
