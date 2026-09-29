import {Claims} from './claims.mjs';
import {document} from './capture.mjs';
import {readJSON,root} from './io.mjs';

const pad=n=>String(n).padStart(3,'0');
const ids={pokemon:n=>`pokemon-${n}`,species:n=>`species-${pad(n)}`,move:n=>`move-${pad(n)}`,ability:n=>`ability-${pad(n)}`,item:n=>`item-${pad(n)}`};
const clean=s=>String(s).replace(/\s+/gu,' ').trim();
const unique=xs=>[...new Set(xs)].sort();
const requiredTables=['personal','waza','waza_learn','item'];

// No external catalogue participates in identity, availability or normalization.
export async function loadChampout(snapshot){
  if(!snapshot.revisions?.champout)throw new Error('Missing champout revision');
  const tables={},rows={};
  for(const [id,doc] of Object.entries(snapshot.documents)){
    if(doc.provider!=='champout'||doc.revision!==snapshot.revisions.champout)throw new Error(`Unexpected source or mixed revision: ${id}`);
    const parsed=JSON.parse(await document(snapshot,id));
    if(id.startsWith('champout/masterdata/')){
      if(!Array.isArray(parsed)||!parsed.length||parsed.some(r=>typeof r.id!=='string')||new Set(parsed.map(r=>r.id)).size!==parsed.length)throw new Error(`Invalid champout table: ${id}`);
      tables[id]=parsed;
    }else{
      if(!Array.isArray(parsed.mSDataSet)||!parsed.mSDataSet.length||parsed.mSDataSet.some(r=>typeof r.LabelName!=='string'||typeof r.OriginalText!=='string')||new Set(parsed.mSDataSet.map(r=>r.LabelName)).size!==parsed.mSDataSet.length)throw new Error(`Invalid champout text: ${id}`);
      rows[id]=parsed.mSDataSet;
      tables[id]=Object.fromEntries(parsed.mSDataSet.map(r=>[r.LabelName,r.OriginalText]));
    }
  }
  for(const name of requiredTables)if(!tables[`champout/masterdata/${name}`])throw new Error(`Missing champout table ${name}`);
  for(const [name,fields] of Object.entries({personal:['no','fo','type1','type2','hp','atk','def','spatk','spdef','agi','weight','toku0','toku1','toku2','sex','is_valid'],waza:['type','category','power','accuracy','pp','priority','available','target','direct','classification_a','classification_b'],item:['category_a']})){
    for(const row of tables[`champout/masterdata/${name}`])if(fields.some(f=>row[f]===undefined||row[f]===''||!Number.isFinite(Number(row[f]))))throw new Error(`Invalid champout ${name}/${row.id}`);
  }
  for(const row of tables['champout/masterdata/waza_learn'])if(typeof row.waza!=='string'||!/^\d+(,\d+)*$/.test(row.waza))throw new Error(`Invalid learnset ${row.id}`);
  return {tables,rows};
}

