/* Provider module — loaded after app-universal.js core. Depends on global state, $, fetchJson, etc. */
/* === pxweb (19 functions) === */

function pxUrl(path){
 var p=(path||[]).slice();
 // Statistics Finland mostra els identificadors de carpeta com StatFin__xxx,
 // però l'API REST construeix la ruta amb xxx (p. ex. /StatFin/synt/12dj.px).
 if(state.provider==="pxweb"&&state.pxPreset==="finland"&&p.length&&/^StatFin__/i.test(String(p[0])))
  p[0]=String(p[0]).replace(/^StatFin__/i,"");
 return [provider().base.replace(/\/+$/,"")].concat(p).join("/");
}

function icelandEnglishRootLabel(label){
 var s=String(label||"").trim(),n=s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 var m={
  "ibuar":"Population",
  "mannfjoldi":"Population",
  "samfelag":"Society",
  "atvinnuvegir":"Business Sectors",
  "efnahagur":"Economy",
  "umhverfi":"Environment"
 };
 return m[n]||s;
}

function pxRecursiveClearLevels(){
 var box=$("eurostatLevels");if(box){box.innerHTML="";box.hidden=true}
 state.pxItems.forEach(function(v,k){if(/^pxRecursiveLevel\d+$/.test(k))state.pxItems.delete(k)});
}

function pxRecursiveResetAfter(index){
 var box=$("eurostatLevels");
 if(box)Array.from(box.querySelectorAll("label")).forEach(function(l){if(Number(l.dataset.eurostatLevel)>index)l.remove()});
 state.pxItems.forEach(function(v,k){
  var m=/^pxRecursiveLevel(\d+)$/.exec(k);
  if(m&&Number(m[1])>index)state.pxItems.delete(k);
 });
 state.metadata=null;
 state.selected.table="";
 state.selected.node="";
 state.selected.cross="";
 if(typeof clearQueryView==="function")clearQueryView();
 if($("query"))$("query").disabled=true;
 if($("tableInfo"))$("tableInfo").hidden=true;
 if($("cellInfo"))$("cellInfo").hidden=true;
 if($("filters"))$("filters").innerHTML="";
}

function pxRecursiveLevelLabel(index,list){
 var isTable=list&&list.length&&list.every(function(x){return x&&((String(x.type||"").toLowerCase()==="table")||String(x.type||"").toLowerCase()==="t"||x.tableId||/\\.px$/i.test(String(x.id||"")))});
 return isTable?"Taula":"Nivell "+(index+1);
}

function pxRecursiveTableItems(list){
 return (list||[]).filter(function(x){return x&&((String(x.type||"").toLowerCase()==="table")||String(x.type||"").toLowerCase()==="t"||x.tableId||/\\.px$/i.test(String(x.id||"")))});
}

function pxPlainText(s){
 s=String(s==null?"":s);
 // treu marques HTML típiques de PxWeb (<em>[CODI]</em>, etc.)
 s=s.replace(/<[^>]+>/g," ");
 s=s.replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&quot;/gi,'"');
 return s.replace(/\s+/g," ").trim();
}

async function pxRecursiveChildren(path){
 var raw=await fetchJson(pxUrl(path)),src=a(raw),items=[];
 src.forEach(function(x){
  if(!x||typeof x!=="object")return;
  var id=String(f(x,"id","code","dbid","path")||"").trim();
  if(!id)return;
  var type=String(f(x,"type","class")||"folder").trim().toLowerCase();
  items.push({id:id,label:pxPlainText(f(x,"text","label","name","title")||id),type:type,path:(path||[]).concat([id]),tableId:type==="t"||type==="table"||/\.px$/i.test(id)?id:""});
 });
 return items;
}

