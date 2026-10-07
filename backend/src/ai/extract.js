export function extractJson(text) {
  if(typeof text!=='string') throw new Error('Expected JSON text.');
  const start=text.indexOf('{'),end=text.lastIndexOf('}');
  if(start<0 || end<start) throw new Error('No JSON object found.');
  return JSON.parse(text.slice(start,end+1));
}
