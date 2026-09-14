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

t.done();
