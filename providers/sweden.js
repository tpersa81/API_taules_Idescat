/* Provider module — loaded after app-universal.js core. Depends on global state, $, fetchJson, etc. */
/* === sweden (14 functions) === */

function swedenClearLevels(){var box=$("eurostatLevels");if(box){box.innerHTML="";box.hidden=true}}

function swedenLevelLabel(index,list){var isTableLevel=list&&list.length&&list.every(function(x){var t=String(x&&x.type||"").toLowerCase();return t==="table"||t==="t"||x&&x.tableId});return isTableLevel?"Taula":"Nivell "+(index+1)}

function swedenTableLevelItems(list){return (list||[]).filter(function(x){return x&&String(x.type||"").toLowerCase()==="table"||x&&x.tableId})}

async function swedenV1Children(path){var base=(path||[]).slice(),raw=await fetchJson(pxUrl(base));return a(raw).map(function(x){var id=String(f(x,"id","code","dbid","path")).trim();return{id:id,label:String(f(x,"text","label","name","title")||id).trim(),type:String(f(x,"type","class")),path:base.concat([id])}}).filter(function(x){return x.id})}

async function swedenSelectRoot(rootCode){state.swedenPath=[];state.swedenV2Table=false;swedenClearLevels();await loadSwedenV2Tables();var children=await swedenV2Children([rootCode],null);if(children.length===1&&children[0].type==="table"){await swedenTryTableMetadata(children[0].path,children[0].tableId,children[0].tableId);return}swedenAddLevel(children,0,[rootCode])}

function swedenAddLevel(children,index,path){var box=$("eurostatLevels");if(!box)return;var list=(children||[]).filter(function(x){return x&&x.id});
 if(list.length&&swedenTableLevelItems(list).length===list.length){list=list.map(function(x){return Object.assign({},x,{type:"table"})})}if(!list.length)return;state.pxItems.set("swedenLevel"+index,list);box.hidden=false;var label=document.createElement("label");label.dataset.eurostatLevel=String(index);label.textContent=swedenLevelLabel(index,list)+" ";var sel=document.createElement("select");sel.id="swedenLevel"+index;sel.disabled=false;sel.appendChild(new Option("— Selecciona —",""));label.appendChild(sel);box.appendChild(label);list.forEach(function(x){sel.appendChild(new Option(x.id+" · "+x.label,x.id))});sel.onchange=async function(){var val=sel.value;if(!val)return;try{await swedenSelectDynamic(index,val)}catch(e){status(e&&e.message?e.message:String(e),"error")}};if(list.length===1){sel.value=list[0].id;swedenSelectDynamic(index,list[0].id).catch(function(e){status(e&&e.message?e.message:String(e),"error")})}}

async function swedenSelectDynamic(index,val){var items=state.pxItems.get("swedenLevel"+index)||[],item=items.find(function(x){return String(x.id)===String(val)});if(!item)throw new Error("No s'ha trobat l'element seleccionat de Statistics Sweden.");var box=$("eurostatLevels");if(box)Array.from(box.querySelectorAll("label")).forEach(function(l){if(Number(l.dataset.eurostatLevel)>index)l.remove()});state.swedenPath=(item.path||[]).slice();state.selected.node=item.tableId||item.id;state.selected.table=item.tableId||item.id;state.metadata=null;$("query").disabled=true;$("tableInfo").hidden=true;$("cellInfo").hidden=true;$("filters").innerHTML="";state.filters.clear();if(pxTable(item)||item.type==="table"||item.tableId){await swedenLoadV1Table(item.path||state.swedenPath,item.tableId||item.id);return}var next=await swedenV1Children(item.path||state.swedenPath);state.pxItems.set("swedenLevel"+(index+1),next);swedenAddLevel(next,index+1,item.path||state.swedenPath)}

