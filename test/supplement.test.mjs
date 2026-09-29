import test from 'node:test';
import assert from 'node:assert/strict';
import {readJSON,hash} from '../scripts/lib/io.mjs';
import {Claims,reconcile,references} from '../scripts/lib/claims.mjs';
import {addSupplement,applySupplementalReviewed,section} from '../scripts/lib/supplement.mjs';
import {acceptedObservations,supplementScope} from '../scripts/lib/source-policy.mjs';

const scopes=(await readJSON('rules/supplemental-scope.json')).claims;
const snapshot={documents:{primary:{provider:'champout',sha256:hash('primary')},external:{provider:'opgg',sha256:hash('external')},mechanics:{provider:'showdown',sha256:hash('mechanics')}}};
function make(){const s=new Claims(snapshot);s.policy={mode:'champout-primary',provider:'champout',minimumProviders:1};return s;}

test('supplements cannot expand the frozen 147 gaps or overwrite a primary value',()=>{
  assert.equal(scopes.length,147);assert.equal(new Set(scopes).size,147);
  const s=make(),claim='moves/move-165/description';
  assert.throws(()=>addSupplement(s,scopes,'moves/move-165/pp',10,'external','pp'),/outside authorized/);
  assert.equal(addSupplement(s,scopes,claim,'Texto externo','external','description'),true);
  s.add('moves','move-165','description','Texto principal','primary','description');
  assert.equal(addSupplement(s,scopes,claim,'No reemplazar','external','description'),false);
  const obs=acceptedObservations(s.claims.get(claim),claim,s.policy);
  assert.equal(obs.length,1);assert.equal(obs[0].value,'Texto principal');
  assert.equal(supplementScope('regulations/invented/rules',scopes),undefined);
  assert.equal(supplementScope('interactions/item-677--0359000/rule',scopes),'interactions/item-677--0359000');
});

test('a primary conflict cannot be silently replaced with external agreement',()=>{
  const s=make(),claim='moves/move-165/description';
  for(const field of ['identity','available'])s.add('moves','move-165',field,true,'primary',field);
  addSupplement(s,scopes,claim,'A','external','description');
  for(const value of ['A','B'])s.add('moves','move-165','description',value,'primary','description');
  assert.equal(reconcile(s).decisions[claim],'conflict');
});

test('reviewed supplemental rules become pending when bound source text changes',()=>{
  const raw='one\ntwo\nthree',binding={document:'mechanics',lines:[2,2],locator:'line 2',sha256:hash('two')};
  assert.equal(section(raw,binding),'two');
  assert.throws(()=>section(raw,{start:'missing'}),/structure changed/);
  const rule={id:'stat-calculation',name:'Cálculo',value:{value:1},bindings:[binding]},s=make();
  applySupplementalReviewed(s,scopes,{rules:[rule]},{mechanics:raw});
  assert.equal(reconcile(s).data['battle-rules'][0].rule.value,1);
  const changed=make();applySupplementalReviewed(changed,scopes,{rules:[rule]},{mechanics:'one\nchanged\nthree'});
  assert.equal(reconcile(changed).data['battle-rules'].length,0);
  assert.ok(changed.extraPending.some(p=>p.reason==='supplemental-review-evidence-changed'));
});

test('supplement coverage accounts for every original gap and keeps global mechanics open',async()=>{
  const report=await readJSON('data/reports/supplements.json');
  assert.equal(report.authorized,147);assert.deepEqual(new Set(report.claims.map(r=>r.scope)),new Set(scopes));
  for(const row of report.claims)for(const field of row.fields)assert.equal(supplementScope(field,scopes),row.scope);
  assert.equal(report.claims.find(r=>r.scope==='interactions/full-mechanics').resolved,false);
  assert.ok((await readJSON('data/reports/pending.json')).some(p=>p.claim==='interactions/full-mechanics'));
  const reviewed=await readJSON('rules/supplemental-reviewed.json');
  assert.equal(reviewed.rules.length,10);assert.ok(reviewed.rules.every(r=>r.value.exceptionsComplete===false));
});

test('complete type matrix preserves immunities; neutral natures have null stats and unit factors',async()=>{
  const types=await readJSON('data/types.json'),natures=await readJSON('data/natures.json');
  assert.equal(types.reduce((n,t)=>n+Object.keys(t.effectiveness).length,0),324);
  for(const t of types)assert.deepEqual(Object.keys(t.effectiveness).sort(),types.map(t=>t.id).sort());
  assert.equal(types.find(t=>t.id==='electric').effectiveness.ground,0);
  assert.equal(types.find(t=>t.id==='fire').effectiveness.grass,2);
  assert.equal(types.find(t=>t.id==='fire').effectiveness.water,0.5);
  assert.equal(natures.length,25);assert.equal(natures.filter(n=>n.increased===null).length,5);
  for(const n of natures){assert.equal(n.increased===null,n.decreased===null);assert.deepEqual(n.multipliers,n.increased===null?{decreased:1,increased:1}:{decreased:0.9,increased:1.1});}
});

test('item supplements resolve species restrictions and classic Mega destinations',async()=>{
  const items=await readJSON('data/items.json'),interactions=await readJSON('data/interactions.json'),pokemon=await readJSON('data/pokemon.json');
  const ids=new Set(pokemon.map(p=>p.id));
  for(const number of [236,259]){const item=items.find(i=>i.id==='item-'+number);assert.ok(item.restrictions[0].any.length);assert.ok(item.restrictions[0].any.every(c=>ids.has(c.pokemonId)));}
  for(const id of ['item-677--0359000','item-683--0445000','item-673--0448000']){
    const rule=interactions.find(i=>i.id===id).rule,target=pokemon.find(p=>p.id===rule.target.id);
    assert.match(target.name,/Mega/);assert.doesNotMatch(target.name,/ Z$/);
    assert.equal(rule.requirements.all[0].pokemonId,'pokemon-'+id.split('--')[1]);
  }
});

test('official regulation preserves unmatched names and does not claim complete team legality',async()=>{
  const regulations=await readJSON('data/regulations.json'),pokemon=await readJSON('data/pokemon.json');
  for(const r of regulations){
    assert.equal(r.rules.eligibilityComplete,false);
    assert.ok(r.rules.startsAtUtc<r.rules.endsAtUtc);
    assert.equal(r.rules.eligiblePokemon.length+r.rules.unmappedPokemonNames.length,r.rules.eligiblePokemonNames.length);
    for(const ref of references('regulations',r))assert.ok(pokemon.some(p=>p.id===ref.id));
  }
});
