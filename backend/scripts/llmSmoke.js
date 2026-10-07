import { loadConfig } from '../src/config.js';
import { createLLM } from '../src/ai/llmClient.js';
const config=loadConfig(), start=Date.now();
try {
  const output=await createLLM(config).complete({system:'Return one JSON object only.',user:'Reply with exactly {"ok":true}.'});
  const result=JSON.parse(output.slice(output.indexOf('{'),output.lastIndexOf('}')+1));
  if(result.ok!==true) throw new Error('The smoke response did not contain ok=true.');
  console.log({provider:config.provider,model:config.model,latencyMs:Date.now()-start,result});
} catch(error) {console.error(error.code || 'SMOKE_FAILED',error.message);process.exitCode=1;}
