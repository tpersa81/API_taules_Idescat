/* Provider module — loaded after app-universal.js core. Depends on global state, $, fetchJson, etc. */
/* === istac (22 functions) === */

function istacJsonUrl(url){
 // ISTAC retorna XML per defecte; cal demanar JSON (.json a la ruta).
 url=String(url||"");
 if(!/datos\.canarias\.es\/api\/estadisticas/i.test(url))return url;
 try{
  var u=new URL(url);
  // /datasets/ISTAC? → /datasets/ISTAC.json?
  // /datasets/ISTAC/ID/~latest → /datasets/ISTAC/ID/~latest.json si no el té
  if(!/\.json$/i.test(u.pathname)){
   if(/\/~latest$/i.test(u.pathname)||/\/versions\/[^/]+$/i.test(u.pathname)||/\/datasets\/ISTAC$/i.test(u.pathname)){
    u.pathname=u.pathname.replace(/\/?$/,"")+".json";
   }else if(/\/datasets\/ISTAC\//i.test(u.pathname)&&!/\.json(\/|$)/i.test(u.pathname)){
    // deixa passar rutes de recurs; només afegeix .json al final del path si sembla endpoint de representació
    if(/\/(ISTAC|~latest|V[0-9.]+)$/i.test(u.pathname))u.pathname=u.pathname+".json";
   }
  }
  return u.toString();
 }catch(e){
  return url.replace(/\/datasets\/ISTAC(\?|$)/i,"/datasets/ISTAC.json$1")
            .replace(/\/~latest(\?|$)/i,"/~latest.json$1");
 }
}

function istacList(d){if(Array.isArray(d))return d;if(d&&Array.isArray(d.dataset))return d.dataset;if(d&&Array.isArray(d.query))return d.query;if(d&&Array.isArray(d.operation))return d.operation;if(d&&Array.isArray(d.operations))return d.operations;if(d&&Array.isArray(d.data))return d.data;if(d&&Array.isArray(d.datasets))return d.datasets;if(d&&Array.isArray(d.results))return d.results;if(d&&Array.isArray(d.items))return d.items;if(d&&Array.isArray(d.category))return d.category;return[]}

function istacText(x,lang){if(x==null)return"";if(typeof x==="string"||typeof x==="number")return String(x);if(Array.isArray(x)){var exact=x.find(function(v){return v&&String(v.lang||"").toLowerCase()===String(lang||"es").toLowerCase()});if(exact)return istacText(exact.value!=null?exact.value:exact.text,lang);for(var i=0;i<x.length;i++){var t=istacText(x[i],lang);if(t)return t}return""}if(typeof x==="object"){if(x.value!=null&&typeof x.value!=="object")return String(x.value);if(x.text!=null)return istacText(x.text,lang);if(x.name!=null)return istacText(x.name,lang)}return""}

function istacDimensionArray(meta){var d=meta&&meta.dimensions&&meta.dimensions.dimension;if(Array.isArray(d))return d;if(d&&typeof d==="object")return Object.keys(d).map(function(k){return d[k]});return[]}

function istacValueArray(v){if(!v)return[];if(Array.isArray(v))return v;if(v.value&&Array.isArray(v.value))return v.value;return[]}

function istacMetadataToJsonStat(raw){var src=raw&&raw.metadata?raw.metadata:raw;if(src&&Array.isArray(src.id)&&src.dimension)return pxToJsonStat(src);if(!src||!src.dimensions)return pxToJsonStat(raw);var ds={version:"2.0",class:"dataset",label:istacText(src.name,"es")||String(raw&&raw.label||state.selected.table||""),id:[],size:[],dimension:{}};istacDimensionArray(src).forEach(function(d){var id=String(d&&d.id||"").trim();if(!id)return;var vals=istacValueArray(d.dimensionValues),index={},label={};vals.forEach(function(v,i){var code=String(v&&v.id!=null?v.id:"").trim();if(!code)return;index[code]=i;label[code]=istacText(v&&v.name,"es")||code});ds.id.push(id);ds.size.push(vals.length);ds.dimension[id]={label:istacText(d.name,"es")||id,category:{index:index,label:label}}});return ds}

function istacMetaField(x,key){var v=x&&x.metadata&&x.metadata[key]!=null?x.metadata[key]:(x&&x[key]!=null?x[key]:null);if(Array.isArray(v))return{id:"",label:istacText(v,"es")};if(v&&typeof v==="object"){var id=v.id||v.code||v.resourceId||v.operationId||"",label=istacText(v.name||v.label||v.title,"es")||String(id||"");return{id:String(id||""),label:label}}return{id:String(v||""),label:String(v||"")}}