async function swedenLoadV1Table(path,tableId){
 path=(path||[]).slice();tableId=String(tableId||path[path.length-1]||"").trim();
 if(!tableId)throw new Error("No s'ha pogut identificar la taula de Statistics Sweden.");

 // La navegació de Statistics Sweden continua fent-se amb PxWeb v1,
 // però els identificadors de taula de v1 no són compatibles amb v2.
 // Primer obtenim les metadades v1 per conèixer el títol i després
 // resolem la taula equivalent al catàleg v2.
 var v1Url=pxUrl(path),v1Raw=null;
 try{v1Raw=await fetchJson(v1Url)}catch(e){}

 var terms=[tableId];
 var v1Title=String(v1Raw&&(v1Raw.title||v1Raw.label)||"").trim();
 if(v1Title&&v1Title.toLowerCase()!==tableId.toLowerCase())terms.push(v1Title);

 var candidates=[];
 try{
  for(var ti=0;ti<terms.length&&!candidates.length;ti++){
   var su="https://statistikdatabasen.scb.se/api/v2/tables?lang=en&query="+encodeURIComponent(terms[ti])+"&pageSize=100";
   var sd=await fetchJson(su);
   var rows=Array.isArray(sd&&sd.tables)?sd.tables:a(sd);
   if(Array.isArray(rows)&&rows.length){
    candidates=rows.map(function(t){
     return{
      id:String(f(t,"id","tableId","code","tableCode")).trim(),
      label:String(f(t,"label","title","text","name")||"").trim()
     };
    }).filter(function(t){return t.id});
   }
  }
 }catch(e){}

 // Prioritzem una coincidència exacta del títol; si no n'hi ha,
 // provem la primera coincidència retornada pel cercador v2.
 if(candidates.length){
  var titleLower=v1Title.toLowerCase();
  candidates.sort(function(x,y){
   var xs=x.label.toLowerCase(),ys=y.label.toLowerCase();
   var xr=xs===titleLower?0:(titleLower&&xs.indexOf(titleLower)>=0?1:2);
   var yr=ys===titleLower?0:(titleLower&&ys.indexOf(titleLower)>=0?1:2);
   return xr-yr;
  });
  for(var ci=0;ci<candidates.length;ci++){
   try{
    var mapped=candidates[ci],
        mu="https://statistikdatabasen.scb.se/api/v2/tables/"+encodeURIComponent(mapped.id)+"/metadata?lang=en",
        raw=await fetchJson(mu),
        ds=swedenV2MetadataToJsonStat(raw);
    if(ds&&Array.isArray(ds.id)&&ds.id.length){
     state.selected.node=mapped.id;
     state.selected.table=mapped.id;
     state.pxPath=path;
     state.swedenV2Table=true;
     state.metadata=ds;
     renderMetadata(ds);
     $("tableInfo").hidden=false;
     $("tableInfo").innerHTML="<strong>Taula:</strong> "+esc(raw.label||mapped.label||v1Title||tableId)+"<span class=\"path\">"+esc(mu)+"</span>";
     $("query").disabled=false;
     return;
    }
   }catch(e){}
  }
 }

 // Si no podem resoldre la taula a v2, mantenim les metadades v1
 // per no trencar la navegació; la consulta posterior mostrarà
 // l'error real de l'API en lloc d'inventar un identificador v2.
 if(v1Raw){
  var ds1=pxToJsonStat(v1Raw);
  if(ds1&&Array.isArray(ds1.id)&&ds1.id.length){
   state.selected.node=tableId;
   state.selected.table=tableId;
   state.pxPath=path;
   state.swedenV2Table=false;
   state.metadata=ds1;
   renderMetadata(ds1);
   $("tableInfo").hidden=false;
   $("tableInfo").innerHTML="<strong>Taula:</strong> "+esc(v1Raw.title||v1Raw.label||tableId)+"<span class=\"path\">"+esc(v1Url)+"</span>";
   $("query").disabled=false;
   return;
  }
 }
 throw new Error("No s'ha pogut resoldre la taula de Statistics Sweden a PxWebApi v2.");
}

async function swedenAutoSelect(target){
 var sel=$(target);if(!sel||sel.disabled)return;
 var options=[].slice.call(sel.options).filter(function(o){return o.value});
 if(options.length===1){sel.value=options[0].value;await pxSelect(target)}
}

