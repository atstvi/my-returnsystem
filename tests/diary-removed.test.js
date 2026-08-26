'use strict';
/* 일기 기능 제거 고정 — 진입점·네비·알림에서 diary가 빠졌는지 확인.
   (백엔드 데이터/동기화 코드는 휴면으로 남지만 사용자 UI에서는 접근 불가.) */
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('일기 기능 제거');

// goPage가 diary를 홈으로 리다이렉트
t.ok('goPage diary→home 리다이렉트', /if \(slug === 'diary'\) slug = 'home';/.test(html));

// 사이드바 일기 탭 버튼 제거
t.ok('사이드바 tab-diary 버튼 없음', html.indexOf('id="tab-diary"') < 0);

// 포커스 네비 순서에 diary 없음
{
  const m = /var FOCUS_NAV_ORDER=\[([^\]]*)\]/.exec(html);
  t.ok('FOCUS_NAV_ORDER에 diary 없음', m && m[1].indexOf("'diary'") < 0, m && m[1]);
}

// 초기 페이지 valid 목록에 diary 없음(#diary 해시 → 홈)
{
  const m = /var valid=\['home','inbox','tasks','check'[^\]]*\]/.exec(html);
  t.ok('초기 valid 목록에 diary 없음', m && m[0].indexOf("'diary'") < 0, m && m[0]);
}

// 일기 알림 발송 루프에서 diary 제거
t.ok('알림 발송 루프에서 diary 제외', /\['routine','deadline','checkin'\]\.forEach/.test(html));

// 설정 일기 알림 토글 제거
t.ok('설정 일기 알림 토글 없음', html.indexOf('notif-toggle-diary') < 0 && html.indexOf("toggleNotifType('diary'") < 0);

// 지표·트렌드에서 일기 트래커 렌더 비활성화
t.ok('트렌드 일기 트래커 렌더 차단', /if \(false && diaryTrackers\.length\)/.test(html));

// 프로젝트 기록 섹션 라벨에서 일기 제거
t.ok('프로젝트 기록 라벨 "기록 · 체크"', html.indexOf('기록 · 체크') >= 0 && html.indexOf('기록 · 일기 · 체크') < 0);

t.done();
