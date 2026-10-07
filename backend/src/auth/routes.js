import {Router} from 'express';
import bcrypt from 'bcryptjs';
import {AppError} from '../lib/errors.js';
import {requireAuth} from './middleware.js';
const dummyHash=bcrypt.hashSync('invalid-account-comparison',10);
const callback=fn=>new Promise((resolve,reject)=>fn(error=>error ? reject(error) : resolve()));
export function authRoutes(pool,config) {
  const router=Router();
  router.post('/login',async(req,res)=>{
    const {email,password}=req.body || {};
    if(typeof email!=='string' || !email.trim() || typeof password!=='string' || !password || password.length>1024) throw new AppError(400,'BAD_REQUEST','Enter your email and password.');
    const {rows}=await pool.query('SELECT id,name,email,role,specialization,password_hash FROM users WHERE email=$1',[email.trim().toLowerCase()]);
    const record=rows[0];
    const valid=await bcrypt.compare(password,record?.password_hash || dummyHash);
    if(!record || !valid) throw new AppError(401,'INVALID_CREDENTIALS','Email or password is incorrect.');
    await callback(done=>req.session.regenerate(done));
    req.session.userId=record.id;
    await callback(done=>req.session.save(done));
    const {password_hash,...user}=record;
    res.json({user});
  });
  router.post('/logout',async(req,res)=>{
    await callback(done=>req.session.destroy(done));
    res.clearCookie('nw.sid',config.cookie).status(204).end();
  });
  router.get('/me',requireAuth(pool),(req,res)=>res.json({user:req.user}));
  return router;
}