function swedenPathParts(t){var out=[];(t.paths||[]).forEach(function(path){var arr=Array.isArray(path)?path:(path&&Array.isArray(path.elements)?path.elements:(path&&Array.isArray(path.path)?path.path:null));if(!arr)return;var p=arr.map(function(x){if(typeof x==="string")return{id:String(x).trim(),label:String(x).trim()};return{id:String(f(x,"id","code","path")).trim(),label:String(f(x,"label","text","name","title")||f(x,"id","code","path")).trim()}}).filter(function(x){return x.id});if(p.length)out.push(p)});return out}

async function swedenV2Children(path,target){
 var wanted=(path||[]).map(String),items=[],seen=new Set();
 (state.swedenV2Tables||[]).forEach(function(t){
  swedenPathParts(t).forEach(function(parts){
   if(wanted.length>parts.length)return;
   for(var i=0;i<wanted.length;i++)if(parts[i].id!==wanted[i])return;
   if(wanted.length===parts.length)return;
   var p=parts[wanted.length];
   var key=p.id;
   if(!seen.has(key)){
    seen.add(key);
    var isTableId=String(t.id)===String(p.id);
    items.push({
     id:p.id,
     label:isTableId?t.label:p.label,
     type:isTableId?"table":"folder",
     tableId:isTableId?t.id:"",
     path:parts.slice(0,wanted.length+1).map(function(x){return x.id})
    });
   }
   if(wanted.length+1===parts.length){
    var tk="__table__"+t.id;
    if(!seen.has(tk)){
     seen.add(tk);
     items.push({
      id:t.id,
      label:t.label,
      type:"table",
      tableId:t.id,
      path:parts.map(function(x){return x.id})
     });
    }
   }
  });
 });
 if(!items.length&&target){
  try{
   var d=await fetchJson(pxUrl(wanted));
   var legacy=a(d);
   items=legacy.map(function(x){
    var id=String(f(x,"id","code","dbid","path")).trim();
    return {
     id:id,
     label:String(f(x,"text","label","name","title")||id),
     type:String(f(x,"type","class")||"folder")
    };
   }).filter(function(x){return x.id});
  }catch(e){}
 }
 items.sort(function(x,y){return String(x.label||"").localeCompare(String(y.label||""),"sv",{numeric:true})});
 if(target){
  state.pxItems.set(target,items);
  fill($(target),items.map(function(x){
   return {value:x.id,label:x.id+" · "+x.label};
  }));
  $(target).disabled=!items.length;
 }
 return items;
}

