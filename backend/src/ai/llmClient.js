import { AppError } from '../lib/errors.js';
export function aiError(code = 'AI_FAILED') {
  const errors={AI_FAILED:[502,'The AI service could not process this transcript. Please try again. Nothing was saved.'],AI_BUSY:[503,'The AI service is busy. Please try again in a moment. Nothing was saved.'],AI_TIMEOUT:[504,'The AI service took too long. Please try again. Nothing was saved.']};
  return new AppError(errors[code][0],code,errors[code][1]);
}
export function createLLM(config,fetchImpl=globalThis.fetch) {
  return { async complete({system,user,signal}) {
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),config.timeoutMs);
    const combined=signal ? AbortSignal.any([signal,controller.signal]) : controller.signal;
    let url,body,headers={'content-type':'application/json'};
    const temperature=config.temperature === undefined ? {} : {temperature:config.temperature};
    if(config.provider==='anthropic') {
      url=(config.baseUrl || 'https://api.anthropic.com/v1')+'/messages';
      headers={...headers,'x-api-key':config.apiKey,'anthropic-version':'2023-06-01'};
      body={model:config.model,max_tokens:config.maxOutputTokens,system,messages:[{role:'user',content:user}],...temperature};
    } else if(config.provider==='gemini') {
      url=(config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta')+'/models/'+encodeURIComponent(config.model)+':generateContent';
      headers['x-goog-api-key']=config.apiKey;
      body={systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text:user}]}],generationConfig:{maxOutputTokens:config.maxOutputTokens,...temperature,...(config.jsonMode ? {responseMimeType:'application/json'} : {})}};
    } else {
      url=(config.baseUrl || 'https://api.openai.com/v1')+'/chat/completions';
      headers.Authorization='Bearer '+config.apiKey;
      const tokenParameter=new URL(url).hostname==='api.openai.com' ? 'max_completion_tokens' : 'max_tokens';
      body={model:config.model,messages:[{role:'system',content:system},{role:'user',content:user}],[tokenParameter]:config.maxOutputTokens,...temperature,...(config.jsonMode ? {response_format:{type:'json_object'}} : {})};
    }
    try {
      const response=await fetchImpl(url,{method:'POST',headers,body:JSON.stringify(body),signal:combined});
      if(!response.ok) {
        // Provider bodies may echo inputs or credentials. Log status and a redacted code only.
        let providerCode; try { providerCode=(await response.json()).error?.code; } catch {}
        console.error('LLM request rejected:',{provider:config.provider,status:response.status,code:typeof providerCode==='number' ? providerCode : undefined});
        if([401,403].includes(response.status)) console.error('LLM key rejected');
        throw aiError([429,503,529].includes(response.status) ? 'AI_BUSY' : 'AI_FAILED');
      }
      const data=await response.json();
      if(data.error) throw aiError([429,503,529].includes(Number(data.error.code)) ? 'AI_BUSY' : 'AI_FAILED');
      const output=config.provider==='anthropic' ? data.content?.filter(x=>x.type==='text').map(x=>x.text).join('') : config.provider==='gemini' ? data.candidates?.[0]?.content?.parts?.map(x=>x.text || '').join('') : data.choices?.[0]?.message?.content;
      if(typeof output !== 'string' || !output.trim()) throw aiError();
      return output;
    } catch(error) {
      if(combined.aborted || error.name==='AbortError' || error.name==='TimeoutError') throw aiError('AI_TIMEOUT');
      if(error instanceof AppError) throw error;
      throw aiError();
    } finally {clearTimeout(timer);}
  }};
}
