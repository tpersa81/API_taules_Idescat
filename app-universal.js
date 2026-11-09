
const MAX_CELLS=20000;
const state={provider:"idescat",pxPreset:"finland",stats:[],metadata:null,lastData:null,lastQueryUrl:"",finlandTableUrl:"",filters:new Map(),page:1,pageSize:100,requestToken:0,pivot:{rows:[],columns:[]},selected:{stat:"",concept:"",cross:"",node:"",table:"",geo:""},cart:[],nextCartId:1,pxPath:[],pxItems:new Map(),ineTables:[],swedenV2Tables:null,swedenV2Table:false,swedenPath:[],eurostatTOC:null,eurostatRoots:[],eurostatNodes:[],eurostatPath:[]};
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]});
async function fetchJson(url,opt){opt=opt||{};var r;try{r=await fetch(url,opt)}catch(e){
  // Statistics Iceland no exposa CORS per a les peticions de la seva API.
  // Reintentem la mateixa petició a través de cors.tools, que admet també POST.
  if(state.provider==="pxweb"&&((state.pxPreset==="iceland"&&/^https:\/\/px\.hagstofa\.is\//i.test(url))||(state.pxPreset==="finland"&&/^https:\/\/pxdata\.stat\.fi\//i.test(url)))){
   try{
    // Statistics Iceland i Statistics Finland no permeten les peticions POST
    // directes des de GitHub Pages per CORS. cors.tools admet també POST i
    // reenvia el body i els headers de la petició original.
    var proxyUrl="https://cors.tools/proxy?url="+encodeURIComponent(url);
    r=await fetch(proxyUrl,opt);
   }catch(e2){throw new Error("No s'ha pogut connectar amb l'API. "+(e2&&e2.message||"Failed to fetch")+" · "+url)}
  }else if(state.provider==="ine"&&/^https:\/\/servicios\\.ine\\.es\//i.test(url)&&/\?/.test(url)){
   // INE pot retornar una resposta d'error sense cap capçalera CORS quan la
   // consulta DATASET porta filtres tv. Reintentem la mateixa petició GET
   // mitjançant un proxy de lectura per poder obtenir també el cos real de
   // la resposta (i no confondre l'error CORS amb un error de connexió).
   try{
    var ineProxy="https://api.allorigins.win/raw?url="+encodeURIComponent(url);
    r=await fetch(ineProxy,{cache:"no-store"});
   }catch(e2){throw new Error("No s'ha pogut connectar amb l'API. "+(e2&&e2.message||"Failed to fetch")+" · "+url)}
  }else throw new Error("No s'ha pogut connectar amb l'API. "+(e&&e.message||"Failed to fetch")+" · "+url)
}var text="";try{text=await r.text()}catch(e){throw new Error("No s'ha pogut llegir la resposta de l'API (HTTP "+r.status+").")}var d=null;try{d=text?JSON.parse(text):null}catch(e){if(!r.ok)throw new Error("Error HTTP "+r.status+": "+text.slice(0,300));throw new Error("Resposta no vàlida de l'API (HTTP "+r.status+").")}if(!r.ok||d&&(d.class==="error"||d.error||d.errors)){
  var detail=d&&(d.detail||d.label||d.message||d.error||d.errors||d.title);
  if(detail&&typeof detail==="object"){
   if(Array.isArray(detail))detail=detail.map(function(x){return x&&typeof x==="object"?String(x.message||x.detail||x.error||JSON.stringify(x)):String(x)}).join(" · ");
   else detail=detail.message||detail.detail||detail.error||JSON.stringify(detail);
  }
  throw new Error(String(detail||"Error HTTP "+r.status+"."));
 }
 return d}
function a(d){if(Array.isArray(d))return d;if(d&&Array.isArray(d.data))return d.data;if(d&&Array.isArray(d.items))return d.items;if(d&&Array.isArray(d.result))return d.result;return[]}
function f(o){for(var i=1;i<arguments.length;i++){var k=arguments[i];if(o&&o[k]!=null)return o[k]}return""}
function fill(sel,items,ph){if(!sel)return;var old=sel.value;sel.innerHTML="";if(ph!==null)sel.append(new Option(ph||"— Selecciona —",""));(items||[]).forEach(function(x){sel.append(new Option(x.label||x.value,x.value))});if([].slice.call(sel.options).some(function(o){return o.value===old}))sel.value=old}
function resetSelect(id){if($(id)){$(id).innerHTML='<option value="">— Selecciona —</option>';$(id).disabled=true}}
function busy(v){document.body.classList.toggle("busy",v)}
function status(s,t){$("status").textContent=s||"";$("status").className=t||""}
function provider(){var p={idescat:{label:"Idescat",base:"https://api.idescat.cat/taules/v2",doc:"https://www.idescat.cat/dev/api/taules/"},pxweb:{label:"PXWeb",base:"",doc:"https://pxdata.stat.fi/api1.html"},ine:{label:"INE",base:"https://servicios.ine.es/wstempus/js",doc:"https://www.ine.es/OpenAPI/"},eurostat:{label:"Eurostat",base:"https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0",doc:"https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access/"}};if(state.provider==="pxweb"){var x={finland:"https://pxdata.stat.fi/PxWeb/api/v1/en/StatFin",sweden:"https://api.scb.se/OV0104/v1/doris/en/ssd",unece:"https://w3.unece.org/PXWeb2015/api/v1/en/STAT",iceland:"https://px.hagstofa.is/pxen/api/v1/en"};p.pxweb.base=x[state.pxPreset]||x.finland}return p[state.provider]}
function pxUrl(path){
 var p=(path||[]).slice();
 // Statistics Finland mostra els identificadors de carpeta com StatFin__xxx,
 // però l'API REST construeix la ruta amb xxx (p. ex. /StatFin/synt/12dj.px).
 if(state.provider==="pxweb"&&state.pxPreset==="finland"&&p.length&&/^StatFin__/i.test(String(p[0])))
  p[0]=String(p[0]).replace(/^StatFin__/i,"");
 return [provider().base.replace(/\/+$/,"")].concat(p).join("/");
}
function jsonstatCats(ds,id){var c=ds.dimension&&ds.dimension[id]&&ds.dimension[id].category||{},lab=c.label&&typeof c.label==="object"?c.label:{};if(Array.isArray(c.index))return c.index.map(function(code,i){return{code:String(code),label:String(lab[code]==null?code:lab[code]),index:i}});if(c.index&&typeof c.index==="object")return Object.keys(c.index).map(function(code){return{code:String(code),label:String(lab[code]==null?code:lab[code]),index:Number(c.index[code])}}).sort(function(x,y){return x.index-y.index});return Object.keys(lab).map(function(code,i){return{code:String(code),label:String(lab[code]),index:i}})}
function dims(ds){return(ds.id||[]).map(function(id){var d=ds.dimension&&ds.dimension[id]||{};return{id:id,label:d.label||id,role:d.extension&&d.extension.role||d.role||"",categories:jsonstatCats(ds,id)}})}
function temporal(d){var id=String(d.id||"").toUpperCase(),r=String(d.role||"").toUpperCase();return["YEAR","MONTH","QUARTER","SEMESTER","BIMONTH","WEEK","DAY","DATE","TIME","TIME_PERIOD","PERIOD"].indexOf(id)>=0||id.indexOf("TIME")===0||r.indexOf("TIME")>=0||r.indexOf("TEMPOR")>=0}
function sortedCats(c,d){var x=c.slice().sort(function(a,b){return a.index-b.index});return temporal(d)?x.reverse():x}
function collection(d){
 if(d&&d.class==="collection"){
  var items=Array.isArray(d.link&&d.link.item)?d.link.item:[];
  return items.map(function(item){
   var id=item&&item.id;
   if(!id&&item&&item.extension&&typeof item.extension==="object")id=item.extension.id;
   if(!id&&item&&item.href){
    try{
     var u=new URL(item.href,provider().base+"/");
     var parts=u.pathname.split("/").filter(Boolean);
     id=parts.length?parts[parts.length-1]:"";
    }catch(e){
     var h=String(item.href).split("?")[0].split("#")[0];
     id=h.split("/").filter(Boolean).pop()||"";
    }
   }
   return{id:String(id||""),label:String(item&&item.label!=null?item.label:(id||""))};
  }).filter(function(x){return x.id});
 }
 if(d&&d.class==="dataset"&&Array.isArray(d.id)&&d.id.length)
  return jsonstatCats(d,d.id[0]).map(function(x){return{id:x.code,label:x.label}});
 return[];
}
function clearBelow(keepStat){state.pivot={rows:[],columns:[]};if(!keepStat)fill($("stat"),[]);["concept","cross","node","table","geo"].forEach(resetSelect);eurostatClearLevels();state.metadata=null;state.lastData=null;state.filters.clear();$("filters").innerHTML="";$("results").innerHTML='<div class="empty">Selecciona una taula i fes la consulta.</div>';$("query").disabled=true;$("exportCsv").disabled=true;$("exportXlsx").disabled=true;$("addToCart").disabled=true;$("tableInfo").hidden=true;$("cellInfo").hidden=true;$("resultCount").textContent=""}
function setLabels(){var p=state.provider,ls=p==="idescat"?["Organisme","Tema","Encreuament","Entrada","Taula","Geografia"]:p==="pxweb"&&state.pxPreset==="sweden"?["Organisme","Tema","Nivell 2","Nivell 3","Taula","Geografia"]:p==="pxweb"?["Organisme","Nivell 1","Nivell 2","Nivell 3","Taula","Geografia"]:p==="ine"?["Organisme","—","—","Taula","—","—"]:["Organisme","Tipus de dades","Tema","Subtema","Estadística","—"];var l=document.querySelectorAll("#step2 label");document.querySelector("#step1 label:nth-child(1)").firstChild.textContent=ls[0]+" ";l.forEach(function(x,i){x.firstChild.textContent=ls[i+1]+" "})}
function setProviderUI(){setLabels();var isEuro=state.provider==="eurostat",isSweden=state.provider==="pxweb"&&state.pxPreset==="sweden",sl=document.querySelector("#step1 .grid label:nth-child(2)");if(sl)sl.firstChild.textContent=(isEuro?"Tipus de dades":"Estadística")+" ";var fixedGrid=document.querySelector("#step2>.grid"),euroBox=$("eurostatLevels");if(fixedGrid)fixedGrid.style.display=(isEuro||isSweden)?"none":"";if(euroBox)euroBox.hidden=!(isEuro||isSweden);var tl=$("table")&&$("table").parentElement,gl=$("geo")&&$("geo").parentElement;if(tl)tl.style.display=isEuro?"none":"";if(gl)gl.style.display=isEuro?"none":"";$("docLink").href=provider().doc;var sel=state.provider==="pxweb"?"pxweb:"+state.pxPreset:state.provider;if($("provider")&&[].slice.call($("provider").options).some(function(o){return o.value===sel}))$("provider").value=sel}
async function loadStats(){
 var loadToken=state.requestToken,loadProvider=state.provider,loadPreset=state.pxPreset;
 state.swedenPath=[];state.swedenV2Table=false;
 setProviderUI();state.stats=[];state.selected.stat="";fill($("stat"),[]);$("stat").disabled=true;
 var c=provider(),out=[];
 if(state.provider==="idescat")out=collection(await fetchJson(c.base+"?lang=ca")).map(function(x){return{value:x.id,label:x.id+" · "+x.label}});
 else if(state.provider==="ine"){var d=await fetchJson(c.base+"/ES/OPERACIONES_DISPONIBLES?det=1");out=a(d).map(function(x){var id=String(f(x,"Id","id","Codigo","Code"));return{value:id,label:id+" · "+String(f(x,"Nombre","nombre","Name","Descripcion","Description")||id)}}).filter(function(x){return x.value})}
 else if(state.provider==="eurostat"){await loadEurostatTOC();out=state.eurostatRoots.map(function(x){return{value:x.code,label:x.label}})}
 else if(state.pxPreset==="sweden"){out=a(await fetchJson(c.base)).map(function(x){return{id:String(f(x,"id","code","dbid","path")),label:String(f(x,"text","label","name","title")||f(x,"id","code","dbid","path")),type:String(f(x,"type","class"))}}).filter(function(x){return x.id}).map(function(x){return{value:x.id,label:x.id+" · "+x.label}})}
 else if(state.pxPreset==="finland"){
  var finCatalog=null;
  try{finCatalog=await fetchJson(c.base)}
  catch(finErr){
   // Statistics Finland pot rebutjar la petició directa des de GitHub Pages
   // segons el CORS de la resposta. Per a la navegació GET del catàleg,
   // disposem d'un fallback de lectura.
   try{
    var finProxy="https://api.allorigins.win/raw?url="+encodeURIComponent(c.base);
    finCatalog=await fetchJson(finProxy);
   }catch(e){throw finErr}
  }
  out=a(finCatalog).map(function(x){
   var id=String(f(x,"id","dbid","code","path")).trim();
   return{value:id,label:String(f(x,"text","label","name","title")||id).trim()}
  }).filter(function(x){return x.value});
}
else out=a(await fetchJson(c.base)).map(function(x){var id=String(f(x,"id","dbid","code","path"));return{value:id,label:String(f(x,"text","label","name","title")||id)}}).filter(function(x){return x.value});
 if(loadToken!==state.requestToken||loadProvider!==state.provider||(loadProvider==="pxweb"&&loadPreset!==state.pxPreset))return;
 out.sort(function(x,y){return x.label.localeCompare(y.label,"ca",{numeric:true})});state.stats=out;fill($("stat"),out);$("stat").disabled=!out.length;
 var initial=new URLSearchParams(location.search).get("stat")||"";
 if(initial&&[].slice.call($("stat").options).some(function(o){return o.value===initial})){$("stat").value=initial;await onStatChange()}
}
async function loadEurostatTOC(){
 if(state.eurostatTOC&&state.eurostatTOC.length)return;

 // The Eurostat Catalogue API is not a reliable browser-CORS source.
 // A GitHub Action mirrors its small navigation index into the repository,
 // so GitHub Pages can load it from the same origin without a proxy.
 var local="data/eurostat-toc.json";
 var d=null;
 try{
  var lr=await fetch(local,{cache:"no-store"});
  if(lr.ok)d=await lr.json();
 }catch(e){}

 // Keep a short-lived fallback for the first deployment while the scheduled
 // catalogue file is being generated by GitHub Actions.
 if(!Array.isArray(d)||!d.length){
  var u="https://ec.europa.eu/eurostat/api/dissemination/catalogue/toc/txt?lang=en";
  var r,txt="";
  try{
   r=await fetch(u);
   if(r.ok)txt=await r.text();
  }catch(e){}
  if(!txt){
   var proxy="https://api.allorigins.win/raw?url="+encodeURIComponent(u);
   try{
    r=await fetch(proxy);
    if(r.ok)txt=await r.text();
   }catch(e){}
  }
  if(txt){
   d=[];
   txt.split(/\r?\n/).forEach(function(line){
    if(!line.trim())return;
    var p=line.split("\t");
    if(p.length<3)return;
    var clean=function(v){return String(v==null?"":v).replace(/^"|"$/g,"").trim()};
    var rawTitle=clean(p[0]),title=rawTitle.trim(),code=clean(p[1]),type=clean(p[2]).toLowerCase();
    var hierarchy=Number(clean(p[8]));
    if(!Number.isFinite(hierarchy))hierarchy=Math.floor((rawTitle.match(/^ */)||[""])[0].length/4);
    if(title&&code&&(type==="folder"||type==="dataset"||type==="table"))
      d.push({title:title,code:code,type:type,hierarchy:hierarchy});
   });
  }
 }
 if(!Array.isArray(d)||!d.length)
  throw new Error("No s'ha pogut carregar el catàleg d'Eurostat. Comprova la connexió o torna-ho a provar.");

 var rows=d.map(function(x){
  return {
   title:String(x.title||"").trim(),
   code:String(x.code||"").trim(),
   type:String(x.type||"").toLowerCase(),
   hierarchy:Number(x.hierarchy)
  };
 }).filter(function(x){
  return x.title&&x.code&&(x.type==="folder"||x.type==="dataset"||x.type==="table")&&Number.isFinite(x.hierarchy);
 });
 if(!rows.length)throw new Error("El catàleg d'Eurostat no conté elements navegables.");

 state.eurostatTOC=rows;
 var roots=[],stack=[];
 rows.forEach(function(x){
  while(stack.length&&stack[stack.length-1].level>=x.hierarchy)stack.pop();
  var node={label:x.title,code:x.code,type:x.type,hierarchy:x.hierarchy,path:[],children:[]};
  if(stack.length){
   var parent=stack[stack.length-1].node;
   parent.children.push(node);
   node.path=parent.path.concat([node.code]);
  }
  if(x.type==="folder"){
   if(!stack.length)roots.push(node);
   stack.push({node:node,level:x.hierarchy});
  }
 });
 function fixPaths(n,path){
  n.path=path;
  n.children.forEach(function(c){fixPaths(c,path.concat([c.code]))});
 }
 roots.forEach(function(r){fixPaths(r,[r.code])});
 state.eurostatRoots=roots;
 state.eurostatNodes=[];
 function flatten(n){state.eurostatNodes.push(n);n.children.forEach(flatten)}
 roots.forEach(flatten);
}
function eurostatNodeByPath(path){
 if(!path||!path.length)return null;var cur=state.eurostatRoots.find(function(r){return r.code===path[0]});if(!cur)return null;
 for(var i=1;i<path.length;i++){cur=(cur.children||[]).find(function(x){return x.code===path[i]});if(!cur)return null}return cur;
}

function deriveConcept(s){s=String(s||"");var p=s.indexOf(".");return p>=0?s.slice(0,p):s}
function deriveCross(s){s=String(s||"").trim();var p=s.indexOf(". ");if(p<0)return"";var r=s.slice(p+2),q=r.indexOf(". A");return(q>=0?r.slice(0,q):r).trim()}
async function onStatChange(){
 state.selected.stat=$("stat").value;clearBelow(true);if(!state.selected.stat)return;busy(true);
 try{
  if(state.provider==="idescat"){var d=await fetchJson(provider().base+"/"+encodeURIComponent(state.selected.stat)+"?lang=ca");state.catalog=collection(d).map(function(x){return{node:x.id,name:x.label,concept:deriveConcept(x.label),cross:deriveCross(x.label)}});var cs=[...new Set(state.catalog.map(function(x){return x.concept}).filter(Boolean))];fill($("concept"),cs.map(function(x){return{value:x,label:x}}));$("concept").disabled=!cs.length}
  else if(state.provider==="ine"){var t=await fetchJson(provider().base+"/ES/TABLAS_OPERACION/"+encodeURIComponent(state.selected.stat)+"?det=1");state.ineTables=a(t).map(function(x){var id=String(f(x,"Id","id","Codigo","Code"));return{value:id,label:String(f(x,"Nombre","nombre","Name","Descripcion","Description")||id)}}).filter(function(x){return x.value});fill($("node"),state.ineTables);$("node").disabled=!state.ineTables.length;$("concept").disabled=true;$("cross").disabled=true;$("table").disabled=true;$("geo").disabled=true}
  else if(state.provider==="eurostat"){await eurostatSelectRoot(state.selected.stat)}
  else if(state.pxPreset==="sweden"){await swedenSelectRoot(state.selected.stat)}
  else{state.pxPath=[state.selected.stat];await pxChildren(state.pxPath,"concept")}
 }catch(e){status(e.message,"error")}finally{busy(false)}
}
function swedenClearLevels(){var box=$("eurostatLevels");if(box){box.innerHTML="";box.hidden=true}}
function swedenLevelLabel(index,list){return list&&list.length&&list.every(function(x){return x.type==="table"})?"Taula":"Nivell "+(index+1)}
async function swedenV1Children(path){var base=(path||[]).slice(),raw=await fetchJson(pxUrl(base));return a(raw).map(function(x){var id=String(f(x,"id","code","dbid","path")).trim();return{id:id,label:String(f(x,"text","label","name","title")||id).trim(),type:String(f(x,"type","class")),path:base.concat([id])}}).filter(function(x){return x.id})}
async function swedenSelectRoot(rootCode){state.swedenPath=[rootCode];state.swedenV2Table=false;state.pxItems.delete("swedenLevel0");swedenClearLevels();var children=await swedenV1Children([rootCode]);state.pxItems.set("swedenLevel0",children);if(children.length===1&&pxTable(children[0])){await swedenLoadV1Table(children[0].path,children[0].id);return}swedenAddLevel(children,0,[rootCode])}
function swedenAddLevel(children,index,path){var box=$("eurostatLevels");if(!box)return;var list=(children||[]).filter(function(x){return x&&x.id});if(!list.length)return;box.hidden=false;var label=document.createElement("label");label.dataset.eurostatLevel=String(index);label.textContent=swedenLevelLabel(index,list)+" ";var sel=document.createElement("select");sel.id="swedenLevel"+index;sel.disabled=false;sel.appendChild(new Option("— Selecciona —",""));label.appendChild(sel);box.appendChild(label);list.forEach(function(x){sel.appendChild(new Option(x.id+" · "+x.label,x.id))});sel.onchange=async function(){var val=sel.value;if(!val)return;try{await swedenSelectDynamic(index,val)}catch(e){status(e&&e.message?e.message:String(e),"error")}};if(list.length===1){sel.value=list[0].id;swedenSelectDynamic(index,list[0].id).catch(function(e){status(e&&e.message?e.message:String(e),"error")})}}
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
function eurostatClearLevels(){
 var box=$("eurostatLevels");
 if(box){box.innerHTML="";box.hidden=true}
}
function eurostatLevelLabel(i){
 if(i===0)return "Tema";
 if(i===1)return "Subtema";
 return "Nivell "+(i+1);
}
function eurostatAddLevel(children,path,index){
 var box=$("eurostatLevels");
 if(!box)return;
 var list=(children||[]).filter(function(x){return x.type==="folder"||x.type==="dataset"||x.type==="table"});
 if(!list.length)return;
 box.hidden=false;
 var label=document.createElement("label");
 label.dataset.eurostatLevel=String(index);
 label.textContent=eurostatLevelLabel(index)+" ";
 var sel=document.createElement("select");
 sel.id="eurostatLevel"+index;
 sel.disabled=false;
 sel.appendChild(new Option("— Selecciona —",""));
 label.appendChild(sel);
 box.appendChild(label);
 list.forEach(function(x){
  sel.appendChild(new Option(x.label+(x.type!=="folder"?" ["+x.code+"]":""),x.code));
 });
 sel.onchange=async function(){
  var val=sel.value;
  if(!val)return;
  try{
   await eurostatSelectDynamic(index,val);
  }catch(e){
   status(e&&e.message?e.message:String(e),"error");
  }
 };
 if(list.length===1){
  sel.value=list[0].code;
  eurostatSelectDynamic(index,list[0].code).catch(function(e){
   status(e&&e.message?e.message:String(e),"error");
  });
 }
}
async function eurostatSelectRoot(rootCode){
 var root=state.eurostatRoots.find(function(x){return x.code===rootCode});
 if(!root)throw new Error("No s'ha trobat el tipus de dades d'Eurostat.");
 state.eurostatPath=[root.code];
 state.eurostatNodeParentPath=[root.code];
 eurostatClearLevels();
 ["concept","cross","node","table","geo"].forEach(resetSelect);
 eurostatAddLevel(root.children||[],[root.code],0);
}
async function eurostatSelectDynamic(index,val){
 var base=(state.eurostatPath||[]).slice(0,index+1);
 var path=base.concat([val]);
 var item=eurostatNodeByPath(path);
 if(!item)throw new Error("No s'ha trobat l'element seleccionat d'Eurostat.");
 state.eurostatPath=path;
 var box=$("eurostatLevels");
 if(box){
  Array.from(box.querySelectorAll("label")).forEach(function(l){
   if(Number(l.dataset.eurostatLevel)>index)l.remove();
  });
 }
 if(item.type==="dataset"||item.type==="table"){
  state.selected.node=item.code;
  state.selected.table=item.code;
  await eurostatSelect(item.code);
  return;
 }
 eurostatAddLevel(item.children||[],path,index+1);
}
async function eurostatSelect(code){state.selected.node=code;state.selected.table=code;busy(true);$("eurostatLoading").hidden=false;try{var ds=await fetchJson(provider().base+"/data/"+encodeURIComponent(code)+"?format=JSON&lang=EN");state.metadata=ds;renderMetadata(ds);$("tableInfo").hidden=false;$("tableInfo").innerHTML="<strong>Conjunt de dades:</strong> "+esc(ds.label||code)+"<span class=\"path\">"+esc(provider().base+"/data/"+code)+"</span>";$("query").disabled=false}finally{$("eurostatLoading").hidden=true;busy(false)}}
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
async function swedenAutoSelect(target){
 var sel=$(target);if(!sel||sel.disabled)return;
 var options=[].slice.call(sel.options).filter(function(o){return o.value});
 if(options.length===1){sel.value=options[0].value;await pxSelect(target)}
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
 if(src&&Array.isArray(src.id)&&src.dimension)return src;
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
function finlandTableUrls(path){
 var p=(path||[]).slice(),base=provider().base.replace(/\/+$/,"");
 if(state.pxPreset!=="finland")return [pxUrl(p)];
 var last=String(p[p.length-1]||"").trim().replace(/\.px$/i,"");
 var db=String(p[0]||state.selected.stat||"").replace(/^StatFin__/i,"").trim();
 var urls=[];
 if(last){
  // Format físic actual de Statistics Finland: /StatFin/statfin_<db>_pxt_<taula>.px
  var physical="statfin_"+db+"_pxt_"+last+".px";
  // Des del canvi de 8/6/2026 Statistics Finland ha escurçat els
  // noms dels fitxers de les taules. Per a les taules actives de
  // StatFin, l'endpoint API canònic és /StatFin/<nivell>/<id>.px.
  if(db)urls.push(base+"/"+db+"/"+last+".px");
  if(db)urls.push(base+"/"+db+"/"+physical);
  if(db)urls.push(base+"/"+physical);
  urls.push(base+"/"+last+".px");
 }
 return [...new Set(urls)];
}
function finlandTableUrl(path){return finlandTableUrls(path)[0]}
function isPxMetadata(d){
 var s=d&&d.dataset&&typeof d.dataset==="object"?d.dataset:d;
 return !!(s&&((Array.isArray(s.variables)&&s.variables.length)||(Array.isArray(s.id)&&s.dimension)));
}
function pxTable(x){return/^(t|table)$/i.test(x&&x.type)||/\.px$/i.test(x&&x.id||"")||/_pxt_/i.test(x&&x.id||"")}
async function loadSwedenV2Tables(){
 if(state.swedenV2Tables&&state.swedenV2Tables.length)return;
 var all=[],page=1,pageSize=500;
 for(var guard=0;guard<20;guard++,page++){
  var u="https://statistikdatabasen.scb.se/api/v2/tables?lang=en&pageNumber="+page+"&pageSize="+pageSize;
  var d=await fetchJson(u),rows=Array.isArray(d&&d.tables)?d.tables:a(d);all=all.concat(rows);
  var pi=d&&d.page||d&&d.pageInfo||d&&d.pagination||{},totalPages=Number(f(pi,"totalPages","pages","pageCount"));
  if(totalPages&&page>=totalPages)break;if(!rows.length||rows.length<pageSize)break;
 }
 if(!all.length)throw new Error("No s'han pogut carregar les taules de Statistics Sweden amb PxWebApi v2.");
 state.swedenV2Tables=all.map(function(t){var id=String(f(t,"id","tableId","code","tableCode")).trim(),label=String(f(t,"label","title","text","name")||id).trim();return{id:id,label:label,paths:Array.isArray(t.paths)?t.paths:[]}}).filter(function(t){return t.id});
}
function swedenPathParts(t){var out=[];(t.paths||[]).forEach(function(path){if(Array.isArray(path)){var p=path.map(function(x){return{id:String(f(x,"id","code","path")).trim(),label:String(f(x,"label","text","name","title")||f(x,"id","code","path")).trim()}}).filter(function(x){return x.id});if(p.length)out.push(p)}});return out}
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
 items.sort(function(x,y){return x.label.localeCompare(y.label,"sv",{numeric:true})});
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
 var selections=(query.query||[]).map(function(q){
  return {
   variableCode:String(q.code),
   valueCodes:Array.from(q.selection&&q.selection.values||[])
  }
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
async function pxMetadata(){
 var raw,ds;
 if(state.pxPreset==="sweden"){
  var tableId=String(state.selected.table||"");
  var mu="https://statistikdatabasen.scb.se/api/v2/tables/"+encodeURIComponent(tableId)+"/metadata?lang=en";
  raw=await fetchJson(mu);ds=swedenV2MetadataToJsonStat(raw);state.metadata=ds;renderMetadata(ds);$("tableInfo").hidden=false;$("tableInfo").innerHTML="<strong>Taula:</strong> "+esc(raw.label||state.selected.table)+"<span class=\"path\">"+esc(mu)+"</span>";$("query").disabled=false;return
 }
 raw=await fetchJson(pxUrl(state.pxPath));ds=pxToJsonStat(raw);state.metadata=ds;renderMetadata(ds);$("tableInfo").hidden=false;$("tableInfo").innerHTML="<strong>Taula:</strong> "+esc(raw.title||raw.label||state.selected.table)+"<span class=\"path\">"+esc(pxUrl(state.pxPath))+"</span>";$("query").disabled=false}
function ineJsonStatUrl(tableId){return "https://servicios.ine.es/wstempus/jsstat/ES/DATASET/"+encodeURIComponent(String(tableId))}
function ineDatosTablaUrl(tableId,query){
  var u="https://servicios.ine.es/wstempus/jsCache/ES/DATOS_TABLA/"+encodeURIComponent(String(tableId))+"";
  return u+(query?"?"+query:"");
}
function ineTvCandidates(d){
  var a=[String(d.id||"").trim(),String(d.label||"").trim(),String(d.id||"").trim().toUpperCase(),String(d.label||"").trim().toUpperCase(),String(d.label||"").trim().toLowerCase()];
  return a.filter(function(x,i){return x&&a.indexOf(x)===i});
}
function inePeriodCode(row){
  var y=String(row&&row.Anyo!=null?row.Anyo:"").trim(),p=String(row&&row.T3_Periodo!=null?row.T3_Periodo:"").trim().toUpperCase();
  if(!y)return"";
  if(!p||p==="A"||p==="ANUAL")return y;
  var m=p.match(/^M(\\d{1,2})$/);if(m)return y+"M"+String(Number(m[1])).padStart(2,"0");
  var q=p.match(/^(?:T|Q)(\\d)$/);if(q)return y+"Q"+q[1];
  var s=p.match(/^S(\\d)$/);if(s)return y+"S"+s[1];
  var b=p.match(/^B(\\d{1,2})$/);if(b)return y+"B"+String(Number(b[1])).padStart(2,"0");
  return y+"-"+p.replace(/\\s+/g,"_");
}
function ineDatosTablaToJsonStat(raw,metadata){
  var series=Array.isArray(raw)?raw:[];
  if(!series.length)return null;
  var baseDims=dims(metadata),timeDim=baseDims.find(function(d){return temporal(d)});
  var nonTime=baseDims.filter(function(d){return !timeDim||d.id!==timeDim.id});
  var timeMap=new Map(),rows=[];
  function norm(x){return String(x==null?"":x).trim().toUpperCase()}
  function metaFor(s){
    var out={};(s.MetaData||[]).forEach(function(m){
      var v=m&&m.T3_Variable;
      var code=m&&m.Codigo;
      if(m&&m.Variable){v=m.Variable.Nombre||m.Variable.Codigo||v;code=m.Codigo||m.Variable.Codigo||code}
      if(v!=null)out[norm(v)]=String(code==null?"":code);
    });return out;
  }
  series.forEach(function(s){
    var sm=metaFor(s),data=Array.isArray(s.Data)?s.Data:[];
    data.forEach(function(x){
      var tc=inePeriodCode(x);if(!tc)return;
      var key=[];
      nonTime.forEach(function(d){
        var code="";
        Object.keys(sm).some(function(k){if(k===norm(d.label)||k===norm(d.id)){code=sm[k];return true}return false});
        if(!code&&d.categories.length===1)code=d.categories[0].code;
        key.push(code);
      });
      timeMap.set(tc,{code:tc,label:(x.T3_Periodo?String(x.T3_Periodo)+" ":"")+String(x.Anyo||tc)});
      rows.push({key:key,time:tc,value:x.Valor});
    });
  });
  if(!rows.length)return null;
  var td=timeDim||{id:"time",label:"Temps",role:"time",categories:[]};
  var timeCats=Array.from(timeMap.values()).sort(function(a,b){return String(a.code).localeCompare(String(b.code),"ca",{numeric:true})});
  var outDims=nonTime.concat([{id:td.id,label:td.label,role:td.role,categories:timeCats.map(function(c,i){return{code:c.code,label:c.label,index:i}})}]);
  var out={class:"dataset",id:outDims.map(function(d){return d.id}),size:outDims.map(function(d){return d.categories.length}),dimension:{}};
  outDims.forEach(function(d){
    var cat={index:d.categories.map(function(c){return c.code}),label:{}};
    d.categories.forEach(function(c){cat.label[c.code]=c.label});
    out.dimension[d.id]={label:d.label,category:cat};
  });
  var index=new Map();
  outDims.forEach(function(d,j){var m=new Map();d.categories.forEach(function(c,i){m.set(String(c.code),i)});index.set(d.id,m)});
  var total=out.size.reduce(function(a,b){return a*b},1),vals=new Array(total).fill(null),strides=[];
  var st=1;for(var j=out.size.length-1;j>=0;j--){strides[j]=st;st*=out.size[j]};
  rows.forEach(function(r){
    var coords=[];
    nonTime.forEach(function(d,j){coords.push(index.get(d.id).has(String(r.key[j]))?index.get(d.id).get(String(r.key[j])):0)});
    coords.push(index.get(td.id).get(String(r.time)));
    var flat=0;coords.forEach(function(v,j){flat+=v*strides[j]});vals[flat]=r.value;
  });
  out.value=vals;return out;
}
async function ineFilterJsonStat(ds,filters){
 var ids=Array.isArray(ds.id)?ds.id.slice():[];
 var oldDims=ids.map(function(id){return ds.dimension&&ds.dimension[id]||{}});
 var oldSizes=Array.isArray(ds.size)?ds.size.map(Number):ids.map(function(id){return jsonstatCats(ds,id).length});
 var oldCats=ids.map(function(id){return jsonstatCats(ds,id)});
 var keep=ids.map(function(id,j){
  var vals=filters&&filters[id];
  var wanted=vals&&vals.length?new Set(vals.map(String)):null;
  var cats=oldCats[j];
  return wanted?cats.filter(function(cat){return wanted.has(String(cat.code))}):cats.slice();
 });
 var out=JSON.parse(JSON.stringify(ds));
 out.id=ids;
 out.size=keep.map(function(c){return c.length});
 out.dimension={};
 ids.forEach(function(id,j){
  var od=oldDims[j],cats=keep[j],catIndex={};
  cats.forEach(function(cat,i){catIndex[cat.code]=i});
  out.dimension[id]={
   label:od.label,
   category:{
    index:catIndex,
    label:{}
   }
  };
  cats.forEach(function(cat){out.dimension[id].category.label[cat.code]=cat.label});
  if(od.role)out.dimension[id].role=od.role;
  if(od.extension)out.dimension[id].extension=od.extension;
 });
 var total=out.size.reduce(function(a,b){return a*Number(b)},1);
 var vals=Array.isArray(ds.value)?ds.value:[];
 var oldStrides=[],newStrides=[],s=1;
 for(var j=ids.length-1;j>=0;j--){oldStrides[j]=s;s*=oldSizes[j]}
 s=1;
 for(var k=ids.length-1;k>=0;k--){newStrides[k]=s;s*=out.size[k]}
 out.value=new Array(total);
 if(Array.isArray(ds.status))out.status=new Array(total);
 for(var flat=0;flat<total;flat++){
  var rem=flat,oldFlat=0;
  for(var j=0;j<ids.length;j++){
   var coord=Math.floor(rem/newStrides[j]);rem=rem%newStrides[j];
   var oldIndex=oldCats[j].findIndex(function(cat){return String(cat.code)===String(keep[j][coord]&&keep[j][coord].code)});
   oldFlat+=oldIndex*oldStrides[j];
  }
  out.value[flat]=vals[oldFlat];
  if(Array.isArray(ds.status))out.status[flat]=ds.status[oldFlat];
 }
 return out;
}
function ineDatosTablaFiltered(tableId,filters){
 var dsx=state.metadata,q={};
 dims(dsx).forEach(function(d){var vals=filters[d.id];if(vals&&vals.length)q[d.id]=vals});
 var dimsList=dims(dsx).filter(function(d){return q[d.id]&&q[d.id].length});
 if(!dimsList.length)return null;
 var qp=new URLSearchParams();
 qp.append("tip","AM");
 dimsList.forEach(function(d){
  var variable=String(d.id||'').trim().toLowerCase();
  if(!/^[a-z][a-z0-9_]*$/.test(variable))variable=String(d.label||d.id||'').trim().toLowerCase().replace(/[^a-z0-9_]/g,'');
  (q[d.id]||[]).forEach(function(v){qp.append('tv',variable+':'+String(v))});
 });
 var u=ineDatosTablaUrl(tableId,qp.toString());
 var raw=await fetchJson(u),converted=ineDatosTablaToJsonStat(raw,dsx);
 if(!converted)throw new Error("L'INE no ha retornat dades per als filtres seleccionats.");
 return{data:converted,url:u};
}
async function ineMetadata(tableId){
 var u=ineJsonStatUrl(tableId);
 var ds=await fetchJson(u);state.metadata=ds;renderMetadata(ds);$("tableInfo").hidden=false;$("tableInfo").innerHTML="<strong>Taula:</strong> "+esc(ds.label||tableId)+"<span class=\"path\">"+esc(u)+"</span>";$("query").disabled=false
}
function idesPath(){
 var parts=[state.selected.stat,state.selected.node,state.selected.table,state.selected.geo].filter(function(x){return x!==""&&x!=null});
 return provider().base+"/"+parts.map(function(x){return encodeURIComponent(String(x))}).join("/");
}
async function onNodeChange(){
 if(state.provider==="idescat"){
  state.selected.node=$("node").value;
  resetSelect("table");resetSelect("geo");
  if(!state.selected.node)return;
  try{
   var d=await fetchJson(idesPath()+"?lang=ca"),t=collection(d);
   fill($("table"),t.map(function(x){return{value:x.id,label:x.id+" · "+x.label}}));
   $("table").disabled=!t.length;
   if(t.length===1){
    $("table").value=t[0].id;
    await onTableChange();
   }
  }catch(e){status(e.message,"error")}
 }else if(state.provider==="pxweb")await pxSelect("node");
 else if(state.provider==="ine"){state.selected.node=$("node").value;state.selected.table=state.selected.node;if(!state.selected.table)return;try{await ineMetadata(state.selected.table)}catch(e){status("INE: "+e.message,"error")}}
}
async function onTableChange(){
 if(state.provider==="idescat"){
  state.selected.table=$("table").value;
  resetSelect("geo");
  if(!state.selected.table)return;
  try{
   var d=await fetchJson(idesPath()+"?lang=ca"),g=collection(d);
   fill($("geo"),g.map(function(x){return{value:x.id,label:x.id+" · "+x.label}}));
   $("geo").disabled=!g.length;
   if(g.length===1){
    $("geo").value=g[0].id;
    await onGeoChange();
   }
  }catch(e){status(e.message,"error")}
 }else if(state.provider==="pxweb")await pxSelect("table")
}
async function onGeoChange(){
 if(state.provider!=="idescat")return;
 state.selected.geo=$("geo").value;
 if(!state.selected.geo)return;
 try{
  var ds=await fetchJson(idesPath()+"?lang=ca");
  state.metadata=ds;renderMetadata(ds);
  $("tableInfo").hidden=false;
  $("tableInfo").innerHTML="<strong>Taula triada:</strong> "+esc(ds.label||"")+"<span class=\"path\">"+esc(idesPath())+"</span>";
  $("query").disabled=false;
 }catch(e){status(e.message,"error")}
}
function temporalPeriodicity(categories){
 var codes=(categories||[]).map(function(c){return String(c.code||"").trim()}).filter(Boolean);
 for(var i=0;i<codes.length;i++){
  var code=codes[i];
  if(/^\d{4}$/.test(code))return"year";
  if(/^\d{4}M\d{1,2}$/i.test(code)||/^\d{4}-\d{2}$/.test(code))return"month";
  if(/^\d{4}Q\d$/i.test(code))return"quarter";
  if(/^\d{4}S\d$/i.test(code))return"semester";
  if(/^\d{4}B\d{1,2}$/i.test(code))return"bimonth";
  if(/^\d{4}W\d{1,2}$/i.test(code))return"week";
  if(/^\d{4}D\d{1,3}$/i.test(code)||/^\d{4}-\d{2}-\d{2}$/.test(code))return"day";
 }
 return null
}
function previousYearPeriodCode(code){
 var v=String(code||"").trim();
 if(/^\d{4}[MQSBDW]\d{1,3}$/i.test(v)||/^\d{4}-\d{2}(?:-\d{2})?$/.test(v))return v.replace(/^(\d{4})/,function(_,y){return String(Number(y)-1)});
 return""
}
function setFilterSelection(dim,categories,codes,list){
 var selected=new Set((codes||[]).map(String));state.filters.set(dim.id,selected);
 list.querySelectorAll(".option").forEach(function(b){var on=selected.has(String(b.dataset.code));b.classList.toggle("selected",on);b.setAttribute("aria-pressed",on?"true":"false")});updateCells()
}
function addTemporalQuickControls(toolbar,dim,categories,list){
 if(!temporal(dim))return;
 var periodicity=temporalPeriodicity(categories);if(!periodicity)return;
 var row=document.createElement("div");row.className="temporal-row";
 var text1=document.createElement("span");text1.textContent="Tria els últims ";
 var input=document.createElement("input");input.type="number";input.min="1";input.max=String(categories.length);input.value=String(Math.min(3,categories.length));input.inputMode="numeric";input.setAttribute("aria-label","Nombre d'últims períodes");
 var text2=document.createElement("span");text2.textContent=" períodes";
 var btn=document.createElement("button");btn.type="button";btn.className="secondary";btn.textContent="Selecciona";
 var choose=function(){var n=Number(input.value);if(!Number.isFinite(n))n=1;n=Math.max(1,Math.min(categories.length,Math.trunc(n)));input.value=String(n);setFilterSelection(dim,categories,categories.slice(0,n).map(function(c){return c.code}),list)};
 btn.onclick=choose;input.onkeydown=function(e){if(e.key==="Enter"){e.preventDefault();choose()}};
 row.append(text1,input,text2,btn);toolbar.append(row);
 if(periodicity!=="year"&&categories.length>1){
  var target=previousYearPeriodCode(categories[0].code),prev=categories[1].code,latest=categories[0].code,found=categories.some(function(c){return String(c.code)===target});
  if(found){
   var rr=document.createElement("div");rr.className="temporal-row";
   var rb=document.createElement("button");rb.type="button";rb.className="secondary";rb.textContent="Últim període, període anterior i mateix període de l'any anterior";
   rb.onclick=function(){setFilterSelection(dim,categories,[latest,prev,target],list)};rr.append(rb);toolbar.append(rr)
  }
 }
}
function renderMetadata(ds){
 state.filters.clear();$("filters").innerHTML="";
 dims(ds).forEach(function(d){var cats=sortedCats(d.categories,d),set=new Set(cats.map(function(x){return x.code}));state.filters.set(d.id,set);var sec=document.createElement("section");sec.className="filter";sec.dataset.dim=d.id;sec.innerHTML="<div class=\"filter-head\"><div><h3>"+esc(d.label)+"</h3><span class=\"role\">"+esc(d.role||"")+"</span></div><span class=\"selected-count\"></span></div>";var tools=document.createElement("div");tools.className="filter-tools";var buttons=document.createElement("div");buttons.className="filter-buttons";var all=document.createElement("button");all.className="secondary";all.textContent="Tots";var none=document.createElement("button");none.className="secondary";none.textContent="Cap";var list=document.createElement("div");list.className="options";if(cats.length>1){buttons.append(all,none);tools.append(buttons);addTemporalQuickControls(tools,d,cats,list)}
 cats.forEach(function(c){var b=document.createElement("button");b.type="button";b.className="option selected";b.dataset.code=c.code;b.innerHTML="<span class=\"option-label\">"+esc(c.label)+"</span><small>"+esc(c.code)+"</small>";b.onclick=function(){if(cats.length===1)return;var s=state.filters.get(d.id);if(s.has(c.code))s.delete(c.code);else s.add(c.code);b.classList.toggle("selected",s.has(c.code));updateCells()};list.append(b)});
 sec.append(tools,list);$("filters").append(sec);
 all.onclick=function(){state.filters.set(d.id,new Set(cats.map(function(c){return c.code})));list.querySelectorAll(".option").forEach(function(b){b.classList.add("selected")});updateCells()};none.onclick=function(){state.filters.set(d.id,new Set());list.querySelectorAll(".option").forEach(function(b){b.classList.remove("selected")});updateCells()}
 });updateCells()
}
function selectedFilters(){var q={};dims(state.metadata).forEach(function(d){var s=state.filters.get(d.id)||new Set(),n=d.categories.length;if(s.size&&s.size!==n)q[d.id]=Array.from(s)});return q}
function updateCells(){var n=1;state.filters.forEach(function(s){n*=s.size});var missing=Array.from(state.filters.values()).some(function(s){return !s.size});var cellLimit=state.provider==="idescat"?MAX_CELLS:(state.provider==="pxweb"&&state.pxPreset==="finland"?100000:(state.provider==="pxweb"&&state.pxPreset==="sweden"?150000:Infinity));var tooMany=n>cellLimit;var bad=missing||tooMany;$("cellInfo").hidden=false;var icon=bad?"✕":"✓";var limitText=Number.isFinite(cellLimit)?cellLimit.toLocaleString("ca-ES"):"—";var msg=missing?"Cal seleccionar valors a totes les dimensions.":tooMany?"Cal filtrar la taula (màxim "+limitText+" cel·les)":"Es pot continuar."; $("cellInfo").innerHTML="<span class=\"status-icon "+(bad?"bad":"ok")+"\" aria-hidden=\"true\">"+icon+"</span> <strong>Nombre de cel·les de la taula filtrada:</strong> "+n.toLocaleString("ca-ES")+" · <span class=\""+(bad?"bad":"ok")+"\">"+msg+"</span>";document.querySelectorAll(".filter").forEach(function(x){x.querySelector(".selected-count").textContent=(state.filters.get(x.dataset.dim)||new Set()).size.toLocaleString("ca-ES")+" seleccionades"});$("query").disabled=bad||!state.metadata}
function buildEurostatParams(){var p=new URLSearchParams();p.set("format","JSON");p.set("lang","EN");var q=selectedFilters();Object.keys(q).forEach(function(k){q[k].forEach(function(v){p.append(k,v)})});return p}
async function runQuery(){
 var token=++state.requestToken;busy(true);$("query").disabled=true;status("Consultant l’API…");
 try{var ds;
  if(state.provider==="idescat"){var base=provider().base+"/"+state.selected.stat+"/"+state.selected.node+"/"+state.selected.table+"/"+state.selected.geo+"/data",q=new URLSearchParams();Object.keys(selectedFilters()).forEach(function(k){q.set(k,selectedFilters()[k].join(","))});q.set("lang","ca");var u=base+"?"+q.toString();ds=await fetchJson(u);state.lastQueryUrl=u}
  else if(state.provider==="eurostat"){
   var euroCode=state.selected.table||state.selected.node;
   if(!euroCode)throw new Error("No s'ha seleccionat cap conjunt de dades d'Eurostat.");
   var u2=provider().base+"/data/"+encodeURIComponent(euroCode)+"?"+buildEurostatParams().toString();
   ds=await fetchJson(u2);state.lastQueryUrl=u2
  }
  else if(state.provider==="pxweb"){
   var query={query:[],response:{format:"json-stat2"}};
   dims(state.metadata).forEach(function(d){
    query.query.push({code:d.id,selection:{filter:"item",values:Array.from(state.filters.get(d.id)||[])}});
   });
   var up=state.pxPreset==="finland"&&state.finlandTableUrl?state.finlandTableUrl:finlandTableUrl(state.pxPath);
   if(state.pxPreset==="sweden"){
    ds=await swedenV2Query(query);
   }else{
    try{
     ds=await fetchJson(up,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(query)});
    }catch(pxErr){
     // Statistics Iceland pot servir JSON-stat clàssic encara que la
     // interfície PxWeb publiqui l'opció json-stat2.
     if(state.pxPreset==="iceland"){
      var fallbackQuery={query:query.query,response:{format:"json"}};
      ds=await fetchJson(up,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(fallbackQuery)});
     }else throw pxErr;
    }
   }
   state.lastQueryUrl=up
  }
  else {
   var sf=selectedFilters();
   if(Object.keys(sf).length===0){
    var iu=ineJsonStatUrl(state.selected.table);
    ds=await fetchJson(iu);state.lastQueryUrl=iu
   }else{
    ds=ineFilterJsonStat(state.metadata,sf);
    state.lastQueryUrl=ineJsonStatUrl(state.selected.table)+" (filtre local)";
   }
  }
  if(token!==state.requestToken)return;state.lastData=ds;state.page=1;renderResults(ds);var n=Array.isArray(ds.value)?ds.value.length:Object.keys(ds.value||{}).length;$("resultCount").textContent=n.toLocaleString("ca-ES")+" valors retornats";$("exportCsv").disabled=false;$("exportXlsx").disabled=false;$("addToCart").disabled=false;status("")
 }catch(e){if(token===state.requestToken){$("results").innerHTML="<div class=\"error\">"+esc(e.message)+"</div>";status("Error","error")}}finally{busy(false);updateCells()}
}
function diceJsonStat(ds,filters){
 if(!filters||!Object.keys(filters).length)return ds;
 var ids=ds.id||[],oldSizes=ds.size||[],kept=[],oldStrides=[];
 var stride=1;
 for(var si=oldSizes.length-1;si>=0;si--){oldStrides[si]=stride;stride*=Number(oldSizes[si]||0)}
 ids.forEach(function(id,j){
  var cats=jsonstatCats(ds,id),wanted=filters[id];
  kept[j]=wanted?cats.filter(function(c){return wanted.indexOf(c.code)>=0}):cats;
 });
 var out=Object.assign({},ds);
 out.id=ids.slice();
 out.size=kept.map(function(c){return c.length});
 out.dimension=Object.assign({},ds.dimension||{});
 ids.forEach(function(id,j){
  var dim=Object.assign({},ds.dimension&&ds.dimension[id]||{});
  var cat=Object.assign({},dim.category||{}),labels=cat.label&&typeof cat.label==="object"?Object.assign({},cat.label):{};
  var index=[];
  kept[j].forEach(function(c){index.push(c.code);if(labels[c.code]==null)labels[c.code]=c.label});
  cat.index=index;cat.label=labels;dim.category=cat;out.dimension[id]=dim;
 });
 var newTotal=out.size.reduce(function(x,y){return x*y},1);
 var oldVal=ds.value||[],getVal=function(i){return Array.isArray(oldVal)?oldVal[i]:oldVal[String(i)]};
 var vals=[];
 for(var flat=0;flat<newTotal;flat++){
  var rem=flat,oldFlat=0;
  for(var j=ids.length-1;j>=0;j--){
   var ns=Number(out.size[j]||0),np=ns?rem%ns:0;rem=ns?Math.floor(rem/ns):0;
   oldFlat+=Number(kept[j][np]&&kept[j][np].index||0)*oldStrides[j];
  }
  vals.push(getVal(oldFlat));
 }
 out.value=vals;
 if(ds.status!=null){
  var st=ds.status;
  if(typeof st==="string")out.status=st;
  else{
   var getSt=function(i){return Array.isArray(st)?st[i]:st[String(i)]},sv=[];
   for(var sf=0;sf<newTotal;sf++){
    var srem=sf,so=0;
    for(var sj=ids.length-1;sj>=0;sj--){
     var ss=Number(out.size[sj]||0),sp=ss?srem%ss:0;srem=ss?Math.floor(srem/ss):0;
     so+=Number(kept[sj][sp]&&kept[sj][sp].index||0)*oldStrides[sj];
    }
    sv.push(getSt(so));
   }
   out.status=Array.isArray(st)?sv:(function(){var o={};sv.forEach(function(v,i){if(v!=null)o[String(i)]=v});return o})();
  }
 }
 return out
}
function resultRows(ds){var ids=ds.id||[],sizes=ds.size||[],dd=ids.map(function(id){return{id:id,label:ds.dimension&&ds.dimension[id]&&ds.dimension[id].label||id,cats:jsonstatCats(ds,id)}}),vals=ds.value||[],get=function(i){return Array.isArray(vals)?vals[i]:vals[String(i)]},total=sizes.reduce(function(x,y){return x*y},1),rows=[];for(var flat=0;flat<total;flat++){var rem=flat,row={};for(var j=ids.length-1;j>=0;j--){var size=Number(sizes[j]||0),idx=rem%size;rem=Math.floor(rem/size);var c=dd[j].cats.find(function(x){return x.index===idx});row[ids[j]]={code:c?c.code:"",label:c?c.label:""}}row.value=get(flat);rows.push(row)}return{dims:dd,rows:rows}}
function decimals(ds){var found=[];function walk(x){if(!x||typeof x!=="object")return;if(Array.isArray(x)){x.forEach(walk);return}Object.keys(x).forEach(function(k){if(k.toLowerCase()==="unit"&&x[k]&&typeof x[k]==="object")Object.values(x[k]).forEach(function(v){var n=Number(v&&v.decimals);if(Number.isInteger(n))found.push(n)});walk(x[k])})}walk(ds);var u=[...new Set(found)];return u.length===1?u[0]:null}
function fmt(v,d){if(v==null||v==="")return"";var n=typeof v==="number"?v:Number(v);if(!Number.isFinite(n))return v;return n.toLocaleString("ca-ES",{minimumFractionDigits:d==null?0:d,maximumFractionDigits:d==null?20:d})}
function renderResults(ds){state.pivot={rows:[],columns:[]};var z=resultRows(ds),rows=z.rows,dd=z.dims,start=(state.page-1)*state.pageSize,end=Math.min(start+state.pageSize,rows.length),page=rows.slice(start,end),h="<div class=\"result-meta\">"+rows.length.toLocaleString("ca-ES")+" files · mostrant "+(rows.length?start+1:0)+"–"+end+"</div><div class=\"table-wrap\"><table class=\"data-table\"><thead><tr>"+dd.map(function(d){return"<th>"+esc(d.id+"_Codi")+"</th><th>"+esc(d.id+"_Etiqueta")+"</th>"}).join("")+"<th>Valor</th></tr></thead><tbody>";page.forEach(function(r){h+="<tr>";dd.forEach(function(d){h+="<td>"+esc(r[d.id].code)+"</td><td>"+esc(r[d.id].label)+"</td>"});h+='<td class="num">'+esc(fmt(r.value,decimals(ds)))+"</td></tr>"});h+="</tbody></table></div>";$("results").innerHTML=h;renderPivotBuilder()}
function exportCSV(){if(!state.lastData)return;var z=resultRows(state.lastData),h=z.dims.map(function(d){return[d.id+"_Codi",d.id+"_Etiqueta"]}).reduce(function(x,y){return x.concat(y)},[]).concat(["Valor"]),lines=[h].concat(z.rows.map(function(r){return z.dims.map(function(d){return[r[d.id].code,r[d.id].label]}).reduce(function(x,y){return x.concat(y)},[]).concat([r.value==null?"":r.value])})).map(function(row){return row.map(function(v){return'"'+String(v).replace(/"/g,'""')+'"'}).join(";")});var b=new Blob(["\uFEFF"+lines.join("\r\n")],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=state.provider+"_consulta.csv";a.click()}
function exportXLSX(){if(!state.lastData||typeof XLSX==="undefined")return;var z=resultRows(state.lastData),info=exportInfo(),headers=z.dims.map(function(d){return[d.id+"_Codi",d.id+"_Etiqueta"]}).reduce(function(a,b){return a.concat(b)},[]).concat(["Valor"]),out=[[info.tableName],[info.source],["URL: "+info.queryUrl],["Data de consulta: "+info.exportDate],[],headers];z.rows.forEach(function(r){out.push(z.dims.map(function(d){return[r[d.id].code,r[d.id].label]}).reduce(function(a,b){return a.concat(b)},[]).concat([r.value==null?"":r.value]))});var wb=XLSX.utils.book_new(),ws=XLSX.utils.aoa_to_sheet(out);ws["!autofilter"]={ref:XLSX.utils.encode_range({s:{r:5,c:0},e:{r:out.length-1,c:headers.length-1}})};ws["!merges"]=[];if(ws.A1)ws.A1.s={font:{bold:true}};XLSX.utils.book_append_sheet(wb,ws,"Dades");var po=pivotExport();if(po){var pw=XLSX.utils.aoa_to_sheet(po),hr=4;if(po.length>hr)pw["!autofilter"]={ref:XLSX.utils.encode_range({s:{r:hr,c:0},e:{r:po.length-1,c:(po[hr]||[]).length-1}})};pw["!merges"]=[];if(pw.A1)pw.A1.s={font:{bold:true}};XLSX.utils.book_append_sheet(wb,pw,"Taula construïda")}XLSX.writeFile(wb,state.provider+"_"+state.selected.table+"_"+state.selected.geo+".xlsx")}

function pivotLabel(d){return String(d&&d.label||d&&d.id||'')}
function pivotDims(){return dims(state.lastData||{}).filter(function(d){return !(d.categories&&d.categories.length===1)})}
function pivotKey(row,ids){return ids.map(function(id){return row[id]&&row[id].code||''}).join('¦')}
function pivotComb(rows,ids){var m=new Map();rows.forEach(function(r){var k=pivotKey(r,ids);if(!m.has(k))m.set(k,{key:k,row:r})});var dsx=dims(state.lastData||{}),rank=new Map();ids.forEach(function(id){var d=dsx.find(function(x){return x.id===id}),m2=new Map();(d&&d.categories||[]).slice().sort(function(a,b){return a.index-b.index}).forEach(function(c,i){m2.set(String(c.code),i)});rank.set(id,m2)});return Array.from(m.values()).sort(function(a,b){for(var i=0;i<ids.length;i++){var id=ids[i],ra=rank.get(id),x=ra&&ra.has(String(a.row[id]&&a.row[id].code))?ra.get(String(a.row[id].code)):999999,y=ra&&ra.has(String(b.row[id]&&b.row[id].code))?ra.get(String(b.row[id].code)):999999;if(x!==y)return x-y}return 0})}
function pivotMove(id,target){state.pivot=state.pivot||{rows:[],columns:[]};state.pivot.rows=state.pivot.rows.filter(function(x){return x!==id});state.pivot.columns=state.pivot.columns.filter(function(x){return x!==id});if(target==="rows")state.pivot.rows.push(id);else state.pivot.columns.push(id);renderPivotBuilder()}
function pivotRemove(id){state.pivot.rows=state.pivot.rows.filter(function(x){return x!==id});state.pivot.columns=state.pivot.columns.filter(function(x){return x!==id});renderPivotBuilder()}
function pivotDragStart(e,id){e.dataTransfer.setData("text/plain",id);e.dataTransfer.effectAllowed="move"}
function pivotAllow(e){e.preventDefault();e.dataTransfer.dropEffect="move"}
function pivotDrop(e,target){e.preventDefault();var id=e.dataTransfer.getData("text/plain");if(id)pivotMove(id,target)}
function pivotDropItem(e,target,targetId){e.preventDefault();e.stopPropagation();var id=e.dataTransfer.getData("text/plain");if(!id||id===targetId)return;state.pivot.rows=state.pivot.rows.filter(function(x){return x!==id});state.pivot.columns=state.pivot.columns.filter(function(x){return x!==id});var list=target==="rows"?state.pivot.rows:state.pivot.columns,idx=list.indexOf(targetId);list.splice(idx<0?list.length:idx,0,id);renderPivotBuilder()}
function pivotZone(title,zone,ids,dsx){var html=ids.map(function(id){var d=dsx.find(function(x){return x.id===id});return '<div class="pivot-dimension" draggable="true" ondragstart="pivotDragStart(event,\''+esc(id)+'\')" ondragover="pivotAllow(event)" ondrop="pivotDropItem(event,\''+zone+'\',\''+esc(id)+'\')"><span class="pivot-drag">☷</span><span>'+esc(pivotLabel(d))+'</span><button type="button" class="pivot-remove" onclick="pivotRemove(\''+esc(id)+'\')">×</button></div>'}).join('');return '<div class="pivot-zone"><div class="pivot-zone-title">'+esc(title)+'</div><div class="pivot-dropzone '+(ids.length?'has-items':'')+'" ondragover="pivotAllow(event)" ondrop="pivotDrop(event,\''+zone+'\')">'+(html||'<span class="pivot-placeholder">Arrossega variables aquí</span>')+'</div></div>'}
function renderPivotBuilder(){var b=$("pivotBuilder");if(!b)return;if(!state.lastData){b.innerHTML='<div class="empty">Primer fes una consulta.</div>';return}state.pivot=state.pivot||{rows:[],columns:[]};var dsx=pivotDims(),assigned=new Set([].concat(state.pivot.rows,state.pivot.columns)),available=dsx.filter(function(d){return !assigned.has(d.id)});var ah=available.map(function(d){return '<div class="pivot-dimension available" draggable="true" ondragstart="pivotDragStart(event,\''+esc(d.id)+'\')"><span class="pivot-drag">☷</span><span>'+esc(pivotLabel(d))+'</span></div>'}).join('')||'<span class="pivot-placeholder">Totes les variables estan assignades.</span>';var all=assigned.size===dsx.length,axes=dsx.length<=1?(state.pivot.rows.length+state.pivot.columns.length>0):(state.pivot.rows.length>0&&state.pivot.columns.length>0);b.innerHTML='<div class="pivot-intro"><strong>Constructor de taula</strong><span>Arrossega cada variable a Files o Columnes. Pots canviar-ne l’ordre.</span></div><div class="pivot-layout"><div class="pivot-panel"><div class="pivot-panel-title">Variables disponibles</div><div class="pivot-available">'+ah+'</div></div><div class="pivot-panel">'+pivotZone("Files","rows",state.pivot.rows,dsx)+'</div><div class="pivot-panel">'+pivotZone("Columnes","columns",state.pivot.columns,dsx)+'</div></div><div class="pivot-actions"><button id="pivotBuild" class="primary" '+(all&&axes?'':'disabled')+'>Genera la taula</button><button id="pivotReset" class="secondary">Restableix</button><span class="pivot-help">'+(!all?'Assigna totes les variables a Files o Columnes.':!axes?'Cal tenir almenys una variable a cada eix.':'Configuració correcta.')+'</span></div><div id="pivotResult"></div>';$("pivotBuild").onclick=renderPivotTable;$("pivotReset").onclick=function(){state.pivot={rows:[],columns:[]};renderPivotBuilder()}}
function pivotHeaderGroups(combs,id){var out=[],i=0;while(i<combs.length){var code=String(combs[i].row[id]&&combs[i].row[id].code||''),j=i+1;while(j<combs.length&&String(combs[j].row[id]&&combs[j].row[id].code||'')===code)j++;out.push({label:combs[i].row[id]&&combs[i].row[id].label||'',span:j-i});i=j}return out}
function renderPivotTable(){var out=$("pivotResult");if(!state.lastData||!out)return;var z=resultRows(state.lastData),rows=z.rows,dsx=z.dims,rowIds=state.pivot.rows,colIds=state.pivot.columns,all=[].concat(rowIds,colIds),avail=pivotDims();if(!all.length||all.length!==avail.length||new Set(all).size!==all.length){out.innerHTML='<div class="error">Cal assignar totes les variables a Files o Columnes.</div>';return}var rc=pivotComb(rows,rowIds),cc=pivotComb(rows,colIds),values=new Map();rows.forEach(function(r){values.set(pivotKey(r,rowIds)+"§"+pivotKey(r,colIds),r.value)});var h='<div class="pivot-table-title">'+esc(state.metadata&&state.metadata.label||state.selected.table)+'</div><div class="pivot-result-meta">'+rc.length.toLocaleString("ca-ES")+' files · '+cc.length.toLocaleString("ca-ES")+' columnes</div><div class="table-wrap pivot-table-wrap"><table class="data-table pivot-table"><thead>';if(colIds.length){for(var l=0;l<colIds.length;l++){h+='<tr>';if(l===0)rowIds.forEach(function(id){h+='<th class="pivot-row-header" rowspan="'+colIds.length+'">'+esc(pivotLabel(dsx.find(function(d){return d.id===id})))+'</th>'});pivotHeaderGroups(cc,colIds[l]).forEach(function(g){h+='<th class="pivot-value-header" colspan="'+g.span+'">'+esc(String(g.label))+'</th>'});h+='</tr>'}}else{h+='<tr>';rowIds.forEach(function(id){h+='<th class="pivot-row-header">'+esc(pivotLabel(dsx.find(function(d){return d.id===id})))+'</th>'});h+='<th class="pivot-value-header">Valor</th></tr>'}h+='</thead><tbody>';function rowspan(combs,idx,level){if(idx>0){var same=true;for(var q=0;q<=level;q++){if(String(combs[idx].row[rowIds[q]]&&combs[idx].row[rowIds[q]].code||'')!==String(combs[idx-1].row[rowIds[q]]&&combs[idx-1].row[rowIds[q]].code||''))same=false}if(same)return 0}var n=1;while(idx+n<combs.length){var same2=true;for(var q2=0;q2<=level;q2++){if(String(combs[idx].row[rowIds[q2]]&&combs[idx+n].row[rowIds[q2]]&&combs[idx+n].row[rowIds[q2]].code||'')!==String(combs[idx].row[rowIds[q2]]&&combs[idx].row[rowIds[q2]].code||''))same2=false}if(!same2)break;n++}return n}rc.forEach(function(r,i){h+='<tr>';rowIds.forEach(function(id,l){var sp=rowspan(rc,i,l);if(sp)h+='<td class="pivot-label pivot-row-header" rowspan="'+sp+'">'+esc(String(r.row[id]&&r.row[id].label||''))+'</td>'});cc.forEach(function(c){var v=values.get(r.key+"§"+c.key);h+='<td class="num pivot-cell">'+(v==null?'':esc(fmt(v,decimals(state.lastData))))+'</td>'});h+='</tr>'});h+='</tbody></table></div>';out.innerHTML=h}
function exportInfo(){var now=new Date(),pad=function(n){return String(n).padStart(2,"0")},date=pad(now.getDate())+"-"+pad(now.getMonth()+1)+"-"+now.getFullYear()+" "+pad(now.getHours())+":"+pad(now.getMinutes());return{tableName:state.metadata&&state.metadata.label||state.selected.table,queryUrl:state.lastQueryUrl,exportDate:date,source:"Font: "+provider().label}}
function rawCartData(name){var z=resultRows(state.lastData),headers=z.dims.map(function(d){return[d.id+"_Codi",d.id+"_Etiqueta"]}).reduce(function(a,b){return a.concat(b)},[]).concat(["Valor"]),info=exportInfo(),out=[[name],[info.source],["URL: "+info.queryUrl],["Data de consulta: "+info.exportDate],[],headers];z.rows.forEach(function(r){out.push(z.dims.map(function(d){return[r[d.id].code,r[d.id].label]}).reduce(function(a,b){return a.concat(b)},[]).concat([r.value==null?"":r.value]))});return out}
function pivotExport(){
 if(!state.lastData)return null;
 var z=resultRows(state.lastData),rowIds=state.pivot.rows,colIds=state.pivot.columns,all=[].concat(rowIds,colIds),avail=pivotDims();
 if(!all.length||all.length!==avail.length||new Set(all).size!==all.length)return null;
 var rc=pivotComb(z.rows,rowIds),cc=pivotComb(z.rows,colIds),values=new Map();
 z.rows.forEach(function(r){values.set(pivotKey(r,rowIds)+"§"+pivotKey(r,colIds),r.value);});
 var info=exportInfo(),headers=[];
 rowIds.forEach(function(id){headers.push(pivotLabel(z.dims.find(function(d){return d.id===id;})));});
 if(colIds.length)cc.forEach(function(c){headers.push(colIds.map(function(id){return c.row[id]&&c.row[id].label||"";}).join(" · "));});
 else headers.push("Valor");
 var out=[[info.tableName],[],[info.source],[],headers];
 rc.forEach(function(r){
   var rr=[];
   rowIds.forEach(function(id){rr.push(r.row[id]&&r.row[id].label||"");});
   cc.forEach(function(c){var v=values.get(r.key+"§"+c.key);rr.push(v==null?"":v);});
   out.push(rr);
 });
 return out;
}
function pivotSignature(){return JSON.stringify({rows:state.pivot.rows.slice(),columns:state.pivot.columns.slice()})}
function pivotVariantName(base){var dsx=dims(state.lastData||{}),r=state.pivot.rows.map(function(id){return pivotLabel(dsx.find(function(d){return d.id===id}))}),c=state.pivot.columns.map(function(id){return pivotLabel(dsx.find(function(d){return d.id===id}));}),p=[];if(r.length)p.push("Files: "+r.join(" · "));if(c.length)p.push("Columnes: "+c.join(" · "));return p.length?base+" · "+p.join(" · "):base}
function addCart(){if(!state.lastData)return;state.pivot=state.pivot||{rows:[],columns:[]};var info=exportInfo(),name=info.tableName,raw=rawCartData(name),pout=pivotExport(),sig=pout?pivotSignature():null,existing=state.cart.find(function(x){return x.queryUrl===info.queryUrl});if(existing){if(!sig){status("Aquesta consulta ja és a la cistella.");return}existing.variants=Array.isArray(existing.variants)?existing.variants:[];if(existing.variants.some(function(v){return v.signature===sig})){status("Aquesta variant de la taula ja és a la cistella.");return}existing.variants.push({signature:sig,name:pivotVariantName(name),pivotOut:pout});renderCart();animateCartAdd();return}state.cart.push({id:state.nextCartId++,name:name,tableName:info.tableName,geo:state.selected.geo,geoLabel:$("geo")&&$("geo").selectedOptions[0]?$("geo").selectedOptions[0].textContent.trim():state.selected.geo,queryUrl:info.queryUrl,exportDate:info.exportDate,source:info.source,rowCount:Math.max(0,raw.length-6),rawOut:raw,pivotOut:pout,pivotSignature:sig,variants:pout?[{signature:sig,name:pivotVariantName(name),pivotOut:pout}]:[],provider:provider().label});renderCart();animateCartAdd()}
function animateCartAdd(){var source=$("addToCart"),target=$("cartToggle");if(!source||!target)return;var icon=document.createElement("img");icon.src="https://cdn-icons-png.flaticon.com/128/7603/7603985.png";icon.alt="";icon.className="cart-flight";var a=source.getBoundingClientRect(),b=target.getBoundingClientRect(),sx=a.left+a.width/2,sy=a.top+a.height/2,ex=b.left+b.width/2,ey=b.top+b.height/2;icon.style.left=sx+"px";icon.style.top=sy+"px";document.body.appendChild(icon);requestAnimationFrame(function(){icon.style.transform="translate("+(ex-sx)+"px,"+(ey-sy)+"px) scale(.35)";icon.style.opacity="0"});setTimeout(function(){icon.remove()},1600)}
function removeFromCart(id){state.cart=state.cart.filter(function(x){return x.id!==id});renderCart()}
function renderCart(){$("cartCount").textContent=state.cart.length;$("cartClear").disabled=!state.cart.length;$("cartExport").disabled=!state.cart.length;$("cartExport").textContent="Exporta Excel ("+state.cart.length+")";$("cartItems").innerHTML=state.cart.length?state.cart.map(function(x){var n=Array.isArray(x.variants)?x.variants.length:(x.pivotOut?1:0);return '<div class="cart-item"><div class="cart-item-info"><strong>'+esc(x.name)+'</strong><span>'+x.rowCount.toLocaleString("ca-ES")+' registres · '+esc(x.provider||provider().label)+' · '+n+' '+(n===1?'variant de taula':'variants de taula')+'</span></div><button type="button" class="secondary cart-remove" data-cart-id="'+x.id+'">Elimina</button></div>'}).join(""):'<div class="cart-empty">La cistella és buida. Afegeix-hi una consulta després de construir-ne la taula.</div>';$("cartItems").querySelectorAll(".cart-remove").forEach(function(b){b.onclick=function(){removeFromCart(Number(b.dataset.cartId))}})}
function sheetName(base,used){var s=String(base||"Full").replace(/[:\\/?*\[\]]/g," ").replace(/\s+/g," ").trim().slice(0,31)||"Full",n=2,name=s;while(used.has(name.toLowerCase())){var e=" ("+n+++")";name=s.slice(0,31-e.length)+e}used.add(name.toLowerCase());return name}
async function exportCart(){
 if(!state.cart.length||typeof XLSX==="undefined")return;
 var wb=XLSX.utils.book_new(),used=new Set(),idx=[["ÍNDEX DE CONSULTES"],[],["Núm.","Consulta","Taula","Geografia","Data de consulta","Registres","Dades","Taula construïda"]];
 state.cart.forEach(function(x,i){
   var n=i+1,dataName="";
   if(x.rawOut&&x.rawOut.length){
     var ws=XLSX.utils.aoa_to_sheet(x.rawOut);
     dataName=sheetName("Dades "+n+" "+x.name,used);
     XLSX.utils.book_append_sheet(wb,ws,dataName);
   }
   var vars=Array.isArray(x.variants)?x.variants:(x.pivotOut?[{name:x.name,pivotOut:x.pivotOut}]:[]),vSheets=[];
   vars.forEach(function(v,vi){
     if(!v.pivotOut||!v.pivotOut.length)return;
     var ws=XLSX.utils.aoa_to_sheet(v.pivotOut);
     var sn=sheetName("Taula "+n+" "+(vi+1)+" "+(v.name||x.name),used);
     XLSX.utils.book_append_sheet(wb,ws,sn);
     vSheets.push(sn);
   });
   var row=[n,x.name||"",x.tableName||"",x.geoLabel||x.geo||"",x.exportDate||"",x.rowCount||0,"—","—"];
   if(dataName)row[6]={t:"s",v:"Obre",l:{Target:"#'"+dataName+"'!A1"}};
   if(vSheets.length)row[7]={t:"s",v:vSheets.length===1?"Obre":"Obre (variant 1)",l:{Target:"#'"+vSheets[0]+"'!A1"}};
   idx.push(row);
   for(var j=1;j<vSheets.length;j++)idx.push(["","","","","","", "",{t:"s",v:"Obre (variant "+(j+1)+")",l:{Target:"#'"+vSheets[j]+"'!A1"}}]);
 });
 if(!wb.SheetNames.length){status("La cistella no conté dades exportables.","error");return;}
 var iw=XLSX.utils.aoa_to_sheet(idx);
 XLSX.utils.book_append_sheet(wb,iw,"Índex");
 wb.SheetNames.unshift(wb.SheetNames.pop());
 var now=new Date(),pad=function(v){return String(v).padStart(2,"0")},filename="idescat_cistella_"+now.getFullYear()+pad(now.getMonth()+1)+pad(now.getDate())+"_"+pad(now.getHours())+pad(now.getMinutes())+".xlsx";
 XLSX.writeFile(wb,filename);
 status("S'ha generat l'Excel amb "+state.cart.length+" consultes i "+wb.SheetNames.length+" fulls.","ok");
}
function bind(){
 $("provider").onchange=async function(){var v=$("provider").value;if(v.indexOf("pxweb:")===0){state.provider="pxweb";state.pxPreset=v.slice(6)}else{state.provider=v}state.requestToken++;clearBelow();state.selected.stat="";fill($("stat"),[]);$("stat").disabled=true;setProviderUI();status("Carregant estadístiques…");try{await loadStats();status("")}catch(e){status(e.message,"error")}updateUrl()};
 
  $("stat").onchange=async function(){await onStatChange();updateUrl()};
 $("concept").onchange=async function(){if(state.provider==="pxweb")await pxSelect("concept");else if(state.provider==="eurostat")await eurostatSelectLevel("concept");else{state.selected.concept=$("concept").value;state.selected.cross="";state.selected.node="";state.selected.table="";state.selected.geo="";["cross","node","table","geo"].forEach(resetSelect);state.metadata=null;state.filters.clear();$("filters").innerHTML="";$("results").innerHTML='<div class="empty">Selecciona una taula i fes la consulta.</div>';$("query").disabled=true;$("exportCsv").disabled=true;$("exportXlsx").disabled=true;$("addToCart").disabled=true;$("tableInfo").hidden=true;$("cellInfo").hidden=true;var c=state.selected.concept,rows=(state.catalog||[]).filter(function(r){return r.concept===c}),x=[...new Set(rows.map(function(r){return r.cross}).filter(Boolean))];fill($("cross"),x.map(function(v){return{value:v,label:v}}));$("cross").disabled=!x.length;if(x.length===1){$("cross").value=x[0];await $("cross").onchange()}else if(x.length===0){var ids=[...new Set(rows.map(function(r){return String(r.node)}).filter(Boolean))];fill($("node"),ids.map(function(id){var q=rows.find(function(r){return String(r.node)===id});return{value:id,label:id+" · "+q.name}}));$("node").disabled=!ids.length;if(ids.length===1){$("node").value=ids[0];await onNodeChange()}}}};
 $("cross").onchange=async function(){if(state.provider==="pxweb")await pxSelect("cross");else if(state.provider==="eurostat")await eurostatSelectLevel("cross");else{var c=$("concept").value,x=$("cross").value;state.selected.cross=x;state.selected.node="";state.selected.table="";state.selected.geo="";resetSelect("node");resetSelect("table");resetSelect("geo");state.metadata=null;state.filters.clear();$("filters").innerHTML="";$("results").innerHTML='<div class="empty">Selecciona una taula i fes la consulta.</div>';$("query").disabled=true;$("exportCsv").disabled=true;$("exportXlsx").disabled=true;$("addToCart").disabled=true;$("tableInfo").hidden=true;$("cellInfo").hidden=true;var r=(state.catalog||[]).filter(function(v){return v.concept===c&&v.cross===x}),ids=[...new Set(r.map(function(v){return v.node}))];fill($("node"),ids.map(function(id){var q=r.find(function(v){return v.node===id});return{value:id,label:id+" · "+q.name}}));$("node").disabled=!ids.length;if(ids.length===1){$("node").value=ids[0];await onNodeChange()}}};
 $("node").onchange=async function(){if(state.provider==="eurostat")await eurostatSelectLevel("node");else await onNodeChange()};$("table").onchange=onTableChange;$("geo").onchange=onGeoChange;$("tabData").onclick=function(){$("tabData").classList.add("active");$("tabPivot").classList.remove("active");$("results").hidden=false;$("pivotBuilder").hidden=true};$("tabPivot").onclick=function(){$("tabPivot").classList.add("active");$("tabData").classList.remove("active");$("results").hidden=true;$("pivotBuilder").hidden=false;renderPivotBuilder()};$("query").onclick=runQuery;$("exportCsv").onclick=exportCSV;$("exportXlsx").onclick=exportXLSX;$("addToCart").onclick=addCart;$("cartExport").onclick=exportCart;$("cartClear").onclick=function(){state.cart=[];renderCart()};$("cartToggle").onclick=function(){var p=$("cartPanel");p.hidden=false;$("cartToggle").setAttribute("aria-expanded","true");p.scrollIntoView({behavior:"smooth",block:"start"})};$("clear").onclick=function(){if(state.metadata)renderMetadata(state.metadata)}
}
function updateUrl(){var q=new URLSearchParams();q.set("provider",state.provider);if(state.provider==="pxweb")q.set("px",state.pxPreset);if(state.selected.stat)q.set("stat",state.selected.stat);history.replaceState(null,"","?"+q.toString())}
(async function(){bind();renderCart();var q=new URLSearchParams(location.search);state.provider=q.get("provider")||"idescat";state.pxPreset=q.get("px")||"finland";$("provider").value=state.provider==="pxweb"?"pxweb:"+state.pxPreset:state.provider;setProviderUI();try{await loadStats()}catch(e){status(e.message,"error")}})();