function finlandTableUrls(path){
 var p=(path||[]).slice(),base=provider().base.replace(/\/+$/,"");
 if(state.pxPreset!=="finland")return [pxUrl(p)];
 if(!p.length)return [];
 var parts=p.map(function(x){return String(x||"").trim()}).filter(Boolean);
 if(!parts.length)return [];
 parts[0]=parts[0].replace(/^StatFin__/i,"");
 var last=parts[parts.length-1].replace(/\.px$/i,"");
 if(!last)return [];
 // Statistics Finland documenta que /StatFin/12dj.px és equivalent a /StatFin/synt/12dj.px.
 // Prioritzem l'endpoint curt i mantenim la ruta jeràrquica com a fallback.
 var urls=[base+"/"+last+".px"];
 var rel=parts.slice(0,-1).concat([last+".px"]).join("/");
 urls.push(base+"/"+rel);
 var db=parts[0];
 if(db){
  var physical="statfin_"+db+"_pxt_"+last+".px";
  urls.push(base+"/"+db+"/"+physical);
  urls.push(base+"/"+physical);
 }
 return [...new Set(urls)];
}

async function pxRecursiveLoadTable(item){
 status("Carregant taula i categories…");
 var path=(item&&item.path||[]).slice(),tableId=String(item&&item.tableId||path[path.length-1]||"").trim(),urls=[];
 if(state.pxPreset==="finland")urls=finlandTableUrls(path);
 else urls=[pxUrl(path)];
 var raw=null,url="",lastErr=null;
 for(var i=0;i<urls.length&&!raw;i++){
  try{var candidate=await fetchJson(urls[i]);if(isPxMetadata(candidate)){raw=candidate;url=urls[i]}else lastErr=new Error("La resposta no és metadades PxWeb.")}
  catch(e){lastErr=e}
 }
 if(!raw)throw new Error("La taula de PxWeb ("+String(state.pxPreset||"?")+") no ha retornat metadades. "+(lastErr&&lastErr.message||""));
 var ds=pxToJsonStat(raw);
 if(!ds||!Array.isArray(ds.id)||!ds.id.length)throw new Error("Les metadades de la taula no contenen variables vàlides.");
 state.selected.table=tableId;state.selected.node=tableId;state.selected.cross=tableId;state.pxPath=path.slice();state.metadata=ds;
 if(state.pxPreset==="finland")state.finlandTableUrl=url;
 renderMetadata(ds);$("tableInfo").hidden=false;
 $("tableInfo").innerHTML="<strong>Taula:</strong> "+esc(pxPlainText(raw.title||raw.label||tableId))+"<span class=\"path\">"+esc(url)+"</span>";
 $("query").disabled=false;status("");
}

function pxRecursiveAddLevel(children,index){
 var box=$("eurostatLevels");if(!box)return;
 var list=(children||[]).filter(function(x){return x&&x.id});
 if(state.pxPreset==="unece"&&index===0)list.sort(function(a,b){return String(a.id||"").localeCompare(String(b.id||""),"en",{numeric:true})});
 if(!list.length)return;
 if(pxRecursiveTableItems(list).length===list.length)list=list.map(function(x){return Object.assign({},x,{type:"table"})});
 state.pxItems.set("pxRecursiveLevel"+index,list);box.hidden=false;
 var label=document.createElement("label");label.dataset.eurostatLevel=String(index);label.textContent=pxRecursiveLevelLabel(index,list)+" ";
 var sel=document.createElement("select");sel.id="pxRecursiveLevel"+index;sel.appendChild(new Option("— Selecciona —",""));label.appendChild(sel);box.appendChild(label);
 list.forEach(function(x){sel.appendChild(new Option(x.id+" · "+x.label,x.id))});
  sel.onchange=async function(){
  var val=sel.value;
  // Qualsevol canvi: buida el que ve al darrere (nivells, filtres i resultats)
  pxRecursiveResetAfter(index);
  if(!val){status("");return}
  try{
   var item=(state.pxItems.get("pxRecursiveLevel"+index)||[]).find(function(x){return String(x.id)===String(val)});
   if(!item)return;
   if(pxRecursiveTableItems([item]).length){
    status("Carregant taula…");
    await pxRecursiveLoadTable(item);
    status("");
    return;
   }
   status(index===0?"Carregant temes…":"Carregant subtemes…");
   var kids=await pxRecursiveChildren(item.path);
   pxRecursiveAddLevel(kids,index+1);
   status("");
  }catch(e){
   var em=e&&e.message?e.message:String(e);
   status(em,"error");
  }
 };
 if(list.length===1){
  var only=list[0];
  if(only&&only.id){
   sel.value=String(only.id);
   Promise.resolve(sel.onchange()).catch(function(e){var em=e&&e.message?e.message:String(e),st=e&&e.stack?String(e.stack).split("\n").find(function(x){return /app-universal\.js/.test(x)}):"";status(em+(st?" · "+st.trim():""),"error")});
  }
 }
}

