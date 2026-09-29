import {load} from 'cheerio';
import {document} from './capture.mjs';
import {flight,text,key} from './parsers.mjs';
import {readJSON,root,hash,json} from './io.mjs';
import {supplementScope} from './source-policy.mjs';

export function addSupplement(store,scopes,claim,value,doc,locator,observed=value){
  const scope=supplementScope(claim,scopes);
  if(!scope)throw new Error(`Supplement outside authorized 147 gaps: ${claim}`);
  if((store.claims.get(claim)||[]).some(o=>o.provider==='champout'))return false;
  const provider=store.snapshot.documents[doc]?.provider;
  if(!provider||provider==='champout')throw new Error(`Invalid supplemental document ${doc}`);
  const [collection,id,field]=claim.split('/');
  store.policy.supplementalClaims??={};
  const allowed=store.policy.supplementalClaims[claim]??={scope,providers:[]};
  if(!allowed.providers.includes(provider))allowed.providers.push(provider);
  store.add(collection,id,field,value,doc,locator,observed,'champions-supplemental-gap');
  return true;
}

export function section(raw,binding){
  if(binding.lines)return raw.split('\n').slice(binding.lines[0]-1,binding.lines[1]).join('\n');
  if(!binding.start)return raw;
  const start=raw.indexOf(binding.start);
  const end=binding.end?raw.indexOf(binding.end,start+binding.start.length):raw.length;
  if(start<0||end<0)throw new Error(`Supplemental source structure changed: ${binding.start}`);
  return raw.slice(start,end);
}

export function applySupplementalReviewed(store,scopes,reviewed,raw){
  const need=id=>{if(!raw[id])throw new Error(`Missing supplemental capture ${id}`);return raw[id];};
  const add=(claim,value,doc,loc,observed)=>addSupplement(store,scopes,claim,value,doc,loc,observed);
  for(const rule of reviewed.rules){
    const evidence=rule.bindings.map(b=>({binding:b,observed:section(need(b.document),b)}));
    if(evidence.some(e=>hash(e.observed)!==e.binding.sha256)){
      store.extraPending.push({claim:`battle-rules/${rule.id}/rule`,reason:'supplemental-review-evidence-changed'});continue;
    }
    for(const [field,value] of Object.entries({identity:true,available:true,name:rule.name,rule:rule.value}))for(const {binding,observed} of evidence)add(`battle-rules/${rule.id}/${field}`,value,binding.document,binding.locator,observed);
  }
}

