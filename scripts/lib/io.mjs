import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile, rename, rm} from 'node:fs/promises';
import path from 'node:path';

export const root = path.resolve(import.meta.dirname, '../..');
export const hash = value => createHash('sha256').update(value).digest('hex');
export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter(k => value[k] !== undefined).map(k => [k, canonical(value[k])]));
  return value;
}
export const json = value => JSON.stringify(canonical(value), null, 2) + '\n';
export async function readJSON(file) { return JSON.parse(await readFile(file, 'utf8')); }
export async function writeJSON(file, value) { await mkdir(path.dirname(file), {recursive:true}); await writeFile(file, json(value)); }
export async function atomicFile(file, content) { await mkdir(path.dirname(file), {recursive:true}); await writeFile(file+'.tmp',content); await rename(file+'.tmp',file); }
export async function pool(values, fn, limit=3) {
  const result = new Array(values.length); let next=0;
  await Promise.all(Array.from({length:Math.min(limit,values.length)},async()=>{ while(next<values.length){const i=next++;result[i]=await fn(values[i],i);} }));
  return result;
}
export async function publish(directory, files) {
  const stage=directory+'.next', previous=directory+'.previous';
  await rm(stage,{recursive:true,force:true}); await mkdir(stage,{recursive:true});
  for(const [name,value] of Object.entries(files)) await writeJSON(path.join(stage,name),value);
  // Recover a publication interrupted between the two directory renames.
  try { await readFile(path.join(directory,'manifest.json')); }
  catch { try { await rename(previous,directory); } catch(error){if(error.code!=='ENOENT')throw error;} }
  await rm(previous,{recursive:true,force:true});
  let moved=false;
  try {await rename(directory,previous);moved=true;} catch(error){if(error.code!=='ENOENT')throw error;}
  try {await rename(stage,directory);} catch(error){if(moved)await rename(previous,directory);throw error;}
  await rm(previous,{recursive:true,force:true});
}
