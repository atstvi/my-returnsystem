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

const projectBlock = sliceBlock(html, 'var projects=[], activeProjectId=null;', '\nfunction projectEsc(');
t.ok('loadProjects dedupes projects', /loadProjects\(\)[\s\S]*returnEntityDedupeArray\(projects,\s*['"]p_['"]\)/.test(projectBlock));
t.ok('loadProjects persists deduped projects', /projects\.length<before[\s\S]*setReturnStorageItem\(['"]projects_v1['"]/.test(projectBlock));
t.ok('saveProjects dedupes projects before prepare', /saveProjects\(\)[\s\S]*projects=returnEntityDedupeArray\(projects,\s*['"]p_['"]\)[\s\S]*returnEntityPrepareForSave/.test(projectBlock));

const routineBlock = sliceBlock(html, 'var routineHabits=[], routineBundles=[]', '\nfunction routineTodayLog(');
t.ok('loadRoutineData dedupes habits', /routineHabits=returnEntityDedupeArray/.test(routineBlock));
t.ok('loadRoutineData dedupes bundles', /routineBundles=returnEntityDedupeArray/.test(routineBlock));
t.ok('loadRoutineData persists deduped habits', /routineHabits\.length<\(rawHabits\|\|\[\]\)\.length[\s\S]*setReturnStorageItem\(['"]routine_habits_v1['"]/.test(routineBlock));
t.ok('loadRoutineData persists deduped bundles', /routineBundles\.length<\(rawBundles\|\|\[\]\)\.length[\s\S]*setReturnStorageItem\(['"]routine_bundles_v1['"]/.test(routineBlock));
t.ok('loadRoutineData does not seed while applying Firebase data', /&&!window\._applyingFbData\)seedRoutineData\(\)/.test(routineBlock));
t.ok('saveRoutineData dedupes habits before prepare', /routineHabits=returnEntityDedupeArray\(routineHabits,\s*['"]rh_['"]\)/.test(routineBlock));
t.ok('saveRoutineData dedupes bundles before prepare', /routineBundles=returnEntityDedupeArray\(routineBundles,\s*['"]rb_['"]\)/.test(routineBlock));

t.done();
