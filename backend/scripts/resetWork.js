import {readFile} from 'node:fs/promises';
import {loadConfig} from '../src/config.js';
import {createPool} from '../src/db/pool.js';
const config=loadConfig();
if(config.production && !process.argv.includes('--force')) throw new Error('Refusing to reset production data without --force.');
const pool=createPool(config);
try {await pool.query(await readFile(new URL('../db/reset-work.sql',import.meta.url),'utf8'));console.log('Projects and tasks cleared; users preserved.');} finally {await pool.end();}
