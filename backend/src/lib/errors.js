export class AppError extends Error {
  constructor(status, code, message, details, draft) { super(message); Object.assign(this,{status,code,details,draft}); }
}
export function notFound(req,res,next) { next(new AppError(404,'NOT_FOUND','This endpoint does not exist.')); }
export function errorHandler(error,req,res,next) {
  if (res.headersSent) return next(error);
  if (error.type === 'entity.parse.failed') error = new AppError(400,'INVALID_JSON','The request body must be valid JSON.');
  if (error.type === 'entity.too.large') error = new AppError(413,'TRANSCRIPT_TOO_LONG','The request is too large. Nothing was saved.');
  const known = error instanceof AppError;
  if (!known) console.error('Request failed:', { name:error.name, code:error.code || 'INTERNAL' });
  res.status(known ? error.status : 500).json({ error: {
    code:known ? error.code : 'INTERNAL', message:known ? error.message : 'Something went wrong. Please try again.',
    ...(error.details ? {details:error.details} : {})
  }, ...(error.draft !== undefined ? {draft:error.draft} : {}) });
}
