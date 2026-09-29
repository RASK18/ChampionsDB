import test from 'node:test';
import assert from 'node:assert/strict';
import {readJSON,hash} from '../scripts/lib/io.mjs';
import {Claims,reconcile} from '../scripts/lib/claims.mjs';
import {reports} from '../scripts/lib/reports.mjs';
import {applyReviewed} from '../scripts/lib/reviewed.mjs';
import {loadChampout} from '../scripts/lib/champout.mjs';

const policy=await readJSON('sources/policy.json');
const snapshot={documents:{one:{provider:'champout',sha256:hash('one')},other:{provider:'opgg',sha256:hash('other')}}};
const make=()=>{const s=new Claims(snapshot);s.policy=policy;for(const [f,v] of Object.entries({identity:true,available:true,name:'Viscosecreción'}))s.add('abilities','ability-064',f,v,'one',f);return s;};
test('champout alone publishes; foreign discrepancies cannot override it',()=>{
  const s=make();s.add('abilities','ability-064','name','Lodo Líquido','other','name');
  const result=reconcile(s);assert.equal(result.data.abilities[0].name,'Viscosecreción');
  assert.equal(result.evidence['abilities/ability-064/name'].evidence.length,1);
});
test('foreign data alone cannot enter the champout publication',()=>{
  const s=make();s.claims.delete('abilities/ability-064/name');s.add('abilities','ability-064','name','Lodo Líquido','other','name');
  assert.equal(reconcile(s).data.abilities[0].name,undefined);
});
test('a missing row is not a withdrawal; an explicit champout false flag is',()=>{
  const s=make(),before={...reconcile(s),manifest:{datasetId:'old'}};
  const absent=new Claims(snapshot);absent.policy=policy;
  assert.equal(reports(absent,reconcile(absent),before).withdrawn.length,0);
  s.claims.set('abilities/ability-064/available',[]);s.add('abilities','ability-064','available',false,'one','available');
  assert.equal(reports(s,reconcile(s),before).withdrawn.length,1);
});
test('changed champout text invalidates reviewed semantics even with the single source policy',async()=>{
  const s=make();applyReviewed(s,{rules:[{id:'example',collection:'interactions',entity:'example',field:'rule',value:{},bindings:[{claim:'abilities/ability-064/name',document:'one',locator:'name',observedHash:hash('outdated')}]}]});
  assert.ok(s.extraPending.some(p=>p.reason==='review-evidence-changed'));
});
test('missing or mixed source revisions are rejected before publication',async()=>{
  await assert.rejects(loadChampout({documents:{}}),/Missing champout revision/);
  await assert.rejects(loadChampout({revisions:{champout:'one'},documents:{'champout/table':{provider:'opgg',revision:'one'}}}),/Unexpected source/);
  await assert.rejects(loadChampout({revisions:{champout:'one'},documents:{'champout/table':{provider:'champout',revision:'two'}}}),/mixed revision/);
});
test('user-reported cases preserve source names, complete descriptions and learnsets',async()=>{
  const abilities=await readJSON('data/abilities.json'),moves=await readJSON('data/moves.json'),learnsets=await readJSON('data/learnsets.json');
  assert.match(abilities.find(a=>a.id==='ability-008').description,/inmune al daño/);
  assert.equal(abilities.find(a=>a.id==='ability-064').name,'Viscosecreción');
  const drum=moves.find(m=>m.id==='move-778');assert.equal(drum.name,'Batería Asalto');assert.equal(drum.pp,12);assert.equal(drum.power.value,80);assert.equal(drum.properties.contact,false);
  assert.ok(learnsets.some(l=>l.pokemonId==='pokemon-0812000'&&l.moveId===drum.id));
  assert.equal(moves.find(m=>m.id==='move-208').target,'user-or-ally');
  assert.equal(moves.find(m=>m.id==='move-014').target,'user');
  assert.equal(moves.find(m=>m.id==='move-446').target,'opponents-field');
  assert.equal(moves.find(m=>m.id==='move-069').power.kind,'not-applicable');
  assert.ok(abilities.every(a=>a.name&&a.description));
  assert.ok((await readJSON('data/pokemon.json')).every(p=>p.name&&p.stats&&p.abilityIds));
});
