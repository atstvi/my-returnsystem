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
t.ok('homeMakeLinkedTask: 대상을 가리키는 연결 할일 생성', /function homeMakeLinkedTask\(target, ?text\)\{[\s\S]*?deadlineId:String\(target\.id\)[\s\S]*?sourceTaskId:String\(target\.id\)[\s\S]*?tasks\.unshift\(t\)/.test(html));
t.ok('연결 할일 카테고리/마감일 물려받음', /catId:target\.catId\|\|'etc'[\s\S]*?deadlineDate:target\.deadlineDate\|\|target\.date\|\|''/.test(html));

/* (a) 연결 필요 목록에 버튼 + 인라인 폼 */
t.ok('isLinkList 행에 ＋연결 버튼', /var mkBtn = \(isLinkList && e\.task\) \? '<button class="btn btn-primary" data-mklink="'\+i\+'">/.test(html));
t.ok('인라인 연결 폼(입력+추가+취소)', /ops-mklink-form[\s\S]*?data-mkinput="'\+i\+'[\s\S]*?data-mkok="'\+i\+'[\s\S]*?data-mkcancel="'\+i\+'/.test(html));
t.ok('확인 시 homeMakeLinkedTask 호출', /function _mkOk\(i\)\{[\s\S]*?homeMakeLinkedTask\(entry\.task, ?inp\?inp\.value:''\)/.test(html));
t.ok('Enter로도 추가', /inp\.addEventListener\('keydown',function\(e\)\{ ?if\(e\.key==='Enter'\)\{[\s\S]*?_mkOk\(inp\.getAttribute\('data-mkinput'\)\)/.test(html));

/* (b) 3단 순환 상태 + 저장 */
t.ok('dlOnly 상태 변수', /var dlOnly {4}= false;/.test(html));
t.ok('prefs 로드/저장에 dlOnly 포함', /dlOnly=!!_p\.dlOnly;/.test(html) && /dlOnly:dlOnly,/.test(html));
t.ok('마감 뷰 버튼 3단 순환(끔→마감 뷰→마감만→끔)', /if\(!dlView&&!dlOnly\)\{ ?dlView=true; ?dlOnly=false;[\s\S]*?else if\(dlView&&!dlOnly\)\{ ?dlOnly=true;[\s\S]*?else \{ ?dlView=false; ?dlOnly=false;/.test(html));
t.ok('버튼 라벨/상태 마감만 반영', /dlBtn\.classList\.toggle\('on',dlView\|\|dlOnly\);[\s\S]*?dlLabel\.textContent=dlOnly\?'마감만':'마감 뷰'/.test(html));

/* (b) dlOnlyFilter + renderList 적용 */
t.ok('dlOnlyFilter: 마감/연결만 남김', /function dlOnlyFilter\(list\)\{[\s\S]*?if\(t\.deadlineDate\)return true;[\s\S]*?if\(t\.deadlineId\|\|t\.sourceTaskId\|\|t\._ruleSourceId\)return true;/.test(html));
t.ok('renderList에서 dlOnly 적용', /if\(dlOnly\)vt=dlOnlyFilter\(vt\);/.test(html));
t.ok('마감만 빈 상태 안내', /이 날엔 마감·연결 할일이 없어요/.test(html));

t.done();