async function pxRecursiveSelectRoot(rootCode){
 var keepUneceRoot=state.pxPreset==="unece",box=$("eurostatLevels");
 if(keepUneceRoot){Array.from(box.querySelectorAll("label")).forEach(function(l){if(l.querySelector("#universalRootLevel"))return;l.remove()});state.pxItems.forEach(function(v,k){if(/^pxRecursiveLevel\d+$/.test(k))state.pxItems.delete(k)})}else pxRecursiveClearLevels();
 rootCode=String(rootCode||"").trim();
 if(!rootCode)throw new Error("No s'ha pogut identificar el tema seleccionat.");
 state.pxPath=[rootCode];
 status("Carregant temes…");
 var children=await pxRecursiveChildren([rootCode]);
 status("");
 if(children.length===1&&pxRecursiveTableItems(children).length===1){
  var only=children[0];
  if(!only||!only.id)throw new Error("La resposta de PxWeb conté una taula sense identificador.");
  await pxRecursiveLoadTable(only);
  return;
 }
 pxRecursiveAddLevel(children,0);
}

async function pxChildren(path,target){
 var d=await fetchJson(pxUrl(path)),items=a(d).map(function(x){return{id:String(f(x,"id","code","dbid","path")),label:String(f(x,"text","label","name","title")||f(x,"id","code","path")),type:String(f(x,"type","class"))}}).filter(function(x){return x.id});
 state.pxItems.set(target,items);
 fill($(target),items.map(function(x){return{value:x.id,label:x.id+" · "+x.label}}));
 $(target).disabled=!items.length;
 // Some PxWeb databases put the table directly at the first level.
 // If that level contains exactly one table, load its metadata immediately
 // instead of forcing the user through an empty/deeper selector.
 if(target&&items.length===1&&pxTable(items[0])){
  $(target).value=items[0].id;
  await pxSelect(target);
 }
}

