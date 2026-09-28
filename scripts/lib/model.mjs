export const collections=['types','species','pokemon','learnsets','moves','abilities','items','effects','interactions','natures','battle-rules','regulations'];
export const expectedFields={
  types:['identity','available','name','effectiveness'], species:['identity','available','name','nationalDex'],
  pokemon:['identity','available','name','speciesId','form','typeIds','stats.hp','stats.attack','stats.defense','stats.spAttack','stats.spDefense','stats.speed','weightKg','sex','abilityIds'],
  learnsets:['identity','available','pokemonId','moveId'],
  moves:['identity','available','name','description','typeId','category','power','accuracy','pp','priority','target','properties'],
  abilities:['identity','available','name','description'], items:['identity','available','name','description','category','restrictions'],
  effects:['identity','available','name','description','category'],
  interactions:['identity','available','rule'], natures:['identity','available','name','increased','decreased','multipliers'],
  'battle-rules':['identity','available','name','rule'],regulations:['identity','available','name','rules','validFrom','validUntil']
};
export function put(object,field,value){const parts=field.split('.');const last=parts.pop();for(const part of parts)object=object[part]??={};object[last]=value;}
export function get(object,field){return field.split('.').reduce((v,k)=>v?.[k],object);}
export const ref=(collection,id)=>({collection,id});
export const statMap={hp:'hp',atk:'attack',def:'defense',spa:'spAttack',spd:'spDefense',spe:'speed'};
