'use strict';
/* 복구 센터(UI): 흩어져 있던 '올리기/가져오기'와 콘솔 전용 복구 도구를 폰에서 쓸 수 있는
   한 모달로 모은다. ① 소스 스캔(할일·반복이 어디 남았나) → 가장 많은 곳에서 없는 것만 병합
   복원(dryRun 확인 후), ② 이전 버전으로 되돌리기(스냅샷 UI 연결), ③ 클라우드 백업
   가져오기(fbForcePull)/올리기(fbForceSync, 덮어쓰기 경고). 설정 데이터 관리에 대문 버튼. */
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('복구 센터(UI)');

t.ok('returnRecoveryCenterUI 정의+노출', /async function returnRecoveryCenterUI\(\)\{/.test(html) && /window\.returnRecoveryCenterUI=returnRecoveryCenterUI;/.test(html));
t.ok('설정 데이터 관리 대문 버튼', /onclick="returnRecoveryCenterUI\(\)"/.test(html));

// ① 소스 스캔
t.ok('소스 스캔 호출(returnRecoveryScan)', /var scan=await returnRecoveryScan\(\{\}\);/.test(html));
t.ok('4개 소스 순서 표시', /var order=\['memory','idbOverflow','archive','cloud'\];/.test(html));
t.ok('현재보다 많은 소스에만 되살리기 버튼', /var canRestore=\(s!=='memory' && typeof n==='number' && n>cur\);/.test(html));
t.ok('되살리기: dryRun 미리보기 후 확인', /returnRecoveryRestore\(s,\{dryRun:true\}\)\.then\(function\(dry\)\{[\s\S]*?openConfirmDialog\('사라진 기록 되살리기'/.test(html));
t.ok('확인 시 실제 복원', /returnRecoveryRestore\(s\)\.then\(function\(\)\{ ov\.remove\(\); returnRecoveryCenterUI\(\); \}\)/.test(html));

// ② 버전
t.ok('버전 기록 UI 연결', /ov\.querySelector\('#rc-version'\)\.addEventListener\('click',function\(\)\{ ov\.remove\(\); returnVersionOpenUI\(\); \}\)/.test(html));

// ③ 백업(가져오기/올리기) — 로그인 게이트 + 덮어쓰기 경고
t.ok('로그인 여부 게이트', /var loggedIn=\(typeof fbUser!=='undefined'&&fbUser&&typeof fbDb!=='undefined'&&fbDb\);/.test(html));
t.ok('가져오기 = fbForcePull', /if\(pullBtn\)pullBtn\.addEventListener\('click',function\(\)\{ if\(typeof fbForcePull==='function'\)fbForcePull\(\); \}\)/.test(html));
t.ok('올리기 = fbForceSync + 덮어쓰기 경고', /openConfirmDialog\('이 기기 내용을 클라우드에 올리기'[\s\S]*?fbForceSync\(\)/.test(html));
t.ok('로그아웃 시 로그인 안내(올리기/가져오기 숨김)', /클라우드 백업을 쓰려면 먼저 <b>설정 → 동기화·연동 → Firebase<\/b>/.test(html));

// 쉬운 말 라벨
t.ok('소스 라벨 사람 말로', /memory:'지금 이 기기\(화면\)'[\s\S]*?idbOverflow:'이 기기 숨은 저장소'[\s\S]*?cloud:'클라우드\(다른 기기 포함\)'/.test(html));

t.done();
