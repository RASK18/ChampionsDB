import {load} from 'cheerio';
import {Claims} from './claims.mjs';
import {key,text,resolvedDex} from './parsers.mjs';
import {statMap,ref} from './model.mjs';

const pad=n=>String(n).padStart(3,'0');
const sorted=values=>[...new Set(values)].sort();
export const ids={move:n=>`move-${pad(n)}`,ability:n=>`ability-${pad(n)}`,item:n=>`item-${pad(n)}`,pokemon:n=>`pokemon-${n}`,species:n=>`species-${pad(n)}`};
const statusIds={paralysis:'paralysis',freezing:'freezing',burning:'burning',poison:'poison','bad-poison':'bad-poison',sleep:'sleep'};
const psStatus={par:'paralysis',frz:'freezing',brn:'burning',psn:'poison',tox:'bad-poison',slp:'sleep'};
const psEffect={sunnyday:'harsh-sunlight',raindance:'rain',sandstorm:'sandstorm',snow:'snow',electricterrain:'electric-terrain',grassyterrain:'grassy-terrain',mistyterrain:'misty-terrain',psychicterrain:'psychic-terrain',confusion:'confused',attract:'infatuated',yawn:'drowsy',gastroacid:'no-ability',torment:'unable-to-repeat',healblock:'healing-prevented',disable:'move-disabled',trapped:'cant-escape',lockon:'locked-on',charge:'electric-boost',taunt:'taunted',ingrain:'ingrained',curse:'cursed',trickortreat:'trick-or-treating',imprison:'sealing-off',perishsong:'perishing',destinybond:'destiny-bound',forestscurse:'forest-cursed',leechseed:'leech-seeded',partiallytrapped:'bound',lockedmove:'rampaging',futuremove:'future-attack',smackdown:'landed',fairylock:'fairy-locked',throatchop:'throat-chopped',saltcure:'salt-cured',syrupbomb:'syrupy',mustrecharge:'recharging',twoturnmove:'charging',fly:'sky-high',dive:'submerged',dig:'underground',phantomforce:'concealed',minimize:'minimized',powershift:'atk-def-swapped',flashfire:'flash-fire',micleberry:'micle-berry'};
const psPokemonKey=slug=>slug.startsWith('mega-')?slug.slice(5).replace(/-(x|y|z)$/,'-mega-$1')+( /-(x|y|z)$/.test(slug)?'':'-mega'):slug.replace(/-alolan$/,'-alola').replace(/-galarian$/,'-galar').replace(/-female$/,'-f').replace(/-male$/,'').replace(/-average$/,'').replace(/-amped$/,'').replace(/-green-plumage$/,'').replace(/-paldean-combat$/,'-paldea-combat').replace(/-paldean-blaze$/,'-paldea-blaze').replace(/-paldean-aqua$/,'-paldea-aqua');

