import {Router} from 'express';
import {listProjects,listTasks,requireProjectAccess} from '../access/projectAccess.js';
export function projectRoutes(pool) {
  const router=Router();
  router.get('/',async(req,res)=>res.json({projects:await listProjects(pool,req.user)}));
  router.get('/:id',async(req,res)=>{
    await requireProjectAccess(pool,req.user,req.params.id);
    res.json({project:(await listProjects(pool,req.user,req.params.id))[0],tasks:await listTasks(pool,req.user,{projectId:req.params.id})});
  });
  router.get('/:id/tasks',async(req,res)=>{
    await requireProjectAccess(pool,req.user,req.params.id);
    res.json({tasks:await listTasks(pool,req.user,{projectId:req.params.id})});
  });
  return router;
}
