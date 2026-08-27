'use strict';
/* 자료 보드 안정성 고정(소스 수준).
   1) 보드 save()가 '라이브 projects 배열'에 write-through — fbApplyData의
      loadProjects()가 배열을 새 객체로 교체(orphan)해도 삭제/편집이 유실·되돌림
      되지 않게. (핵심: live.board=b; live.updatedAt=now)
   2) 이미지 해상 실패 시 무한 '불러오는 중…' 대신 실패 상태로 전환(+타임아웃).
   3) 보드 편집 직후 짧은 창 동안 원격 재렌더를 미뤄 이미지 재로딩 깜빡임 방지. */
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('자료 보드 안정성');

// 1) save() write-through
{
  const i = html.indexOf('window._pjbLastEditMs=now;');
  const seg = i >= 0 ? html.slice(i, i + 1100) : '';
  t.ok('save에서 편집 시각 기록', i >= 0);
  t.ok('라이브 배열의 같은 id 프로젝트 찾음', seg.indexOf('var live=projects.find(function(p){return p&&String(p.id)===String(project.id);});') >= 0);
  t.ok('라이브에 board·updatedAt write-through', /live\.board=b;\s*live\.updatedAt=now;/.test(seg));
  t.ok('배열에 없으면 프로젝트 복구(push)', /else if\(!live\)\{ projects\.push\(project\); \}/.test(seg));
}

// 2) 이미지 해상 실패 상태
{
  const i = html.indexOf('function projectBoardResolveMedia(');
  const seg = i >= 0 ? html.slice(i, i + 1600) : '';
  t.ok('resolve 실패/빈값 → fail() 처리', /else \{ fail\(/.test(seg) && /\.catch\(function\(\)\{ clearTimeout\(to\); fail\(/.test(seg));
  t.ok('img error → fail()', /addEventListener\('error',function\(\)\{ fail\(/.test(seg));
  t.ok('해상 타임아웃(멈춤) 존재', /setTimeout\(function\(\)\{ fail\([^)]*\); \}, 12000\)/.test(seg));
  t.ok('성공 시 로딩 문구 제거', /wrap\.classList\.remove\('pjb-img-load'\)/.test(seg));
  t.ok('실패 시 pjb-img-fail 클래스', /wrap\.classList\.add\('pjb-img-fail'\)/.test(seg));
}

// 3) 편집 직후 재렌더 지연 가드
{
  t.ok('보드 편집 직후 busy 가드', /window\._pjbLastEditMs && \(Date\.now\(\)-window\._pjbLastEditMs<1500\) && typeof document\.getElementById==='function' && document\.getElementById\('pjb-root'\)/.test(html));
}

// 4) 실패 상태 CSS(깨진 img 숨김)
{
  t.ok('pjb-img-fail img 숨김 CSS', /\.pjb-img\.pjb-img-fail img\{display:none\}/.test(html));
}

t.done();
