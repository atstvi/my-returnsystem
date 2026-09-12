'use strict';
/* 되돌리기(UNDO): 사용자 제스처(터치·클릭·키) 직후 일어나는 데이터 키 쓰기를 하나의
   '동작'으로 묶어 그 직전 값을 스택에 담고, Ctrl/⌘+Z 또는 되돌리기 토스트 버튼으로 방금
   동작을 직전 값으로 복원한다. 부팅·동기화·마이그레이션 같은 프로그램 쓰기(최근 제스처
   없음)는 담기지 않아 예기치 않은 되돌리기를 막고, 복원 중 재적재가 만드는 잔여 캡처는
   폐기한다. 복원은 setReturnStorageItem 경로만 사용(직접 localStorage.setItem 아님). */
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('되돌리기(UNDO)');

// ── 상수/상태 ──
t.ok('되돌리기 키셋은 스냅샷 키셋 재사용', /var RETURN_UNDO_KEYS=RETURN_SNAPSHOT_KEYS;/.test(html));
t.ok('스택 한도/그룹 코얼레싱/제스처 창', /var RETURN_UNDO_MAX=25, RETURN_UNDO_GROUP_MS=450, RETURN_UNDO_GESTURE_WINDOW=6000;/.test(html));
t.ok('스택/복원플래그/펜딩 상태', /var _undoStack=\[\], _undoRestoring=false, _undoPending=null, _undoGroupTimer=null, _lastUserGestureMs=0;/.test(html));

// ── 캡처 게이트 ──
t.ok('복원 중엔 캡처 금지', /function _undoCapture\(key\)\{\s*if\(_undoRestoring\)return;/.test(html));
t.ok('클라우드 적용은 캡처 금지', /if\(window\._applyingFbData\)return;/.test(html));
t.ok('settle 전엔 캡처 금지', /if\(typeof _idbInitSettled!=='undefined'&&!_idbInitSettled\)return;/.test(html));
t.ok('최근 제스처 없으면 캡처 금지(부팅/reconcile)', /if\(Date\.now\(\)-_lastUserGestureMs>RETURN_UNDO_GESTURE_WINDOW\)return;/.test(html));
t.ok('동작 시작 직전값만(첫 캡처) 보존', /if\(!Object\.prototype\.hasOwnProperty\.call\(_undoPending\.changes,key\)\)\{ _undoPending\.changes\[key\]=prev; _undoPending\.keys\.push\(key\); \}/.test(html));

// ── 그룹 flush ──
t.ok('그룹 flush 시 스택 push + 한도 유지', /_undoStack\.push\(grp\);\s*if\(_undoStack\.length>RETURN_UNDO_MAX\)_undoStack\.shift\(\);/.test(html));
t.ok('그룹 flush 시 되돌리기 토스트', /_undoFlushGroup\(\)\{[\s\S]*?_showUndoToast\(grp\.label\)/.test(html));

// ── 복원(returnUndoLast) ──
t.ok('returnUndoLast 정의+노출', /function returnUndoLast\(\)\{/.test(html) && /window\.returnUndoLast=returnUndoLast;/.test(html));
t.ok('빈 스택이면 false', /if\(!_undoStack\.length\)\{[\s\S]*?return false;/.test(html));
t.ok('마지막 동작을 즉시 되돌릴 수 있게 flush', /if\(_undoPending\)\{ _undoFlushGroup\(\); \}/.test(html));
t.ok('복원은 setReturnStorageItem(직전값 또는 빈값)', /setReturnStorageItem\(k, \(prev==null\)\?_undoEmptyFor\(k\):prev\);/.test(html));
t.ok('복원 후 메모리 재적재', /try\{ returnReloadMemoryFromStorage\(\); \}catch\(e\)\{\}\s*\}finally\{ _undoRestoring=false; \}/.test(html));
t.ok('복원이 만든 잔여 캡처 폐기', /_undoPending=null; clearTimeout\(_undoGroupTimer\); _undoGroupTimer=null; \/\* 복원이 만든 잔여 캡처 폐기/.test(html));

// ── 재적재 중 캡처 억제(팬텀 방지) ──
t.ok('returnReloadMemoryFromStorage가 복원 중 캡처 억제', /var _prevUR=\(typeof _undoRestoring!=='undefined'\)\?_undoRestoring:false; try\{ _undoRestoring=true; \}/.test(html));
t.ok('재적재 끝에 복원플래그 복구', /\}finally\{ try\{ _undoRestoring=_prevUR; \}catch\(_e\)\{\} \}/.test(html));

// ── 입력 트리거 ──
t.ok('setReturnStorageItem이 쓰기 직전 캡처 호출', /if\(typeof _undoCapture==='function'\)_undoCapture\(key\);/.test(html));
t.ok('제스처 리스너(pointerdown/keydown)', /addEventListener\('pointerdown', function\(\)\{ _lastUserGestureMs=Date\.now\(\); \}, true\)/.test(html));
t.ok('Ctrl/⌘+Z 단축키 + 입력 중 제외', /if\(mod && !e\.shiftKey && !e\.altKey && \(e\.key==='z'\|\|e\.key==='Z'[\s\S]*?tag==='input'\|\|tag==='textarea'\|\|\(t&&t\.isContentEditable\)\)return;/.test(html));

t.done();