async function swedenTryTableMetadata(path,tableId,v2TableId){
 path=Array.isArray(path)?path.slice():[];
 tableId=String(tableId||"").trim();
 v2TableId=String(v2TableId||tableId).trim();
 if(!tableId&&!v2TableId)return false;

 // Primer recuperem les metadades v1 de la taula seleccionada.
 // El seu identificador NO és necessàriament el de PxWebApi v2.
 var v1Candidates=[];
 if(path.length)v1Candidates.push(pxUrl(path));
 if(tableId){
  var shortV1=provider().base.replace(/\/+$/,"")+"/"+encodeURIComponent(tableId);
  if(!v1Candidates.some(function(u){return u===shortV1}))v1Candidates.push(shortV1);
 }
 var v1Raw=null;
 for(var vi=0;vi<v1Candidates.length;vi++){
  try{
   var raw=await fetchJson(v1Candidates[vi]);
   if(raw&&Array.isArray(raw.variables)&&raw.variables.length){
    v1Raw=raw;
    break;
   }
  }catch(e){}
 }

 // Resolem la taula contra el catàleg v2. SCB adverteix que v2 no és
 // retrocompatible amb v1 i que l'estructura dels identificadors ha canviat.
 try{
  await loadSwedenV2Tables();
  var candidates=(state.swedenV2Tables||[]).filter(function(t){
   return String(t.id)===v2TableId || String(t.id)===tableId;
  });

  // Si l'ID v1 no coincideix amb l'ID v2, utilitzem el cercador de taules v2.
  // Fem la cerca amb l'ID i, si cal, amb el títol retornat per v1.
  var terms=[tableId];
  var v1Title=String(v1Raw&& (v1Raw.title||v1Raw.label) || "").trim();
  if(v1Title&&v1Title.toLowerCase()!==tableId.toLowerCase())terms.push(v1Title);

  for(var ti=0;ti<terms.length&&(!candidates.length);ti++){
   try{
    var su="https://statistikdatabasen.scb.se/api/v2/tables?lang=en&query="+encodeURIComponent(terms[ti])+"&pageSize=100";
    var sd=await fetchJson(su);
    var sr=Array.isArray(sd&&sd.tables)?sd.tables:a(sd);
    if(Array.isArray(sr)&&sr.length){
     var found=sr.map(function(t){
      return{id:String(f(t,"id","tableId","code","tableCode")).trim(),label:String(f(t,"label","title","text","name")||"").trim()};
     }).filter(function(t){return t.id});
     candidates=found;
    }
   }catch(e){}
  }

  for(var ci=0;ci<candidates.length;ci++){
   try{
    var mapped=candidates[ci],
        mu="https://statistikdatabasen.scb.se/api/v2/tables/"+encodeURIComponent(mapped.id)+"/metadata?lang=en",
        mappedRaw=await fetchJson(mu),
        mappedDs=swedenV2MetadataToJsonStat(mappedRaw);
    if(mappedDs&&Array.isArray(mappedDs.id)&&mappedDs.id.length){
     state.selected.node=mapped.id;
     state.selected.table=mapped.id;
     state.swedenV2Table=true;
     state.pxPath=path;
     state.metadata=mappedDs;
     renderMetadata(mappedDs);
     $("tableInfo").hidden=false;
     $("tableInfo").innerHTML="<strong>Taula:</strong> "+esc(mappedRaw.label||mapped.label||v1Title||tableId)+"<span class=\"path\">"+esc(mu)+"</span>";
     $("query").disabled=false;
     return true;
    }
   }catch(e){}
  }
 }catch(e){}

 // Fallback a v1 si no hem pogut resoldre la taula en v2.
 if(v1Raw){
  var ds=pxToJsonStat(v1Raw);
  state.selected.node=tableId||v2TableId;
  state.selected.table=tableId||v2TableId;
  state.swedenV2Table=false;
  state.pxPath=path;
  state.metadata=ds;
  renderMetadata(ds);
  $("tableInfo").hidden=false;
  $("tableInfo").innerHTML="<strong>Taula:</strong> "+esc(v1Raw.title||v1Raw.label||tableId||v2TableId)+"<span class=\"path\">"+esc(v1Candidates[0])+"</span>";
  $("query").disabled=false;
  return true;
 }
 return false;
}

function swedenV2MetadataToJsonStat(m){if(m&&Array.isArray(m.id)&&m.dimension)return m;var vars=Array.isArray(m&&m.variables)?m.variables:[],ds={version:"2.0",class:"dataset",label:m&&m.label||state.selected.table,id:[],size:[],dimension:{}};vars.forEach(function(v){var id=String(f(v,"id","code","variableCode")).trim(),vals=v.values||v.valueCodes||[],labs=v.valueTexts||v.labels||v.texts||vals,index={},label={};vals.forEach(function(x,i){index[String(x)]=i;label[String(x)]=String(labs[i]==null?x:labs[i])});if(id){ds.id.push(id);ds.size.push(vals.length);ds.dimension[id]={label:String(f(v,"label","text","name")||id),category:{index:index,label:label}}}});return ds}

async function swedenV2Query(query){
 var tableId=String(state.selected.table||"").trim();
 if(!tableId)throw new Error("No s'ha pogut identificar la taula de Statistics Sweden.");
 var selections=dims(state.metadata).map(function(d){
  var selected=Array.from(state.filters.get(d.id)||[]),all=(d.categories||[]).map(function(c){return c.code});
  return {variableCode:String(d.id),valueCodes:selected.length?selected:all};
 });
 if(!state.swedenV2Table){
  var v1=pxUrl(state.pxPath);
  return await fetchJson(v1,{
   method:"POST",
   headers:{"Content-Type":"application/json"},
   body:JSON.stringify(query)
  });
 }
 var u="https://statistikdatabasen.scb.se/api/v2/tables/"+encodeURIComponent(tableId)+"/data?lang=en&outputFormat=json-stat2";
 return await fetchJson(u,{
  method:"POST",
  headers:{"Content-Type":"application/json"},
  body:JSON.stringify({selection:selections})
 })
}
