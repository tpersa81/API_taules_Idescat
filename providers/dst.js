/* Provider module — loaded after app-universal.js core. Depends on global state, $, fetchJson, etc. */
/* === dst (6 functions) === */

async function dstApi(path,body){
 var base=provider().base.replace(/\/+$/,"");
 var url=base+"/"+String(path||"").replace(/^\//,"");
 var opt={method:body?"POST":"GET",headers:{"Accept":"application/json","Content-Type":"application/json"},cache:"no-store"};
 if(body)opt.body=JSON.stringify(body);
 var r=await fetch(url,opt);
 if(!r.ok){
  var tx="";
  try{tx=await r.text()}catch(e){}
  throw new Error("Statistics Denmark: HTTP "+r.status+(tx?" · "+String(tx).slice(0,120):"")+" · "+url);
 }
 return r.json();
}

function dstTableLabel(tb){
 if(!tb)return "";
 var id=String(tb.id||"").trim();
 var text=String(tb.text||"").trim();
 var unit=String(tb.unit||"").trim();
 var vars=Array.isArray(tb.variables)?tb.variables.map(function(v){return String(v||"").trim()}).filter(Boolean):[];
 // Exclou "time" del "by …" (ja surt al període)
 var by=vars.filter(function(v){return !/^time$/i.test(v)});
 var period="";
 if(tb.firstPeriod||tb.latestPeriod){
  period=String(tb.firstPeriod||"")+(tb.firstPeriod&&tb.latestPeriod?"–":"")+String(tb.latestPeriod||"");
 }
 var parts=[];
 if(id)parts.push(id);
 var title=text||id;
 if(by.length)title=title+(title?" by ":"by ")+by.join(", ");
 if(title&&title!==id)parts.push(title);
 else if(text)parts.push(text);
 if(period)parts.push("("+period+")");
 if(unit)parts.push("["+unit+"]");
 return parts.join(" · ").replace(/\s+/g," ").trim();
}

async function dstSelectRoot(){
 var box=$("eurostatLevels");
 if(box){box.innerHTML="";box.hidden=false;box.style.display="grid"}
 if(typeof igeClearLevels==="function")igeClearLevels();
 else if(state.igeItems&&state.igeItems.clear)state.igeItems.clear();
 hideStatSelector(true);
 status("Carregant temes Statistics Denmark…");
 var roots=await dstApi("subjects",{lang:"en",format:"JSON"});
 if(!Array.isArray(roots)||!roots.length)throw new Error("Statistics Denmark: no s'han trobat temes.");
 var items=roots.map(function(x){
  return{id:String(x.id),label:String(x.description||x.text||x.id),type:"dst-subject"};
 });
 igeAddLevel(items,0,"Tema");
 if(box){box.hidden=false;box.style.display="grid"}
}

async function dstSelectFromLevel(index,val){
 var items=state.igeItems.get("igeLevel"+index)||[];
 var item=items.find(function(x){return String(x.id)===String(val)});
 if(!item)throw new Error("Statistics Denmark: element no trobat.");
 var box=$("eurostatLevels");
 if(box)Array.from(box.querySelectorAll("[data-ige-level]")).forEach(function(l){if(Number(l.dataset.igeLevel)>index)l.remove()});
 if(item.type==="dst-table"){
  await dstSelectTable(item.id,item.label);
  return;
 }
 status("Carregant…");
 var nodes=await dstApi("subjects",{lang:"en",format:"JSON",subjects:[String(item.id)],includeTables:true});
 var node=Array.isArray(nodes)&&nodes.length?nodes[0]:null;
 if(!node)throw new Error("Statistics Denmark: tema buit.");
 var next=[];
 (node.subjects||[]).forEach(function(s){
  next.push({id:String(s.id),label:String(s.description||s.text||s.id),type:"dst-subject"});
 });
 (node.tables||[]).forEach(function(tb){
  var tid=String(tb.id||"").trim();
  if(!tid)return;
  next.push({id:tid,label:dstTableLabel(tb),type:"dst-table"});
 });
 if(!next.length)throw new Error("Statistics Denmark: aquest tema no té subtemes ni taules.");
 igeAddLevel(next,index+1,next.some(function(x){return x.type==="dst-table"})&&!next.some(function(x){return x.type==="dst-subject"})?"Taula":"Subtema / taula");
 status("");
}

async function dstSelectTable(tableId,label){
 status("Carregant metadades…");
 var info=await dstApi("tableinfo",{table:String(tableId),lang:"en",format:"JSON"});
 if(!info||!Array.isArray(info.variables))throw new Error("Statistics Denmark: tableinfo sense variables.");
 var out={class:"dataset",version:"2.0",label:String(info.text||label||tableId),id:[],size:[],dimension:{},value:[],source:"Statistics Denmark"};
 info.variables.forEach(function(v){
  var dimId=String(v.id||"").trim();
  if(!dimId)return;
  var vals=Array.isArray(v.values)?v.values:[];
  var labels={},index=[];
  vals.forEach(function(x){
   var code=String(x.id!=null?x.id:x.values!=null?x.values:"").trim();
   if(!code)return;
   labels[code]=String(x.text||code);
   index.push(code);
  });
  if(!index.length)return;
  out.id.push(dimId);
  out.size.push(index.length);
  out.dimension[dimId]={label:String(v.text||dimId),category:{index:index,label:labels}};
  if(v.time)out.dimension[dimId].category.unit=out.dimension[dimId].category.unit||{};
 });
 if(!out.id.length)throw new Error("Statistics Denmark: la taula no té dimensions utilitzables.");
 state.selected.table=String(tableId);
 state.selected.node=String(tableId);
 state.selected.stat=String(tableId);
 state.metadata=out;
 renderMetadata(out);
 $("tableInfo").hidden=false;
 $("tableInfo").innerHTML="<strong>Taula:</strong> "+esc(out.label)+" <code>"+esc(tableId)+"</code>"
  +"<span class=\"path\">https://api.statbank.dk/v1/tableinfo · "+esc(tableId)+"</span>"
  +"<p>Source: Statistics Denmark (StatBank). CC BY 4.0.</p>"
  +"<p class=\"hint\">Límit orientatiu de consulta: 10.000 cel·les.</p>";
 $("query").disabled=false;
 status("");
}

async function dstQuery(filters){
 var tableId=state.selected.table;
 if(!tableId)throw new Error("Statistics Denmark: no s'ha seleccionat cap taula.");
 filters=filters||selectedFilters();
 var variables=[];
 dims(state.metadata).forEach(function(d){
  var all=d.categories||[];
  var selected=[];
  if(filters[d.id])selected=Array.from(filters[d.id]||[]);
  else if(state.filters&&state.filters.has(d.id))selected=Array.from(state.filters.get(d.id)||[]);
  // Si totes seleccionades → "*" (més curt i equivalent a StatBank)
  var useAll=!selected.length||selected.length===all.length;
  variables.push({code:d.id,values:useAll?["*"]:selected});
 });
 var body={table:String(tableId),lang:"en",format:"JSONSTAT",variables:variables};
 var url=provider().base.replace(/\/+$/,"")+"/data";
 var data=await dstApi("data",body);
 // StatBank retorna JSON-stat amb id/size/role DINS de dimension (variant antiga)
 if(data&&data.dataset)data=data.dataset;
 if(data&&data.dimension){
  if(!data.id&&data.dimension.id)data.id=data.dimension.id;
  if(!data.size&&data.dimension.size)data.size=data.dimension.size;
  if(!data.role&&data.dimension.role)data.role=data.dimension.role;
  try{delete data.dimension.id;delete data.dimension.size;delete data.dimension.role}catch(e){}
 }
 if(data&&!Array.isArray(data.id)){
  // reconstrueix id/size a partir de les dimensions de categoria
  var ids=[],sizes=[];
  Object.keys(data.dimension||{}).forEach(function(k){
   var cat=data.dimension[k]&&data.dimension[k].category;
   if(!cat)return;
   ids.push(k);
   var n=0;
   if(Array.isArray(cat.index))n=cat.index.length;
   else if(cat.index&&typeof cat.index==="object")n=Object.keys(cat.index).length;
   sizes.push(n||1);
  });
  data.id=ids;data.size=sizes;
 }
 if(data&&data.dimension&&!data.version)data.version="2.0";
 if(data&&!data.class)data.class="dataset";
 if(!data||!Array.isArray(data.id)||!data.id.length){
  throw new Error("Statistics Denmark: la resposta no té dimensions reconeixibles.");
 }
 return{data:data,url:url+"?table="+encodeURIComponent(tableId)};
}
