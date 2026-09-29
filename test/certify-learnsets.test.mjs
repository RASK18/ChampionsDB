import test from 'node:test';
import assert from 'node:assert/strict';
import {certifyLearnsets} from '../scripts/lib/certify-learnsets.mjs';

const source = 'champout/masterdata/waza_learn';
const fixture = () => ({
  tables: {
    [source]: [{id:'0024000',waza:'369,521'}],
    'champout/masterdata/personal': [{id:'0024000',is_valid:'1'}],
    'champout/masterdata/waza': [
      {id:'369',available:'1'},
      {id:'521',available:'0'},
    ],
  },
  data: {
    pokemon:[{id:'pokemon-0024000'}],
    moves:[{id:'move-369'}],
    learnsets:[{id:'pokemon-0024000--move-369'}],
  },
  excluded:[{entity:'learnsets/pokemon-0024000--move-521'}],
  snapshot:{
    revisions:{champout:'revision'},
    documents:{[source]:{sha256:'capture-hash'}},
  },
});

test('certifica solo relaciones reconciliadas con la captura de Champions', () => {
  const report=certifyLearnsets(fixture());
  assert.equal(report.revision,'revision');
  assert.equal(report.relations['pokemon/pokemon-0024000/moves'],true);
  assert.equal(report.relations['moves/move-369/pokemon'],true);
});

test('no declara completa una lista si falta un movimiento disponible', () => {
  const input=fixture();
  input.data.learnsets=[];
  assert.throws(()=>certifyLearnsets(input),/Unpublished available learnset/);
});

test('no declara completa una lista si falta una exclusión o una forma válida', () => {
  const input=fixture();
  input.excluded=[];
  assert.throws(()=>certifyLearnsets(input),/Unexplained unavailable learnset/);
  const missing=fixture();
  missing.tables['champout/masterdata/personal'].push({id:'0025000',is_valid:'1'});
  assert.throws(()=>certifyLearnsets(missing),/Missing captured learnset/);
  missing.tables[source].push({id:'0025000',waza:'369'});
  assert.throws(()=>certifyLearnsets(missing),/Unaccounted valid Champions Pokemon/);
});
