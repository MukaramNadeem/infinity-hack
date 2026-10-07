import { Router } from 'express';
export function healthRoutes(pool) {
  const router = Router();
  router.get('/health',async (req,res) => {
    try { await pool.query('SELECT 1'); res.json({ok:true,db:'up'}); }
    catch { res.status(503).json({ok:false,db:'down'}); }
  });
  return router;
}
