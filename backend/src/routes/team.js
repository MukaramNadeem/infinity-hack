import {Router} from 'express';
export function teamRoutes(pool) {const router=Router();router.get('/',async(req,res)=>res.json({team:(await pool.query('SELECT id,name,role,specialization,skills FROM users ORDER BY id')).rows}));return router;}