function formKey(name,form,fo){
  if(form.startsWith('Mega '))return key(form);
  if(form==='Alolan Form')return key(name+' alolan');
  if(form==='Galarian Form')return key(name+' galarian');
  if(form==='Hisuian Form')return key(name+' hisui');
  if(form.startsWith('Paldean Form'))return key(name+' paldean '+form.match(/\((\w+) Breed\)/)[1]);
  if(name==='Rotom'&&fo!=='0')return key('rotom '+form.replace(' Rotom',''));
  if(name==='Maushold')return fo==='0'?'mausholdfamilyofthree':'mausholdfamilyoffour';
  if(fo==='0')return ({Meowstic:'meowsticmale',Indeedee:'indeedeemale',Basculegion:'basculegionmale',Gourgeist:'gourgeistaverage',Toxtricity:'toxtricityamped',Squawkabilly:'squawkabillygreenplumage'})[name]||key(name);
  const suffix={Female:'female','Blade Forme':'blade','Small Variety':'small','Large Variety':'large','Jumbo Variety':'super','Midnight Form':'midnight','Dusk Form':'dusk','Low Key Form':'low-key','Hero Form':'hero','Blue Plumage':'blue-plumage','Yellow Plumage':'yellow-plumage','White Plumage':'white-plumage'}[form];
  return suffix?key(name+' '+suffix):key(name+' '+form);
}
function parseTypeChart(code){
  const match=code.match(/\{normal:\{doubleDamageFrom:[\s\S]+?fairy:\{doubleDamageFrom:[^}]+\}\}/);
  if(!match)throw new Error('Type chart structure changed');
  const chart=JSON.parse(match[0].replace(/([,{])([A-Za-z]+):/g,'$1"$2":'));
  if(Object.keys(chart).length!==18)throw new Error('Expected 18 types');return chart;
}

export async function normalize(snapshot,inputs){
  const {tables:t,op,raw}=inputs;const c=new Claims(snapshot);const dex=await resolvedDex(raw);
  for(const item of op.items.items.filter(i=>!['hold-items','mega-stones','berries'].includes(i.category))){
    if(item.category==='miscellaneous'&&item.id===undefined)c.mapping.push({collection:'items',opgg:item.key,scope:'non-combat',category:item.category});
    else{c.expect('items',item.id===undefined?`opgg-${item.key}`:ids.item(item.id));c.extraPending.push({claim:`items/${item.key}`,reason:'unknown-item-category',category:item.category});}
  }
  op.items.items=op.items.items.filter(i=>['hold-items','mega-stones','berries'].includes(i.category));
  const table=(lang,name)=>t[`champout/${lang}/${name}`];
  const label=(name,label)=>table('esp',name)?.[label];
  const add=(coll,id,field,value,doc,loc,observed)=>c.add(coll,id,field,value,doc,loc,observed);
  const psDoc=(kind,id,field)=>`showdown/${dex.sourceFields[kind==='moves'?'Moves':kind==='items'?'Items':'Conditions']?.[id]?.includes(field)?'champions':'base'}/${kind}`;
  const basic=(coll,id,doc,loc,available)=>{add(coll,id,'identity',true,doc,loc);if(available!==undefined)add(coll,id,'available',available,doc,loc+'.available');};
  const txt=(coll,id,field,name,lbl)=>{const v=label(name,lbl);if(v!==undefined)add(coll,id,field,text(v),`champout/esp/${name}`,lbl,v);};
  const pRows=t['champout/masterdata/personal'],mRows=t['champout/masterdata/waza'];
  const typeList=op.types.types,chart=parseTypeChart(raw['opgg/type-chart-code']);
  const typeByNum=Object.fromEntries(typeList.map(x=>[x.id,x.key]));
  for(const type of typeList){
    const id=type.key,lbl=Object.entries(table('usa','typename')).find(([,v])=>key(v)===key(id))?.[0];
    if(!lbl)throw new Error(`Unknown type ${id}`);
    basic('types',id,'champout/esp/typename',lbl,true);basic('types',id,'opgg/types',`types[key=${id}]`,true);
    txt('types',id,'name','typename',lbl);add('types',id,'name',text(type.name),'opgg/types',`types[key=${id}].name`);
    // Each cell is a separate claim: an incomplete matrix remains visibly incomplete.
    c.inventory.get(`types/${id}`).delete('effectiveness');
    for(const def of typeList){const entry=chart[def.key];
      const value=entry.noDamageFrom.includes(id)?0:entry.doubleDamageFrom.includes(id)?2:entry.halfDamageFrom.includes(id)?0.5:1;
      add('types',id,`effectiveness.${def.key}`,value,'opgg/type-chart-code',`TYPE_EFFECTIVENESS.${def.key}`,entry);
      const d=dex.types.get(def.key);const code=d.damageTaken[dex.types.get(id).name];
      add('types',id,`effectiveness.${def.key}`,({0:1,1:2,2:0.5,3:0})[code]??1,'showdown/base/typechart',`${d.id}.damageTaken.${dex.types.get(id).name}`,code??0);
    }
  }
  const moveByKey=Object.fromEntries(op.moves.moves.map(x=>[key(x.key),ids.move(x.id)]));
  const abilityByKey=Object.fromEntries(op.abilities.abilities.map(x=>[key(x.key),ids.ability(x.id)]));
  const itemByKey=Object.fromEntries(op.items.items.map(x=>[key(x.key),ids.item(x.id)]));
  const usedAbilities=new Set(pRows.filter(p=>p.is_valid==='1').flatMap(p=>[p.toku0,p.toku1,p.toku2]).map(Number));
  const usedOpAbilities=new Set(op.pokemon.pokemon.flatMap(p=>p.abilities).map(key));
  const mappedPokemon=new Map(), opPokemon=new Map(op.pokemon.pokemon.map(p=>[key(p.key),p]));
  const sourceIds={pokemon:{},moves:{},abilities:{},items:{},effects:{}};
  for(const p of pRows){
    const id=ids.pokemon(p.id),sid=ids.species(p.no),name=table('usa','monsname_syn')[p.ms_name_lbl],form=table('usa','zkn_form_syn')[p.ms_form_lbl]||'';
    const pk=formKey(name,form,p.fo),other=opPokemon.get(pk),doc='champout/masterdata/personal',loc=`[id=${p.id}]`;
    // Purely cosmetic variants are tracked explicitly outside the combat inventory.
    if(['666','671','676','869','855','1013'].includes(p.no)&&p.fo!=='0'){
      c.mapping.push({collection:'pokemon',id,champout:p.id,scope:'cosmetic',form});continue;
    }
    basic('pokemon',id,doc,loc,p.is_valid==='1');basic('species',sid,doc,loc,p.is_valid==='1');
    txt('species',sid,'name','monsname_syn',p.ms_name_lbl);add('species',sid,'nationalDex',Number(p.no),doc,loc+'.no',p.no);
    txt('pokemon',id,'name',form?'zkn_form_syn':'monsname_syn',form?p.ms_form_lbl:p.ms_name_lbl);
    add('pokemon',id,'speciesId',sid,doc,loc+'.no',p.no);
    add('pokemon',id,'form',{kind:form.startsWith('Mega ')?'mega':/Alolan|Galarian|Hisuian|Paldean/.test(form)?'regional':p.fo==='0'?'base':form==='Female'?'gender':'alternate'},doc,loc+'.ms_form_lbl',form);
    add('pokemon',id,'typeIds',sorted([typeByNum[p.type1],typeByNum[p.type2]]),doc,loc+'.type1/type2',[p.type1,p.type2]);
    for(const [field,col] of Object.entries({hp:'hp',attack:'atk',defense:'def',spAttack:'spatk',spDefense:'spdef',speed:'agi'}))add('pokemon',id,`stats.${field}`,Number(p[col]),doc,loc+'.'+col,p[col]);
    add('pokemon',id,'weightKg',Number(p.weight)/10,doc,loc+'.weight',p.weight);
    add('pokemon',id,'sex',({0:'mixed',1:'male',2:'genderless',3:'female'})[p.sex],doc,loc+'.sex',p.sex);
    add('pokemon',id,'abilityIds',sorted([p.toku0,p.toku1,p.toku2].map(ids.ability)),doc,loc+'.toku0/toku1/toku2',[p.toku0,p.toku1,p.toku2]);
    if(!other){
      const exceptional={castformsunnyform:'castformsunny',castformrainyform:'castformrainy',castformsnowyform:'castformsnowy'}[pk];
      const ps=exceptional&&dex.species.get(exceptional);
      if(ps?.exists&&Object.hasOwn(dex.sourceFields.FormatsData,ps.id)&&!ps.isNonstandard){
        basic('pokemon',id,'showdown/champions/formats-data',ps.id,true);
        add('pokemon',id,'speciesId',ids.species(ps.num),'showdown/base/pokedex',ps.id+'.num',ps.num);
        add('pokemon',id,'form',{kind:'alternate'},'showdown/base/pokedex',ps.id+'.forme',ps.forme);
        add('pokemon',id,'typeIds',sorted(ps.types.map(key)),'showdown/base/pokedex',ps.id+'.types',ps.types);
        for(const [s,v] of Object.entries(ps.baseStats))add('pokemon',id,`stats.${statMap[s]}`,v,'showdown/base/pokedex',ps.id+'.baseStats.'+s);
        add('pokemon',id,'weightKg',ps.weightkg,'showdown/base/pokedex',ps.id+'.weightkg');
        add('pokemon',id,'sex',ps.gender==='N'?'genderless':ps.gender==='M'?'male':ps.gender==='F'?'female':'mixed','showdown/base/pokedex',ps.id+'.genderRatio',ps.genderRatio);
        add('pokemon',id,'abilityIds',sorted(Object.values(ps.abilities).map(a=>ids.ability(dex.abilities.get(a).num))),'showdown/base/pokedex',ps.id+'.abilities',ps.abilities);
        c.mapping.push({collection:'pokemon',id,champout:p.id,showdown:ps.id});
      }else c.mapping.push({collection:'pokemon',id,champout:p.id,unmatched:pk});
      continue;
    }
    mappedPokemon.set(other.key,{p,other,id});opPokemon.delete(pk);sourceIds.pokemon[other.key]=id;
    c.mapping.push({collection:'pokemon',id,champout:p.id,opgg:other.key});
    const oLoc=`pokemon[key=${other.key}]`;
    basic('pokemon',id,'opgg/pokemon',oLoc,true);basic('species',sid,'opgg/pokemon',oLoc,true);
    add('pokemon',id,'name',text(other.name),'opgg/pokemon',oLoc+'.name');
    add('pokemon',id,'speciesId',sid,'opgg/pokemon',oLoc+'.key',other.key);
    // Mapping derives the national number from the exact species/form identity, not stats.
    const baseNumber=other.id<10000?other.id:op.pokemon.pokemon.find(x=>x.key===other.base_key)?.id;
    if(baseNumber!==undefined&&baseNumber<10000)add('species',sid,'nationalDex',baseNumber,'opgg/pokemon',oLoc+'.id/base_key',{id:other.id,base_key:other.base_key||null});
    if(p.fo==='0')add('species',sid,'name',text(other.name),'opgg/pokemon',oLoc+'.name');
    add('pokemon',id,'typeIds',sorted(other.types),'opgg/pokemon',oLoc+'.types',other.types);
    for(const [s,v] of Object.entries(other.stats))add('pokemon',id,`stats.${s}`,v,'opgg/pokemon',oLoc+'.stats.'+s);
    add('pokemon',id,'abilityIds',sorted(other.abilities.map(a=>abilityByKey[key(a)]).filter(Boolean)),'opgg/pokemon',oLoc+'.abilities',other.abilities);
    const ps=dex.species.get(psPokemonKey(other.key));
    if(ps.exists&&ps.num===Number(p.no)){
      add('pokemon',id,'weightKg',ps.weightkg,'showdown/base/pokedex',ps.id+'.weightkg');
      add('pokemon',id,'sex',ps.gender==='M'?'male':ps.gender==='F'?'female':ps.gender==='N'?'genderless':'mixed','showdown/base/pokedex',ps.id+'.gender',ps.gender||ps.genderRatio);
      const psKind=ps.isMega?'mega':/Alola|Galar|Hisui|Paldea/.test(ps.forme)?'regional':p.fo==='0'?'base':ps.gender==='F'?'gender':'alternate';
      add('pokemon',id,'form',{kind:psKind},'showdown/base/pokedex',ps.id+'.forme',ps.forme);
    }
  }
  for(const other of opPokemon.values()){
    const base=other.key.endsWith('-female')&&op.pokemon.pokemon.find(p=>p.key===other.key.replace(/-female$/,''));
    if(base&&base.id===other.id&&JSON.stringify(base.stats)===JSON.stringify(other.stats)&&JSON.stringify(sorted(base.abilities))===JSON.stringify(sorted(other.abilities))&&JSON.stringify(sorted(base.moves))===JSON.stringify(sorted(other.moves))){
      c.mapping.push({collection:'pokemon',opgg:other.key,scope:'cosmetic',reason:'same-number-stats-abilities-learnset; sex represented on base record'});continue;
    }
    const id=`opgg-${other.key}`;basic('pokemon',id,'opgg/pokemon',`pokemon[key=${other.key}]`,true);c.mapping.push({collection:'pokemon',id,opgg:other.key,unmatched:true});
  }

  const opMoves=new Map(op.moves.moves.map(m=>[Number(m.id),m]));
  const targetMap={normal:'selected-pokemon',self:'user',adjacentAlly:'ally',allAdjacentFoes:'all-opponents',allAdjacent:'all-other-pokemon',all:'entire-field',foeSide:'opponents-field',allySide:'users-field',allyTeam:'user-and-allies',randomNormal:'random-opponent',adjacentAllyOrSelf:'user-or-ally',any:'selected-pokemon'};
  for(const m of mRows){
    const id=ids.move(m.id),o=opMoves.get(Number(m.id)),doc='champout/masterdata/waza',loc=`[id=${m.id}]`;
    basic('moves',id,doc,loc,m.available==='1');txt('moves',id,'name',m.ms_name,m.ms_lbl);txt('moves',id,'description',m.ms_name_info,m.ms_lbl_info);
    add('moves',id,'typeId',typeByNum[m.type],doc,loc+'.type',m.type);
    const category=['physical','special','status'][Number(m.category)];add('moves',id,'category',category,doc,loc+'.category',m.category);
    for(const field of ['pp','priority'])add('moves',id,field,Number(m[field]),doc,loc+'.'+field,m[field]);
    // 0 and the sentinel 1 do not distinguish variable power, fixed damage or OHKO.
    // Special power semantics require corroborated descriptions or explicit mechanics.
    if(Number(m.power)>1||category==='status')add('moves',id,'power',category==='status'?{kind:'not-applicable'}:{kind:'fixed',value:Number(m.power)},doc,loc+'.power',m.power);
    if(Number(m.accuracy)>0)add('moves',id,'accuracy',Number(m.accuracy)===101?{kind:'not-applicable'}:{kind:'percent',value:Number(m.accuracy)},doc,loc+'.accuracy',m.accuracy);
    if(o){
      const ol=`moves[id=${o.id}]`;sourceIds.moves[o.key]=id;
      basic('moves',id,'opgg/moves',ol,o.isAvailable);add('moves',id,'name',text(o.name),'opgg/moves',ol+'.name');
      add('moves',id,'description',text(o.description),'opgg/moves',ol+'.description',o.description);
      for(const field of ['category','pp','priority','target'])add('moves',id,field,o[field],'opgg/moves',ol+'.'+field);
      add('moves',id,'typeId',o.type,'opgg/moves',ol+'.type');
      if(o.category==='status'||o.power>1)add('moves',id,'power',o.category==='status'?{kind:'not-applicable'}:{kind:'fixed',value:o.power},'opgg/moves',ol+'.power',o.power);
      add('moves',id,'accuracy',o.accuracy===null?{kind:'not-applicable'}:{kind:'percent',value:o.accuracy},'opgg/moves',ol+'.accuracy',o.accuracy);
      const ps=dex.moves.get(o.key);
      if(ps.exists){
        const sl=ps.id;
        add('moves',id,'target',targetMap[ps.target],psDoc('moves',sl,'target'),sl+'.target',ps.target);
        if(Number(m.power)===0&&category!=='status')add('moves',id,'power',{kind:'variable'},psDoc('moves',sl,'basePower'),sl+'.basePower',ps.basePower);
        if(ps.accuracy===true)add('moves',id,'accuracy',{kind:'not-applicable'},psDoc('moves',sl,'accuracy'),sl+'.accuracy',true);
        // Properties are individually corroborated, including known false values.
        c.inventory.get(`moves/${id}`).delete('properties');
        const flags={contact:'contact',sound:'sound',punch:'punch',bite:'bite',bullet:'ball-bomb',pulse:'pulse',dance:'dance',wind:'wind',slicing:'slicing'};
        for(const [flag,trait] of Object.entries(flags)){
          add('moves',id,`properties.${flag}`,Boolean(ps.flags[flag]),psDoc('moves',sl,'flags'),sl+'.flags.'+flag,ps.flags);
          add('moves',id,`properties.${flag}`,(o.moveTraits||[]).includes(trait),'opgg/moves',ol+'.moveTraits',o.moveTraits);
        }
      }
    }
  }
  for(const o of opMoves.values())if(!mRows.some(m=>Number(m.id)===o.id))basic('moves',ids.move(o.id),'opgg/moves',`moves[id=${o.id}]`,o.isAvailable);

  for(const a of op.abilities.abilities){
    const id=ids.ability(a.id),lbl=`TOKUSEI_${pad(a.id)}`,info=`TOKUSEIINFO_SYN_${pad(a.id)}`,ol=`abilities[id=${a.id}]`;
    sourceIds.abilities[a.key]=id;
    basic('abilities',id,'opgg/abilities',ol,usedOpAbilities.has(key(a.key))?true:undefined);
    if(label('tokusei',lbl)!==undefined)basic('abilities',id,'champout/esp/tokusei',lbl);
    if(usedAbilities.has(a.id))add('abilities',id,'available',true,'champout/masterdata/personal',`toku0|toku1|toku2=${a.id}`,a.id);
    txt('abilities',id,'name','tokusei',lbl);txt('abilities',id,'description','tokuseiinfo_syn',info);
    add('abilities',id,'name',text(a.name),'opgg/abilities',ol+'.name');add('abilities',id,'description',text(a.description),'opgg/abilities',ol+'.description',a.description);
  }
  // Abilities in game tables but absent from the second catalogue must still be inventoried.
  for(const number of usedAbilities)if(!op.abilities.abilities.some(a=>a.id===number))basic('abilities',ids.ability(number),'champout/masterdata/personal',`ability=${number}`,true);

  for(const o of op.items.items){
    const id=ids.item(o.id),ol=`items[id=${o.id}]`,m=t['champout/masterdata/item'].find(x=>Number(x.id)===o.id);sourceIds.items[o.key]=id;
    basic('items',id,'opgg/items',ol,true);add('items',id,'name',text(o.name),'opgg/items',ol+'.name');
    add('items',id,'description',text(o.effect),'opgg/items',ol+'.effect',o.effect);
    add('items',id,'category',o.category==='mega-stones'?'mega-stone':o.category==='berries'?'berry':'held-item','opgg/items',ol+'.category',o.category);
    if(m){const loc=`[id=${m.id}]`;basic('items',id,'champout/masterdata/item',loc);
      txt('items',id,'name',m.ms_name,m.ms_lbl);txt('items',id,'description',m.ms_name_info,m.ms_lbl_info);
      // Table presence alone does not prove an item is currently obtainable.
      const ps=dex.items.get(o.key);
      if(ps.exists&&!ps.isNonstandard){basic('items',id,'showdown/champions/items',ps.id,true);add('items',id,'category',ps.megaStone?'mega-stone':ps.isBerry?'berry':'held-item','showdown/base/items',ps.id,ps.megaStone||ps.isBerry||'held-item');}
    }
  }
  for(const m of t['champout/masterdata/item'])if(!op.items.items.some(o=>o.id===Number(m.id)))basic('items',ids.item(m.id),'champout/masterdata/item',`[id=${m.id}]`);

  for(const e of op.effects.buffEffects){
    if(e.slug==='badly-poisoned')continue; // Same toxic status, canonical definition is below.
    const id=e.slug,ol=`buffEffects[id=${e.id}]`;sourceIds.effects[e.slug]=id;
    basic('effects',id,'opgg/effects',ol,true);
    basic('effects',id,`champout/esp/${e.label.namespace}`,e.label.key,true);
    txt('effects',id,'name',e.label.namespace,e.label.key);txt('effects',id,'description',e.infoLabel.namespace,e.infoLabel.key);
    add('effects',id,'name',text(e.name),'opgg/effects',ol+'.name');add('effects',id,'description',text(e.infoLabel.name),'opgg/effects',ol+'.infoLabel.name',e.infoLabel.name);
    const category=e.type===2?'weather':e.slug.endsWith('-terrain')?'terrain':e.type===1?'field':'volatile';
    add('effects',id,'category',category,'opgg/effects',ol+'.type',e.type);
    const psId=Object.entries(psEffect).find(([,v])=>v===id)?.[0]||key(id);
    const ps=dex.conditions.get(psId);
    if(ps.exists&&['Weather','Terrain'].includes(ps.effectType))add('effects',id,'category',ps.effectType.toLowerCase(),psDoc('conditions',psId,'effectType'),psId+'.effectType',ps.effectType);
  }
  for(const e of op.conditions.conditions){
    const id=statusIds[e.key];if(!id)throw new Error(`Unknown condition ${e.key}`);
    const ol=`conditions[key=${id}]`,lbl=`btl_condition_${id.replaceAll('-','_')}_info`;
    basic('effects',id,'opgg/conditions',ol,true);basic('effects',id,'champout/esp/btl_condition',lbl,true);
    add('effects',id,'name',text(e.name),'opgg/conditions',ol+'.name');
    const ui={paralysis:'mahi',freezing:'koori',burning:'yakedo',poison:'doku','bad-poison':'moudoku',sleep:'nemuri'}[id];txt('effects',id,'name','ui_control',`ui_control_${ui}`);
    txt('effects',id,'description','btl_condition',lbl);add('effects',id,'description',text(e.description),'opgg/conditions',ol+'.description',e.description);
    add('effects',id,'category','status','opgg/conditions',ol);add('effects',id,'category','status','champout/esp/btl_condition',lbl);
  }

  for(const n of op.natures.natures){
    const id=n.key,ol=`natures[id=${n.id}]`,lbl=`SEIKAKU_${pad(n.id)}`;basic('natures',id,'opgg/natures',ol,true);basic('natures',id,'champout/esp/seikaku',lbl,true);
    txt('natures',id,'name','seikaku',lbl);add('natures',id,'name',text(n.name),'opgg/natures',ol+'.name');
    const ps=dex.natures.get(n.key);
    for(const [field,pfield] of [['increased','plus'],['decreased','minus']]){add('natures',id,field,n[field],'opgg/natures',ol+'.'+field);add('natures',id,field,statMap[ps[pfield]]||null,'showdown/base/natures',ps.id+'.'+pfield,ps[pfield]||null);}
    const mult={increased:n.increased?1.1:1,decreased:n.decreased?0.9:1};
    add('natures',id,'multipliers',mult,'champout/esp/help_syn','help_04_02_01 + SEIKAKU identity',label('help_syn','help_04_02_01'));
    add('natures',id,'multipliers',{increased:ps.plus?1.1:1,decreased:ps.minus?0.9:1},'showdown/champions/scripts','pokemon.calculateStat:natureModify',ps.plus||'neutral');
  }

  const learnRows=new Map(t['champout/masterdata/waza_learn'].map(x=>[x.id,x]));
  for(const p of pRows.filter(p=>c.inventory.has(`pokemon/${ids.pokemon(p.id)}`))){
    const pid=ids.pokemon(p.id),other=[...mappedPokemon.values()].find(x=>x.p.id===p.id)?.other;
    const m=learnRows.get(p.id);if(!m)throw new Error(`Missing learnset ${p.id}`);
    const sourceMoves=new Set(m.waza.split(',').filter(Boolean).map(ids.move));
    const opLearn=new Set((other?.moves||[]).map(x=>moveByKey[key(x)]).filter(Boolean));
    for(const mid of sorted([...sourceMoves,...opLearn])){
      const id=`${pid}--${mid}`;
      const observations=[['champout/masterdata/waza_learn',`[id=${p.id}].waza`,sourceMoves.has(mid)]];
      if(other)observations.push(['opgg/pokemon',`pokemon[key=${other.key}].moves`,opLearn.has(mid)&&!other.bannedMoves?.some(x=>moveByKey[key(x)]===mid)]);
      for(const [doc,loc,present] of observations){
        basic('learnsets',id,doc,loc,present?true:undefined);add('learnsets',id,'pokemonId',pid,doc,loc);add('learnsets',id,'moveId',mid,doc,loc);
      }
    }
  }
  addInteractions(c,inputs,dex,sourceIds);
  // Full mechanics/regulations remain inventoried even when no second source is available.
  for(const id of ['stat-calculation','damage-calculation','turn-order','critical-hits','accuracy-evasion','stat-stages','switching','mega-evolution','ability-copying','move-copying','paralysis','freezing'])c.expect('battle-rules',id);
  for(const id of sorted(op.pokemon.pokemon.map(p=>p.regulation).filter(Boolean)))c.expect('regulations',id.toLowerCase());
  c.sourceIds=sourceIds;
  return c;
}

function addInteractions(c,inputs,dex,sourceIds){
  const {op,tables:t}=inputs;
  const rule=(id,value,docs)=>{for(const [doc,loc,observed] of docs){c.add('interactions',id,'identity',true,doc,loc,observed);c.add('interactions',id,'available',true,doc,loc,observed);c.add('interactions',id,'rule',value,doc,loc,observed);}};
  const effectMap={...Object.fromEntries(op.effects.buffEffects.map(e=>[key(e.slug),e.slug])),...psEffect,...psStatus};
  for(const item of op.items.items.filter(i=>i.category==='mega-stones')){
    const target=op.pokemon.pokemon.find(p=>p.key===item.pokemon_key);
    const from=target?.base_key&&sourceIds.pokemon[target.base_key],to=target&&sourceIds.pokemon[target.key];
    const ps=dex.items.get(item.key);
    const pair=typeof ps.megaStone==='string'?[ps.megaEvolves,ps.megaStone]:Object.entries(ps.megaStone||{}).find(([origin,destination])=>key(destination)===key(psPokemonKey(target?.key||'')));
    if(!from||!to||!pair||key(pair[1])!==key(psPokemonKey(target.key))||key(pair[0])!==key(psPokemonKey(target.base_key)))continue;
    const source=ref('items',ids.item(item.id)),requirements={all:[{predicate:'form-is',pokemonId:from},{predicate:'holds-item',itemId:source.id}]};
    const psDocument=`showdown/${dex.sourceFields.Items?.[ps.id]?.includes('megaStone')?'champions':'base'}/items`;
    rule(`${source.id}--transforms--${to}`,{source,target:ref('pokemon',to),relation:'transforms',trigger:'mega-evolution',recipient:'holder',requirements,parameters:{}},[['opgg/items',`items[id=${item.id}].pokemon_key`,{target:item.pokemon_key,origin:target.base_key}],[psDocument,`${ps.id}.megaStone`,{target:pair[1],origin:pair[0]}]]);
    const raw=t['champout/masterdata/item'].find(i=>Number(i.id)===item.id);
    if(raw?.personal_usepoke===from.slice(8)){
      for(const [doc,loc,observed] of [['champout/masterdata/item',`[id=${item.id}].personal_usepoke`,raw.personal_usepoke],[psDocument,`${ps.id}.megaStone`,pair[0]]])c.add('items',source.id,'restrictions',[{predicate:'form-is',pokemonId:from}],doc,loc,observed);
    }
  }
  for(const move of op.moves.moves.filter(m=>m.isAvailable)){
    const m=dex.moves.get(move.key),source=ref('moves',ids.move(move.id));
    const effects=[...op.effects.buffEffects,...op.conditions.conditions].filter(e=>e.sourceMoves?.some(s=>s.key===move.key));
    for(const [field,trigger] of [['weather','on-use'],['terrain','on-use'],['pseudoWeather','on-use'],['sideCondition','on-hit'],['volatileStatus','on-hit'],['status','on-hit']]){
      if(field!=='status')continue; // Text-only causal relationships require a hash-bound review.
      const targetId=effectMap[m[field]];if(!targetId)continue;
      const e=effects.find(e=>(e.slug||e.key)===targetId);if(!e)continue;
      // OP.GG membership is insufficient: require explicit causal text for weather/field,
      // or structured ailment metadata for primary statuses.
      const causal=field==='status'?((psStatus[m.status]===move.meta?.ailment)||(m.status==='brn'&&move.meta?.ailment==='burn')||(m.status==='frz'&&move.meta?.ailment==='freeze')):/provoca|hace que|durante cinco turnos|cubre|extiende|coloca|crea|esparce|siembra|invoca/i.test(move.description);
      if(!causal){c.extraPending.push({claim:`interactions/${source.id}--${targetId}`,reason:'association-needs-semantic-review'});continue;}
      const r={source,target:ref('effects',targetId),relation:'causes',trigger,recipient:m.target==='self'?'self':'target',requirements:{all:[]},parameters:{}};
      rule(`${source.id}--causes--${targetId}`,r,[['opgg/moves',`moves[id=${move.id}].description`,move.description],['showdown/base/moves',`${m.id}.${field}`,m[field]]]);
    }
    // Secondary status infliction: both providers specify the status and probability.
    for(const secondary of m.secondaries||[]){const targetId=psStatus[secondary.status];if(!targetId)continue;
      const ailment={burn:'burning',freeze:'freezing'}[move.meta?.ailment]||move.meta?.ailment;
      if(ailment!==targetId||move.meta?.ailmentChance!==secondary.chance)continue;
      rule(`${source.id}--secondary--${targetId}`,{source,target:ref('effects',targetId),relation:'causes',trigger:'on-hit',recipient:'target',requirements:{all:[]},parameters:{probability:secondary.chance/100}},[['opgg/moves',`moves[id=${move.id}].meta`,move.meta],['showdown/base/moves',`${m.id}.secondaries`,m.secondaries]]);
    }
  }
  // Every association is inventoried; a broad relation never silently becomes causal.
  for(const effect of [...op.effects.buffEffects,...op.conditions.conditions])for(const [list,collection] of [['sourceMoves','moves'],['sourceAbilities','abilities'],['sourceItems','items']])for(const entry of effect[list]||[]){
    const id=`association-${collection}-${entry.key}--${effect.slug||effect.key}`;
    c.extraPending.push({claim:`interactions/${id}`,reason:'association-not-fully-classified',source:{collection,id:sourceIds[collection]?.[entry.key]||entry.key},effectId:effect.slug||effect.key});
  }
}
