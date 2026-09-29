export function supplementScope(claim, scopes) {
  if(scopes.includes(claim))return claim;
  const entity=claim.split('/').slice(0,2).join('/');
  if(entity.startsWith('interactions/item-')&&scopes.includes(entity))return entity;
  if(entity==='regulations/m-c'&&scopes.includes('regulations/current'))return 'regulations/current';
  return undefined;
}
export function acceptedObservations(observations,claim,policy){
  if(!policy?.provider)return observations;
  const primary=observations.filter(o=>o.provider===policy.provider);
  if(primary.length)return primary;
  if(policy.mode==='champout-primary'){
    const allowed=policy.supplementalClaims?.[claim];
    return observations.filter(o=>allowed?.providers.includes(o.provider));
  }
  return [];
}
