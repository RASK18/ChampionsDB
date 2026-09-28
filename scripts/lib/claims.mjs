import {canonical,hash,json} from './io.mjs';
import {collections,expectedFields,put} from './model.mjs';

export class Claims {
  constructor(snapshot){this.snapshot=snapshot;this.claims=new Map();this.inventory=new Map();this.mapping=[];this.extraPending=[];}
  expect(collection,id,fields=expectedFields[collection]){
    const entity=`${collection}/${id}`;
    if(!this.inventory.has(entity))this.inventory.set(entity,new Set());
    for(const field of fields)this.inventory.get(entity).add(field);
  }
  add(collection,id,field,value,document,locator,observed=value,context='champions-current-capture'){
    if(value===undefined)return;
    if(!this.inventory.has(`${collection}/${id}`))this.expect(collection,id);
    this.inventory.get(`${collection}/${id}`).add(field);
    const doc=this.snapshot.documents[document];if(!doc)throw new Error(`Evidence document missing ${document}`);
    const claim=`${collection}/${id}/${field}`;
    const evidence={provider:doc.provider,document,locator,observed,value:canonical(value),context,sha256:doc.sha256};
    if(!this.claims.has(claim))this.claims.set(claim,[]);
    this.claims.get(claim).push(evidence);
  }
}

export function reconcile(store,reviewed={equivalences:[],resolutions:[]}){
  const verified={},pending=[],decisions={};
  for(const [entity,fields] of [...store.inventory].sort(([a],[b])=>a.localeCompare(b)))for(const field of [...fields].sort()){
    const claim=`${entity}/${field}`;let obs=store.claims.get(claim)||[];
    obs=obs.map(o=>({...o}));
    for(const equivalence of reviewed.equivalences||[]){
      if(equivalence.claim!==claim)continue;
      const matched=equivalence.evidence.every(e=>obs.some(o=>o.document===e.document&&o.locator===e.locator&&hash(json(o.observed))===e.observedHash));
      if(matched)for(const o of obs)if(equivalence.evidence.some(e=>e.document===o.document&&e.locator===o.locator)){o.value=equivalence.value;o.review=equivalence.id;}
    }
    const groups=new Map();for(const o of obs){const signature=json(o.value);if(!groups.has(signature))groups.set(signature,[]);groups.get(signature).push(o);}
    let winners=[...groups.values()].filter(g=>new Set(g.map(o=>o.provider)).size>=2);
    let resolution;
    if(groups.size>1){
      resolution=(reviewed.resolutions||[]).find(r=>r.claim===claim&&r.evidence.every(e=>obs.some(o=>o.document===e.document&&hash(json(o.observed))===e.observedHash)));
      winners=resolution?winners.filter(g=>json(g[0].value)===json(resolution.value)):[];
    }
    if(winners.length===1){
      verified[claim]={value:winners[0][0].value,evidence:winners[0],...(resolution?{resolution:resolution.id,dissent:obs.filter(o=>json(o.value)!==json(resolution.value))}:{})};
      decisions[claim]='verified';
    }else{const reason=groups.size>1?'conflict':obs.length?'uncorroborated':'missing';pending.push({claim,reason,observations:obs});decisions[claim]=reason;}
  }
  const data=Object.fromEntries(collections.map(c=>[c,[]]));
  for(const entity of [...store.inventory.keys()].sort()){
    const [collection,id]=entity.split('/');
    if(verified[`${entity}/identity`]?.value!==true||verified[`${entity}/available`]?.value!==true)continue;
    const record={id};
    for(const field of store.inventory.get(entity))if(verified[`${entity}/${field}`])put(record,field,verified[`${entity}/${field}`].value);
    data[collection].push(record);
  }
  // Relations and fields with references cannot escape if an endpoint is pending.
  let changed=true;
  while(changed){changed=false;const ids=Object.fromEntries(collections.map(c=>[c,new Set(data[c].map(x=>x.id))]));
    for(const collection of collections)data[collection]=data[collection].filter(row=>{
      const missing=references(collection,row).filter(r=>!ids[r.collection]?.has(r.id));
      if(!missing.length)return true;
      if(['learnsets','interactions'].includes(collection)||missing.some(r=>r.field==='speciesId')){
        pending.push({claim:`${collection}/${row.id}`,reason:'missing-endpoint',references:missing});changed=true;return false;
      }
      for(const {field} of missing){delete row[field];pending.push({claim:`${collection}/${row.id}/${field}`,reason:'missing-endpoint'});}changed=true;return true;
    });
  }
  // Evidence may cover candidate fields, but publicationEvidence only indexes published ones.
  const evidence={};for(const [collection,rows] of Object.entries(data))for(const row of rows)for(const field of store.inventory.get(`${collection}/${row.id}`)){
    const claim=`${collection}/${row.id}/${field}`;
    const exists=field.split('.').reduce((v,k)=>v?.[k],row)!==undefined;
    if(exists&&verified[claim])evidence[claim]=verified[claim];
  }
  return {data,evidence,pending:[...pending,...store.extraPending],decisions};
}
export function references(collection,row){
  const refs=[];const add=(field,c,value)=>{if(value)refs.push({field,collection:c,id:value});};
  if(collection==='pokemon'){
    add('speciesId','species',row.speciesId);
    for(const id of row.typeIds||[])add('typeIds','types',id);
    for(const id of row.abilityIds||[])add('abilityIds','abilities',id);
  }
  if(collection==='moves')add('typeId','types',row.typeId);
  if(collection==='learnsets'){add('pokemonId','pokemon',row.pokemonId);add('moveId','moves',row.moveId);}
  if(collection==='interactions'&&row.rule){
    for(const end of ['source','target']){const r=row.rule[end];if(r?.id)add('rule',r.collection,r.id);}
  }
  function nested(value,field){
    if(!value||typeof value!=='object')return;
    if(value.pokemonId)add(field,'pokemon',value.pokemonId);
    if(value.itemId)add(field,'items',value.itemId);
    if(value.effectId)add(field,'effects',value.effectId);
    if(value.selector?.typeId)add(field,'types',value.selector.typeId);
    for(const v of Object.values(value))nested(v,field);
  }
  if(collection==='interactions')nested(row.rule,'rule');
  if(collection==='items')nested(row.restrictions,'restrictions');
  return refs;
}
