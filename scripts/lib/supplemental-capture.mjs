import {mkdir,writeFile} from 'node:fs/promises';
import {load} from 'cheerio';
import {cache,request,document} from './capture.mjs';
import {hash,pool,readJSON,root} from './io.mjs';

export async function captureSupplemental(snapshot,{offline=false}={}){
  if(offline)return snapshot;
  const capturedAt=new Date().toISOString(),documents={...snapshot.documents};
  let previous;try{previous=await readJSON(root+'/sources/snapshot.json');}catch(e){if(e.code!=='ENOENT')throw e;}
  const showdown=JSON.parse((await request('https://api.github.com/repos/smogon/pokemon-showdown/commits/HEAD')).toString()).sha;
  const jobs=[];
  const add=(id,url,provider,revision='live')=>jobs.push({id,url,provider,revision});
  for(const route of ['natures','types','moves','items','pokedex'])add(`supplement/opgg/${route}`,`https://op.gg/es/pokemon-champions/${route}`,'opgg');
  add('supplement/official/regulation','https://champions-news.pokemon-home.com/es/page/816.html','pokemon');
  for(const name of ['scripts','abilities','moves','items','conditions','rulesets'])add(`supplement/showdown/champions/${name}`,`https://raw.githubusercontent.com/smogon/pokemon-showdown/${showdown}/data/mods/champions/${name}.ts`,'showdown',showdown);
  for(const name of ['scripts','abilities','moves','items','conditions','rulesets'])add(`supplement/showdown/base/${name}`,`https://raw.githubusercontent.com/smogon/pokemon-showdown/${showdown}/data/${name}.ts`,'showdown',showdown);
  for(const name of ['battle-actions','pokemon','battle','battle-queue'])add(`supplement/showdown/sim/${name}`,`https://raw.githubusercontent.com/smogon/pokemon-showdown/${showdown}/sim/${name}.ts`,'showdown',showdown);
  await mkdir(cache+'/objects',{recursive:true});
  const save=async(job,bytes)=>{const sha256=hash(bytes);await writeFile(cache+'/objects/'+sha256,bytes);documents[job.id]={...job,sha256,bytes:bytes.length,capturedAt};};
  await pool(jobs,async job=>{
    const old=previous?.documents[job.id];
    if(job.revision!=='live'&&old?.url===job.url){try{await document(previous,job.id);documents[job.id]=old;return;}catch(e){if(e.code!=='ENOENT')throw e;}}
    await save(job,await request(job.url));
    process.stdout.write(`Supplement ${job.id}\n`);
  });
  const official=load(await document({documents},'supplement/official/regulation'));
  const eligibilityURL=official('a[href]').toArray().map(a=>official(a).attr('href')).find(u=>u?.startsWith('https://web-view.app.pokemonchampions.jp/battle/pages/events/')&&u.endsWith('/es/pokemon.html'));
  if(!eligibilityURL)throw new Error('Official regulation roster link changed');
  await save({id:'supplement/official/eligible-pokemon',url:eligibilityURL,provider:'pokemon',revision:'live'},await request(eligibilityURL));
  const $=load(await document({documents},'supplement/opgg/types'));
  const chunks=$('script[src]').toArray().map(e=>$(e).attr('src')).filter(s=>s.startsWith('https://s-stats-platform-cdn.op.gg/app-router/_next/'));
  const matches=await pool(chunks,async url=>{const bytes=await request(url);return bytes.toString().includes('normal:{doubleDamageFrom:')?{url,bytes}:null;});
  const chart=matches.find(Boolean);if(!chart)throw new Error('Supplement type chart format changed');
  await save({id:'supplement/opgg/type-chart',url:chart.url,provider:'opgg',revision:'live'},chart.bytes);
  return {...snapshot,asOf:capturedAt,revisions:{...snapshot.revisions,showdown},documents};
}
