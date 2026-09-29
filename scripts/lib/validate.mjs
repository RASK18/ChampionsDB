import Ajv from 'ajv';
import {collections} from './model.mjs';
import {references} from './claims.mjs';
import {json,hash,readJSON,root} from './io.mjs';
import path from 'node:path';
import {supplementScope} from './source-policy.mjs';

export async function validateDataset({data,evidence,snapshot,manifest,policy=manifest?.sourcePolicy}){
  const single=['champout-only','champout-primary'].includes(policy?.mode);
  const supplementalScopes=policy?.mode==='champout-primary'?(await readJSON(path.join(root,'rules/supplemental-scope.json'))).claims:[];
  if(single&&(policy.provider!=='champout'||policy.minimumProviders!==1))throw new Error('Invalid champout source policy');
  const ajv=new Ajv({allErrors:true,strict:false});const errors=[];
  const sets=Object.fromEntries(collections.map(c=>[c,new Set(data[c].map(r=>r.id))]));
  for(const collection of collections){
    const check=ajv.compile(await readJSON(path.join(root,`schemas/${collection}.schema.json`)));
    if(!check(data[collection]))errors.push(`${collection}: ${ajv.errorsText(check.errors)}`);
    if(sets[collection].size!==data[collection].length)errors.push(`Duplicate IDs in ${collection}`);
    for(const row of data[collection]){
      const prefix=`${collection}/${row.id}`;
      for(const r of references(collection,row))if(!sets[r.collection]?.has(r.id))errors.push(`Dangling reference ${prefix} -> ${r.collection}/${r.id}`);
      function field(value,fieldPath){
        const claim=`${prefix}/${fieldPath}`,entry=evidence[claim];
        if(entry){
          if(json(value)!==json(entry.value))errors.push(`Value/evidence mismatch ${claim}`);
          if(new Set(entry.evidence.map(e=>e.provider)).size<(single?1:2))errors.push(`Insufficient providers ${claim}`);
          if(single&&entry.evidence.some(e=>e.provider!=='champout')){
            const allowed=policy.supplementalClaims?.[claim],scope=supplementScope(claim,supplementalScopes);
            if(!scope||allowed?.scope!==scope||entry.evidence.some(e=>!allowed.providers.includes(e.provider)))errors.push(`Foreign provider outside authorized supplement ${claim}`);
          }
          for(const e of entry.evidence){
            const doc=snapshot.documents[e.document];
            if(!doc||doc.sha256!==e.sha256||doc.provider!==e.provider||!e.locator||!e.context)errors.push(`Invalid provenance ${claim}`);
            if(json(e.value)!==json(entry.value))errors.push(`Unreconciled evidence ${claim}`);
          }
        }else if(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length){for(const [k,v] of Object.entries(value))field(v,`${fieldPath}.${k}`);}
        else errors.push(`Missing evidence ${claim}`);
      }
      for(const [k,v] of Object.entries(row))if(k!=='id')field(v,k);
    }
  }
  const relations=new Set();for(const row of data.learnsets){const pair=`${row.pokemonId}/${row.moveId}`;if(relations.has(pair))errors.push(`Duplicate learnset ${pair}`);relations.add(pair);}
  const ruleKeys=new Set();for(const row of data.interactions){const k=json(row.rule);if(ruleKeys.has(k))errors.push(`Duplicate interaction ${row.id}`);ruleKeys.add(k);}
  for(const type of data.types){
    if((!single||type.effectiveness)&&
      (Object.keys(type.effectiveness||{}).length!==18||data.types.some(t=>![0,0.5,1,2].includes(type.effectiveness?.[t.id]))))errors.push(`Incomplete type matrix ${type.id}`);
  }
  if(data.types.length!==18)errors.push('Expected complete 18-type matrix');
  if(manifest)for(const c of collections)if(manifest.files[`${c}.json`]?.sha256!==hash(json(data[c])))errors.push(`Manifest hash mismatch ${c}`);
  if(errors.length)throw new Error(errors.slice(0,30).join('\n')+`\n${errors.length} validation error(s)`);
  return {records:collections.reduce((n,c)=>n+data[c].length,0),claims:Object.keys(evidence).length};
}
