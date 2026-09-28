import {load} from 'cheerio';
import {stripTypeScriptTypes} from 'node:module';
import {document} from './capture.mjs';

export const key = value => String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export const text = value => String(value).replace(/\s+/gu,' ').trim();
export function flight(html, required, predicate=()=>true) {
  const $=load(html); const prefix='self.__next_f.push(';
  const stream=$('script').toArray().map(e=>$(e).text()).filter(t=>t.startsWith(prefix)).flatMap(t=>{
    const arg=JSON.parse(t.slice(prefix.length,t.lastIndexOf(')')));return arg[0]===1?[arg[1]]:[];
  }).join('');
  const found=[];
  function walk(v){
    if(!v||typeof v!=='object')return;
    if(required.every(k=>k in v)&&required.some(k=>Array.isArray(v[k]))&&predicate(v))found.push(v);
    for(const [k,x] of Object.entries(v))if(k!=='initialMessages')walk(x);
  }
  for(const line of stream.split('\n')){
    const match=line.match(/^[0-9a-f]+:([\[{].*)$/);if(!match)continue;
    let value;try{value=JSON.parse(match[1]);}catch{continue;}walk(value);
  }
  if(found.length!==1)throw new Error(`OP.GG format changed: ${required.join(',')}: ${found.length} matches`);
  return found[0];
}
export async function loadInputs(snapshot){
  const raw={};for(const id of Object.keys(snapshot.documents))raw[id]=await document(snapshot,id);
  const tables={};for(const [id,body] of Object.entries(raw))if(id.startsWith('champout/')){
    const value=JSON.parse(body);
    tables[id]=Array.isArray(value)?value:Object.fromEntries(value.mSDataSet.map(row=>[row.LabelName,row.OriginalText]));
  }
  const op={};
  for(const [name,required] of Object.entries({pokemon:['pokemon','buildMetadata'],moves:['moves','pokemonList'],abilities:['abilities','pokemonList'],items:['items'],effects:['buffEffects','pokemonList'],conditions:['conditions'],natures:['natures'],types:['types']})){
    op[name]=flight(raw[`opgg/${name}`],required,v=>name==='items'?v.items?.[0]?.category: name==='conditions'?v.conditions?.[0]?.description: name==='types'?v.types?.[0]?.id!==undefined:true);
  }
  for(const [name,field] of Object.entries({pokemon:'pokemon',moves:'moves',abilities:'abilities',items:'items',effects:'buffEffects',conditions:'conditions',natures:'natures',types:'types'})){
    const rows=op[name][field];if(!Array.isArray(rows)||!rows.length)throw new Error(`Empty or invalid OP.GG catalogue ${name}`);
    if(new Set(rows.map(r=>r.key)).size!==rows.length)throw new Error(`Duplicate OP.GG keys in ${name}`);
  }
  const moves=new Set(op.moves.moves.map(m=>m.key)),abilities=new Set(op.abilities.abilities.map(a=>a.key));
  for(const p of op.pokemon.pokemon){
    if(!Array.isArray(p.moves)||!Array.isArray(p.abilities)||!Array.isArray(p.types)||Object.values(p.stats||{}).length!==6||Object.values(p.stats).some(v=>!Number.isFinite(v)))throw new Error(`Invalid Pokémon record ${p.key}`);
    if(p.moves.some(m=>!moves.has(m))||p.abilities.some(a=>!abilities.has(a)))throw new Error(`Unknown catalogue reference on ${p.key}`);
  }
  for(const m of op.moves.moves)if(typeof m.isAvailable!=='boolean'||!Number.isInteger(m.pp)||!Array.isArray(m.moveTraits))throw new Error(`Invalid move record ${m.key}`);
  for(const [kind,fields] of [['personal',['no','fo','type1','type2','hp','atk','def','spatk','spdef','agi','weight','toku0','toku1','toku2']],['waza',['type','category','power','accuracy','pp','priority']]]){
    const rows=tables[`champout/masterdata/${kind}`];if(!rows?.length)throw new Error(`Empty champout catalogue ${kind}`);
    for(const row of rows)if(fields.some(f=>row[f]===undefined||row[f]===''||!Number.isFinite(Number(row[f]))))throw new Error(`Invalid champout ${kind} ${row.id}`);
  }
  return {raw,tables,op};
}
export async function resolvedDex(raw){
  // Resolve actual upstream Champions overrides with the pinned Showdown loader.
  // The TS tables are trusted source code from the pinned smogon repository.
  const {Dex}=(await import('pokemon-showdown/dist/sim/dex.js')).default;
  const tables={base:{},champions:{}};
  for(const [id,source] of Object.entries(raw))if(id.startsWith('showdown/')){
    const js=stripTypeScriptTypes(source,{mode:'strip'});
    if(/^\s*import\s/m.test(js))throw new Error(`New runtime import requires review: ${id}`);
    const module=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
    Object.assign(tables[id.split('/')[1]],module);
  }
  Dex.includeMods();
  if(Dex.dataCache)throw new Error('Dex must be resolved once in a fresh process');
  Dex.loadDataFile=(_dir,type)=>tables.base[type]||{};
  const dex=Dex.mod('champions');
  dex.loadDataFile=(_dir,type)=>tables.champions[type]||{};
  dex.sourceFields=Object.fromEntries(Object.entries(tables.champions).map(([table,entries])=>[table,Object.fromEntries(Object.entries(entries).map(([id,value])=>[id,value?Object.keys(value):[]]))]));
  dex.includeData();
  dex.sourceTables=tables;
  return dex;
}
