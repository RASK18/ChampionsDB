import {load} from 'cheerio';
import {text,key} from './parsers.mjs';
import {ids} from './normalize.mjs';

export function normalizeEditorial(c,inputs){
  const {raw,op}=inputs;
  const body=id=>{const $=load(raw[id]);$('script,style,nav').remove();return text($('body').text());};
  const official=body('official/regulation-m-c'),serebii=body('serebii/regulation-m-c');
  if(!official.includes('Reglamento M-C')||!serebii.includes('Regulation M-C'))throw new Error('Regulation source changed');
  const add=(field,value,doc,locator,observed)=>c.add('regulations','m-c',field,value,doc,locator,observed);
  for(const doc of ['official/regulation-m-c','serebii/regulation-m-c']){
    add('identity',true,doc,'heading','M-C');add('available',true,doc,'heading','M-C');add('name','Reglamento M-C',doc,'heading','M-C');
  }
  const dates=official.match(/(\d+) de (\w+) de (\d+) a las (\d\d:\d\d) UTC al .*?(\d+) de (\w+) de (\d+) a la[s]? (\d\d:\d\d) UTC/);
  const eng=serebii.match(/Date (\w+) (\d+)\w* (\d+) - (\w+) (\d+)\w* (\d+)/);
  if(!dates||!eng)throw new Error('Regulation dates cannot be parsed');
  const months={enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,octubre:10,noviembre:11,diciembre:12,January:1,February:2,March:3,April:4,May:5,June:6,July:7,August:8,September:9,October:10,November:11,December:12};
  const date=(y,m,d)=>`${y}-${String(months[m]).padStart(2,'0')}-${d.padStart(2,'0')}`;
  for(const [field,es,en] of [['validFrom',date(dates[3],dates[2],dates[1]),date(eng[3],eng[1],eng[2])],['validUntil',date(dates[7],dates[6],dates[5]),date(eng[6],eng[4],eng[5])]]){
    add(field,{date:es,precision:'day'},'official/regulation-m-c','Duración del reglamento M-C',dates[0]);
    add(field,{date:en,precision:'day'},'serebii/regulation-m-c','Regulation Date',eng[0]);
  }
  for(const [field,esRE,enRE,mult] of [['playerTimeSeconds',/Tiempo del jugador: (\d+) minutos/,/Your Time: (\d+) Minutes/,60],['turnTimeSeconds',/Tiempo de turno: (\d+) segundos/,/Turn Time: (\d+) Seconds/,1],['teamPreviewSeconds',/Tiempo para la vista previa de equipos: (\d+) segundos/,/Team Preview: (\d+) Seconds/,1]]){
    const es=official.match(esRE),en=serebii.match(enRE);if(!es||!en)throw new Error(`Regulation missing ${field}`);
    add(`rules.${field}`,Number(es[1])*mult,'official/regulation-m-c',es[0],es[0]);add(`rules.${field}`,Number(en[1])*mult,'serebii/regulation-m-c',en[0],en[0]);
  }
  c.inventory.get('regulations/m-c').delete('rules');
  if(official.includes('No se permite que dos Pokémon lleven el mismo objeto.'))add('rules.itemClause',true,'official/regulation-m-c','Objetos equipados','No se permite que dos Pokémon lleven el mismo objeto.');
  for(const field of ['eligiblePokemon','eligibleItems','eligibleMoves','eligibleAbilities','singles','doubles','battleTimeSeconds','megaEvolutionLimit'])c.expect('regulations','m-c',[`rules.${field}`]);
  const $=load(raw['serebii/statusconditions']);
  const rows=$('tr').toArray().map(e=>$(e).children('td').toArray().map(td=>text($(td).text())));
  for(const [label,id,pattern,fields] of [
    ['Paralysis','paralysis',/12\.5%.*50%/,['failureProbability','speedMultiplier']],
    ['Freeze','freezing',/25%.*third turn/i,['thawProbability','forcedThawTurn']]
  ]){
    const row=rows.find(r=>r[0]===label&&r.length===3);if(!row||!pattern.test(row[2]))throw new Error(`Status parser changed: ${label}`);
    // Editorial observations are kept as claims for auditing the reviewed status rules.
    c.add('battle-rules',id,'identity',true,'serebii/statusconditions',label+'.New Effect',row[2]);
    c.add('battle-rules',id,'available',true,'serebii/statusconditions',label+'.New Effect',row[2]);
  }
  // Current Champions item list supplies explicit availability, not a generic item dex.
  const items=load(raw['serebii/items']);
  const english=inputs.tables['champout/usa/itemname'];
  const itemIds=new Map(Object.entries(english).map(([label,name])=>[key(name),Number(label.match(/\d+$/)?.[0])]));
  const candidateNames=new Set(op.items.items.map(i=>key(i.key)));
  let matchedItems=0;
  for(const row of items('tr').toArray()){
    const cells=items(row).children('td');if(cells.length<3)continue;
    for(const cell of cells.toArray().slice(0,3)){
      const name=text(items(cell).text());const number=itemIds.get(key(name));
      if(number===undefined||!candidateNames.has(key(name)))continue;
      matchedItems++;
      c.add('items',ids.item(number),'available',true,'serebii/items',`tr: ${name}`,name);
    }
  }
  if(!matchedItems)throw new Error('Serebii item catalogue format changed');
  // Regression withdrawals must be explicit, not inferred from an omitted row.
  const patch=body('nintendo/updates');
  const versions=source=>[...new Set(source.match(/\b\d+\.\d+\.\d+\b/g)||[])].sort((a,b)=>{const x=a.split('.').map(Number),y=b.split('.').map(Number);return y[0]-x[0]||y[1]-x[1]||y[2]-x[2];});
  if(!patch.includes('Champions')||!versions(patch).length||!versions(body('serebii/patch')).length)throw new Error('Patch notes format changed');
  const version=versions(patch).find(v=>versions(body('serebii/patch')).includes(v));
  c.context={game:'pokemon-champions',locale:'es-ES',gameVersion:version||null,regulation:'m-c',versionEvidence:['nintendo/updates','serebii/patch'],sourceCompatibility:'checked-per-claim; conflicts withheld'};
  const captured=s=>new Date(c.snapshot.documents[s].capturedAt);
  if(captured('official/regulation-m-c')>=new Date(`${date(dates[7],dates[6],dates[5])}T${dates[8]}:00Z`)){
    c.context.regulation=null;c.extraPending.push({claim:'regulations/current',reason:'current-regulation-needs-sources',previous:'m-c'});
  }
  for(const [pokemon,move,pid,mid] of [['Politoed','Destructor','pokemon-0186000','move-001'],['Archaludon','Manto Espejo','pokemon-1018000','move-243'],['Archaludon','Represión Metal','pokemon-1018000','move-368']]){
    const p=op.pokemon.pokemon.find(p=>p.name===pokemon);const m=op.moves.moves.find(m=>m.id===Number(mid.slice(5)));
    if(!patch.includes(pokemon)||!patch.includes(move)||!p||!m)continue;
    if(p.bannedMoves?.includes(m.key)){
      const id=`${pid}--${mid}`;
      c.add('learnsets',id,'available',false,'opgg/pokemon',`pokemon[key=${p.key}].bannedMoves`,p.bannedMoves);
      c.add('learnsets',id,'available',false,'nintendo/updates',`${pokemon}: ${move}`,{pokemon,move});
    }
  }
}
