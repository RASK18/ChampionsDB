import {writeJSON} from './lib/io.mjs';
import {collections} from './lib/model.mjs';
const str={type:'string',minLength:1},bool={type:'boolean'},num={type:'number'},integer={type:'integer'},id={type:'string',pattern:'^[a-z0-9][a-z0-9-]*$'};
const array=items=>({type:'array',items,uniqueItems:true});
const obj=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
const stat={enum:['hp','attack','defense','spAttack','spDefense','speed']};
const reference=obj({collection:{enum:collections},id,selector:obj({typeId:id,property:str,category:str})},['collection']);
reference.oneOf=[{required:['id'],not:{required:['selector']}},{required:['selector'],not:{required:['id']}}];
const condition={oneOf:[
  obj({all:{type:'array',items:{$ref:'#/$defs/condition'}}},['all']),
  obj({any:{type:'array',items:{$ref:'#/$defs/condition'}}},['any']),
  obj({not:{$ref:'#/$defs/condition'}},['not']),
  obj({predicate:{enum:['effect-active','created-by-holder','ability-active','move-succeeds','form-is','holds-item','grounded','type-is','contact','chance','source-is-opponent','status-is']},effectId:id,pokemonId:id,itemId:id,subject:str,value:{}},['predicate'])
]};
const rule=obj({source:reference,target:reference,relation:{enum:['causes','cures','prevents','extends','suppresses','boosts','reduces','activates','benefits','transforms','copies','modifies']},trigger:str,recipient:str,requirements:{$ref:'#/$defs/condition'},parameters:{type:'object'}},['source','target','relation','trigger','recipient','requirements','parameters']);
const properties={
 types:{name:str,effectiveness:{type:'object',additionalProperties:{enum:[0,0.5,1,2]}}},
 species:{name:str,nationalDex:{type:'integer',minimum:1}},
 pokemon:{name:str,speciesId:id,form:obj({kind:{enum:['base','mega','regional','gender','alternate']}},['kind']),typeIds:{...array(id),minItems:1,maxItems:2},stats:obj(Object.fromEntries(['hp','attack','defense','spAttack','spDefense','speed'].map(s=>[s,{type:'integer',minimum:1,maximum:255}]))),weightKg:{type:'number',minimum:0},sex:{enum:['male','female','mixed','genderless']},abilityIds:array(id)},
 learnsets:{pokemonId:id,moveId:id},
 moves:{name:str,description:str,typeId:id,category:{enum:['physical','special','status']},power:{oneOf:[obj({kind:{const:'fixed'},value:{type:'integer',minimum:1}},['kind','value']),obj({kind:{enum:['variable','not-applicable']}},['kind'])]},accuracy:{oneOf:[obj({kind:{const:'percent'},value:{type:'number',minimum:0,maximum:100}},['kind','value']),obj({kind:{const:'not-applicable'}},['kind'])]},pp:{type:'integer',minimum:1},priority:{type:'integer',minimum:-7,maximum:5},target:str,properties:{type:'object',additionalProperties:bool}},
 abilities:{name:str,description:str},items:{name:str,description:str,category:{enum:['berry','mega-stone','held-item']},restrictions:{type:'array',items:{$ref:'#/$defs/condition'}}},
 effects:{name:str,description:str,category:{enum:['weather','terrain','status','volatile','field','team']}},
 interactions:{rule},natures:{name:str,increased:{anyOf:[stat,{type:'null'}]},decreased:{anyOf:[stat,{type:'null'}]},multipliers:obj({increased:{enum:[1,1.1]},decreased:{enum:[1,0.9]}},['increased','decreased'])},
 'battle-rules':{name:str,rule:{type:'object'}},regulations:{name:str,rules:{type:'object'},validFrom:obj({date:{type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$'},precision:{const:'day'}},['date','precision']),validUntil:obj({date:{type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$'},precision:{const:'day'}},['date','precision'])}
};
for(const collection of collections){
 const required=['id','identity','available'];if(collection==='learnsets')required.push('pokemonId','moveId');if(collection==='interactions')required.push('rule');
 const schema={$schema:'http://json-schema.org/draft-07/schema#',$id:`https://disboard.es/ChampionsDB/schemas/${collection}.schema.json`,title:`ChampionsDB: ${collection}`,$defs:{condition},type:'array',items:obj({id,identity:{const:true},available:{const:true},...properties[collection]},required)};
 await writeJSON(`schemas/${collection}.schema.json`,schema);
}
