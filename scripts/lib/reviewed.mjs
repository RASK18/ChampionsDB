import {hash,json} from './io.mjs';

export function applyReviewed(store,reviewed){
  for(const rule of reviewed.rules||[]){
    const evidence=rule.bindings.map(binding=>(store.claims.get(binding.claim)||[]).find(o=>o.document===binding.document&&o.locator===binding.locator&&hash(json(o.observed))===binding.observedHash));
    store.expect(rule.collection,rule.entity);
    if(evidence.some(e=>!e)||new Set(evidence.map(e=>e.provider)).size<2){
      store.extraPending.push({claim:`${rule.collection}/${rule.entity}/${rule.field}`,reason:'review-evidence-changed',review:rule.id});continue;
    }
    for(const o of evidence){
      const fields=['interactions','battle-rules'].includes(rule.collection)?{identity:true,available:true,[rule.field]:rule.value}:{[rule.field]:rule.value};
      for(const [field,value] of Object.entries(fields)){
        store.add(rule.collection,rule.entity,field,value,o.document,o.locator,o.observed);
        store.claims.get(`${rule.collection}/${rule.entity}/${field}`).at(-1).review=rule.id;
      }
    }
    if(rule.collection==='battle-rules')for(const name of store.claims.get(`effects/${rule.entity}/name`)||[])store.add('battle-rules',rule.entity,'name',name.value,name.document,name.locator,name.observed);
  }
}
