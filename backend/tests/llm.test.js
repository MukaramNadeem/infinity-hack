import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLLM} from '../src/ai/llmClient.js';
const config={provider:'openai',model:'test',apiKey:'private-test-value',timeoutMs:100,maxOutputTokens:8192,jsonMode:true};
for(const [status,code] of [[401,'AI_FAILED'],[403,'AI_FAILED'],[429,'AI_BUSY'],[503,'AI_BUSY'],[529,'AI_BUSY'],[500,'AI_FAILED']]) {
  test(`LLM maps HTTP ${status}`,async()=>assert.rejects(createLLM(config,async()=>new Response('{}',{status})).complete({system:'test',user:'test'}),error=>error.code===code && error.message.includes('Nothing was saved.')));
}
test('LLM transport, malformed body and timeout failures',async()=>{
  await assert.rejects(createLLM(config,async()=>{throw new TypeError('network');}).complete({}),{code:'AI_FAILED'});
  await assert.rejects(createLLM(config,async()=>new Response('not json')).complete({}),{code:'AI_FAILED'});
  await assert.rejects(createLLM({...config,timeoutMs:5},(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason)))).complete({}),{code:'AI_TIMEOUT'});
});
for(const provider of ['openai','anthropic','gemini']) test(`${provider} request shape and text extraction`,async()=>{
  let request;
  const output=await createLLM({...config,provider},async(url,options)=>{request={url,...options,body:JSON.parse(options.body)};return Response.json(provider==='openai' ? {choices:[{message:{content:'{"ok":true}'}}]} : provider==='anthropic' ? {content:[{type:'text',text:'{"ok":true}'}]} : {candidates:[{content:{parts:[{text:'{"ok":true}'}]}}]});}).complete({system:'instructions',user:'input'});
  assert.equal(output,'{"ok":true}');assert.equal(request.method,'POST');assert.ok(!Object.hasOwn(request.body,'temperature'));
  if(provider==='openai') assert.equal(request.body.max_completion_tokens,8192);
  if(provider==='gemini') assert.equal(request.body.generationConfig.responseMimeType,'application/json');
});
