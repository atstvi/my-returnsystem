'use strict';
/* PC 위젯 앱(Tauri)을 없애고, 작업대만 앱이 직접 띄우는 창으로 남긴다.
   계약: 위젯 설정 패널·widget_prefs_v1 동기화·위젯으로 보내기(widget_workstation_v1) 제거,
   작업대 버튼 → Document PiP / 팝업 / (휴대폰) 앱 안 타이머. 단, 이름에 widget이 붙어 있어도
   기기 간 공용인 집중 세션 로그(widget_focus_sessions)·실시간 타이머(widget_timer_state_v1)는 유지. */
const fs = require('fs');
const path = require('path');
const { readIndex, runner } = require('./lib');
const html = readIndex();
const root = path.resolve(__dirname, '..');
const t = runner('작업대 창(위젯 앱 제거)');

// 1) 위젯 앱·설정 제거
t.ok('widget/ 폴더 없음', !fs.existsSync(path.join(root, 'widget')));
t.ok('위젯 빌드/릴리스 워크플로 없음', !fs.existsSync(path.join(root, '.github/workflows/widget-build.yml')) && !fs.existsSync(path.join(root, '.github/workflows/widget-release.yml')));
t.ok('설정 › 위젯 탭·패널 없음', html.indexOf('data-panel="widget"') < 0 && html.indexOf('id="panel-widget"') < 0);
t.ok('위젯 설정 함수 없음', !/function (loadWidgetPrefs|renderWidgetPanel|_wpUpdate)\(/.test(html));
t.ok('widget_prefs_v1 클라우드 동기화 키 제거', html.indexOf("'widget_prefs_v1'") < 0);
t.ok('위젯으로 보내기(widget_workstation_v1) 제거', html.indexOf('widget_workstation_v1') < 0);
t.ok("위젯 clientId 분기 제거", html.indexOf("indexOf('widget_')===0") < 0);

// 2) 기기 간 공용 경로는 유지
t.ok('집중 세션 기기 간 동기화 유지', /function pullWidgetFocusSessions\(/.test(html) && html.indexOf("collection('widget_focus_sessions')") > 0);
t.ok('실시간 타이머 기기 간 동기화 유지', /function syncWidgetTimerState\(/.test(html) && /function focusTimerApplyWidgetState\(/.test(html));
t.ok('남은 빠른 입력 큐는 부팅 때 한 번 회수', /try\{ pullWidgetCaptureQueue\(ref\); \}catch\(_e\)\{\}/.test(html));

// 3) 작업대 창
{
  const i = html.indexOf('function openTaskWorkstation(');
  const seg = html.slice(i, i + 1400);
  t.ok('openTaskWorkstation 존재', i > 0);
  t.ok('Document Picture-in-Picture 우선', /documentPictureInPicture\.requestWindow\(/.test(seg));
  t.ok('PiP 실패 시 팝업으로', /\.catch\(function\(\)\{ _wsPopOpenPopup\(t\); \}\)/.test(seg));
  t.ok('휴대폰은 앱 안 타이머', /pointer:coarse[\s\S]{0,120}_wsOpenInApp\(t\)/.test(seg));
  t.ok('이미 열려 있으면 그 창을 이 할일로', /_wsPop\.win&&!_wsPop\.win\.closed/.test(seg));
  t.ok('팝업 차단 시 앱 안으로', /if\(!w\)\{ _wsOpenInApp\(t\); return; \}/.test(html));
  t.ok('창 닫힘(pagehide) 정리', /w\.addEventListener\('pagehide',_wsPopClosed\)/.test(html));
  t.ok('메모는 할일 note에 저장(디바운스+blur)', /t\.note=ta\.value; t\.updatedAt=Date\.now\(\); _wsPopSaveTasks\(\);/.test(html));
  t.ok('저장은 saveTaskData 경유', /function _wsPopSaveTasks\(\)\{\s*if\(typeof saveTaskData==='function'\)saveTaskData\(\);/.test(html));
  t.ok('타이머 상태 바뀌면 창도 갱신', /function renderFocusTimerMini\(\)\{\s*try\{renderSidebarLive\(\);\}catch\(e\)\{\}\s*try\{ if\(_wsPop\.win\)/.test(html));
  t.ok('할일 편집창 버튼 → 작업대 창', /tasksCloseModal\(\);\s*openTaskWorkstation\(_wsId\);/.test(html) && html.indexOf('title="작업대 창으로 열기') > 0);
}

t.done();
