import {AppError} from '../lib/errors.js';
export function requireAuth(pool) {
  return async(req,res,next)=>{
    const id=req.session?.userId;
    if(!id) throw new AppError(401,'UNAUTHENTICATED','Please log in to continue.');
    const {rows}=await pool.query('SELECT id,name,email,role,specialization FROM users WHERE id=$1',[id]);
    if(!rows[0]) throw new AppError(401,'UNAUTHENTICATED','Please log in to continue.');
    req.user=rows[0];next();
  };
}
export function requireRole(...roles) {return (req,res,next)=>{
  if(!roles.includes(req.user.role)) throw new AppError(403,'FORBIDDEN','Your account cannot perform this action.');
  next();
};}
export function originGuard(origins) {return(req,res,next)=>{
  if(['POST','PUT','PATCH','DELETE'].includes(req.method) && req.get('Origin') && !origins.includes(req.get('Origin'))) throw new AppError(403,'FORBIDDEN','This origin is not allowed.');
  next();
};}
