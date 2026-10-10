import { writeFile } from 'node:fs/promises';
const base='http://127.0.0.1:19387';
const results=[];
for (const method of ['GET','POST']) {
 const url=method==='GET'?base+'/':base+'/api/wishWillow/list';
 const response=await fetch(url,{method,redirect:'manual',signal:AbortSignal.timeout(5000),...(method==='POST'?{headers:{'content-type':'application/json'},body:JSON.stringify({type:'client-request',rpcId:'p0-final-acceptance-no-auth',method:'wishWillow/list',payload:{args:{}}})}:{})});
 results.push({url,method,status:response.status,contentType:response.headers.get('content-type')});
 await response.body?.cancel();
}
const evidence={observedAt:new Date().toISOString(),credentialsRead:false,authenticationBypassed:false,results,browserDomE2E:'UNVERIFIED: no authenticated controllable browser target obtained',note:'An attempted Chrome window launch did not yield an identifiable DSH target. HTTP checks do not represent DOM E2E.'};
await writeFile(new URL('./web-access.json',import.meta.url),JSON.stringify(evidence,null,2));
console.log(JSON.stringify(evidence,null,2));