function istacDatasetRecord(x){var id=String(f(x,"id","resourceId","resourceID","code")).trim(),label=istacText(x&&x.name,"es")||String(f(x,"label","title","text")||id).trim(),subject=istacMetaField(x,"subject"),op=istacMetaField(x,"statisticalOperation");if(!subject.label)subject=istacMetaField(x,"subjectCode");return{id:id,label:label,subject:subject.label||"Altres",operation:op.label||"Sense operació",version:String(f(x,"version")||"~latest")}}

function istacNormTheme(v){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim()}

function istacTextEs(nameObj){
 if(nameObj==null)return"";
 if(typeof nameObj==="string"||typeof nameObj==="number")return String(nameObj);
 return istacText(nameObj,"es")||istacText(nameObj,"en")||"";
}

function istacThemeFromSubjectArea(sa){
 if(!sa)return"";
 // nestedId tipus T130000.T130100.T130103 → arrel T130000
 var nid=String(sa.nestedId||sa.id||"").trim();
 var root=(nid.split(".")[0]||"").trim();
 if(root&&state.istacThemeMap&&state.istacThemeMap.has(root))return state.istacThemeMap.get(root);
 // fallback al nom de l'àrea (pot ser més específic)
 var lab=istacTextEs(sa.name);
 return lab||root||"";
}

function istacOperationThemes(x){
 // Preferent: subjectArea de la fitxa d'operació
 var out=[],seen=new Set();
 function add(t){t=String(t||"").trim();if(t&&!seen.has(t)){seen.add(t);out.push(t)}}
 if(x&&x.subjectArea)add(istacThemeFromSubjectArea(x.subjectArea));
 if(x&&Array.isArray(x.themes))x.themes.forEach(add);
 return out;
}

async function istacLoadThemeRoots(){
 if(state.istacThemeMap&&state.istacThemeMap.size)return;
 var map=new Map(),offset=0,limit=100;
 for(var guard=0;guard<10;guard++){
  var u="https://datos.canarias.es/api/estadisticas/structural-resources/v1.0/categoryschemes/ISTAC/TEMAS_CANARIAS/03.000/categories.json?lang=es&limit="+limit+"&offset="+offset;
  var d=await fetchJson(u),page=istacList(d);
  // categories poden venir com category[]
  if(!page.length&&d&&Array.isArray(d.category))page=d.category;
  if(!page.length)break;
  page.forEach(function(c){
   var id=String(c&&c.id||"").trim();
   var nid=String(c&&c.nestedId||id).trim();
   var parent=c&&c.parent;
   var isRoot=!parent&&nid&&nid.indexOf(".")<0;
   if(!isRoot&&parent==null&&id&&id.indexOf(".")<0)isRoot=true;
   if(!isRoot)return;
   var lab=istacTextEs(c&&c.name)||id;
   if(id)map.set(id,lab);
  });
  if(page.length<limit)break;
  offset+=page.length;
 }
 state.istacThemeMap=map;
 ISTAC_THEMES=Array.from(map.values());
}

async function istacFetchOperationDetail(id){
 var u="https://datos.canarias.es/api/estadisticas/operations/v1.0/operations/"+encodeURIComponent(id)+".json?lang=es";
 return await fetchJson(u);
}

