'use strict';
/* 데스크톱 위젯: 창 표시여부/자동시작 설정이 반영되도록 고정.
   회귀: 표시여부 적용을 `if (!VIEW_MODE)`로 게이트했는데, VIEW_MODE는 기본 "habits"라
   항상 truthy → 조건이 늘 false → set_window_visible/set_autostart_enabled가 전혀
   호출되지 않아 앱 설정(showTimeline 등)이 위젯에 반영되지 않았다. 습관(메인) 창일 때
   적용해야 한다: `VIEW_MODE === "habits"`. */
const fs = require('fs');
const path = require('path');
const { runner } = require('./lib');

const app = fs.readFileSync(path.resolve(__dirname, '..', 'widget', 'src', 'app.js'), 'utf8');
const t = runner('위젯 창 표시여부 반영');

// VIEW_MODE 기본값이 "habits"(항상 truthy)임을 확인
t.ok('VIEW_MODE 기본 "habits"', /var VIEW_MODE = \(new URLSearchParams\(location\.search\)\.get\("view"\)\) \|\| "habits";/.test(app));

// 표시여부 적용 게이트가 습관 창 기준
t.ok('표시여부 적용 게이트 = VIEW_MODE === "habits"', /if \(VIEW_MODE === "habits"\) \{/.test(app));

// 예전의 항상-false 게이트가 없어야 함
t.ok('낡은 `if (!VIEW_MODE)` 게이트 제거', app.indexOf('if (!VIEW_MODE)') < 0);

// set_window_visible을 4개 창 각각에 대해 호출
t.ok('set_window_visible 호출', /tauriCore\.invoke\("set_window_visible", \{label: w\.label, visible: visible\}\)/.test(app));
t.ok('창 4종 매핑', /showTimeline[\s\S]{0,120}showWorkstation[\s\S]{0,120}showCalendar[\s\S]{0,120}showQuickinput/.test(app));
// 자동시작도 같은 블록에서
t.ok('set_autostart_enabled 호출', /tauriCore\.invoke\("set_autostart_enabled", \{enabled: p\.autostart\}\)/.test(app));

t.done();
