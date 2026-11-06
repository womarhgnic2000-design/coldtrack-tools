/* Record boundaries preserve independent BOLs, counts, reviews and pallet plans. */
export const clone=v=>v===undefined?undefined:structuredClone(v);
export const identity=(scope,key)=>JSON.stringify([scope,String(key)]);
export const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const localSlots={
 'pressed-future-demo-v1':{tool:'pressed',scope:'pressed-state'},
 'coldtrack-bol-v1':{tool:'bol',scope:'bol',array:true},
 'ct-redflags-reviews-v1':{tool:'redflags',scope:'redflag-review',map:true},
 'coldtrack-item-needs-v1':{tool:'inventory-finder',scope:'lookup-needs'},
 'coldtrack-standalone-counts-v1':{tool:'count-planner',scope:'count-state',fields:{history:{scope:'count-result',array:true},drafts:{scope:'count-draft',map:true}},personal:['lang','counter','savedAt']},
 'coldtrack-packaging-capacities-v1':{tool:'packaging',scope:'packaging-config',fields:{profiles:{scope:'packaging-profile',map:true}}},
 'coldtrack-packaging-space-v1':{tool:'packaging',scope:'packaging-space',fields:{slots:{scope:'packaging-slot',map:true}}},
 'coldtrack-packaging-settings-v1':{tool:'packaging',scope:'packaging-analysis'},
 'coldtrack-packaging-weekdays-v1':{tool:'packaging',scope:'packaging-weekdays',scalar:true}
};
export const dbModels={
 'coldtrack-shared-data-v1':{datasets:{dataset:true,keyPath:'kind'},settings:{scope:'data-config'}},
 'coldtrack-forecast-v1':{state:{scope:'forecast-state',fields:{pickings:{scope:'picking',array:true}},personal:['lang']}},
 'ColdTrack-Product-Incidents':{reports:{scope:'incidence',keyPath:'id'}},
 'ColdTrack-Corrective-Action':{drafts:{scope:'corrective-action',keyPath:'id'}},
 'coldtrack-destruction-v1':{certificates:{scope:'destruction',keyPath:'id'}}
};
export function label(scope,v,key){return String(scope==='bol'?v?.bol||'':v?.number||v?.reportNumber||v?.reference||v?.certificate||v?.filename||v?.location||v?.loc||v?.name||key).slice(0,400);}
export function flatten(model,value,key='current'){
 const out=new Map();
 if(value===undefined||value===null)return out;
 if(model.array){for(const v of value){if(!v?.id)throw Error('El registro necesita un identificador.');out.set(identity(model.scope,v.id),{scope:model.scope,record_key:String(v.id),value:clone(v),label:label(model.scope,v,v.id)});}return out;}
 if(model.map){for(const [k,v]of Object.entries(value))out.set(identity(model.scope,k),{scope:model.scope,record_key:k,value:clone(v),label:label(model.scope,v,k)});return out;}
 const core=clone(value);
 for(const [field,nested]of Object.entries(model.fields||{})){for(const [id,r]of flatten(nested,core[field]??(nested.array?[]:{})))out.set(id,r);delete core[field];}
 for(const field of model.personal||[])delete core[field];
 out.set(identity(model.scope,key),{scope:model.scope,record_key:key,value:core,label:label(model.scope,core,key)});return out;
}
export function rebuild(model,records,key='current',personal={}){
 const rows=[...records.values()].filter(r=>!r.deleted);
 if(model.array)return rows.filter(r=>r.scope===model.scope).map(r=>clone(r.value));
 if(model.map)return Object.fromEntries(rows.filter(r=>r.scope===model.scope).map(r=>[r.record_key,clone(r.value)]));
 const main=rows.find(r=>r.scope===model.scope&&r.record_key===key);if(!main)return undefined;
 const result=clone(main.value);
 for(const [field,nested]of Object.entries(model.fields||{}))result[field]=rebuild(nested,records);
 for(const field of model.personal||[])if(personal[field]!==undefined)result[field]=personal[field];
 return result;
}
export function scopesFor(model){return [model.scope,...Object.values(model.fields||{}).flatMap(scopesFor)].filter(Boolean);}
export function changesBetween(model,before,after,key='current'){
 const a=flatten(model,before,key),b=flatten(model,after,key),changes=[];
 for(const [id,next]of b)if(!same(a.get(id)?.value,next.value))changes.push(next);
 for(const [id,old]of a)if(!b.has(id))changes.push({...old,value:null,deleted:true});
 return changes;
}
export const tools=['pressed','data-center','inactive-items','forecasting','bol','destruction','corrective-action','handwashing','product-incidents','inventory-finder','count-planner','redflags','packaging'];
export function toolScopes(tool){
 const scopes=Object.values(localSlots).filter(m=>m.tool===tool).flatMap(scopesFor);
 if(tool==='inventory-finder')scopes.push('lookup-items');
 if(tool==='forecasting')scopes.push(...scopesFor(dbModels['coldtrack-forecast-v1'].state));
 const extra={'product-incidents':['incidence'],'corrective-action':['corrective-action'],destruction:['destruction']};
 return [...new Set([...scopes,...(extra[tool]||[])])];
}