export async function normalizeChampout(snapshot,{tables:t,rows}){
  const c=new Claims(snapshot);
  c.policy=await readJSON(root+'/sources/policy.json');
  c.context={game:'pokemon-champions',source:'champout',revision:snapshot.revisions.champout,gameVersion:null,regulation:null};
  const mappings=await readJSON(root+'/rules/champout-mappings.json');
  const table=(name,lang='esp')=>{const found=t[`champout/${lang}/${name}`];if(!found)throw new Error(`Missing text table ${lang}/${name}`);return found;};
  const add=(coll,id,field,value,doc,loc,observed=value)=>c.add(coll,id,field,value,doc,loc,observed,'champions-champout-capture');
  const basic=(coll,id,doc,loc,available=true,observed=available)=>{add(coll,id,'identity',true,doc,loc,observed);add(coll,id,'available',available,doc,loc,observed);};
  const txt=(coll,id,field,name,label)=>{
    const value=table(name)[label];if(value===undefined||!clean(value))return undefined;
    add(coll,id,field,clean(value),`champout/esp/${name}`,label,value);return clean(value);
  };
  const typeByNum={};
  for(const row of rows['champout/usa/typename']){
    const id=row.OriginalText.toLowerCase();typeByNum[row.Index]=id;
    basic('types',id,'champout/esp/typename',row.LabelName);txt('types',id,'name','typename',row.LabelName);
  }
  if(Object.keys(typeByNum).length!==18)throw new Error('Type catalogue changed');
  const allPokemon=t['champout/masterdata/personal'];
  const pRows=allPokemon.filter(p=>{
    const form=table(p.ms_form,'usa')[p.ms_form_lbl]||'';
    if(['666','671','676','869','855','1013'].includes(p.no)&&p.fo!=='0'&&!form.startsWith('Mega ')){
      c.mapping.push({collection:'pokemon',id:ids.pokemon(p.id),champout:p.id,scope:'cosmetic',form});return false;
    }return true;
  });
  const pById=new Map(pRows.map(p=>[p.id,p]));
  for(const p of pRows){
    if(!['0','1'].includes(p.is_valid)||![p.type1,p.type2].every(n=>typeByNum[n])||!['0','1','2','3'].includes(p.sex))throw new Error(`Unknown personal codes ${p.id}`);
    const id=ids.pokemon(p.id),sid=ids.species(p.no),doc='champout/masterdata/personal',loc=`[id=${p.id}]`;
    basic('pokemon',id,doc,loc,p.is_valid==='1',p);basic('species',sid,doc,loc,p.is_valid==='1',p.no);
    const baseName=txt('species',sid,'name',p.ms_name,p.ms_name_lbl);
    add('species',sid,'nationalDex',Number(p.no),doc,loc+'.no',p.no);
    const form=table(p.ms_form)[p.ms_form_lbl]||'',english=table(p.ms_form,'usa')[p.ms_form_lbl]||'';
    const name=form?(/^Mega[- ]/.test(form)?clean(form):`${baseName} (${clean(form)})`):baseName;
    add('pokemon',id,'name',name,`champout/esp/${p.ms_name}`,p.ms_name_lbl,table(p.ms_name)[p.ms_name_lbl]);
    if(form)add('pokemon',id,'name',name,`champout/esp/${p.ms_form}`,p.ms_form_lbl,form);
    add('pokemon',id,'speciesId',sid,doc,loc+'.no',p.no);
    const kind=english.startsWith('Mega ')?'mega':/Alolan|Galarian|Hisuian|Paldean/.test(english)?'regional':/^(Female|Male)$/.test(english)?'gender':p.fo==='0'?'base':'alternate';
    add('pokemon',id,'form',{kind},`champout/usa/${p.ms_form}`,p.ms_form_lbl,english);
    add('pokemon',id,'typeIds',unique([typeByNum[p.type1],typeByNum[p.type2]]),doc,loc+'.type1/type2',[p.type1,p.type2]);
    for(const [field,column] of Object.entries({hp:'hp',attack:'atk',defense:'def',spAttack:'spatk',spDefense:'spdef',speed:'agi'}))add('pokemon',id,`stats.${field}`,Number(p[column]),doc,loc+'.'+column,p[column]);
    add('pokemon',id,'weightKg',Number(p.weight)/10,doc,loc+'.weight',p.weight);
    add('pokemon',id,'sex',['mixed','male','genderless','female'][Number(p.sex)],doc,loc+'.sex',p.sex);
    add('pokemon',id,'abilityIds',unique([p.toku0,p.toku1,p.toku2].map(ids.ability)),doc,loc+'.toku0/toku1/toku2',[p.toku0,p.toku1,p.toku2]);
    c.mapping.push({collection:'pokemon',id,champout:p.id});
  }
  // masterdata target codes are NOT indices into the UI wazatarget table.
  // Code 9 lacks an explicit mapping in the captured documentation.
  const targets={0:'selected-pokemon',1:'user-or-ally',2:'ally',4:'all-other-pokemon',5:'all-opponents',6:'user-and-allies',7:'user',8:'all-pokemon',10:'entire-field',11:'opponents-field',12:'users-field',13:'special',14:'all-allies'};
  const traits={1:'punch',2:'sound',3:'dance',4:'slicing',5:'wind',6:'powder',7:'bullet',8:'pulse',9:'bite',10:'explosion',11:'coercion',12:'healing'};
  const mRows=t['champout/masterdata/waza'],mById=new Map(mRows.map(m=>[String(Number(m.id)),m]));
  for(const m of mRows){
    const id=ids.move(m.id),doc='champout/masterdata/waza',loc=`[id=${m.id}]`,category=['physical','special','status'][Number(m.category)];
    if(!['0','1'].includes(m.available))throw new Error(`Unknown availability ${m.id}`);
    basic('moves',id,doc,loc+'.available',m.available==='1',m.available);
    // Unavailable moves stay in the inventory, never in the published catalogue.
    if(m.available!=='1')continue;
    if(!category||!typeByNum[m.type]||![m.classification_a,m.classification_b].every(x=>x==='0'||traits[x]))throw new Error(`Unknown move codes ${m.id}`);
    txt('moves',id,'name',m.ms_name,m.ms_lbl);txt('moves',id,'description',m.ms_name_info,m.ms_lbl_info);
    add('moves',id,'typeId',typeByNum[m.type],doc,loc+'.type',m.type);
    add('moves',id,'category',category,doc,loc+'.category',m.category);
    for(const f of ['pp','priority'])add('moves',id,f,Number(m[f]),doc,loc+'.'+f,m[f]);
    if(category==='status'||Number(m.power)>1)add('moves',id,'power',category==='status'?{kind:'not-applicable'}:{kind:'fixed',value:Number(m.power)},doc,loc+'.power',m.power);
    if(Number(m.accuracy)>0)add('moves',id,'accuracy',Number(m.accuracy)===101?{kind:'not-applicable'}:{kind:'percent',value:Number(m.accuracy)},doc,loc+'.accuracy',m.accuracy);
    if(targets[m.target])add('moves',id,'target',targets[m.target],doc,loc+'.target',m.target);
    c.inventory.get(`moves/${id}`).delete('properties');
    add('moves',id,'properties.contact',m.direct==='1',doc,loc+'.direct',m.direct);
    for(const [code,name] of Object.entries(traits))add('moves',id,`properties.${name}`,[m.classification_a,m.classification_b].includes(code),doc,loc+'.classification_a/classification_b',[m.classification_a,m.classification_b]);
  }
  for(const n of unique(pRows.filter(p=>p.is_valid==='1').flatMap(p=>[p.toku0,p.toku1,p.toku2]))){
    const id=ids.ability(n),label=`TOKUSEI_${pad(n)}`;
    basic('abilities',id,'champout/masterdata/personal',`toku0|toku1|toku2=${n}`,true,n);
    txt('abilities',id,'name','tokusei',label);txt('abilities',id,'description','tokuseiinfo_syn',`TOKUSEIINFO_SYN_${pad(n)}`);
  }
  const rule=(id,value,doc,loc,observed)=>{basic('interactions',id,doc,loc,true,observed);add('interactions',id,'rule',value,doc,loc,observed);};
  for(const i of t['champout/masterdata/item']){
    const id=ids.item(i.id),doc='champout/masterdata/item',loc=`[id=${i.id}]`;
    if(!['1','2','3','4','5','6','8','10'].includes(i.category_a))throw new Error(`Unknown item category ${i.id}`);
    basic('items',id,doc,loc,true,i);
    txt('items',id,'name',i.ms_name,i.ms_lbl);const description=txt('items',id,'description',i.ms_name_info,i.ms_lbl_info);
    const category=i.category_a==='8'?'mega-stone':i.category_a==='6'?'berry':'held-item';
    add('items',id,'category',category,doc,loc+'.category_a',i.category_a);
    const origins=i.personal_usepoke.split(',').filter(Boolean);
    if(origins.every(p=>pById.has(p)))add('items',id,'restrictions',origins.length?[{any:origins.map(p=>({predicate:'form-is',pokemonId:ids.pokemon(p)}))}]:[],doc,loc+'.personal_usepoke',i.personal_usepoke);
    if(category==='mega-stone'){
      for(const origin of origins){
        const from=pById.get(origin);if(!from)continue;
        const candidates=pRows.filter(p=>p.no===from.no&&table(p.ms_form,'usa')[p.ms_form_lbl]?.startsWith('Mega ')&&(p.sex===from.sex||p.sex==='0'));
        const named=candidates.filter(p=>description.includes(clean(table(p.ms_form)[p.ms_form_lbl])+'.'));
        const choices=named.length?named:candidates;
        if(choices.length!==1){c.extraPending.push({claim:`interactions/${id}--${origin}`,reason:'transformation-needs-interpretation'});continue;}
        const to=choices[0],r={source:{collection:'items',id},target:{collection:'pokemon',id:ids.pokemon(to.id)},relation:'transforms',trigger:'mega-evolution',recipient:'holder',requirements:{all:[{predicate:'form-is',pokemonId:ids.pokemon(origin)},{predicate:'holds-item',itemId:id}]},parameters:{}};
        const rid=`${id}--${origin}--transforms--${to.id}`;
        for(const [d,l,o] of [[doc,loc+'.personal_usepoke',i.personal_usepoke],[`champout/esp/${i.ms_name_info}`,i.ms_lbl_info,table(i.ms_name_info)[i.ms_lbl_info]],['champout/masterdata/personal',`[id=${to.id}]`,to]])rule(rid,r,d,l,o);
      }
    }
  }
  for(const [label,name] of Object.entries(table('btl_state_syn')).filter(([k])=>/_03$/.test(k))){
    if(label==='BTR_STATE_SYN_59_03')continue; // Same badly poisoned status as btl_condition.
    const mapping=mappings.states[label];
    if(!mapping){c.extraPending.push({claim:`effects/${label.toLowerCase().replaceAll('_','-')}`,reason:'new-effect-needs-classification'});continue;}
    const {id,category}=mapping;basic('effects',id,'champout/esp/btl_state_syn',label);
    txt('effects',id,'name','btl_state_syn',label);txt('effects',id,'description','btl_state_syn',label.replace(/_03$/,'_02'));
    add('effects',id,'category',category,'champout/esp/btl_state_syn',label,name);
  }
  for(const [id,code] of Object.entries({paralysis:'mahi',freezing:'koori',burning:'yakedo',poison:'doku','bad-poison':'moudoku',sleep:'nemuri'})){
    const label=`btl_condition_${id.replaceAll('-','_')}_info`;basic('effects',id,'champout/esp/btl_condition',label);
    txt('effects',id,'name','ui_control',`ui_control_${code}`);txt('effects',id,'description','btl_condition',label);
    add('effects',id,'category','status','champout/esp/btl_condition',label,table('btl_condition')[label]);
  }
  for(const [label,name] of Object.entries(table('seikaku','usa'))){
    const id=name.toLowerCase();basic('natures',id,'champout/esp/seikaku',label);txt('natures',id,'name','seikaku',label);
    // Nature modifiers are not in these source tables. Missing is not neutral.
  }
  const learnRows=new Map(t['champout/masterdata/waza_learn'].map(r=>[r.id,r]));
  for(const p of pRows.filter(p=>p.is_valid==='1')){
    const learn=learnRows.get(p.id);if(!learn)throw new Error(`Missing learnset ${p.id}`);
    for(const number of unique(learn.waza.split(','))){
      const move=mById.get(String(Number(number)));if(!move)throw new Error(`Missing move ${number} in learnset ${p.id}`);
      const pid=ids.pokemon(p.id),mid=ids.move(number),id=`${pid}--${mid}`,doc='champout/masterdata/waza_learn',loc=`[id=${p.id}].waza`;
      basic('learnsets',id,doc,loc,move.available==='1',learn.waza);
      if(move.available!=='1')continue;
      add('learnsets',id,'pokemonId',pid,doc,loc,learn.waza);add('learnsets',id,'moveId',mid,doc,loc,learn.waza);
    }
  }
  for(const id of ['stat-calculation','damage-calculation','turn-order','critical-hits','accuracy-evasion','stat-stages','switching','mega-evolution','ability-copying','move-copying'])c.expect('battle-rules',id);
  c.extraPending.push({claim:'regulations/current',reason:'not-provided-by-source',detail:'Las plantillas de tournament_rule no contienen el reglamento vigente rellenado.'});
  c.extraPending.push({claim:'interactions/full-mechanics',reason:'not-fully-structured',detail:'Los textos están publicados; con_ref y buf_ref son asociaciones, no reglas causales completas.'});
  return c;
}
