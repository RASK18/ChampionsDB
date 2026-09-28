/** Browser-compatible graph indexes. No build step, database, or runtime dependency. */
export function createIndexes(data,coverage={complete:false}){
  const index=Object.fromEntries(Object.entries(data).map(([name,rows])=>[name,new Map(rows.map(row=>[row.id,row]))]));
  const pokemonByMove=new Map(),pokemonByAbility=new Map(),formsBySpecies=new Map();
  const append=(map,k,v)=>{if(!map.has(k))map.set(k,[]);map.get(k).push(v);};
  for(const p of data.pokemon){append(formsBySpecies,p.speciesId,p);for(const a of p.abilityIds||[])append(pokemonByAbility,a,p);}
  for(const l of data.learnsets)append(pokemonByMove,l.moveId,index.pokemon.get(l.pokemonId));
  const result=(records,collections)=>({records,coverage:{complete:coverage.complete===true,collections:Object.fromEntries(collections.map(c=>[c,coverage.collections?.[c]||null])),absenceMeansImpossible:false}});
  function producersOfEffect(effectId,{includeIndirect=true}={}){
    const producers=new Map();
    function add(p,path){if(!p)return;if(!producers.has(p.id))producers.set(p.id,{pokemon:p,paths:[]});const row=producers.get(p.id);if(!row.paths.some(existing=>JSON.stringify(existing)===JSON.stringify(path)))row.paths.push(path);}
    const direct=data.interactions.filter(x=>x.rule.relation==='causes'&&x.rule.target.collection==='effects'&&x.rule.target.id===effectId);
    for(const interaction of direct){
      const rule=interaction.rule;const holders=rule.source.collection==='moves'?pokemonByMove.get(rule.source.id):rule.source.collection==='abilities'?pokemonByAbility.get(rule.source.id):[];
      for(const p of holders||[])add(p,{kind:'direct',via:rule.source,interactionId:interaction.id,requirements:rule.requirements,parameters:rule.parameters});
    }
    if(includeIndirect){
      for(const copy of data.interactions.filter(x=>x.rule.relation==='copies')){
        const rule=copy.rule;const holders=rule.source.collection==='moves'?pokemonByMove.get(rule.source.id):pokemonByAbility.get(rule.source.id);
        for(const directRule of direct.filter(x=>x.rule.source.collection===rule.target.collection)){
          for(const p of holders||[])add(p,{kind:'indirect',via:rule.source,interactionId:copy.id,copied:directRule.rule.source,resultingInteractionId:directRule.id,requirements:{all:[rule.requirements,{predicate:'opponent-has-copyable-source',source:directRule.rule.source},{predicate:'copied-source-activates'}]},eligibility:'conditional-not-evaluated'});
        }
      }
    }
    return result([...producers.values()].sort((a,b)=>a.pokemon.id.localeCompare(b.pokemon.id)),['pokemon','learnsets','abilities','interactions']);
  }
  return {
    get:(collection,id)=>index[collection]?.get(id),
    pokemonForMove:id=>result(pokemonByMove.get(id)||[],['pokemon','learnsets']),
    pokemonForAbility:id=>result(pokemonByAbility.get(id)||[],['pokemon','abilities']),
    formsOfSpecies:id=>result(formsBySpecies.get(id)||[],['species','pokemon']),
    relatedToEffect:id=>result(data.interactions.filter(x=>x.rule.target.id===id&&x.rule.target.collection==='effects'||x.rule.source.id===id&&x.rule.source.collection==='effects'),['interactions']),
    conditions:()=>result(data.effects.filter(e=>e.category==='status'),['effects']),
    berries:()=>result(data.items.filter(i=>i.category==='berry'),['items']),
    megaStones:()=>result(data.items.filter(i=>i.category==='mega-stone'),['items']),
    regulation:id=>({record:index.regulations.get(id),coverage:{complete:coverage.complete===true,absenceMeansUnrestricted:false}}),
    producersOfEffect
  };
}

/** `base` must point to the data directory, e.g. /ChampionsDB/data/. */
export async function loadDatabase(base,{fetcher=fetch}={}){
  const names=['types','species','pokemon','learnsets','moves','abilities','items','effects','interactions','natures','battle-rules','regulations'];
  const get=async name=>{const response=await fetcher(`${base.replace(/\/$/,'')}/${name}.json`);if(!response.ok)throw new Error(`Cannot load ${name}: ${response.status}`);return response.json();};
  const values=await Promise.all(names.map(get));const coverage=await get('reports/coverage');
  return createIndexes(Object.fromEntries(names.map((name,i)=>[name,values[i]])),coverage);
}
