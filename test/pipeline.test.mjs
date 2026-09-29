import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Claims,reconcile} from '../scripts/lib/claims.mjs';
import {reports} from '../scripts/lib/reports.mjs';
import {applyReviewed} from '../scripts/lib/reviewed.mjs';
import {hash,json,publish,readJSON,root} from '../scripts/lib/io.mjs';
import {flight} from '../scripts/lib/parsers.mjs';
import {packEvidence,unpackEvidence} from '../scripts/lib/evidence.mjs';
import {loadPublication,update} from '../scripts/update.mjs';
import {validateDataset} from '../scripts/lib/validate.mjs';
import {createIndexes} from '../lib/queries.mjs';
import {request} from '../scripts/lib/capture.mjs';

const snapshot={documents:Object.fromEntries([['a','alpha'],['b','beta'],['a-copy','alpha'],['c','gamma']].map(([id,provider])=>[id,{provider,sha256:hash(id),url:`https://example.test/${id}`,revision:'test',capturedAt:'2026-09-28T00:00:00Z'}]))};
function sample(){
  const store=new Claims(snapshot);
  for(const doc of ['a','b'])for(const [field,value] of Object.entries({identity:true,available:true,name:'Agua'}))store.add('types','water',field,value,doc,field);
  return store;
}
test('two pages of one provider cannot corroborate a claim',()=>{
  const s=new Claims(snapshot);for(const d of ['a','a-copy'])s.add('types','water','identity',true,d,'water');
  assert.equal(reconcile(s).decisions['types/water/identity'],'uncorroborated');
});
test('a new corroborated entry publishes; a disagreement withholds only the changed field',()=>{
  const s=sample();s.add('types','water','name','Conflicto','c','name');
  const r=reconcile(s);assert.equal(r.data.types.length,1);assert.equal(r.data.types[0].name,undefined);assert.equal(r.decisions['types/water/name'],'conflict');
});
test('reviewed third-source resolution stays bound to observed values',()=>{
  const s=sample();s.add('types','water','name','Conflicto','c','name');
  const resolution={id:'editorial',claim:'types/water/name',value:'Agua',evidence:s.claims.get('types/water/name').map(o=>({document:o.document,observedHash:hash(json(o.observed))}))};
  assert.equal(reconcile(s,{resolutions:[resolution]}).data.types[0].name,'Agua');
  resolution.evidence[0].observedHash=hash('outdated');assert.equal(reconcile(s,{resolutions:[resolution]}).data.types[0].name,undefined);
});
test('missing endpoints cannot publish a relationship',()=>{
  const s=sample();for(const d of ['a','b'])for(const [f,v] of Object.entries({identity:true,available:true,pokemonId:'missing',moveId:'missing'}))s.add('learnsets','test',f,v,d,f);
  const r=reconcile(s);assert.equal(r.data.learnsets.length,0);assert.ok(r.pending.some(p=>p.reason==='missing-endpoint'));
});
test('new semantic evidence invalidates the reviewed rule instead of silently approving it',()=>{
  const s=sample();const bindings=s.claims.get('types/water/name').map(o=>({claim:'types/water/name',document:o.document,locator:o.locator,observedHash:hash(json(o.observed))}));
  const rule={id:'rule',collection:'battle-rules',entity:'test',field:'rule',value:{value:1},bindings};
  applyReviewed(s,{rules:[rule]});assert.equal(reconcile(s).data['battle-rules'].length,1);
  const changed=sample();changed.claims.get('types/water/name')[0].observed='new evidence';applyReviewed(changed,{rules:[rule]});
  assert.equal(reconcile(changed).data['battle-rules'].length,0);assert.ok(changed.extraPending.some(p=>p.reason==='review-evidence-changed'));
});
test('absence is pending; withdrawal needs two explicit false observations',()=>{
  const original=reconcile(sample());const previous={...original,manifest:{datasetId:'old'}};
  const missing=new Claims(snapshot);const pending=reports(missing,reconcile(missing),previous);
  assert.equal(pending.withdrawn.length,0);assert.equal(pending.stale.length,1);
  const removed=new Claims(snapshot);for(const d of ['a','b'])removed.add('types','water','available',false,d,'available');
  const r=reports(removed,reconcile(removed),previous);assert.equal(r.withdrawn.length,1);assert.equal(r.excluded.length,1);
});
test('an unavailable current value is never carried forward as verified',()=>{
  const before=reconcile(sample());const s=sample();s.claims.get('types/water/name').pop();
  const after=reconcile(s);const r=reports(s,after,{...before,manifest:{datasetId:'old'}});
  assert.equal(after.data.types[0].name,undefined);assert.ok(r.stale.some(x=>x.field==='name'));
});
test('Flight parser rejects format changes instead of treating an empty catalogue as deletions',()=>{
  assert.throws(()=>flight('<html></html>',['pokemon','buildMetadata']),/format changed/);
  const payload='0:'+JSON.stringify({pokemon:[],buildMetadata:{}})+'\n';
  assert.deepEqual(flight(`<script>self.__next_f.push(${JSON.stringify([1,payload])})</script>`,['pokemon','buildMetadata']).pokemon,[]);
});
test('inaccessible sources retry within a bound and surface a failure',async()=>{
  let calls=0;await assert.rejects(()=>request('https://example.test/unavailable',{fetcher:async()=>{calls++;throw new Error('503 source unavailable');},retryDelay:0}),/503/);assert.equal(calls,3);
});
test('packed provenance is lossless',()=>{
  const evidence=reconcile(sample()).evidence;assert.deepEqual(Object.fromEntries(Object.entries(unpackEvidence(packEvidence(evidence))).map(([k,v])=>[k,{value:v.value,evidence:v.evidence}])),evidence);
});
test('publication writes complete generations and recovers a rename interruption',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'champions-publish-'));const out=path.join(dir,'data');
  try{
    await publish(out,{'manifest.json':{version:1},'types.json':[1]});
    await publish(out,{'manifest.json':{version:2},'types.json':[2]});
    assert.deepEqual(await readJSON(path.join(out,'types.json')),[2]);
    const {rename}=await import('node:fs/promises');await rename(out,out+'.previous');
    await publish(out,{'manifest.json':{version:3},'types.json':[3]});assert.deepEqual(await readJSON(path.join(out,'types.json')),[3]);
  }finally{await rm(dir,{recursive:true,force:true});}
});

