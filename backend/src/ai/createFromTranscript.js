import {AppError} from '../lib/errors.js';
import {aiError} from './llmClient.js';
import {buildPrompt} from './prompt.js';
import {extractJson} from './extract.js';
import {validateDraft} from './validate.js';
import {persistDraft} from './persist.js';
export function createTranscriptService({pool,llm,config}) {
  const running=new Set();
  async function directory() {return (await pool.query("SELECT id,name,role,specialization,skills FROM users WHERE role IN ('MANAGER','AGENT') ORDER BY id")).rows;}
  async function save(raw,users) {
    const result=validateDraft(raw,users,config.meetingDate);
    if(!result.ok) throw new AppError(422,'VALIDATION_FAILED','The draft has unresolved fields. Nothing was saved.',result.errors,result.draft);
    return persistDraft(pool,result.draft);
  }
  return {
    async create(userId,transcript) {
      if(typeof transcript!=='string') throw new AppError(400,'BAD_REQUEST','Provide the meeting transcript as text.');
      if(!transcript.trim()) throw new AppError(400,'EMPTY_TRANSCRIPT','Paste a meeting transcript to continue.');
      if(transcript.length>config.transcriptMaxChars) throw new AppError(413,'TRANSCRIPT_TOO_LONG','The transcript is too long. Nothing was saved.');
      if(running.has(userId)) throw new AppError(409,'ALREADY_PROCESSING','Your transcript is already being processed. Please wait.');
      running.add(userId);
      try {
        const users=await directory(),prompt=buildPrompt({directory:users,transcript,meetingDate:config.meetingDate});
        let raw,lastError,feedback='';
        for(let attempt=0;attempt<config.maxAttempts;attempt++) {
          try {
            const output=await llm.complete({...prompt,user:prompt.user+feedback});
            if(config.debugAI) console.log('AI output:',output);
            raw=extractJson(output);
            if(!raw || !Array.isArray(raw.projects)) throw new Error('Expected an object containing a projects array.');
            if(config.debugAI) console.log('AI draft:',raw);
            lastError=null;break;
          } catch(error) {
            lastError=error instanceof AppError ? error : aiError();
            feedback='\nYour previous reply could not be parsed as the required projects object. Reply with only the JSON object.';
          }
        }
        if(lastError) throw lastError;
        return await save(raw,users);
      } finally {running.delete(userId);}
    },
    async commit(draft) {return save(draft,await directory());}
  };
}
