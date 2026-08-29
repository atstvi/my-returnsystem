'use strict';
/* 지표 추가가 Firebase 동기화를 큐잉하도록 고정.

   회귀 배경: 지표 추가 함수가 metrics를 push한 뒤 localStorage.setItem으로 직접 저장해
   setReturnStorageItem의 _afterWriteSideEffects(Firebase 저장 큐)를 우회했다. 그러면
   새 지표가 다른 기기로 안 올라가고, metrics_v1은 fbApplyData에서 union-merge가 아닌
   기본 덮어쓰기 키라 원격 스냅샷이 도착하면 되돌려질 수 있었다(같은 롤백 클래스). */
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('지표 추가 동기화');

// metrics.push(metric) 직후 저장이 setReturnStorageItem을 거쳐야 한다.
const i = html.indexOf('metrics.push(metric);');
const seg = i >= 0 ? html.slice(i, i + 400) : '';
t.ok('지표 추가 지점 존재', i >= 0);
t.ok('metrics_v1 저장이 setReturnStorageItem 경유',
  /setReturnStorageItem\('metrics_v1', JSON\.stringify\(metrics\)\)/.test(seg), seg.slice(0, 200));
t.ok('metrics_v1 직접 localStorage.setItem 우회 없음',
  seg.indexOf("localStorage.setItem('metrics_v1'") < 0, seg.slice(0, 200));

t.done();
