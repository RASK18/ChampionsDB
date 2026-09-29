import {collections,get} from './model.mjs';
import {hash,json} from './io.mjs';

export function reports(store,result,previous){
  const required=store.policy?.minimumProviders||2;
  const stats={};
  for(const collection of collections){
    const entities=[...store.inventory].filter(([id])=>id.startsWith(collection+'/'));
    let expected=0,excluded=0;
    for(const [entity,fields] of entities){
      const availability=(store.claims.get(`${entity}/available`)||[]);
      if(new Set(availability.filter(o=>o.value===false).map(o=>o.provider)).size>=required&&!availability.some(o=>o.value===true)){excluded++;continue;}
      expected+=fields.size;
    }
    stats[collection]={inventoried:entities.length,excluded,recordsPublished:result.data[collection].length,fieldsExpected:expected,fieldsPublished:Object.keys(result.evidence).filter(k=>k.startsWith(collection+'/')).length};
  }
  const pending=result.pending.filter(p=>{
    const entity=p.claim.split('/').slice(0,2).join('/');const a=store.claims.get(`${entity}/available`)||[];
    return !(new Set(a.filter(o=>o.value===false).map(o=>o.provider)).size>=required&&!a.some(o=>o.value===true));
  });
  const diff=[],stale=[],withdrawn=[];
  const previousByEntity=new Map();
  for(const [claim,e] of Object.entries(previous?.evidence||{})){
    const entity=claim.split('/').slice(0,2).join('/');if(!previousByEntity.has(entity))previousByEntity.set(entity,[]);previousByEntity.get(entity).push([claim,e]);
  }
  for(const collection of collections){
    const before=new Map((previous?.data[collection]||[]).map(r=>[r.id,r]));
    const after=new Map(result.data[collection].map(r=>[r.id,r]));
    for(const [id,row] of after){
      if(!before.has(id))diff.push({collection,id,change:'added'});
      else if(json(before.get(id))!==json(row))diff.push({collection,id,change:'modified'});
    }
    for(const [id,row] of before){
      if(!after.has(id)){
        const a=store.claims.get(`${collection}/${id}/available`)||[];
        if(new Set(a.filter(o=>o.value===false).map(o=>o.provider)).size>=required&&!a.some(o=>o.value===true))withdrawn.push({collection,id,evidence:a});
        else stale.push({collection,id,reason:store.policy?'not-in-current-source':'no-current-double-validation',lastVerified:row,previousDataset:previous.manifest.datasetId});
        diff.push({collection,id,change:withdrawn.at(-1)?.id===id?'withdrawn':'pending'});
      }else{
        for(const [claim,e] of previousByEntity.get(`${collection}/${id}`)||[]){
          const field=claim.split('/').slice(2).join('/');
          if(get(after.get(id),field)===undefined)stale.push({collection,id,field,reason:store.policy?'not-provided-by-current-source':'field-no-longer-corroborated',lastVerified:e,previousDataset:previous.manifest.datasetId});
        }
      }
    }
  }
  const coverage={complete:pending.length===0,collections:stats,pendingCount:pending.length,pendingByReason:Object.fromEntries([...new Set(pending.map(p=>p.reason))].sort().map(r=>[r,pending.filter(p=>p.reason===r).length])),scope:'Inventario reconciliado de los catálogos capturados; las asociaciones sin clasificación y mecánicas aún no modeladas siguen pendientes.',unknownIsNotImpossible:true};
  if(store.policy){coverage.sourcePolicy=store.policy;coverage.scope='Tablas y textos de champout en el commit capturado, con complementos limitados a los 147 huecos autorizados. No certifica legalidad integral ni cobertura completa de mecánicas.';}
  coverage.collections.interactions.associationsAwaitingClassification=pending.filter(p=>p.reason==='association-not-fully-classified').length;
  const excluded=[];
  for(const entity of store.inventory.keys()){
    const a=store.claims.get(`${entity}/available`)||[];
    if(new Set(a.filter(o=>o.value===false).map(o=>o.provider)).size>=required&&!a.some(o=>o.value===true))excluded.push({entity,evidence:a});
  }
  return {coverage,pending,diff,stale,withdrawn,excluded};
}
