import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isTeamEntryForm,entryFormId} from '../site/form-roles.mjs';

const pokemon=JSON.parse(readFileSync(new URL('../data/pokemon.json',import.meta.url)));
test('la captura separa formas de entrada y formas que aparecen solo en combate',()=>{
  assert.equal(pokemon.length,355);
  assert.equal(pokemon.filter(p=>p.form?.kind==='mega').length,82);
  assert.equal(pokemon.filter(p=>p.form?.kind==='alternate').length,24);
  assert.equal(pokemon.filter(isTeamEntryForm).length,266);
  for(const id of ['pokemon-0351001','pokemon-0351002','pokemon-0351003',
    'pokemon-0681001','pokemon-0778001','pokemon-0877001','pokemon-0964001']){
    const form=pokemon.find(p=>p.id===id);
    assert.ok(form,id);
    assert.equal(isTeamEntryForm(form),false,id);
    assert.ok(pokemon.some(p=>p.id===entryFormId(form)),id);
  }
  assert.equal(isTeamEntryForm(pokemon.find(p=>p.id==='pokemon-0877000')),true);
});
