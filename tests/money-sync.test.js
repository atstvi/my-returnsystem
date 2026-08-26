'use strict';
/* 머니(가계부) 기기간 동기화 배선 고정.
   - 거래·구독·예산·분야는 FB_DATA_KEYS에 들어가 동기화된다.
   - 환율 캐시·알림중복표시는 동기화 목록에 넣지 않는다(기기-로컬).
   - 거래·구독은 fbApplyData의 per-item union-merge 대상(교차기기 유실 방지).
   - fbApplyData 재수화에서 moneyLoad를 호출해 들어온 변경이 반영된다. */
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('머니 · 기기간 동기화 배선');

// FB_DATA_KEYS = DATA_KEYS.concat([ ... ]) 배열 텍스트 추출
const concatStart = html.indexOf('var FB_DATA_KEYS = DATA_KEYS.concat([');
const concatSlice = html.slice(concatStart, concatStart + 1200); // 넉넉히
const additions = concatSlice.slice(0, concatSlice.indexOf(']).filter'));

// ── 동기화 대상 ───────────────────────────────────────────────────────────────
{
  t.ok('거래 동기화(money_tx_v1)', additions.indexOf("'money_tx_v1'") >= 0);
  t.ok('구독 동기화(money_subs_v1)', additions.indexOf("'money_subs_v1'") >= 0);
  t.ok('예산 동기화(money_budget_v1)', additions.indexOf("'money_budget_v1'") >= 0);
  t.ok('분야 동기화(money_cats_v1)', additions.indexOf("'money_cats_v1'") >= 0);
}

// ── 기기-로컬 유지(동기화 목록 밖) ────────────────────────────────────────────
{
  t.ok('환율 캐시는 비동기화(money_fx_v1)', additions.indexOf("'money_fx_v1'") < 0);
  t.ok('알림 중복표시는 비동기화(money_alert_shown_v1)', additions.indexOf("'money_alert_shown_v1'") < 0);
}

// ── union-merge 대상(교차기기 유실 방지) ──────────────────────────────────────
{
  const mergeRe = /if\(k==='task_items_v1'\|\|k==='inbox_v1'\|\|k==='projects_v1'\|\|k==='money_tx_v1'\|\|k==='money_subs_v1'\)/g;
  const hits = (html.match(mergeRe) || []).length;
  t.ok('거래·구독이 union-merge 조건에 포함(두 경로)', hits >= 2, 'hits=' + hits);
}

// ── 재수화에서 moneyLoad 호출 ─────────────────────────────────────────────────
{
  t.ok('fbApplyData 재수화가 moneyLoad 호출', /\[fbApply\] moneyLoad failed/.test(html) && /if\(typeof moneyLoad==='function'\) moneyLoad\(\);/.test(html));
}

t.done();
