'use strict';
/* 오늘 상황에서 바로 마감 연결 + 할일탭 '마감만' 모드:
   (a) '연결이 필요한 마감' 목록(openHomeSignalList, isLinkList)에서 '＋ 연결 할일' 버튼으로
       그 자리에서 연결(준비) 할일을 만든다(homeMakeLinkedTask). 새 할일은 대상을 정/역방향으로
       가리켜(deadlineId·sourceTaskId) 대상이 다음 렌더에서 '연결 필요'에서 빠진다.
   (b) 마감 뷰 버튼이 3단 순환(끔 → 마감 뷰 → 마감만). '마감만'(dlOnly)이면 리스트에서
       마감·마감 연결된 할일만 남기고 나머지는 숨긴다(dlOnlyFilter, renderList). */
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('오늘 상황 바로 연결 + 마감만 모드');

/* (a) homeMakeLinkedTask */
t.ok('homeMakeLinkedTask: 대상을 가리키는 연결 할일 생성', /function homeMakeLinkedTask\(target, ?text, ?opts\)\{[\s\S]*?deadlineId:String\(target\.id\)[\s\S]*?sourceTaskId:String\(target\.id\)[\s\S]*?tasks\.unshift\(t\)/.test(html));
t.ok('연결 할일 카테고리/마감일 물려받음', /catId:target\.catId\|\|'etc'[\s\S]*?deadlineDate:deadline,/.test(html) && /var deadline=target\.deadlineDate\|\|target\.date\|\|'';/.test(html));

/* (a) 날짜 지정: homeMakeLinkedTask가 opts.date를 쓰고, 없으면 마감 하루 전(오늘 이후)로 */
t.ok('homeMakeLinkedTask opts.date 지원 + 마감 전날 기본', /function homeMakeLinkedTask\(target, ?text, ?opts\)\{[\s\S]*?var workDate=opts\.date\|\|'';[\s\S]*?dd\.setDate\(dd\.getDate\(\)-1\);[\s\S]*?if\(prev>=TK\)workDate=prev;/.test(html));
t.ok('연결 할일 date=workDate', /date:workDate,/.test(html));

/* (a) 연결 필요 목록에 버튼 + 인라인 폼(이름 + 날짜) */
t.ok('isLinkList 행에 ＋연결 버튼', /var mkBtn = \(isLinkList && e\.task\) \? '<button class="btn btn-primary" data-mklink="'\+i\+'">/.test(html));
t.ok('인라인 연결 폼(이름+날짜+추가+취소)', /ops-mklink-form[\s\S]*?data-mkinput="'\+i\+'[\s\S]*?data-mkdate="'\+i\+'[\s\S]*?data-mkok="'\+i\+'[\s\S]*?data-mkcancel="'\+i\+'/.test(html));
t.ok('폼에 날짜 입력(field-inp date)', /<input type="date" class="field-inp" data-mkdate="'\+i\+'" value="'\+defDate\+'"/.test(html));
t.ok('확인 시 날짜 함께 전달', /function _mkOk\(i\)\{[\s\S]*?var dateInp=ov\.querySelector\('\[data-mkdate="'\+i\+'"\]'\);[\s\S]*?homeMakeLinkedTask\(entry\.task, ?inp\?inp\.value:'', ?\{date:dateInp\?dateInp\.value:''\}\)/.test(html));
t.ok('Enter로도 추가(이름·날짜)', /ov\.querySelectorAll\('\[data-mkinput\],\[data-mkdate\]'\)[\s\S]*?_mkOk\(inp\.getAttribute\('data-mkinput'\)\|\|inp\.getAttribute\('data-mkdate'\)\)/.test(html));

/* (b) 3단 순환 상태 + 저장 */
t.ok('dlOnly 상태 변수', /var dlOnly {4}= false;/.test(html));
t.ok('prefs 로드/저장에 dlOnly 포함', /dlOnly=!!_p\.dlOnly;/.test(html) && /dlOnly:dlOnly,/.test(html));
t.ok('마감 뷰 버튼 3단 순환(끔→마감 뷰→마감만→끔)', /if\(!dlView&&!dlOnly\)\{ ?dlView=true; ?dlOnly=false;[\s\S]*?else if\(dlView&&!dlOnly\)\{ ?dlOnly=true;[\s\S]*?else \{ ?dlView=false; ?dlOnly=false;/.test(html));
t.ok('버튼 라벨/상태 마감만 반영', /dlBtn\.classList\.toggle\('on',dlView\|\|dlOnly\);[\s\S]*?dlLabel\.textContent=dlOnly\?'마감만':'마감 뷰'/.test(html));

/* (b) dlOnlyFilter + renderCal(달력) 적용 — 리스트는 그대로, 달력에서만 필터 */
/* dlOnlyFilter는 이제 마감 목표만 남기고 연결 준비 할일(_taskIsLinkPrep)은 숨긴다
   (달력이 지저분해지는 문제 해결 · 대신 마감 칩에 '🔗N' 배지). */
t.ok('dlOnlyFilter: 마감 목표만 남기고 연결 준비는 숨김', /function dlOnlyFilter\(list\)\{[\s\S]*?if\(_taskIsLinkPrep\(t\)\)return false;[\s\S]*?if\(t\.deadlineDate\)return true;/.test(html));
t.ok('renderCal에서 dlOnly로 달력 이벤트 필터', /if\(dlOnly\)dayTasks=dlOnlyFilter\(dayTasks\);/.test(html));
t.ok('마감만 모드에선 취미도 숨김', /var dayHobby=\(showHobby&&!dlOnly&&/.test(html));
t.ok('리스트(renderList)는 dlOnly로 필터하지 않음', !/if\(dlOnly\)vt=dlOnlyFilter\(vt\)/.test(html));

t.done();
