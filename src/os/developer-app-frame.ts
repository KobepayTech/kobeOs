// The developer runs in an opaque-origin inner frame. A separate trusted outer
// frame constrains navigation and relays only messages from that exact child.
// No account token, Electron bridge or host object crosses this boundary.
export function developerAppDocument(html: string, session: string): string {
  const policy = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
  const sdk = `(function(){const session=${JSON.stringify(session)},pending=new Map();let seq=0;
    function request(method){return new Promise((resolve,reject)=>{const id=String(++seq);const timer=setTimeout(()=>{pending.delete(id);reject(new Error('KobeOS did not respond.'));},15000);pending.set(id,{resolve,reject,timer});parent.postMessage({type:'kobe-app-request',session,id,method},'*');});}
    addEventListener('message',e=>{const d=e.data;if(e.source!==parent||!d||d.session!==session||d.type!=='kobe-app-response')return;const p=pending.get(d.id);if(!p)return;clearTimeout(p.timer);pending.delete(d.id);d.error?p.reject(new Error(d.error)):p.resolve(d.result);});
    Object.defineProperty(window,'KobeOS',{value:Object.freeze({apiVersion:1,inventory:Object.freeze({list:()=>request('inventory.read')})}),writable:false});})();`;
  const inner = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="referrer" content="no-referrer"><script>${sdk}</script></head><body>${html}</body></html>`;
  const encoded = JSON.stringify(inner).replace(/</g, '\\u003c');
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"><style>html,body,iframe{width:100%;height:100%;margin:0;border:0;display:block}</style></head><body><script>
    const app=document.createElement('iframe');app.title='Developer app';app.sandbox='allow-scripts';app.referrerPolicy='no-referrer';app.allow="camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'; clipboard-read 'none'; clipboard-write 'none'";
    app.srcdoc=${encoded};
    addEventListener('message',e=>{const d=e.data;if(!d||d.session!==${JSON.stringify(session)})return;
      if(e.source===app.contentWindow&&d.type==='kobe-app-request')parent.postMessage({type:d.type,session:d.session,id:d.id,method:d.method},'*');
      else if(e.source===parent&&d.type==='kobe-app-response')app.contentWindow.postMessage(d,'*');
    });document.body.append(app);
  </script></body></html>`;
}
