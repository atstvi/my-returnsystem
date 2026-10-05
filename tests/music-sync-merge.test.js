'use strict';
/* 음악 라이브러리(music_playlists_v1 = {songs,playlists}) 크로스기기 union-merge.
   버그: fbApplyData(인바운드)에만 병합이 있고 fbSaveAll absorb(아웃바운드)엔 없어,
   저장 푸시의 콜드리드에서 스테일 클라우드가 방금 추가한 노래/플레이리스트를 덮어
   '저장 안 됨'처럼 보였다. 또 인바운드 병합은 '새 항목'만 지키고 '편집'은 안 지켰다.
   수정: 양쪽에 id 기준 per-item LWW(updatedAt) + baseline/세션 이후 로컬 전용 보존. */
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('음악 라이브러리 union-merge(저장 유실 방지)');

// 두 경로(인바운드 fbApplyData + 아웃바운드 fbSaveAll)에 음악 병합이 있다
var cnt = (html.match(/if\(k==='music_playlists_v1'\)\{/g) || []).length;
t.ok('music 병합이 두 경로(apply+save)에 있음', cnt===2, cnt);

// LWW 배선(인바운드/아웃바운드 공통): 로컬 updatedAt이 더 최신이면 유지
t.ok('인바운드 LWW(노래)', /_mSongsLww=_mCloud\.songs\.map\([\s\S]*?Number\(ls\.updatedAt\|\|ls\.createdAt\|\|0\)>Number\(cs\.updatedAt\|\|cs\.createdAt\|\|0\)/.test(html));
t.ok('아웃바운드 LWW(노래)', /_mcSongsLww=_mcCloud\.songs\.map\([\s\S]*?Number\(ls\.updatedAt\|\|ls\.createdAt\|\|0\)>Number\(cs\.updatedAt\|\|cs\.createdAt\|\|0\)/.test(html));
t.ok('아웃바운드 로컬 전용 보존(baseline)', /_mcSongsOnly=_mcOurs\.songs\.filter\([\s\S]*?Number\(s\.createdAt\|\|0\)>localApplyBaseline/.test(html));

// ── 병합 로직 단위 재현(인바운드 shape) ──
function merge(cloud, local, sessionLoadMs){
  var cloudSongIds={}, cloudPlIds={};
  cloud.songs.forEach(function(s){cloudSongIds[String(s.id)]=1;});
  cloud.playlists.forEach(function(p){cloudPlIds[String(p.id)]=1;});
  var localSongById={}; local.songs.forEach(function(s){localSongById[String(s.id)]=s;});
  var localPlById={}; local.playlists.forEach(function(p){localPlById[String(p.id)]=p;});
  var songsLww=cloud.songs.map(function(cs){var ls=localSongById[String(cs.id)];return (ls&&Number(ls.updatedAt||ls.createdAt||0)>Number(cs.updatedAt||cs.createdAt||0))?ls:cs;});
  var plsLww=cloud.playlists.map(function(cp){var lp=localPlById[String(cp.id)];return (lp&&Number(lp.updatedAt||lp.createdAt||0)>Number(cp.updatedAt||cp.createdAt||0))?lp:cp;});
  var songsOnly=local.songs.filter(function(s){return !cloudSongIds[String(s.id)]&&Number(s.createdAt||0)>sessionLoadMs;});
  var plsOnly=local.playlists.filter(function(p){return !cloudPlIds[String(p.id)]&&Number(p.createdAt||0)>sessionLoadMs;});
  return { songs:songsLww.concat(songsOnly), playlists:plsLww.concat(plsOnly) };
}

// 새로 추가한 노래/리스트가 스테일(빈) 클라우드에 안 덮인다
var m1=merge({songs:[],playlists:[]}, {songs:[{id:'s1',createdAt:2000}],playlists:[{id:'p1',createdAt:2000}]}, 100);
t.ok('새 노래 보존', m1.songs.some(function(s){return s.id==='s1';}), JSON.stringify(m1.songs));
t.ok('새 플레이리스트 보존', m1.playlists.some(function(p){return p.id==='p1';}));

// 편집한 노래(최신 updatedAt)가 옛 클라우드본을 이긴다
var m2=merge({songs:[{id:'s1',title:'옛',updatedAt:1000}],playlists:[]}, {songs:[{id:'s1',title:'수정',updatedAt:2000}],playlists:[]}, 50);
t.ok('편집 노래 LWW 유지', m2.songs[0].title==='수정', JSON.stringify(m2.songs));

// 클라우드가 더 최신이면 클라우드 채택
var m3=merge({songs:[{id:'s1',title:'클라우드',updatedAt:3000}],playlists:[]}, {songs:[{id:'s1',title:'옛로컬',updatedAt:1000}],playlists:[]}, 50);
t.ok('클라우드가 최신이면 채택', m3.songs[0].title==='클라우드');

// 세션 이전에 만든 로컬 전용(이미 삭제됐을 수 있는)은 되살리지 않는다
var m4=merge({songs:[],playlists:[]}, {songs:[{id:'old',createdAt:10}],playlists:[]}, 100);
t.ok('세션 이전 로컬 전용은 안 되살림', m4.songs.length===0, JSON.stringify(m4.songs));

t.done();
