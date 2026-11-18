'use strict';
/* 작성 중 바탕 눌러 닫힘 방지 — 모든 입력 창 공통 가드(rdsBackdropGuard).
   - 바탕(화면을 덮는 fixed dim)을 눌렀을 때, 그 창에서 사용자가 직접 쓴 내용이 그대로 남아 있으면 바로 닫지
     않고 '계속 쓰기 / 닫기'를 묻는다(mousedown으로 닫는 창도 포함). 닫기를 고르면 원래 닫기 처리 그대로.
   - 입력칸에서 누른 채 끌다가(글자 선택) 바탕에서 떼면 닫히던 것 → 무시.
   - 코드가 값을 다시 채운 창(다른 할일로 다시 열기)은 깨끗한 것으로 봄. 확인 시트의 바탕은 제외. */
const { readIndex, sliceBlock, runner } = require('./lib');
const html = readIndex();
const t = runner('작성 중 바탕 눌러 닫힘 방지');
const g = sliceBlock(html, '(function rdsBackdropGuard(){', '\n})();');

t.ok('캡처 단계에서 click·mousedown 모두 가로챔(각 창의 닫기 처리보다 먼저)', /window\.addEventListener\('click',function\(e\)\{/.test(g) && /window\.addEventListener\('mousedown',function\(e\)\{/.test(g) && (g.match(/\},true\);/g) || []).length >= 5);
t.ok('사용자가 쓴 값만 표시(input 이벤트) · 코드가 값을 바꾸면 해제(focusin)', /window\.addEventListener\('input',function\(e\)\{ var el=e\.target; if\(editable\(el\)\)el\._rdsTyped=val\(el\); \},true\);/.test(g) && /if\(el&&el\._rdsTyped!=null&&val\(el\)!==el\._rdsTyped\)el\._rdsTyped=null;/.test(g));
t.ok('쓴 내용 판정: 표시된 값이 그대로·비어 있지 않음·보이는 칸', /x\._rdsTyped!=null&&val\(x\)===x\._rdsTyped&&\(x\._rdsPicked\|\|val\(x\)\.trim\(\)!==''\)&&x\.getClientRects\(\)\.length/.test(g));
t.ok('바탕 판정: 화면 대부분을 덮는 fixed 요소, 확인 시트 바탕은 제외', /cs\.position!=='fixed'/.test(g) && /r\.width>=window\.innerWidth\*0\.9&&r\.height>=window\.innerHeight\*0\.85/.test(g) && /classList\.contains\('rds-sheet-dim'\)\)return false;/.test(g));
t.ok('dim이 시트 옆에 따로 있는 창(빠르게 담기)도 확인', /dirtyIn\(bd\.nextElementSibling\)\|\|dirtyIn\(bd\.previousElementSibling\)/.test(g));
t.ok('안에서 끌다가 바탕에서 뗀 click은 무시', /if\(downEl&&downEl!==bd&&bd\.contains&&bd\.contains\(downEl\)\)\{ stop\(e\); return; \}/.test(g));
t.ok('공용 시트로 묻기: 계속 쓰기(입력칸으로) / 닫기(원래 닫기 처리 재실행)', /rdsActionSheet\(\{ title:'작성 중인 내용이 있어요'/.test(g) && /bypass=bd;[\s\S]{0,200}bd\.dispatchEvent\(new MouseEvent\('mousedown'[\s\S]{0,120}bd\.dispatchEvent\(new MouseEvent\('click'/.test(g));
t.ok('닫기·Esc 버튼 등 바탕 아닌 곳은 그대로(바탕일 때만 개입)', /if\(!isBackdrop\(bd\)\)return;/.test(g));
t.ok('고르는 칸(날짜·시간·선택·체크)을 바꿔도 쓴 내용으로 봄', /window\.addEventListener\('change',function\(e\)\{ var el=e\.target; if\(pickable\(el\)\)\{ el\._rdsTyped=val\(el\); el\._rdsPicked=true; \} \},true\);/.test(g) && /\^\(date\|time\|datetime-local\|month\|week\|number\|checkbox\|radio\)\$/.test(g));
t.done();
