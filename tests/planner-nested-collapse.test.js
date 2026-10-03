'use strict';
/* 계획창(1일) 종일 줄도 목록처럼 상·하위 할일을 다룬다:
   (1) 하위 할일(parentId)은 개별로 안 보이고 상위 할일 하나로 묶인다.
   (2) 그날 하위를 가진 (최상위) 상위 할일은 자기 날짜가 달라도 그날 종일 줄에 나타난다
       — '그날로 지정된 하위할일'을 대표.
   (3) 그날 하위를 다 끝냈으면 그 상위 칩을 '그날 완료'(✓·취소선)로 표시(_dayQuotaDone). */
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('계획창: 종일 줄 상·하위 처리');

// (1) 하위 제외 + (2) 그날 하위 가진 상위 추가
t.ok('종일 base가 하위(nested) 제외',
  /var _adBase=dayTasks\.filter\(function\(t\)\{return t&&!t\._travelOnly && _untimed\(t\) && !_isSchedLike\(t\) && !_nested\(t\);\}\);/.test(html));
t.ok('그날 하위 가진 상위를 종일 줄에 추가',
  /var _adParents=\(typeof tasks!=='undefined'\?tasks:\[\]\)\.filter\(function\(p\)\{[\s\S]*?var kids=\(typeof taskChildren==='function'\)\?taskChildren\(p\.id\):\[\];\s*return kids\.some\(function\(k\)\{return k&&k\.date===_planDate;\}\);\s*\}\);/.test(html));
t.ok('_adUntimed = base + 상위',
  /var _adUntimed=_adBase\.concat\(_adParents\);/.test(html));

// (3) 그날 완료 표시(✓ + done 클래스)
t.ok('종일 칩 그날완료 판정(taskDayQuotaDone/taskEffectiveDone)',
  /var _dqDone=\(typeof taskDayQuotaDone==='function'&&taskDayQuotaDone\(t,_planDate\)\)\|\|\(typeof taskEffectiveDone==='function'&&taskEffectiveDone\(t\)\);/.test(html));
t.ok('종일 칩 done 클래스 + ✓ 접두',
  /c\.className='plan-allday-chip untimed'\+\(_dqDone\?' done':''\);[\s\S]*?sp\.textContent=\(_dqDone\?'✓ ':'○ '\)\+\(t\.text\|\|'할일'\);/.test(html));

// _adSched도 nested 제외(하위는 어디서도 개별로 안 보임)
t.ok('_adSched도 nested 제외',
  /var _adSched=dayTasks\.filter\(function\(t\)\{return _untimed\(t\) && _isSchedLike\(t\) && !_nested\(t\);\}\);/.test(html));

// CSS
t.ok('종일 done 칩 CSS(취소선)', /\.plan-allday-chip\.done\{opacity:\.55;text-decoration:line-through\}/.test(html));

t.done();
