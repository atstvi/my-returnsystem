'use strict';
/* 음력 생일/반복을 직관적으로 — 음력 월·일만 직접 고르면(양력 날짜 몰라도) 매년 자동
   계산. 회귀 배경: 반복 다이얼로그의 '음력 기준'은 '할일 양력 날짜'를 음력으로 역변환
   했다. 음력 생일을 아는 사람도 먼저 양력 날짜를 알아내야 해서 거꾸로였다. 이제 음력
   월/일/윤달을 폼에서 직접 고르고, 다가오는 양력 날짜를 미리보기로 확인한다. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'var LUNAR_INFO=[', '\nwindow.lunarUpcomingSolarKey=lunarUpcomingSolarKey;');
const sb = { window: {}, Date, Math, Number, String, Array, parseInt, isNaN };
vm.createContext(sb);
vm.runInContext(block, sb);
const upc = sb.lunarUpcomingSolarKey;

const t = runner('음력 반복 직관 개선');

// ── lunarUpcomingSolarKey: 음력(월,일,윤달) → 다가오는 양력 ──
t.ok('음력 1.1(설날), 2024-06-01 이후 → 2025-01-29', upc(1, 1, false, '2024-06-01') === '2025-01-29', upc(1, 1, false, '2024-06-01'));
t.ok('음력 1.1(설날), 2024-01-01 이후 → 2024-02-10', upc(1, 1, false, '2024-01-01') === '2024-02-10', upc(1, 1, false, '2024-01-01'));
t.ok('음력 8.15(추석), 2024-01-01 이후 → 2024-09-17', upc(8, 15, false, '2024-01-01') === '2024-09-17', upc(8, 15, false, '2024-01-01'));
t.ok('음력 4.8(초파일), 2024-01-01 이후 → 2024-05-15', upc(4, 8, false, '2024-01-01') === '2024-05-15', upc(4, 8, false, '2024-01-01'));
// 다가오는 해에 그 날이 지났으면 내년으로
t.ok('음력 8.15, 2024-10-01 이후 → 2025-10-06(내년)', /^2025-/.test(upc(8, 15, false, '2024-10-01')), upc(8, 15, false, '2024-10-01'));
// 윤달: 2023 윤2월 존재 → 윤2.1 유효한 양력 반환
t.ok('음력 윤2.1, 2023-01-01 이후 → 양력 키 반환', /^\d{4}-\d{2}-\d{2}$/.test(upc(2, 1, true, '2023-01-01')), upc(2, 1, true, '2023-01-01'));
// 방어: 잘못된 입력도 크래시 없이 문자열
t.ok('빈/이상 입력 방어', typeof upc(0, 0, false, '') === 'string');

// ── 소스 배선: 반복 폼에 음력 월/일/윤달 직접 선택 ──
t.ok('반복 폼에 음력 월 선택', /\{key:'lunarMonth', label:'음력 월', type:'select'/.test(html));
t.ok('반복 폼에 음력 일 선택', /\{key:'lunarDay', label:'음력 일', type:'select'/.test(html));
t.ok('반복 폼에 윤달 체크', /\{key:'lunarLeap', label:'윤달 \(그 해에 있을 때만\)', type:'checkbox'/.test(html));
t.ok('음력 미리보기 필드', /\{key:'lunarPreview', type:'lunarpreview'/.test(html));
t.ok('체크박스 라벨이 음력 우선(양력 몰라도 됨) 안내', /🌙 음력 날짜로 반복/.test(html));

// onSave: 선택한 음력 월/일/윤달을 직접 사용(역변환 아님)
t.ok('onSave가 선택한 음력값 직접 사용', /task\._repeat=\{kind:'yearly',lunar:1,lunarMonth:_lm,lunarDay:_ld,lunarLeap:_lleap/.test(html));
t.ok('원본 할일 날짜를 다가오는 양력 음력생일로 설정', /var _up=lunarUpcomingSolarKey\(_lm,_ld,!!_lleap,baseKey\);/.test(html));

// openFormDialog: lunarpreview 렌더 + 반응성
t.ok('openFormDialog lunarpreview 렌더', /f\.type === 'lunarpreview'/.test(html));
t.ok('음력 켜짐일 때만 월/일/윤달/프리뷰 표시', /var lunarOn=isYearly&&lunarYear&&lunarYear\.checked;/.test(html));
t.ok('음력값 변경 시 미리보기 갱신', /\['lunarMonth','lunarDay','lunarLeap'\]\.forEach\(function\(k\)\{ var el=ov\.querySelector\('\[data-key="'\+k\+'"\]'\); if\(el\)el\.addEventListener\('change',updateLunarPreview\)/.test(html));

t.done();