async function pxSelect(target){
 var order=["concept","cross","node","table"],idx=order.indexOf(target);
 if(idx<0)return;
 var val=$(target).value;
 if(!val)return;
 state.selected[target==="concept"?"concept":target==="cross"?"cross":target==="node"?"node":"table"]=val;
 var path=[state.selected.stat];
 for(var i=0;i<idx;i++){
  var pv=$(order[i]).value;
  if(pv)path.push(pv);
 }
 path.push(val);
 for(var j=idx+1;j<order.length;j++)resetSelect(order[j]);
 state.metadata=null;
 $("query").disabled=true;
 $("tableInfo").hidden=true;
 $("cellInfo").hidden=true;
 $("filters").innerHTML="";
 state.filters.clear();

 if(state.pxPreset==="sweden"){
  // The last selector is always a table in the universal PXWeb flow.
  // Do not depend on the catalogue item's type flag.
  if(target==="table"){
   var tableItem=(state.pxItems.get("table")||[]).find(function(x){return String(x.id)===String(val)});
   var swTableId=tableItem&&tableItem.tableId?tableItem.tableId:val;
   var swTablePath=tableItem&&tableItem.path?tableItem.path:path;
   var swOk=await swedenTryTableMetadata(swTablePath,swTableId,swTableId);
   if(!swOk)throw new Error("No s'ha pogut carregar la taula de Statistics Sweden.");
   return;
  }
  var current=state.pxItems.get(target)||[];
  var item=current.find(function(x){return String(x.id)===String(val)});
  if(target==="table"||item&&item.type==="table"){
   var tablePath=item&&item.path?item.path:path;
   var tableId=item&&item.tableId?item.tableId:val;
   var ok=await swedenTryTableMetadata(tablePath,tableId,tableId);
   if(!ok)throw new Error("No s'ha pogut carregar la taula de Statistics Sweden.");
   return;
  }
  var children=await swedenV2Children(path,order[idx+1]||null);
  if(children.length===1){
   var next=order[idx+1];
   if(next){
    $(next).value=children[0].id;
    await pxSelect(next);
   }
  }
  return;
 }

 var current=state.pxItems.get(target)||[];
 var selectedItem=current.find(function(x){return String(x.id)===String(val)});

 // In Finland the final table URL must end in .px even when the
 // navigation catalogue did not mark the node as type "t".
 if(state.pxPreset==="finland"&&target==="table"){
  state.selected.table=val;
  state.pxPath=path.slice();
  if(!/\.px$/i.test(state.pxPath[state.pxPath.length-1]))
    state.pxPath[state.pxPath.length-1]+=".px";
  var finUrls=finlandTableUrls(state.pxPath);
  var finTableUrl=finUrls[0];
  var finRaw=null,finLastError=null;
  for(var fu=0;fu<finUrls.length&&!finRaw;fu++){
   try{finRaw=await fetchJson(finUrls[fu]);finTableUrl=finUrls[fu]}catch(e){finLastError=e}
  }
  if(finRaw&&isPxMetadata(finRaw)){
   // Encara que les metadades s'hagin obtingut per un alias antic,
   // el POST s'ha de fer contra el nom curt introduït el 08/06/2026.
   var finDb=String(state.pxPath[0]||state.selected.stat||"").replace(/^StatFin__/i,"").trim();
   var finShort=String(state.pxPath[state.pxPath.length-1]||val).replace(/\.px$/i,"");
   state.finlandTableUrl=finDb
     ? provider().base.replace(/\/+$/,"")+"/"+finDb+"/"+finShort+".px"
     : finTableUrl;
   state.swedenV2Table=false;
   state.metadata=pxToJsonStat(finRaw);
   renderMetadata(state.metadata);
   $("tableInfo").hidden=false;
   $("tableInfo").innerHTML="<strong>Taula:</strong> "+esc(finRaw.title||finRaw.label||val)+"<span class=\"path\">"+esc(finTableUrl)+"</span>";
   $("query").disabled=false;
   return;
  }
  throw new Error("La taula de Statistics Finland no ha retornat metadades.");
 }
 var directTable=selectedItem&&pxTable(selectedItem);
 if(directTable){
  state.selected.table=val;
  state.pxPath=path.slice();
  if(state.pxPreset==="finland"&&!/\\.px$/i.test(state.pxPath[state.pxPath.length-1]))state.pxPath[state.pxPath.length-1]+=".px";
  var tableUrls=state.pxPreset==="finland"?finlandTableUrls(state.pxPath):[pxUrl(state.pxPath)];
  var tableUrl=tableUrls[0],td=null;
  for(var tu=0;tu<tableUrls.length&&!td;tu++){
   try{td=await fetchJson(tableUrls[tu]);tableUrl=tableUrls[tu]}catch(e){}
  }
  if(td&&isPxMetadata(td)){
   if(state.pxPreset==="finland")state.finlandTableUrl=tableUrl;
   state.swedenV2Table=false;
   state.metadata=pxToJsonStat(td);
   renderMetadata(state.metadata);
   $("tableInfo").hidden=false;
   $("tableInfo").innerHTML="<strong>Taula:</strong> "+esc(td.title||td.label||val)+"<span class=\"path\">"+esc(tableUrl)+"</span>";
   $("query").disabled=false;
   return;
  }
 }
 var d=null,requestPath=path.slice();
 try{d=await fetchJson(pxUrl(requestPath))}catch(pxErr){
  // A Finland pot haver-hi nodes que el catàleg publica sense .px.
  // Si la primera consulta falla, provem la mateixa ruta amb l'extensió .px.
  var last=requestPath.length-1;
  if(state.pxPreset==="finland"&&last>=0&&!/\.px$/i.test(String(requestPath[last]))){
   var altPath=requestPath.slice();
   altPath[last]=String(altPath[last])+".px";
   d=await fetchJson(pxUrl(altPath));
   requestPath=altPath;
  }else throw pxErr;
 }
 if(d&&Array.isArray(d.variables)&&d.variables.length){
  state.selected.table=val;
  state.pxPath=requestPath.slice();
  state.swedenV2Table=false;
  state.metadata=pxToJsonStat(d);
  renderMetadata(state.metadata);
  $("tableInfo").hidden=false;
  $("tableInfo").innerHTML="<strong>Taula:</strong> "+esc(d.title||d.label||val)+"<span class=\"path\">"+esc(pxUrl(requestPath))+"</span>";
  $("query").disabled=false;
  return;
 }
 var items=a(d).map(function(x){
  var id=String(f(x,"id","code","dbid","path")).trim();
  return{id:id,label:String(f(x,"text","label","name","title")||id),type:String(f(x,"type","class")||"folder")};
 }).filter(function(x){return x.id});
 var next=order[idx+1];
 if(!next){
  throw new Error("L'element seleccionat no conté metadades de taula.");
 }
 state.pxItems.set(next,items);
 fill($(next),items.map(function(x){return{value:x.id,label:x.id+" · "+x.label}}));
 $(next).disabled=!items.length;
 if(items.length===1){
  $(next).value=items[0].id;
  await pxSelect(next);
 }
}

