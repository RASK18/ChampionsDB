import Ajv from 'ajv';
import {collections} from './model.mjs';
import {references} from './claims.mjs';
import {json,hash,readJSON,root} from './io.mjs';
import path from 'node:path';

export async function validateDataset({data,evidence,snapshot,manifest}){
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
          if(new Set(entry.evidence.map(e=>e.provider)).size<2)errors.push(`Insufficient providers ${claim}`);
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
  for(const type of data.types){if(Object.keys(type.effectiveness||{}).length!==18)errors.push(`Incomplete type matrix ${type.id}`);}
  if(data.types.length!==18)errors.push('Expected complete 18-type matrix');
  if(manifest)for(const c of collections)if(manifest.files[`${c}.json`]?.sha256!==hash(json(data[c])))errors.push(`Manifest hash mismatch ${c}`);
  if(errors.length)throw new Error(errors.slice(0,30).join('\n')+`\n${errors.length} validation error(s)`);
  return {records:collections.reduce((n,c)=>n+data[c].length,0),claims:Object.keys(evidence).length};
}
