'use strict';
/* Projects and routines are user-owned entity arrays. Duplicate legacy rows can
   be produced by repeated cross-device blob merges or by default routine seeding
   racing remote hydration, so load/save paths must collapse duplicate id/_eid
   entries before rendering or writing them back. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const t = runner('Project + routine dedupe regressions');

const helperBlock = sliceBlock(html, 'var RETURN_SYNC_MODEL=', '\nfunction returnEntityStampChanged(');
const sb = {
  localStorage: { getItem: () => null },
  timetableTaskHash: (s) => String(s.length),
  RETURN_SCHEMA_VERSION: 6,
  window: {},
};
vm.createContext(sb);
vm.runInContext(helperBlock, sb);

const deduped = sb.returnEntityDedupeArray([
  { id: 'project_1', title: 'old', updatedAt: 10 },
  { id: 'project_1', title: 'new', updatedAt: 20 },
  { _eid: 'p_project_2', id: 'project_2', title: 'same eid old', updatedAt: 30 },
  { _eid: 'p_project_2', id: 'project_2', title: 'same eid newer', updatedAt: 40 },
  { id: 'project_3', title: 'unique', updatedAt: 5 },
], 'p_');
t.ok('dedupe keeps one row per id/_eid', deduped.length === 3, deduped);
t.ok('dedupe keeps newest legacy-id project', deduped[0].title === 'new', deduped[0]);
t.ok('dedupe keeps newest _eid project', deduped[1].title === 'same eid newer', deduped[1]);

const semanticProjects = sb.returnEntityDedupeArray([
  { id: 'project_a', title: 'return 개발', status: 'active', deadline: '2026-05-15', resources: [{ id: 'r1', title: 'old' }], updatedAt: 10 },
  { id: 'project_b', title: 'return 개발', status: 'active', deadline: '2026-05-15', resources: [{ id: 'r2', title: 'new' }], updatedAt: 20 },
  { id: 'project_c', title: '노션 템플릿 판매', status: 'active', deadline: '2026-05-20', updatedAt: 5 },
], 'p_');
t.ok('dedupe collapses same project even when legacy ids differ', semanticProjects.length === 2, semanticProjects);
t.ok('dedupe keeps merged project resources', (semanticProjects[0].resources || []).length === 2, semanticProjects[0]);

const semanticHabits = sb.returnEntityDedupeArray([
  { id: 'rh_a', title: '물 마시기', icon: '💧', mini: '한 모금', plus: '한 컵', max: '두 컵', updatedAt: 10 },
  { id: 'rh_b', title: '물 마시기', icon: '💧', mini: '한 모금', plus: '한 컵', max: '두 컵', updatedAt: 20 },
], 'rh_');
t.ok('dedupe collapses same routine habit even when ids differ', semanticHabits.length === 1, semanticHabits);

const semanticBundles = sb.returnEntityDedupeArray([
  { id: 'rb_a', title: '모닝 루틴', icon: '☀️', slot: '눈뜨자마자', habitIds: ['rh_a'], updatedAt: 10 },
  { id: 'rb_b', title: '모닝 루틴', icon: '☀️', slot: '눈뜨자마자', habitIds: ['rh_b', 'rh_c'], updatedAt: 20 },
  { id: 'rb_c', title: '저녁 루틴', icon: '🌙', slot: '자기 전', habitIds: ['rh_d'], updatedAt: 30 },
], 'rb_');
t.ok('dedupe collapses same routine bundle even when ids differ', semanticBundles.length === 2, semanticBundles);
t.ok('dedupe preserves all bundle habit links while collapsing', semanticBundles[0].habitIds.length === 3, semanticBundles[0]);

const projectBlock = sliceBlock(html, 'var projects=[], activeProjectId=null;', '\nfunction projectEsc(');
t.ok('loadProjects dedupes projects', /loadProjects\(\)[\s\S]*returnEntityDedupeArray\(projects,\s*['"]p_['"]\)/.test(projectBlock));
t.ok('loadProjects persists deduped projects', /projects\.length<before[\s\S]*setReturnStorageItem\(['"]projects_v1['"]/.test(projectBlock));
t.ok('saveProjects dedupes projects before prepare', /saveProjects\(\)[\s\S]*projects=returnEntityDedupeArray\(projects,\s*['"]p_['"]\)[\s\S]*returnEntityPrepareForSave/.test(projectBlock));

const routineBlock = sliceBlock(html, 'var routineHabits=[], routineBundles=[]', '\nfunction routineTodayLog(');
t.ok('loadRoutineData dedupes habits', /routineHabits=returnEntityDedupeArray/.test(routineBlock));
t.ok('loadRoutineData dedupes bundles', /routineBundles=returnEntityDedupeArray/.test(routineBlock));
t.ok('routine bundles remap duplicate habit ids to canonical ids', /routineHabitAliasMap/.test(routineBlock) && /routineApplyHabitAliases/.test(routineBlock));
t.ok('loadRoutineData persists cleaned habits by JSON diff', /nextHabitJson&&nextHabitJson!==rawHabitJson[\s\S]*setReturnStorageItem\(['"]routine_habits_v1['"]/.test(routineBlock));
t.ok('loadRoutineData persists cleaned bundles by JSON diff', /nextBundleJson&&nextBundleJson!==rawBundleJson[\s\S]*setReturnStorageItem\(['"]routine_bundles_v1['"]/.test(routineBlock));
t.ok('loadRoutineData does not seed while applying Firebase data', /&&!window\._applyingFbData\)seedRoutineData\(\)/.test(routineBlock));
t.ok('saveRoutineData dedupes habits before prepare', /routineHabits=returnEntityDedupeArray\(routineHabits,\s*['"]rh_['"]\)/.test(routineBlock));
t.ok('saveRoutineData dedupes bundles before prepare', /routineBundles=returnEntityDedupeArray\(routineBundles,\s*['"]rb_['"]\)/.test(routineBlock));

t.done();
