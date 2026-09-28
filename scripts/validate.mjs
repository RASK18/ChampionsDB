import {loadPublication} from './update.mjs';
import {validateDataset} from './lib/validate.mjs';
import {readFile} from 'node:fs/promises';
import {hash,root} from './lib/io.mjs';
import path from 'node:path';
const publication=await loadPublication();
for(const [name,entry] of Object.entries(publication.manifest.files)){
  const bytes=await readFile(path.join(root,'data',name));if(hash(bytes)!==entry.sha256)throw new Error(`File hash mismatch ${name}`);
}
console.log(await validateDataset(publication));
