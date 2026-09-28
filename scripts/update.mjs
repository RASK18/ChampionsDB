import path from 'node:path';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {capture,document,cache} from './lib/capture.mjs';
import {root,readJSON,writeJSON,json,hash,publish,atomicFile} from './lib/io.mjs';
import {loadInputs} from './lib/parsers.mjs';
import {normalize} from './lib/normalize.mjs';
import {normalizeEditorial} from './lib/editorial.mjs';
import {applyReviewed} from './lib/reviewed.mjs';
import {reconcile} from './lib/claims.mjs';
import {packEvidence,unpackEvidence} from './lib/evidence.mjs';
import {validateDataset} from './lib/validate.mjs';
import {collections} from './lib/model.mjs';
import {reports} from './lib/reports.mjs';

export async function loadPublication(directory=path.join(root,'data')){
  const manifest=await readJSON(path.join(directory,'manifest.json'));
  const data={},evidence={};
  for(const c of collections){data[c]=await readJSON(path.join(directory,c+'.json'));Object.assign(evidence,unpackEvidence(await readJSON(path.join(directory,'provenance',c+'.json'))));}
  const snapshot=await readJSON(path.join(directory,'snapshot.json'));
  return {data,evidence,snapshot,manifest};
}

export async function update({offline=false,snapshotFile,output=path.join(root,'data')}={}){
  let previous;try{previous=await loadPublication(output);}catch(e){if(e.code!=='ENOENT')throw e;}
  const snapshot=snapshotFile?await readJSON(snapshotFile):await capture({offline});
  // A re-download of identical bytes preserves original capture timestamps.
  for(const [id,doc] of Object.entries(snapshot.documents))if(previous?.snapshot.documents[id]?.sha256===doc.sha256)snapshot.documents[id].capturedAt=previous.snapshot.documents[id].capturedAt;
  const inputs=await loadInputs(snapshot);
  const store=await normalize(snapshot,inputs);normalizeEditorial(store,inputs);
  const reviewed=await readJSON(path.join(root,'rules/reviewed.json'));applyReviewed(store,reviewed);
  const result=reconcile(store,reviewed),report=reports(store,result,previous);
  await validateDataset({...result,snapshot});
  const files=Object.fromEntries(collections.map(c=>[`${c}.json`,result.data[c]]));
  for(const c of collections)files[`provenance/${c}.json`]=packEvidence(Object.fromEntries(Object.entries(result.evidence).filter(([k])=>k.startsWith(c+'/'))));
  files['reports/coverage.json']=report.coverage;files['reports/pending.json']=report.pending;
  files['reports/mappings.json']=store.mapping;files['reports/stale.json']=report.stale;files['reports/withdrawn.json']=report.withdrawn;
  files['reports/excluded.json']=report.excluded;
  files['snapshot.json']=snapshot;
  const datasetId=hash(json({data:result.data,evidence:result.evidence,coverage:report.coverage,pending:report.pending,mappings:store.mapping,context:store.context,rules:hash(json(reviewed))}));
  // A no-op must not replace the previous change report or touch tracked files.
  if(previous?.manifest.datasetId===datasetId){console.log('Sin cambios en los datos verificados, sus evidencias ni cobertura.');return previous.manifest;}
  files['reports/changes.json']=report.diff;
  files['manifest.json']={formatVersion:1,game:'pokemon-champions',locale:'es-ES',datasetId,complete:report.coverage.complete,scope:'combat',context:store.context,rulesHash:hash(json(reviewed)),sourceRevisions:snapshot.revisions,files:Object.fromEntries(Object.entries(files).map(([name,v])=>[name,{sha256:hash(json(v)),bytes:Buffer.byteLength(json(v))}]))};
  await validateDataset({...result,snapshot,manifest:files['manifest.json']});
  await mkdir(path.join(root,'artifacts'),{recursive:true});
  await writeJSON(path.join(root,'artifacts/candidate-manifest.json'),files['manifest.json']);
  await publish(output,files);
  await writeJSON(path.join(root,'sources/snapshot.json'),snapshot);
  console.log(JSON.stringify({datasetId,records:Object.fromEntries(collections.map(c=>[c,result.data[c].length])),pending:report.pending.length,complete:report.coverage.complete},null,2));
  return files['manifest.json'];
}
if(process.argv[1]===import.meta.filename){
  const arg=name=>{const i=process.argv.indexOf(name);return i===-1?undefined:process.argv[i+1];};
  try{await update({offline:process.argv.includes('--offline'),snapshotFile:arg('--snapshot'),output:arg('--output')});}
  catch(error){await writeJSON(path.join(root,'artifacts/failure.json'),{status:'failed',publicationPreserved:true,error:error.stack});console.error(error);process.exitCode=1;}
}
