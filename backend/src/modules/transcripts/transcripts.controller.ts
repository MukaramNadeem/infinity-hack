import type { Request, Response } from 'express';
import type { CommitInput, TranscriptInput } from './transcripts.schemas';
import * as transcriptsService from './transcripts.service';

const forceOf = (res: Response) => (res.locals.query as { force: boolean }).force;

export async function extract(_req: Request, res: Response) {
  res.json(await transcriptsService.extract(res.locals.body as TranscriptInput));
}

export async function commit(req: Request, res: Response) {
  const result = await transcriptsService.commit(req.user!, res.locals.body as CommitInput, forceOf(res));
  res.status(201).json(result);
}

export async function create(req: Request, res: Response) {
  const result = await transcriptsService.createFromTranscript(req.user!, res.locals.body as TranscriptInput, forceOf(res));
  res.status(201).json(result);
}

export async function list(_req: Request, res: Response) {
  res.json({ transcripts: await transcriptsService.listTranscripts() });
}

export async function getById(req: Request<{ id: string }>, res: Response) {
  res.json({ transcript: await transcriptsService.getTranscript(req.params.id) });
}
