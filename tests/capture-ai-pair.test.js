'use strict';
/* 자연어(AI) 캡처가 '마감 목표 + 준비/실행 할일'을 한 쌍으로 이해하면 연결 할일도 함께
   만들어 서로 연결한다(연결 할일의 deadlineId/sourceTaskId → 마감 할일 id). 그래서 양쪽
   상세('일정 연결'·'연결된 할일')와 달력 화살표가 일관되게 '연결됨'으로 인식된다.
   단, 마감이 없거나 준비 행동이 불분명하면 linkedTask는 빈값이라 관련 없는 걸 억지로
   잇지 않는다(수동 연결은 기존대로 동작). */
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('자연어 캡처: 마감+연결 할일 쌍 생성');

// AI 스키마에 linkedTask + 가드 규칙
t.ok('AI 스키마에 linkedTask 필드', /"deadlineDate":"YYYY-MM-DD\|","note":"추가 설명\|","linkedTask":"연결 준비\/실행 할일 제목\|"/.test(html));
t.ok('linkedTask는 마감 있을 때만(억지 연결 방지) 규칙', /linkedTask: 입력에 "마감\/기한이 있는 목표[\s\S]*?deadlineDate가 없거나 준비 행동이 불분명하면 반드시 ""/.test(html));
t.ok('파싱 후 linkedTask 가드(마감 없거나 text와 동일하면 비움)', /parsed\.linkedTask = \(parsed\.linkedTask && parsed\.deadlineDate && String\(parsed\.linkedTask\)\.trim\(\)!==String\(parsed\.text\|\|''\)\.trim\(\)\) \? String\(parsed\.linkedTask\)\.trim\(\) : '';/.test(html));

// 커밋에서 쌍 생성 + 연결
t.ok('마감+linkedTask면 연결 할일 생성', /if\(linkedText && \(parsed\.deadlineDate\|\|''\)\)\{/.test(html));
t.ok('연결 할일이 마감 할일을 가리킴(deadlineId/sourceTaskId=mainId)', /deadlineDate:parsed\.deadlineDate\|\|'', deadlineId:String\(mainId\)[\s\S]*?sourceTaskId:String\(mainId\)/.test(html));
t.ok('쌍 생성 토스트', /madePair \? \('마감 \+ 연결 할일 추가/.test(html));

// 프리뷰에 연결 할일 표시
t.ok('프리뷰에 연결 할일 행', /parsed\.linkedTask \? \['연결 할일', '＋ '\+parsed\.linkedTask\] : null/.test(html));

t.done();
