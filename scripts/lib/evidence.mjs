import {hash,json} from './io.mjs';
export function packEvidence(evidence){
  const facts={},observations={};
  for(const [claim,entry] of Object.entries(evidence)){
    const ids=entry.evidence.map(o=>{const id=hash(json(o));observations[id]=o;return id;});
    facts[claim]={value:entry.value,witnesses:ids,...(entry.resolution?{resolution:entry.resolution}:{}),...(entry.dissent?{dissent:entry.dissent}:{})};
  }
  return {facts,observations};
}
export function unpackEvidence(packed){return Object.fromEntries(Object.entries(packed.facts).map(([k,v])=>[k,{...v,evidence:v.witnesses.map(id=>{if(!packed.observations[id])throw new Error(`Missing witness ${id}`);return packed.observations[id];})}]));}
