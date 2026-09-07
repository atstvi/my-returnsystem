'use strict';
/* 자연어 퀵캡처 파서 captureParseNL — 시간/날짜를 내용과 분리.
   회귀 배경: AI가 없거나 실패하면 입력 전체가 제목이 돼 "오후 3시 회의"의 시간과 내용이
   섞였다. 로컬 파서가 시간·날짜를 추출해 제목만 남긴다. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'function captureParseNL(input, todayDate){', '\nwindow.captureParseNL=captureParseNL;');
const ctx = { Date };
vm.createContext(ctx);
vm.runInContext(block, ctx);
const parse = ctx.captureParseNL;

const t = runner('자연어 퀵캡처 파싱');
const TODAY = '2026-09-01'; // 화요일

function check(input, exp) {
  const r = parse(input, TODAY);
  const keys = Object.keys(exp);
  const ok = keys.every((k) => r[k] === exp[k]);
  t.ok(input, ok, JSON.stringify({ text: r.text, timeStart: r.timeStart, timeEnd: r.timeEnd, date: r.date }));
}

check('오후 3시 회의', { timeStart: '15:00', text: '회의' });
check('3시에 팀 미팅', { timeStart: '15:00', text: '팀 미팅' });
check('오전 9시 30분 병원', { timeStart: '09:30', text: '병원' });
check('9시 회의', { timeStart: '09:00', text: '회의' });
check('저녁 8시 저녁약속', { timeStart: '20:00', text: '저녁약속' });
check('내일 오후 2시 치과', { timeStart: '14:00', text: '치과', date: '2026-09-02' });
check('14:30 코드리뷰', { timeStart: '14:30', text: '코드리뷰' });
check('오후 2시-4시 워크샵', { timeStart: '14:00', timeEnd: '16:00', text: '워크샵' });
check('오후 2시부터 4시까지 회의', { timeStart: '14:00', timeEnd: '16:00', text: '회의' });
check('3시반 커피', { timeStart: '15:30', text: '커피' });
check('정오 점심약속', { timeStart: '12:00', text: '점심약속' });
check('자정 배포', { timeStart: '00:00', text: '배포' });
check('9월 5일 세미나', { text: '세미나', date: '2026-09-05' });
check('11시 12분 알람', { timeStart: '11:12', text: '알람' });
check('모레 발표 준비', { text: '발표 준비', date: '2026-09-03' });
// 시간 없는 입력은 그대로 제목
check('보고서 작성', { timeStart: '', text: '보고서 작성' });
check('은행 다녀오기', { timeStart: '', date: '', text: '은행 다녀오기' });
// 과거 월/일은 내년으로
check('1월 3일 신년계획', { text: '신년계획', date: '2027-01-03' });
// 마감(deadline) — date가 아니라 deadlineDate로 분리
check('보고서 9월 10일까지', { deadlineDate: '2026-09-10', date: '', text: '보고서' });
check('내일까지 제출', { deadlineDate: '2026-09-02', date: '', text: '제출' });
check('9월 10일 마감 보고서', { deadlineDate: '2026-09-10', date: '', text: '보고서' });
check('과제 마감 금요일', { deadlineDate: '2026-09-04', text: '과제' }); // 2026-09-01=화 → 금=09-04
check('오늘까지 정산', { deadlineDate: '2026-09-01', text: '정산' });
check('프로젝트 기한 9월 20일', { deadlineDate: '2026-09-20', text: '프로젝트' });
// 시작 시간 + 마감 혼합
check('내일 오후 3시 발표, 자료 9월 5일까지', { timeStart: '15:00', date: '2026-09-02', deadlineDate: '2026-09-05' });
// 마감 문맥이 없으면 date로(회귀)
check('9월 5일 세미나 (재확인)'.replace(' (재확인)',''), { date: '2026-09-05', deadlineDate: '', text: '세미나' });
// 빈 입력 방어
{ const r = parse('', TODAY); t.ok('빈 입력 → 빈 결과', r.text === '' && r.timeStart === '' && r.deadlineDate === ''); }

// 소스 배선: 퀵캡처 task 경로가 파서를 사용
t.ok('homeCapture가 captureParseNL 사용',
  /var _nl = captureParseNL\(text, \(typeof TK!=='undefined'\?TK:''\)\);/.test(html));
t.ok('파싱된 제목·시간·날짜로 할일 생성',
  /text:_body,catId:defCat,date:\(_nl\.date\|\|TK\)[^}]*timeStart:\(_nl\.timeStart\|\|''\),timeEnd:\(_nl\.timeEnd\|\|''\)/.test(html));
t.ok('마감일(deadlineDate)도 반영', /deadlineDate:\(_nl\.deadlineDate\|\|''\)/.test(html));

t.done();
