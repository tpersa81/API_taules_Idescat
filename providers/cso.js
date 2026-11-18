/* Provider module — loaded after app-universal.js core. Depends on global state, $, fetchJson, etc. */
/* === cso (7 functions) === */

async function csoRpc(method,params){
 var url="https://ws.cso.ie/public/api.jsonrpc";
 var body={jsonrpc:"2.0",method:method,params:params||{},id:String(Date.now())};
 var r=await fetch(url,{method:"POST",headers:{"Accept":"application/json","Content-Type":"application/json"},body:JSON.stringify(body),cache:"no-store"});
 if(!r.ok)throw new Error("CSO Ireland: HTTP "+r.status+" · "+url);
 var j=await r.json();
 if(j&&j.error)throw new Error("CSO Ireland: "+(j.error.message||JSON.stringify(j.error)));
 return j&&j.result;
}

async function csoRest(path){
 var url="https://ws.cso.ie/public/api.restful/"+String(path||"").replace(/^\//,"");
 var r=await fetch(url,{headers:{"Accept":"application/json"},cache:"no-store"});
 if(!r.ok)throw new Error("CSO Ireland: HTTP "+r.status+" · "+url);
 return r.json();
}

function csoTableLabel(m){
 if(!m)return "";
 var code=String(m.MtrCode||"").trim();
 var title=String(m.MtrTitle||"").trim();
 var cls=(m.classification||[]).map(function(c){return String(c.ClsValue||"").trim()}).filter(Boolean);
 // evita dimensions genèriques poc útils al títol
 cls=cls.filter(function(v){return !/^(statistic|year|quarter|month|time)$/i.test(v)});
 var freq=String(m.FrqValue||"").trim();
 var per=Array.isArray(m.period)?m.period:[];
 var range="";
 if(per.length)range=String(per[0])+(per.length>1?"–"+String(per[per.length-1]):"");
 var parts=[];
 if(code)parts.push(code);
 var mid=title||code;
 if(cls.length)mid=mid+(mid?" · by ":"by ")+cls.join(", ");
 if(mid&&mid!==code)parts.push(mid);
 if(freq)parts.push(freq);
 if(range)parts.push("("+range+")");
 return parts.join(" · ").replace(/\s+/g," ").trim();
}

async function csoSelectRoot(){
 var box=$("eurostatLevels");
 if(box){box.innerHTML="";box.hidden=false;box.style.display="grid"}
 if(typeof igeClearLevels==="function")igeClearLevels();
 else if(state.igeItems&&state.igeItems.clear)state.igeItems.clear();
 hideStatSelector(true);
 status("Carregant temes CSO Ireland…");
 var themes=await csoRpc("PxStat.System.Navigation.Navigation_API.Read",{LngIsoCode:"en"});
 if(!Array.isArray(themes)||!themes.length)throw new Error("CSO Ireland: no s'han trobat temes.");
 state.csoNav=themes;
 var items=themes.map(function(th){
  return{id:String(th.ThmCode),label:String(th.ThmValue||th.ThmCode),type:"cso-theme",raw:th};
 }).filter(function(x){return x.id});
 items.sort(function(a,b){return a.label.localeCompare(b.label,"en")});
 igeAddLevel(items,0,"Tema");
 if(box){box.hidden=false;box.style.display="grid"}
 status("");
}

async function csoSelectFromLevel(index,val){
 var items=state.igeItems.get("igeLevel"+index)||[];
 var item=items.find(function(x){return String(x.id)===String(val)});
 if(!item)throw new Error("CSO Ireland: element no trobat.");
 var box=$("eurostatLevels");
 if(box)Array.from(box.querySelectorAll("[data-ige-level]")).forEach(function(l){if(Number(l.dataset.igeLevel)>index)l.remove()});
 // neteja filtres/resultats en canviar nivell
 state.metadata=null;
 if(typeof clearQueryView==="function")clearQueryView();
 if($("query"))$("query").disabled=true;
 if($("tableInfo"))$("tableInfo").hidden=true;
 if($("cellInfo"))$("cellInfo").hidden=true;

 if(item.type==="cso-table"){
  await csoSelectTable(item.id,item.label);
  return;
 }
 if(item.type==="cso-theme"){
  status("Carregant subjectes…");
  var th=(state.csoNav||[]).find(function(x){return String(x.ThmCode)===String(item.id)})||item.raw;
  var subjects=(th&&th.subject)||[];
  var next=subjects.map(function(s){
   return{id:String(s.SbjCode),label:String(s.SbjValue||s.SbjCode),type:"cso-subject",raw:s,thm:item.id};
  }).filter(function(x){return x.id});
  next.sort(function(a,b){return a.label.localeCompare(b.label,"en")});
  if(!next.length)throw new Error("CSO Ireland: aquest tema no té subjectes.");
  igeAddLevel(next,index+1,"Subjecte");
  status("");
  return;
 }
 if(item.type==="cso-subject"){
  status("Carregant productes…");
  var subjects=[];
  (state.csoNav||[]).forEach(function(th){(th.subject||[]).forEach(function(s){subjects.push(s)})});
  var sbj=subjects.find(function(s){return String(s.SbjCode)===String(item.id)})||item.raw;
  var products=(sbj&&sbj.product)||[];
  var next=products.map(function(p){
   return{id:String(p.PrcCode),label:String(p.PrcValue||p.PrcCode)+(p.PrcReleaseCount!=null?" ("+p.PrcReleaseCount+")":""),type:"cso-product",raw:p,sbj:item.id};
  }).filter(function(x){return x.id});
  next.sort(function(a,b){return a.label.localeCompare(b.label,"en")});
  if(!next.length)throw new Error("CSO Ireland: aquest subjecte no té productes.");
  igeAddLevel(next,index+1,"Producte");
  status("");
  return;
 }
 if(item.type==="cso-product"){
  status("Carregant taules…");
  var found=await csoRpc("PxStat.System.Navigation.Navigation_API.Search",{LngIsoCode:"en",PrcCode:String(item.id)});
  if(!Array.isArray(found)||!found.length)throw new Error("CSO Ireland: aquest producte no té taules.");
  var next=found.map(function(m){
   var code=String(m.MtrCode||"").trim();
   if(!code)return null;
   return{id:code,label:csoTableLabel(m),type:"cso-table",raw:m};
  }).filter(Boolean);
  // unique by id
  var seen={};
  next=next.filter(function(x){if(seen[x.id])return false;seen[x.id]=1;return true});
  next.sort(function(a,b){return a.label.localeCompare(b.label,"en")});
  if(!next.length)throw new Error("CSO Ireland: no s'han pogut llistar taules.");
  igeAddLevel(next,index+1,"Taula");
  status("");
  return;
 }
 throw new Error("CSO Ireland: tipus desconegut ("+item.type+").");
}

async function csoSelectTable(matrix,label){
 status("Carregant metadades…");
 var meta=await csoRest("PxStat.Data.Cube_API.ReadMetadata/"+encodeURIComponent(matrix)+"/en");
 if(!meta||!meta.dimension)throw new Error("CSO Ireland: metadades buides per a "+matrix+".");
 // Normalitza a dataset json-stat
 var ds=meta;
 if(ds.dataset&&!ds.dimension)ds=ds.dataset;
 if(!Array.isArray(ds.id)&&ds.dimension){
  var ids=[],sizes=[];
  Object.keys(ds.dimension).forEach(function(k){
   if(k==="id"||k==="size"||k==="role")return;
   var cat=ds.dimension[k]&&ds.dimension[k].category;
   if(!cat)return;
   ids.push(k);
   var n=0;
   if(Array.isArray(cat.index))n=cat.index.length;
   else if(cat.index&&typeof cat.index==="object")n=Object.keys(cat.index).length;
   else if(cat.label&&typeof cat.label==="object")n=Object.keys(cat.label).length;
   sizes.push(n||1);
  });
  if(!ds.id)ds.id=ids;
  if(!ds.size)ds.size=sizes;
 }
 if(ds.dimension&&!ds.version)ds.version="2.0";
 if(!ds.class)ds.class="dataset";
 if(!ds.label)ds.label=label||matrix;
 state.selected.table=String(matrix);
 state.selected.node=String(matrix);
 state.selected.stat=String(matrix);
 state.metadata=ds;
 renderMetadata(ds);
 $("tableInfo").hidden=false;
 $("tableInfo").innerHTML="<strong>Taula:</strong> "+esc(ds.label||matrix)+" <code>"+esc(matrix)+"</code>"
  +"<span class=\"path\">https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadMetadata/"+esc(matrix)+"/en</span>"
  +"<p>Source: Central Statistics Office (Ireland) · PxStat.</p>";
 $("query").disabled=false;
 status("");
}

async function csoQuery(filters){
 var matrix=state.selected.table;
 if(!matrix)throw new Error("CSO Ireland: no s'ha seleccionat cap taula.");
 filters=filters||selectedFilters();
 // Construeix query JSON-stat / PxStat
 var dim={};
 var idOrder=[];
 dims(state.metadata).forEach(function(d){
  var all=(d.categories||[]).map(function(c){return String(c.code)});
  var selected=[];
  if(filters[d.id])selected=Array.from(filters[d.id]||[]).map(String);
  else if(state.filters&&state.filters.has(d.id))selected=Array.from(state.filters.get(d.id)||[]).map(String);
  if(!selected.length)selected=all.slice();
  // Si totes seleccionades, es pot ometre la dimensió (PxStat retorna totes)
  if(selected.length&&selected.length<all.length){
   dim[d.id]={category:{index:selected}};
   idOrder.push(d.id);
  }
 });
 var body={
  jsonrpc:"2.0",
  method:"PxStat.Data.Cube_API.ReadDataset",
  params:{
   class:"query",
   id:idOrder,
   dimension:dim,
   extension:{
    pivot:null,
    codes:false,
    language:{code:"en"},
    format:{type:"JSON-stat",version:"2.0"},
    matrix:String(matrix)
   },
   version:"2.0"
  },
  id:String(Date.now())
 };
 // Si no hi ha filtre parcial, GET REST de tot el dataset
 var url="https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/"+encodeURIComponent(matrix)+"/JSON-stat/2.0/en";
 var data;
 if(idOrder.length){
  var r=await fetch("https://ws.cso.ie/public/api.jsonrpc",{method:"POST",headers:{"Accept":"application/json","Content-Type":"application/json"},body:JSON.stringify(body),cache:"no-store"});
  if(!r.ok)throw new Error("CSO Ireland: HTTP "+r.status+" en consultar dades.");
  var j=await r.json();
  if(j&&j.error)throw new Error("CSO Ireland: "+(j.error.message||JSON.stringify(j.error)));
  data=j&&j.result;
  url="https://ws.cso.ie/public/api.jsonrpc · "+matrix;
 }else{
  data=await csoRest("PxStat.Data.Cube_API.ReadDataset/"+encodeURIComponent(matrix)+"/JSON-stat/2.0/en");
 }
 if(data&&data.dataset&&!data.dimension)data=data.dataset;
 if(data&&data.dimension&&!data.version)data.version="2.0";
 if(data&&!data.class)data.class="dataset";
 if(!data||(!data.dimension&&data.value==null))throw new Error("CSO Ireland: resposta de dades buida.");
 return{data:data,url:url};
}