export async function supplement(store){
  const scopes=(await readJSON(root+'/rules/supplemental-scope.json')).claims;
  if(scopes.length!==147||new Set(scopes).size!==147)throw new Error('The authorized supplemental scope changed');
  const raw={};for(const id of Object.keys(store.snapshot.documents).filter(id=>id.startsWith('supplement/')))raw[id]=await document(store.snapshot,id);
  const need=id=>{if(!raw[id])throw new Error(`Missing supplemental capture ${id}`);return raw[id];};
  const add=(claim,value,doc,loc,observed)=>addSupplement(store,scopes,claim,value,doc,loc,observed);
  const op={};
  for(const [name,fields] of Object.entries({natures:['natures'],moves:['moves','pokemonList'],items:['items'],pokedex:['pokemon','buildMetadata']}))op[name]=flight(need('supplement/opgg/'+name),fields,v=>name!=='items'||v.items?.[0]?.category);
  const values=(c,id,f)=>store.claims.get(`${c}/${id}/${f}`)?.find(o=>o.provider==='champout')?.value;
  const primaryRows=c=>[...store.inventory.keys()].filter(k=>k.startsWith(c+'/')).map(k=>k.split('/')[1]).filter(id=>values(c,id,'available')===true);
  const pokemon=primaryRows('pokemon').map(id=>({id,name:values('pokemon',id,'name'),speciesId:values('pokemon',id,'speciesId')}));
  const matchPokemon=name=>pokemon.filter(p=>key(p.name)===key(name));
  const chartMatch=need('supplement/opgg/type-chart').match(/\{normal:\{doubleDamageFrom:[\s\S]+?fairy:\{doubleDamageFrom:[^}]+\}\}/);
  if(!chartMatch)throw new Error('Supplemental type chart changed');
  const chart=JSON.parse(chartMatch[0].replace(/([,{])([A-Za-z]+):/g,'$1"$2":'));
  const types=primaryRows('types');
  if(Object.keys(chart).length!==18||types.some(t=>!chart[t]))throw new Error('Supplemental type inventory changed');
  for(const id of types){
    const matrix={};for(const defender of types){const t=chart[defender];if(!['noDamageFrom','doubleDamageFrom','halfDamageFrom'].every(k=>Array.isArray(t[k])&&t[k].every(t=>types.includes(t))))throw new Error('Invalid type chart');matrix[defender]=t.noDamageFrom.includes(id)?0:t.doubleDamageFrom.includes(id)?2:t.halfDamageFrom.includes(id)?0.5:1;}
    add(`types/${id}/effectiveness`,matrix,'supplement/opgg/type-chart',`TYPE_EFFECTIVENESS: attacker=${id}`,chart);
  }
  const statSet=new Set(['attack','defense','spAttack','spDefense','speed']);
  if(op.natures.natures.length!==25)throw new Error('Supplemental nature catalogue changed');
  const statSource='supplement/showdown/champions/scripts';
  if(!need(statSource).includes('stat * 110')||!raw[statSource].includes('stat * 90'))throw new Error('Nature multipliers changed');
  for(const n of op.natures.natures){
    if(!store.inventory.has(`natures/${n.key}`)||![n.increased,n.decreased].every(v=>v===null||statSet.has(v))||(n.increased===null)!==(n.decreased===null))throw new Error(`Invalid nature ${n.key}`);
    for(const f of ['increased','decreased'])add(`natures/${n.key}/${f}`,n[f],'supplement/opgg/natures',`natures[key=${n.key}].${f}`,n[f]);
    const multipliers={increased:n.increased===null?1:1.1,decreased:n.decreased===null?1:0.9};
    add(`natures/${n.key}/multipliers`,multipliers,'supplement/opgg/natures',`natures[key=${n.key}]`,n);
    add(`natures/${n.key}/multipliers`,multipliers,statSource,'Scripts.statModify nature modifiers',section(raw[statSource],{start:'\t\tconst nature =',end:'\n\tcalculatePP('}));
  }
  for(const claim of scopes.filter(c=>c.startsWith('moves/'))){
    const [,id,field]=claim.split('/'),m=op.moves.moves.find(m=>m.id===Number(id.slice(5)));
    if(!m||typeof m[field]!=='string'||!m[field].trim())throw new Error(`Missing supplemental move ${claim}`);
    add(claim,text(m[field]),'supplement/opgg/moves',`moves[id=${m.id}].${field}`,m[field]);
  }
  for(const number of [236,259]){
    const item=op.items.items.find(i=>i.id===number);
    if(!item?.affectedPokemonKeys?.length)throw new Error(`Missing affected Pokémon ${number}`);
    const affected=[];
    for(const slug of item.affectedPokemonKeys){
      const species=primaryRows('species').filter(id=>key(values('species',id,'name'))===key(slug));
      // These item effects apply by species, including regional forms in the primary inventory.
      const forms=pokemon.filter(p=>species.includes(p.speciesId));
      if(!forms.length)throw new Error(`Item restriction outside primary inventory ${slug}`);
      affected.push(...forms.map(p=>p.id));
    }
    const value=[{any:[...new Set(affected)].sort().map(pokemonId=>({predicate:'form-is',pokemonId}))}];
    add(`items/item-${number}/restrictions`,value,'supplement/opgg/items',`items[id=${number}].affectedPokemonKeys`,{effect:item.effect,affectedPokemonKeys:item.affectedPokemonKeys});
  }
  for(const [number,origin] of [[677,'0359000'],[683,'0445000'],[673,'0448000']]){
    const item=op.items.items.find(i=>i.id===number),other=op.pokedex.pokemon.find(p=>p.key===item?.pokemon_key);
    const targets=other?matchPokemon(other.name):[];
    if(targets.length!==1)throw new Error(`Ambiguous supplemental transformation ${number}`);
    const entity=`interactions/item-${number}--${origin}`,value={source:{collection:'items',id:`item-${number}`},target:{collection:'pokemon',id:targets[0].id},relation:'transforms',trigger:'mega-evolution',recipient:'holder',requirements:{all:[{predicate:'form-is',pokemonId:`pokemon-${origin}`},{predicate:'holds-item',itemId:`item-${number}`}]},parameters:{}};
    for(const [field,v] of Object.entries({identity:true,available:true,rule:value}))add(`${entity}/${field}`,v,'supplement/opgg/items',`items[id=${number}].pokemon_key`,{pokemon_key:item.pokemon_key,target:other.name});
  }
  const reviewed=await readJSON(root+'/rules/supplemental-reviewed.json');
  applySupplementalReviewed(store,scopes,reviewed,raw);
  const official='supplement/official/regulation',$=load(need(official));$('script,style').remove();
  const body=text($('body').text());
  if(!body.includes('Reglamento M-C'))throw new Error('Supplemental regulation identity changed');
  const dates=body.match(/(\d+) de (\w+) de (\d+) a las (\d\d:\d\d) UTC al .*?(\d+) de (\w+) de (\d+) a la[s]? (\d\d:\d\d) UTC/);
  const months={enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,octubre:10,noviembre:11,diciembre:12};
  if(!dates||!months[dates[2]]||!months[dates[6]])throw new Error('Regulation period changed');
  const date=(y,m,d)=>`${y}-${String(months[m]).padStart(2,'0')}-${d.padStart(2,'0')}`;
  const from=date(dates[3],dates[2],dates[1]),until=date(dates[7],dates[6],dates[5]);
  const captured=store.snapshot.asOf||store.snapshot.documents[official].capturedAt;
  if(captured>=`${from}T${dates[4]}:00Z`&&captured<=`${until}T${dates[8]}:00Z`){
    const rules={};
    for(const [field,re,mult] of [['battleTimeSeconds',/Tiempo de combate: (\d+) minutos/,60],['playerTimeSeconds',/Tiempo del jugador: (\d+) minutos/,60],['turnTimeSeconds',/Tiempo de turno: (\d+) segundos/,1],['teamPreviewSeconds',/Tiempo para la vista previa de equipos: (\d+) segundos/,1]]){const m=body.match(re);if(!m)throw new Error(`Regulation missing ${field}`);rules[field]=Number(m[1])*mult;}
    if(!body.includes('No se permite que dos Pokémon lleven el mismo objeto.')||!body.includes('Solo se puede megaevolucionar una vez por combate.'))throw new Error('Regulation clauses changed');
    Object.assign(rules,{itemClause:true,megaEvolutionLimit:1,startsAtUtc:`${from}T${dates[4]}:00Z`,endsAtUtc:`${until}T${dates[8]}:00Z`,eligibilityComplete:false});
    const rosterDoc='supplement/official/eligible-pokemon';
    const rosterMatch=need(rosterDoc).match(/const pokemons\s*=\s*(\[.*?\]);/s);
    if(!rosterMatch)throw new Error('Official roster format changed');
    const roster=JSON.parse(rosterMatch[1]);
    if(!roster.length||roster.some(r=>!Array.isArray(r)||r.length!==3||!/^\d{4}-\d{3}$/.test(r[0])||r[1]!==1||typeof r[2]!=='string'))throw new Error('Invalid official roster');
    const notice=(id)=>{const page=load(need(id));page('script,style').remove();return text(page('body').text());};
    const regularNotice=notice('supplement/official/roster-m-c');
    const specialNotice=notice('supplement/official/special-roster-m-c');
    if(!regularNotice.includes('Regular Roster M-C features Pokémon eligible for Ranked Battles in Regulation Set M-C.')||
      !specialNotice.includes('following Pokémon that are included in Regulation Set M-C.'))
      throw new Error('Official M-C roster notice changed');
    const fromNotices=[
      ['Squawkabilly (Blue Plumage)','pokemon-0931001',regularNotice],
      ['Squawkabilly (White Plumage)','pokemon-0931003',regularNotice],
      ['Maushold (Family of Three)','pokemon-0925000',specialNotice],
    ];
    for(const [name,id,body] of fromNotices)
      if(!body.includes(name)||!pokemon.some(p=>p.id===id))throw new Error(`Official M-C form not mapped: ${name}`);
    rules.eligiblePokemonNames=roster.map(r=>r[2]);
    rules.eligiblePokemonFromNotices=fromNotices.map(([,id])=>id);
    rules.eligiblePokemon=[...new Set([...roster.map(r=>'pokemon-'+r[0].replace('-','')).filter(id=>pokemon.some(p=>p.id===id)),...rules.eligiblePokemonFromNotices])];
    const unmapped=roster.filter(r=>!pokemon.some(p=>p.id==='pokemon-'+r[0].replace('-','')));
    rules.unmappedPokemonNames=unmapped.map(r=>r[2]);
    rules.unmappedPokemonCodes=unmapped.map(r=>r[0]);
    rules.eligibilityScope='Lista oficial de formas de entrada al equipo; las transformaciones en combate se documentan por separado. No valida movimientos, habilidades u objetos del equipo.';
    for(const [field,value] of Object.entries({identity:true,available:true,name:'Reglamento M-C',validFrom:{date:from,precision:'day'},validUntil:{date:until,precision:'day'},rules}))add(`regulations/m-c/${field}`,value,official,'Reglamento M-C: periodo, mecánicas, objetos y límites',body);
    add('regulations/m-c/rules',rules,rosterDoc,'const pokemons: lista oficial del reglamento enlazado',roster);
    add('regulations/m-c/rules',rules,'supplement/official/roster-m-c','Pokémon recién añadidos al roster M-C',regularNotice);
    add('regulations/m-c/rules',rules,'supplement/official/special-roster-m-c','Pokémon incluidos en el reglamento M-C',specialNotice);
    store.context.regulation='m-c';
  }else store.extraPending.push({claim:'regulations/current',reason:'current-regulation-needs-sources'});
  // Remove a placeholder only when its replacement has actually been provided.
  store.extraPending=store.extraPending.filter(p=>{
    if(p.reason==='transformation-needs-interpretation')return !store.claims.has(p.claim+'/rule');
    if(p.claim==='regulations/current'&&p.reason==='not-provided-by-source')return store.context.regulation!=='m-c';
    return true;
  });
  return {scopes,reviewed};
}