function pxToJsonStat(m){
 // PxWeb pot retornar les dades JSON-stat dins d'un embolcall
 // {dataset:{...}}. També pot retornar les metadades clàssiques
 // {title,variables:[...]}. Normalitzem tots dos formats.
 var src=m&&m.dataset&&typeof m.dataset==="object"?m.dataset:m;
 if(src&&Array.isArray(src.id)&&src.dimension){
  // Algunes respostes JSON-stat 1.2 d'Eustat poden no incloure "size".
  // La mida es pot reconstruir directament a partir de category.index.
  var needSize=!Array.isArray(src.size)||src.size.length!==src.id.length||src.size.some(function(n){return Number(n)<=0});
  if(needSize){
   var normalized=Object.assign({},src),sizes=[];
   if(normalized.value==null){
    if(normalized.values!=null)normalized.value=normalized.values;
    else if(Array.isArray(normalized.data))normalized.value=normalized.data;
   }
   src.id.forEach(function(id,j){
    var cat=src.dimension[id]&&src.dimension[id].category||{},n=Number(src.size&&src.size[j]||0);
    if(n>0){sizes.push(n);return}
    if(Array.isArray(cat.index))n=cat.index.length;
    else if(cat.index&&typeof cat.index==="object")n=Object.keys(cat.index).length;
    else if(Array.isArray(cat.label))n=cat.label.length;
    else if(cat.label&&typeof cat.label==="object")n=Object.keys(cat.label).length;
    sizes.push(n);
   });
   normalized.size=sizes;
   return normalized;
  }
  if(src.value==null){
   if(src.values!=null)src=Object.assign({},src,{value:src.values});
   else if(Array.isArray(src.data))src=Object.assign({},src,{value:src.data});
  }
  return src;
 }
 // Eustat JSON-stat 1.2: en algunes respostes, "id", "size" i "role" arriben dins de "dimension".
 // Els camps de les dimensions pròpiament dites continuen sent les claus restants.
 if(src&&src.dimension&&Array.isArray(src.dimension.id)){
  var ed=src.dimension, eids=ed.id.slice(), esizes=Array.isArray(ed.size)?ed.size.slice():[], eds={version:src.version||"2.0",class:src.class||"dataset",label:String(src.label||state.selected.table||""),id:eids,size:[],dimension:{}};
  eids.forEach(function(id,j){
   var d=ed[id]||{},cat=d.category||{},idx=cat.index,lab=cat.label||{},n=Number(esizes[j]||0);
   if(!n){if(Array.isArray(idx))n=idx.length;else if(idx&&typeof idx==="object")n=Object.keys(idx).length;else if(lab&&typeof lab==="object")n=Object.keys(lab).length;}
   eds.size.push(n);
   eds.dimension[id]=d;
  });
  if(src.value!=null)eds.value=src.value;
  else if(src.values!=null)eds.value=src.values;
  else if(Array.isArray(src.data))eds.value=src.data;
  if(ed.role)eds.role=ed.role;
  return eds;
 }
 var vars=Array.isArray(src&&src.variables)?src.variables:(Array.isArray(m&&m.variables)?m.variables:[]);
 var ds={version:"2.0",class:"dataset",label:String(src&&src.label||m&&m.title||m&&m.label||state.selected.table||""),id:[],size:[],dimension:{}};
 vars.forEach(function(v){
  var id=String(f(v,"code","id","variableCode","key")).trim();
  var vals=v&&Array.isArray(v.values)?v.values:(v&&Array.isArray(v.valueCodes)?v.valueCodes:[]);
  var labs=v&&Array.isArray(v.valueTexts)?v.valueTexts:(v&&Array.isArray(v.labels)?v.labels:(v&&Array.isArray(v.texts)?v.texts:[]));
  var index={},label={};
  vals.forEach(function(x,i){
   var code;
   if(x&&typeof x==="object")code=String(f(x,"id","code","value","key"));
   else code=String(x);
   if(!code)return;
   index[code]=i;
   label[code]=String(labs[i]==null?(x&&typeof x==="object"?f(x,"text","label","name"):code):labs[i]);
  });
  if(id){
   ds.id.push(id);
   ds.size.push(vals.length);
   ds.dimension[id]={label:String(f(v,"text","label","name","title")||id),category:{index:index,label:label}};
  }
 });
 // Si el metadata clàssic no porta variables però sí dimensions JSON-stat,
 // preservem també l'ordre i les etiquetes originals.
 if(!ds.id.length&&src&&src.dimension){
  ds.id=Array.isArray(src.id)?src.id.slice():Object.keys(src.dimension);
  ds.size=ds.id.map(function(id){
   var cat=src.dimension[id]&&src.dimension[id].category;
   if(cat&&Array.isArray(cat.index))return cat.index.length;
   if(cat&&cat.index&&typeof cat.index==="object")return Object.keys(cat.index).length;
   return 0;
  });
  ds.dimension=src.dimension;
  if(src.role)ds.role=src.role;
 }
 return ds;
}

