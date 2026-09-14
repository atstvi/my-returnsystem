'use strict';
/* 활성 규칙 '며칠 전에 미리 만들까요?'(offsetDays) 입력 버그:
   number 필드를 '0'으로 미리 채워두면(value:'0'), 사용자가 0을 지우지 않고 숫자를 치면
   '0' 뒤에 붙어 '40' 같은 엉뚱한 값이 되거나(모바일 number 입력에선 0에 갇혀 계속 0으로
   보이는 증상), 의도한 숫자로 안 바뀐다. 프리필 대신 placeholder '0'을 써서 필드를 비워
   두면 타이핑이 깨끗하게 들어가고, 비워두면 저장 시 0으로 처리된다(parseInt(...)||0). */
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('활성 규칙 offsetDays 입력');

// openFormDialog: placeholder + number inputmode 지원
t.ok('폼 입력에 placeholder 지원', /var ph = f\.placeholder!=null \? ' placeholder="'\+String\(f\.placeholder\)\.replace\(\/"\/g,'&quot;'\)\+'"' : '';/.test(html));
t.ok('number 필드는 inputmode=numeric', /var im = f\.type==='number' \? ' inputmode="numeric"' : '';/.test(html));
t.ok('input 렌더에 im\+ph 반영', /type="'\+\(f\.type\|\|'text'\)\+'"'\+im\+ph\+' value=/.test(html));

// offsetDays 필드: 0 프리필 제거 → 비움 + placeholder '0'
t.ok("'며칠 전에 미리 만들까요?' 0 프리필 제거", /label:'며칠 전에 미리 만들까요\?', type:'number', value:\(r&&r\.offsetDays\)\?String\(r\.offsetDays\):'', placeholder:'0'/.test(html));
t.ok('0 프리필 잔재 없음(며칠 전에 미리)', /value:String\(\(r&&r\.offsetDays\)\|\|0\)/.test(html) === false);
t.ok("'며칠 전 생성' 신규 폼도 비움+placeholder", /label:'며칠 전 생성', type:'number', value:'', placeholder:'0'/.test(html));
t.ok("'며칠 전 생성' 편집 폼도 비움+placeholder", /label:'며칠 전 생성', type:'number', value:\(r&&r\.offsetDays\)\?String\(r\.offsetDays\):'', placeholder:'0'/.test(html));
t.ok("value:'0' 프리필 잔재 없음", /key:'offsetDays'[^}]*value:'0'\}/.test(html) === false);

// 저장은 여전히 parseInt(...)||0 (비우면 0)
t.ok('비우면 0으로 저장', /offsetDays:parseInt\(data\.offsetDays,10\)\|\|0/.test(html));

/* 필수값 미입력 시 다이얼로그가 그냥 닫혀 입력이 통째로 사라지던 버그:
   openFormDialog가 onSave 반환값과 무관하게 close()를 호출했다. onSave가 false를
   반환하면 닫지 않도록 고치고, 활성 규칙 편집은 무엇이 빠졌는지 토스트로 안내 + false 반환. */
t.ok('openFormDialog: onSave가 false면 닫지 않음', /var ret=onSave\(data\); if\(ret!==false\) close\(\);/.test(html));
t.ok('활성 규칙(며칠 전에 미리): 키워드 없으면 안내+false', /if\(type==='keyword'&&!next\.matchText\)\{ if\(typeof showToast==='function'\)showToast\('‘일정·키워드’를 입력해주세요'\); return false; \}/.test(html));
t.ok('활성 규칙(며칠 전에 미리): 요일 없으면 안내+false', /if\(type==='weekday'&&!next\.weekdays\)\{ if\(typeof showToast==='function'\)showToast\('요일을 하나 이상 선택해주세요'\); return false; \}/.test(html));
t.ok('활성 규칙(며칠 전에 미리): 할일 없으면 안내+false', /if\(!next\.taskText\)\{ if\(typeof showToast==='function'\)showToast\('‘자동으로 만들 할일’을 입력해주세요'\); return false; \}/.test(html));
t.ok('조용히 return하던 검증 제거', /if\(\(!next\.matchText&&!next\.weekdays\)\|\|!next\.taskText\)return;/.test(html) === false);
t.ok('다른 규칙 폼도 미입력 시 안내+false', /if\(!match\)\{ if\(typeof showToast==='function'\)showToast\('‘일정\/키워드’를 입력해주세요'\); return false; \}/.test(html) && /if\(\(!match&&!weekdays\)\|\|!text\)return;/.test(html) === false);

t.done();
