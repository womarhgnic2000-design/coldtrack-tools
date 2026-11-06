/* Runs synchronously before legacy tool scripts. Auth and networking belong to the parent. */
(() => {
 'use strict';
 let host=window;try{for(let i=0;i<4&&host!==host.parent&&!host.ColdTrackCloudHost;i++)host=host.parent;}catch{}
 const root=host.ColdTrackCloudHost;if(!root)return;
 const tool=document.documentElement.dataset.cloudTool||document.documentElement.dataset.ctTool||'pressed',client=root.attach(tool,window);
 globalThis.ColdTrackCloud=client;
 const slots=root.models.localSlots,dbModels=root.models.dbModels,clone=v=>v===undefined?undefined:structuredClone(v);
 const originalGet=Storage.prototype.getItem,originalSet=Storage.prototype.setItem,originalRemove=Storage.prototype.removeItem;
 Storage.prototype.getItem=function(key){if(this===localStorage&&slots[key]?.tool===tool)return client.getItem(key);return originalGet.call(this,key);};
 Storage.prototype.setItem=function(key,value){if(this===localStorage&&slots[key]?.tool===tool){client.setItem(key,String(value));return;}return originalSet.call(this,key,value);};
 Storage.prototype.removeItem=function(key){if(this===localStorage&&slots[key]?.tool===tool){const m=slots[key],empty=m.array?'[]':m.map?'{}':'null';client.setItem(key,empty);return;}return originalRemove.call(this,key);};
 const origOpen=IDBFactory.prototype.open;
 function request(operation,tx,copy=true){const r={result:undefined,error:null,readyState:'pending',transaction:tx};if(tx){tx.pending++;clearTimeout(tx.timer);}Promise.resolve().then(operation).then(value=>{r.result=copy?clone(value):value;r.readyState='done';r.onsuccess?.({target:r});},error=>{r.error=error;r.readyState='done';r.onerror?.({target:r});if(tx){tx.error=error;tx.failed=true;tx.onerror?.({target:tx});tx.onabort?.({target:tx});}}).finally(()=>{if(tx){tx.pending--;tx.finish();}});return r;}
 function virtualDB(name){const stores=dbModels[name];return {name,version:1,objectStoreNames:{contains:n=>!!stores[n]},close(){},createObjectStore(n){return stores[n];},transaction(names,mode='readonly'){
  const tx={mode,pending:0,failed:false,error:null,finish(){clearTimeout(tx.timer);tx.timer=setTimeout(()=>{if(!tx.pending&&!tx.failed)tx.oncomplete?.({target:tx});},0);},abort(){tx.failed=true;tx.error=Error('Operación cancelada.');tx.onabort?.({target:tx});},objectStore(storeName){const m=stores[storeName];if(!m)throw Error('Almacén no disponible.');
   const scope=k=>m.dataset?'dataset-'+k:m.scope,keyOf=(v,k)=>String(m.keyPath?v[m.keyPath]:k??'current');
   const read=async k=>m.fields?client.readModel(m,String(k)):client.read(scope(k),m.dataset?'current':String(k));
   return {get:k=>request(()=>read(k),tx),getAll:()=>request(()=>client.list(m.scope),tx),put:(v,k)=>request(async()=>{if(mode!=='readwrite')throw Error('Solo lectura.');const key=keyOf(v,k);if(m.fields)await client.writeModel(m,key,v);else await client.write(scope(key),m.dataset?'current':key,v);return key;},tx),delete:k=>request(()=>client.remove(scope(k),m.dataset?'current':String(k)),tx)};
  }};tx.finish();return tx;
 }};}
 IDBFactory.prototype.open=function(name,version){if(dbModels[name])return request(()=>virtualDB(name),undefined,false);return origOpen.call(this,name,version);};
 const urls=new Map(),makeURL=URL.createObjectURL?.bind(URL),revoke=URL.revokeObjectURL?.bind(URL),click=HTMLAnchorElement.prototype.click;
 if(makeURL){URL.createObjectURL=blob=>{const url=makeURL(blob);urls.set(url,blob);return url;};URL.revokeObjectURL=url=>{urls.delete(url);return revoke(url);};}
 HTMLAnchorElement.prototype.click=function(){const blob=urls.get(this.href);if(blob&&/\.(pdf|csv)$/i.test(this.download))void client.archive(this.download,blob).catch(()=>{});return click.call(this);};
 document.addEventListener('input',event=>{if(event.target.matches('input:not([type=search]),textarea,select')&&!/search|query|filter/i.test(event.target.id||''))client.dirty=true;},true);
 document.addEventListener('click',event=>{const b=event.target.closest('button');if(b&&/^(save|saveDraft|incidentSave|finish|apply|pgBoxSave|pgBoxApply|pgSpaceApply|export|transferPicking|pickingBOL)$/.test(b.id))setTimeout(()=>{if(!client.pending)client.dirty=false;},600);},true);
 window.addEventListener('pagehide',()=>root.detach(client),{once:true});
 window.addEventListener('DOMContentLoaded',()=>root.mounted(client),{once:true});
})();