function finlandTableUrl(path){return finlandTableUrls(path)[0]}

async function pxFlatSelectTable(tableId){
 tableId=String(tableId||"").trim();
 if(!tableId)return;
 state.selected.table=tableId;state.selected.node=tableId;state.pxPath=[tableId];
 state.metadata=null;$("query").disabled=true;$("tableInfo").hidden=true;$("cellInfo").hidden=true;$("filters").innerHTML="";state.filters.clear();
 var raw,mu;
 if(state.pxPreset==="eustat"){
  mu=provider().base+"/"+encodeURIComponent(tableId);
  raw=await fetchJson(mu);
 }else{
  mu=provider().base+"/tables/"+encodeURIComponent(tableId)+"/metadata?lang=en";
  raw=await fetchJson(mu);
 }
 var ds=pxToJsonStat(raw);
 if(!ds||!Array.isArray(ds.id)||!ds.id.length)throw new Error("La taula seleccionada no ha retornat metadades vàlides.");
 state.metadata=ds;renderMetadata(ds);$("tableInfo").hidden=false;
 $("tableInfo").innerHTML="<strong>Taula:</strong> "+esc(raw.title||raw.label||tableId)+"<span class=\"path\">"+esc(mu)+"</span>";
 $("query").disabled=false;
}

function pxTable(x){return/^(t|table)$/i.test(x&&x.type)||/\.px$/i.test(x&&x.id||"")||/_pxt_/i.test(x&&x.id||"")}

async function pxMetadata(){
 var raw,ds;
 if(state.pxPreset==="sweden"){
  var tableId=String(state.selected.table||"");
  var mu="https://statistikdatabasen.scb.se/api/v2/tables/"+encodeURIComponent(tableId)+"/metadata?lang=en";
  raw=await fetchJson(mu);ds=swedenV2MetadataToJsonStat(raw);state.metadata=ds;renderMetadata(ds);$("tableInfo").hidden=false;$("tableInfo").innerHTML="<strong>Taula:</strong> "+esc(raw.label||state.selected.table)+"<span class=\"path\">"+esc(mu)+"</span>";$("query").disabled=false;return
 }
 raw=await fetchJson(pxUrl(state.pxPath));ds=pxToJsonStat(raw);state.metadata=ds;renderMetadata(ds);$("tableInfo").hidden=false;$("tableInfo").innerHTML="<strong>Taula:</strong> "+esc(raw.title||raw.label||state.selected.table)+"<span class=\"path\">"+esc(pxUrl(state.pxPath))+"</span>";$("query").disabled=false}
