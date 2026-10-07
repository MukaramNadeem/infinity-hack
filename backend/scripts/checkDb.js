import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import {loadConfig} from '../src/config.js';
import {createPool} from '../src/db/pool.js';
const config=loadConfig(), pool=createPool(config);
try {
  const {rows}=await pool.query('SELECT id,name,role,password_hash FROM users ORDER BY id');
  assert.equal(rows.length,10);
  for(const u of rows) {assert.ok(u.password_hash.startsWith('$2'));assert.ok(await bcrypt.compare(config.demoPassword,u.password_hash));}
  console.table(rows.map(({id,name,role})=>({id,name,role})));
  console.log('Ten users verified; all password hashes valid.');
} finally {await pool.end();}