const publication=await loadPublication();
const coverage=await readJSON(path.join(root,'data/reports/coverage.json'));
const db=createIndexes(publication.data,coverage);
test('entire delivered dataset validates schemas, references, IDs, cells and provenance',async()=>{
  const report=await validateDataset(publication);assert.ok(report.records>20000);assert.ok(report.claims>90000);
  assert.equal(publication.manifest.sourcePolicy.mode,'champout-primary');
  for(const [claim,entry] of Object.entries(publication.evidence))for(const e of entry.evidence)assert.ok(e.provider==='champout'||publication.manifest.sourcePolicy.supplementalClaims[claim]?.providers.includes(e.provider),claim);
});
test('rain separates direct producers, beneficiaries, and conditional ability copying',()=>{
  const rain=db.producersOfEffect('rain');
  const politoed=rain.records.find(r=>r.pokemon.id==='pokemon-0186000');assert.ok(politoed.paths.some(p=>p.via.id==='ability-002'));
  assert.ok(rain.records.some(r=>r.pokemon.id==='pokemon-0279000'));
  assert.ok(rain.records.every(r=>r.paths.every(p=>p.via.id!=='ability-033')));
  assert.ok(rain.records.some(r=>r.paths.some(p=>p.kind==='indirect')));
  assert.equal(rain.coverage.absenceMeansImpossible,false);
});
test('Mega forms stay related to the species and have their own stats, abilities and learnsets',()=>{
  const forms=db.formsOfSpecies('species-003').records;assert.equal(forms.length,2);
  assert.notEqual(forms[0].stats.attack,forms[1].stats.attack);assert.notDeepEqual(forms[0].abilityIds,forms[1].abilityIds);
  assert.ok(publication.data.learnsets.some(l=>l.pokemonId==='pokemon-0003001'));
  assert.ok(publication.data.interactions.some(i=>i.rule.relation==='transforms'&&i.rule.target.id==='pokemon-0003001'));
});
test('Champout effective PP, paralysis and freeze',async()=>{
  assert.equal(db.get('moves','move-273').pp,8);assert.equal(db.get('moves','move-668').pp,8);
  assert.equal(db.get('battle-rules','paralysis').rule.failureProbability,0.125);
  assert.equal(db.get('battle-rules','freezing').rule.thawProbability,0.25);
  assert.equal(db.get('battle-rules','freezing').rule.forcedThawTurn,3);
});
test('conditions, berries, Mega stones, neutral natures, immunities and nullable semantics',()=>{
  assert.equal(db.conditions().records.length,6);assert.ok(db.berries().records.length>5);assert.ok(db.megaStones().records.length>20);
  assert.equal(db.get('natures','hardy').name,'Fuerte');assert.equal(db.get('natures','hardy').increased,null);
  assert.equal(db.get('types','normal').effectiveness.ghost,0);
  assert.deepEqual(db.get('moves','move-240').power,{kind:'not-applicable'});
  assert.deepEqual(db.get('moves','move-240').accuracy,{kind:'not-applicable'});
  assert.deepEqual(db.get('moves','move-447').power,{kind:'variable'});
  assert.ok(publication.data.regulations.length<=1);
  if(publication.data.regulations.length)assert.equal(publication.data.regulations[0].rules.eligibilityComplete,false);
  assert.equal(publication.manifest.context.gameVersion,null);
});
test('missing capture or bad format cannot alter the previous publication',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'champions-failure-'));
  try{
    const before=await readFile(path.join(root,'data/manifest.json'),'utf8');
    const bad=path.join(dir,'snapshot.json');await writeFile(bad,json({documents:{missing:{sha256:'not-a-capture'}}}));
    await assert.rejects(()=>update({snapshotFile:bad}));assert.equal(await readFile(path.join(root,'data/manifest.json'),'utf8'),before);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('JSON canonicalization does not depend on key insertion order',()=>{
  assert.equal(json({z:1,a:{b:3,a:2}}),json({a:{a:2,b:3},z:1}));
});
