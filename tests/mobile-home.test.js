'use strict';
/* 모바일 리디자인 ④: 나(홈) 화면 — 목업의 컴팩트한 인사 카드에 맞추기(레이아웃만).
   회귀 배경: '오늘 상황' 카드는 배너 위에 얹히는데(sit-on-banner, 절대배치), 배너가
   비었을 때 데스크톱용 min-height:300px 때문에 모바일에서 100px 넘는 빈 공간이 남았다.
   배너 이미지가 없을 때만(.has-image 아님) 모바일에서: 배경 그라데이션을 절대배치로
   돌리고 상황 카드를 in-flow(static)로 만들어 배너가 콘텐츠 높이에 맞게 한다. 배너
   이미지가 있으면 그대로 유지되고, 데스크톱은 무변경(@media ≤639px). */
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('모바일 홈 화면');

// 데스크톱 원본 규칙은 그대로 존재(회귀 방지 기준선)
t.ok('데스크톱: has-sit min-height:300px 유지', /\.home-banner\.has-sit\{height:auto;min-height:300px;pointer-events:auto\}/.test(html));
t.ok('상황 카드는 배너 위 절대배치(원본)', /\.home-banner \.sit-card\.sit-on-banner\{\s*position:absolute;inset:0;/.test(html));

// 모바일: 빈 배너일 때만 콘텐츠 높이로
t.ok('모바일 빈 배너 min-height 해제', /\.home-banner\.has-sit:not\(\.has-image\)\{ min-height:0; height:auto; \}/.test(html));
t.ok('배경 그라데이션 절대배치로', /\.home-banner\.has-sit:not\(\.has-image\) \.banner-bg\{ position:absolute; inset:0; \}/.test(html));
t.ok('상황 카드 in-flow(static)로', /\.home-banner\.has-sit:not\(\.has-image\) \.sit-card\.sit-on-banner\{ position:static; inset:auto;/.test(html));

// 배너 이미지가 있으면 건드리지 않음(:not(.has-image)으로 스코프)
t.ok('배너 이미지 있을 땐 미적용(:not(.has-image))',
  (html.match(/\.home-banner\.has-sit:not\(\.has-image\)/g)||[]).length >= 3);

// 모바일 구간(≤639px) 안에 있는지 — 데스크톱 무변경 보장
{
  const i = html.indexOf('@media (max-width:639px) {\n  .home-content {');
  const seg = i >= 0 ? html.slice(i, i + 2600) : '';
  t.ok('모바일 홈 규칙이 ≤639px 블록 안', /\.home-banner\.has-sit:not\(\.has-image\)\{ min-height:0/.test(seg));
}

t.done();
