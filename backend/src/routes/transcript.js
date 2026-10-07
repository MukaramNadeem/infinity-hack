import {Router} from 'express';
import {AppError} from '../lib/errors.js';
import {requireRole} from '../auth/middleware.js';
import {createTranscriptService} from '../ai/createFromTranscript.js';
export function transcriptRoutes(options) {
  const router=Router(),service=createTranscriptService(options);
  router.use(requireRole('ADMIN'));
  router.post('/create',async(req,res)=>res.status(201).json({result:await service.create(req.user.id,req.body?.transcript)}));
  router.post('/commit',async(req,res)=>{
    if(!req.body || !Object.hasOwn(req.body,'draft')) throw new AppError(400,'BAD_REQUEST','Provide the corrected draft.');
    res.status(201).json({result:await service.commit(req.body.draft)});
  });
  return router;
}
