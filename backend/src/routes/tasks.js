import {Router} from 'express';
import {listTasks} from '../access/projectAccess.js';
export function taskRoutes(pool) {const router=Router();router.get('/mine',async(req,res)=>res.json({tasks:await listTasks(pool,req.user,{mine:true})}));return router;}
