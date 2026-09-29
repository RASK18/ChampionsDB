import {readFile, mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {root,hash,readJSON,writeJSON,pool} from './io.mjs';


export const cache=path.join(root,'.cache');
export async function request(url,{fetcher=fetch,retries=3,retryDelay=500}={}) {
  let error;
  for(let attempt=0;attempt<retries;attempt++) {
    try {
      const res=await fetcher(url,{headers:{'User-Agent':'ChampionsDB/0.1 (+https://disboard.es/ChampionsDB/)','Accept':'*/*'},signal:AbortSignal.timeout(45000)});
      if(!res.ok)throw new Error(`${res.status} ${url}`);
      return Buffer.from(await res.arrayBuffer());
    }catch(e){error=e;if(attempt<retries-1)await new Promise(r=>setTimeout(r,retryDelay*2**attempt));}
  }
  throw error;
}
export async function document(snapshot, id) {
  const doc=snapshot.documents[id]; if(!doc)throw new Error(`Missing document ${id}`);
  if(!/^[a-f0-9]{64}$/.test(doc.sha256))throw new Error(`Invalid capture hash: ${id}`);
  const bytes=await readFile(path.join(cache,'objects',doc.sha256));
  if(hash(bytes)!==doc.sha256)throw new Error(`Corrupted capture: ${id}`);
  return bytes.toString('utf8');
}
export async function capture({offline=false}={}) {
  if(offline)return readJSON(path.join(root,'sources/snapshot.json'));
  const capturedAt=new Date().toISOString();
  let previous;try{previous=await readJSON(path.join(root,'sources/snapshot.json'));}catch(e){if(e.code!=='ENOENT')throw e;}
  const revision=async repo=>JSON.parse((await request(`https://api.github.com/repos/${repo}/commits/HEAD`)).toString()).sha;
  const champout=await revision('projectpokemon/champout');
  const jobs=[];
  const add=(id,url,provider,revision)=>jobs.push({id,url,provider,revision});
  for(const name of ['personal','waza','waza_learn','item'])add(`champout/masterdata/${name}`,`https://raw.githubusercontent.com/projectpokemon/champout/${champout}/masterdata/${name}.json`,'champout',champout);
  const tables=['monsname_syn','zkn_form_syn','typename','wazaname','wazainfo_syn','wazatarget','wazaclassification','tokusei','tokuseiinfo_syn','itemname','iteminfo_syn','seikaku','btl_condition','btl_state_syn','help_syn','tournament_rule','ui_control'];
  for(const lang of ['esp','usa'])for(const name of tables)add(`champout/${lang}/${name}`,`https://raw.githubusercontent.com/projectpokemon/champout/${champout}/rom-txt/${lang}/${name}.json`,'champout',champout);
  await mkdir(path.join(cache,'objects'),{recursive:true});
  const documents={};
  const download=async job=>{
    const cached=previous?.documents[job.id];
    if(job.revision!=='live'&&cached?.url===job.url){
      try{await document(previous,job.id);documents[job.id]=cached;process.stdout.write(`Cached ${job.id}\n`);return;}catch(e){if(e.code!=='ENOENT')throw e;}
    }
    const bytes=await request(job.url);const sha256=hash(bytes);
    await writeFile(path.join(cache,'objects',sha256),bytes);
    documents[job.id]={...job,sha256,bytes:bytes.length,capturedAt};
    process.stdout.write(`Captured ${job.id}\n`);
  };
  await pool(jobs,download);
  return {formatVersion:1,game:'pokemon-champions',locale:'es-ES',revisions:{champout},documents};
}
