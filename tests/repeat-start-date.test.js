'use strict';
/* 할일 편집 모달의 반복 설정에 '반복 시작일'을 추가 — 규칙에 반영되고 생성이 그 날짜부터
   시작되도록. (repeatMatchesDate는 이미 rep.startDate를 존중하므로, 모달 다이얼로그가
   startDate를 입력받아 task._repeat.startDate로 저장하고, syncTaskRepeatItem이 규칙의
   item.startDate로 옮기면 된다.) */
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('반복 시작일');

// 1) 반복 설정 다이얼로그에 startDate(반복 시작일) date 필드가 있다
{
  const i = html.indexOf("openFormDialog('반복 설정'");
  const seg = i >= 0 ? html.slice(i, i + 1400) : '';
  t.ok('반복 설정 다이얼로그 존재', i >= 0);
  t.ok("startDate 필드(라벨 '반복 시작일', type date)",
    /\{key:'startDate', label:'반복 시작일', type:'date'/.test(seg), seg.slice(0, 200));
  t.ok('종료일 필드는 그대로 유지', /\{key:'until', label:'반복 종료일', type:'date'/.test(seg));
}

// 2) 저장 시 task._repeat에 startDate가 담긴다(비-yearly·yearly 모두)
{
  const i = html.indexOf("openFormDialog('반복 설정'");
  const seg = i >= 0 ? html.slice(i, i + 1800) : '';
  t.ok('제출부에서 startDate 계산', /var startDate=data\.startDate\|\|baseKey\|\|'';/.test(seg));
  t.ok('일반 반복 객체에 startDate 저장', /kind:data\.kind,weekdays:[^}]*startDate:startDate/.test(seg));
  t.ok('매년(양력) 객체에 startDate 저장', /kind:'yearly',month:[^}]*startDate:startDate/.test(seg));
  t.ok('매년(음력) 객체에 startDate 저장', /kind:'yearly',lunar:1[^}]*startDate:startDate/.test(seg));
}

// 3) syncTaskRepeatItem이 rep.startDate를 규칙 item.startDate로 우선 반영
{
  const i = html.indexOf('function syncTaskRepeatItem(');
  const seg = i >= 0 ? html.slice(i, i + 2400) : '';
  t.ok('신규 규칙 생성 시 rep.startDate 사용',
    /if\(!item\)\{item=\{id:id,startDate:rep\.startDate\|\|task\.date\|\|TK\};/.test(seg));
  t.ok('기존 규칙에도 rep.startDate 우선',
    /item\.startDate=rep\.startDate\|\|item\.startDate\|\|task\.date\|\|TK;/.test(seg));
  t.ok('시작일이 미래면 그 시점부터 생성 스캔',
    /var _genFrom=\(item\.startDate && item\.startDate>\(task\.date\|\|TK\)\) \? item\.startDate : \(task\.date\|\|TK\);/.test(seg));
}

t.done();
