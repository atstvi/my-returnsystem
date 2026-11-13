'use strict';
/* 작업대 메모: 체크/목록 줄 바꾸기 · 목록 이어 쓰기(빈 항목 Enter = 끝) · 시각 넣기 ·
   사진(붙여넣기/끌어다 놓기/버튼 → task.imgs, 할일 편집 창과 같은 저장 경로). */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('작업대 메모 도구 · 사진');

function TA(value, a, b) {
  const ta = { value, selectionStart: a == null ? value.length : a, selectionEnd: b == null ? (a == null ? value.length : a) : b, id: 'wsp-note', style: {}, scrollHeight: 100,
    focus() {}, setSelectionRange(x, y) { this.selectionStart = x; this.selectionEnd = y; },
    setRangeText(text, x, y) { this.value = this.value.slice(0, x) + text + this.value.slice(y); this.selectionStart = this.selectionEnd = x + text.length; },
    ownerDocument: { execCommand: () => false } };
  return ta;
}
const ctx = { Date, String, Number, Math, _wsPop: {}, setTimeout: () => 1, clearTimeout() {}, _wsPopFlushNote() {} };
vm.createContext(ctx);
vm.runInContext(sliceBlock(html, 'function _wsNoteDirty(){', '\n/* 사진 넣기'), ctx);
const key = (ta) => { let prevented = false; ctx._wsNoteKey({ target: ta, key: 'Enter', preventDefault() { prevented = true; } }); return prevented; };

{ const ta = TA('할 것'); ctx._wsNoteToggleLines(ta, 'check'); t.ok('체크: 줄 앞에 "- [ ] "', ta.value === '- [ ] 할 것'); ctx._wsNoteToggleLines(ta, 'check'); t.ok('다시 누르면 뗌', ta.value === '할 것'); }
{ const ta = TA('a\nb', 0, 3); ctx._wsNoteToggleLines(ta, 'list'); t.ok('여러 줄 선택 → 줄마다 "- "', ta.value === '- a\n- b'); ctx._wsNoteToggleLines(ta, 'check'); t.ok('목록 → 체크로 바꾸기', ta.value === '- [ ] a\n- [ ] b'); }
{ const ta = TA('- [ ] a'); t.ok('체크 줄 Enter → 다음 줄도 체크', key(ta) && ta.value === '- [ ] a\n- [ ] '); key(ta); t.ok('빈 항목 Enter → 목록 끝(커서는 빈 줄)', ta.value === '- [ ] a\n' && ta.selectionStart === 8); }
{ const ta = TA('- [x] 끝냄'); key(ta); t.ok('완료 체크 줄에서도 새 줄은 빈 체크', ta.value === '- [x] 끝냄\n- [ ] '); }
{ const ta = TA('1. 자료'); key(ta); t.ok('번호 목록은 다음 번호', ta.value === '1. 자료\n2. '); }
{ const ta = TA('  - 들여쓴 항목'); key(ta); t.ok('들여쓰기 유지', ta.value === '  - 들여쓴 항목\n  - '); }
{ const ta = TA('그냥 문장'); t.ok('목록 아닌 줄은 기본 Enter', key(ta) === false && ta.value === '그냥 문장'); }
{ const ta = TA('회의'); ctx._wsNoteTime(ta); t.ok('시각 넣기(글자 뒤면 한 칸 띄움)', /^회의 \d\d:\d\d $/.test(ta.value)); const tb = TA(''); ctx._wsNoteTime(tb); t.ok('빈 줄이면 바로', /^\d\d:\d\d $/.test(tb.value)); }

/* 배선 */
t.ok('메모 도구: 체크·목록·시각·사진(누를 때 입력 커서 유지)', /data-ws="ncheck"[^>]*onmousedown="event\.preventDefault\(\)"/.test(html) && /data-ws="nlist"/.test(html) && /data-ws="ntime"/.test(html) && /data-ws="nimg"/.test(html));
t.ok('사진: 붙여넣기 · 끌어다 놓기 · 파일 선택 → 같은 경로', /ta\.addEventListener\('paste',function\(e\)\{ var fs=_wsImageFiles\(e\.clipboardData&&e\.clipboardData\.items\);/.test(html) && /wrap\.addEventListener\('drop'/.test(html) && /fi\.addEventListener\('change'/.test(html));
t.ok('사진은 압축 → MediaStore → task.imgs(편집 창과 공용)', /MediaStore\.put\(dataUrl,\{role:'task-note',type:file\.type\}\)/.test(html) && /lt\.imgs\.push\(ref\); lt\.updatedAt=Date\.now\(\); _wsPopSaveTasks\(\);/.test(html));
t.ok('PC 창 · 앱 안 창 둘 다 같은 바인딩', (html.match(/_wsBindNote\((document|d)\);/g) || []).length === 2);
t.ok('사진 크게 보기는 작업대 창 안에서(PiP에서도 보이게)', /function _wsImgLightbox\(ref\)\{\s*var w=_wsPop\.win;[\s\S]{0,120}var d=w\.document;/.test(html));
t.done();