async function istacLoadOperations(){
 if(state.istacDatasets&&state.istacDatasets.length&&state.istacDatasets[0]&&state.istacDatasets[0]._kind==="operation"&&state.istacDatasets.some(function(x){return x.themes&&x.themes.length}))return state.istacDatasets;

 status("Carregant temes i operacions d'ISTAC…");
 await istacLoadThemeRoots();

 // 1) Llista d'operacions (≈295)
 var all=[],offset=0,limit=200;
 for(var guard=0;guard<20;guard++){
  var u="https://datos.canarias.es/api/estadisticas/operations/v1.0/operations.json?lang=es&limit="+limit+"&offset="+offset;
  var d=await fetchJson(u),page=istacList(d);
  if(!page.length)break;
  all=all.concat(page);
  if(page.length<limit)break;
  offset+=page.length;
 }

 // 2) Fitxa de cada operació per obtenir subjectArea (lot parallel)
 var ops=[],batchSize=12;
 for(var i=0;i<all.length;i+=batchSize){
  var batch=all.slice(i,i+batchSize);
  var details=await Promise.all(batch.map(function(x){
   var id=String(f(x,"id","code")).trim();
   return istacFetchOperationDetail(id).then(function(det){
    return{list:x,det:det||x};
   }).catch(function(){return{list:x,det:x}});
  }));
  details.forEach(function(pair){
   var x=pair.det||pair.list;
   var id=String(f(x,"id","code")||f(pair.list,"id","code")).trim();
   if(!id)return;
   var label=istacTextEs(x&&x.name)||istacTextEs(pair.list&&pair.list.name)||id;
   var themes=istacOperationThemes(x);
   if(!themes.length)themes=istacOperationThemes(pair.list);
   ops.push({_kind:"operation",id:id,label:label,subject:themes[0]||"Altres",operation:label,themes:themes.length?themes:["Altres"]});
  });
  status("Carregant operacions d'ISTAC…");
 }

 ops=ops.filter(function(x){return x.id});
 // Només mostrem operacions que tenen almenys un cub/taula de dades.
 var usable=[],cubeBatch=12;
 for(var ci=0;ci<ops.length;ci+=cubeBatch){
  var cb=ops.slice(ci,ci+cubeBatch);
  var cr=await Promise.all(cb.map(function(op){
   var q=encodeURIComponent('ID LIKE "'+String(op.id).replace(/"/g,"")+'%"');
   var u=provider().base+"/statistical-resources/v1.0/datasets/ISTAC.json?lang=es&limit=1&offset=0&query="+q;
   return fetchJson(u).then(function(d){
    return{op:op,has:istacList(d).length>0};
   }).catch(function(){
    return{op:op,has:true};
   });
  }));
  cr.forEach(function(x){if(x.has)usable.push(x.op)});
  status("Carregant operacions d'ISTAC…");
 }
 state.istacDatasets=usable.sort(function(a,b){return a.label.localeCompare(b.label,"es",{numeric:true})});
 if(!state.istacDatasets.length)throw new Error("ISTAC: no s'han trobat operacions estadístiques amb cub de dades.");
 return state.istacDatasets;
}

async function istacLoadDatasets(){return istacLoadOperations()}

async function istacLoadOperationTables(opId){
 opId=String(opId||"").trim();
 if(!opId)return [];
 var q=encodeURIComponent('ID LIKE "'+opId+'%"');
 async function loadKind(kind){
  var all=[],offset=0,limit=200;
  for(var guard=0;guard<50;guard++){
   var u=provider().base+"/statistical-resources/v1.0/"+kind+"/ISTAC.json?lang=es&limit="+limit+"&offset="+offset+"&query="+q;
   var d=null;
   try{d=await fetchJson(u)}catch(e){break}
   var page=istacList(d);
   if(!page.length){
    // total pot ser 0
    break;
   }
   page.forEach(function(x){
    var id=String(f(x,"id","code")).trim();
    if(!id)return;
    var label=istacText(x&&x.name,"es")||id;
    all.push({id:id,label:label,operation:opId,kind:kind==="queries"?"query":"dataset"});
   });
   // Per obtenir els temes arrel no cal paginar: el primer bloc ja els conté.
   break;
  }
  return all;
 }
 var datasets=await loadKind("datasets");
 var queries=[];
 try{queries=await loadKind("queries")}catch(e){queries=[]}
 // dedup per id (prioritza dataset)
 var seen=new Set(),out=[];
 datasets.concat(queries).forEach(function(x){
  if(seen.has(x.id))return;
  seen.add(x.id);
  out.push(x);
 });
 out.sort(function(a,b){return a.label.localeCompare(b.label,"es",{numeric:true})});
 return out;
}

function istacUnique(items,key){var seen=new Set(),out=[];items.forEach(function(x){var v=String(x[key]||"").trim();if(v&&!seen.has(v)){seen.add(v);out.push(v)}});return out.sort(function(a,b){return a.localeCompare(b,"ca",{numeric:true})})}

async function istacSelectTable(rec){
 state.selected.stat=rec.operation||"";
 state.selected.concept="";
 state.selected.cross=rec.id;
 state.selected.node=rec.id;
 state.selected.table=rec.id;
 state.istacPath=[rec.id];
 status("Consultant metadades d'ISTAC…");
 var url=provider().base+"/statistical-resources/v1.0/datasets/ISTAC/"+encodeURIComponent(rec.id)+"/~latest.json?fields=-data&lang=es";
 var raw=await fetchJson(url),ds=istacMetadataToJsonStat(raw);
 if(!ds||!Array.isArray(ds.id)||!ds.id.length)throw new Error("ISTAC: no s'han pogut carregar les metadades de la taula.");
 state.metadata=ds;
 renderMetadata(ds);
 $("tableInfo").hidden=false;
 $("tableInfo").innerHTML="<strong>Taula:</strong> "+esc(rec.label)+"<span class=\"path\">"+esc(url)+"</span>";
 $("query").disabled=false;
 status("");
}

function istacDraw(level,theme){
 var box=$("eurostatLevels");if(!box)return;
 box.innerHTML="";box.hidden=false;box.style.display="grid";
 var ops=state.istacDatasets||[];
 // Temes presents a les operacions carregades (no una llista fixa buida)
 var themeSet=new Set();
 ops.forEach(function(op){(op.themes||[]).forEach(function(t){if(t)themeSet.add(t)})});
 var themes=Array.from(themeSet).sort(function(a,b){return a.localeCompare(b,"es",{numeric:true})});
 function addSelect(label,items,value,onchange){
  var lab=document.createElement("label");
  lab.style.display="flex";lab.style.flexDirection="column";lab.style.alignItems="stretch";
  lab.appendChild(document.createTextNode(label+" "));
  var sel=document.createElement("select");
  sel.appendChild(new Option("— Selecciona —",""));
  items.forEach(function(x){sel.appendChild(new Option(x.label||x,x.id||x))});
  if(value)sel.value=value;
  lab.appendChild(sel);box.appendChild(lab);
  sel.onchange=onchange;
  return sel;
 }
 if(!themes.length){
  // Sense temes: salta directament a totes les operacions
  status("ISTAC: no s'ha pogut obtenir la classificació temàtica; es mostren totes les operacions.");
  var lab=document.createElement("label");
  lab.style.display="flex";lab.style.flexDirection="column";lab.style.alignItems="stretch";
  lab.appendChild(document.createTextNode("Operació estadística "));
  var sel=document.createElement("select");
  sel.appendChild(new Option("— Selecciona —",""));
  ops.forEach(function(op){sel.appendChild(new Option(op.label,op.id))});
  lab.appendChild(sel);box.appendChild(lab);
  sel.onchange=async function(){
   clearQueryView();
   if(!sel.value)return;
   status("Carregant taules d'ISTAC…");
   try{
    var tables=await istacLoadOperationTables(sel.value);
    istacDrawTables(sel.value,tables);
    status("");
   }catch(e){status("ISTAC: "+(e&&e.message?String(e.message):String(e)),"error")}
  };
  return;
 }
 var themeItems=themes.map(function(t){return{id:t,label:t}});
 var selTheme=addSelect("Grup temàtic",themeItems,theme||"",async function(){
  clearQueryView();
  if(!selTheme.value){istacDraw(0,"");return}
  istacDrawOperations(selTheme.value);
 });
 if(themes.length===1){selTheme.value=themes[0];selTheme.onchange()}
}

function istacDrawOperations(theme){
 var box=$("eurostatLevels");if(!box)return;
 var labels=box.querySelectorAll("label");
 for(var i=1;i<labels.length;i++)labels[i].remove();
 var oldMsg=box.querySelector(".istac-no-cube");if(oldMsg)oldMsg.remove();
 var ops=(state.istacDatasets||[]).filter(function(x){return (x.themes||[]).indexOf(theme)>=0});
 var lab=document.createElement("label");
 lab.style.display="flex";lab.style.flexDirection="column";lab.style.alignItems="stretch";
 lab.appendChild(document.createTextNode("Operació estadística "));
 var sel=document.createElement("select");
 sel.appendChild(new Option("— Selecciona —",""));
 ops.forEach(function(op){sel.appendChild(new Option(op.label,op.id))});
 lab.appendChild(sel);box.appendChild(lab);
 if(!ops.length){
  status("ISTAC: no s'han trobat operacions per a aquest tema.","error");
  return;
 }
 sel.onchange=async function(){
  clearQueryView();
  if(!sel.value)return;
  status("Carregant taules d'ISTAC…");
  try{
   var tables=await istacLoadOperationTables(sel.value);
   istacDrawTables(sel.value,tables);
   status("");
  }catch(e){status("ISTAC: "+(e&&e.message?String(e.message):String(e)),"error")}
 };
 if(ops.length===1){sel.value=ops[0].id;sel.onchange()}
}

function istacDrawTables(opId,tables){
 var box=$("eurostatLevels");if(!box)return;
 var oldMsg=box.querySelector(".istac-no-cube");if(oldMsg)oldMsg.remove();
 var labels=box.querySelectorAll("label");
 for(var i=2;i<labels.length;i++)labels[i].remove();
 if(!(tables||[]).length){
  var msg=document.createElement("div");
  msg.className="empty istac-no-cube";
  msg.textContent="ISTAC: aquesta operació no té cub de dades associat";
  box.appendChild(msg);
  status("");
  return;
 }
 var lab=document.createElement("label");
 lab.style.display="flex";lab.style.flexDirection="column";lab.style.alignItems="stretch";
 lab.appendChild(document.createTextNode("Taula "));
 var sel=document.createElement("select");
 sel.appendChild(new Option("— Selecciona —",""));
 (tables||[]).forEach(function(tb){sel.appendChild(new Option(tb.label,tb.id))});
 lab.appendChild(sel);box.appendChild(lab);

 sel.onchange=async function(){
  clearQueryView();
  if(!sel.value)return;
  var rec=(tables||[]).find(function(x){return x.id===sel.value});
  if(!rec)return;
  try{await istacSelectTable(rec)}catch(e){status("ISTAC: "+(e&&e.message?String(e.message):String(e)),"error")}
 };
 if(tables.length===1){sel.value=tables[0].id;sel.onchange()}
}
