'use strict';
/* 이미 추가한 활성 규칙(키워드형) 편집 버그: 트리거 종류 판별식이
   (r.triggerType||r.weekdays ? 'weekday':'keyword') 였는데 연산자 우선순위 때문에
   r.triggerType가 'keyword'(truthy)여도 조건이 참이 돼 항상 'weekday'로 잡혔다.
   그 결과 편집 시 키워드 입력칸이 숨겨지고(요일 모드로 전환), 저장하면 키워드가 날아가
   "입력한 게 없어짐"이 됐다. r.triggerType를 우선 존중하도록 고친다. */
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('활성 규칙 편집 트리거 판별');

t.ok('triggerType는 r.triggerType 우선 존중', /var triggerType = \(r && r\.triggerType\) \? r\.triggerType : \(\(r && r\.weekdays\) \? 'weekday' : 'keyword'\);/.test(html));
t.ok('버그 판별식 제거', /\(r&&\(r\.triggerType\|\|r\.weekdays\?'weekday':'keyword'\)\)\|\|'keyword'/.test(html) === false);

t.done();
