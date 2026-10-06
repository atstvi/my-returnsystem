'use strict';
/* fbSaveNow 순서 안전성.
   수정 전: fbCollectData()로 로컬을 수집한 뒤 콜드 읽기(ref.collection('data').get())와
   설정 쓰기(fbSaveCloudSettings)를 await했다. 그 사이 사용자가 편집하면, 클라우드가 더
   최신인 키에 대해 '수집본 ∪ 클라우드' 병합값을 localStorage에 써서 방금 편집을 지우고
   (메모리에만 남음 → 새로고침/다음 동기화 시 유실), 클라우드에도 올리지 않았다.
   (Playwright 가짜 Firestore 재현: 편집 3003 → localStorage·푸시 모두 누락 / 수정 후 유지)
   계약: 마지막 await 이후, 동기 구간인 충돌 해결 직전에 다시 수집한다. */
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('저장 파이프라인 순서(await 중 편집 보존)');

const start = html.indexOf('async function fbSaveNow(opts){');
const end = html.indexOf('\n}', html.indexOf('_fbSaveNowBusy=false;\n  }', start));
const body = html.slice(start, end);
t.ok('fbSaveNow 본문 찾음', start > 0 && end > start);

const iSettings = body.indexOf('await fbSaveCloudSettings(ref)');
const iRecollect = body.indexOf('data=fbCollectData();', iSettings);
const iConflict = body.indexOf('/* Conflict resolution. */');
const iFirstWriteAwait = body.indexOf('await batch.commit()');
t.ok('설정 쓰기 await 뒤에 재수집', iSettings > 0 && iRecollect > iSettings, [iSettings, iRecollect]);
t.ok('재수집은 충돌 해결(absorb) 직전', iRecollect > 0 && iRecollect < iConflict);
/* 재수집 ~ absorb 루프(커밋 전) 사이에 await가 없어야 끼어들 틈이 없다 */
const between = body.slice(iRecollect, body.indexOf('var batch=fbDb.batch()', iRecollect));
t.ok('재수집 ~ absorb 끝까지 await 없음(동기 구간)', !/\bawait\b/.test(between));
t.ok('재수집 뒤 빈 로컬 덮어쓰기 보호 재검사', /data=fbCollectData\(\);\s*if\(window\.SyncManager&&!SyncManager\.protectCloudOverwrite\(data,cloudByKey,opts\)\)/.test(body));
t.ok('커밋 await는 그 뒤에만', iFirstWriteAwait > iRecollect);

/* 실패 후 자동 재시도: 예전엔 실패한 저장이 재시도를 예약하지 않아, 다음 편집이 없으면
   로컬 변경이 클라우드에 영영 안 올라갔다. catch에서 백오프 끝(최소 30초)에 1회 예약. */
const iCatch = body.lastIndexOf('}catch(e){');
const catchBody = body.slice(iCatch);
t.ok('실패 경로가 재시도 예약', /window\._fbBackoffRetryTimer=setTimeout\(function\(\)\{\s*window\._fbBackoffRetryTimer=null;\s*try\{ if\(typeof fbSaveAll==='function'\)fbSaveAll\(\); \}catch\(_e\)\{\}\s*\}, _retryIn\);/.test(catchBody));
t.ok('재시도는 백오프 끝 이후(최소 30초)·중복 예약 없음', /if\(!window\._fbBackoffRetryTimer\)\{\s*var _retryIn=Math\.max\(30000, \(_fbQuotaBackoffUntil\|\|0\)-Date\.now\(\)\+500\);/.test(catchBody));
t.done();
