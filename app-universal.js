
const MAX_CELLS=20000;
const state={provider:"idescat",pxPreset:"finland",stats:[],metadata:null,lastData:null,lastQueryUrl:"",filters:new Map(),page:1,pageSize:100,requestToken:0,selected:{stat:"",concept:"",cross:"",node:"",table:"",geo:""},cart:[],nextCartId:1,pxPath:[],pxItems:new Map(),ineTables:[]};
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]});
async function fetchJson(url,opt){opt=opt||{};const r=await fetch(url,opt);let d;try{d=await r.json()}catch(e){throw new Error("Resposta no vàlida de l'API (HTTP "+r.status+").")}if(!r.ok||d&&d.class==="error")throw new Error(d&& (d.label||d.message)||"Error HTTP "+r.status+".");return d}
function a(d){if(Array.isArray(d))return d;if(d&&Array.isArray(d.data))return d.data;if(d&&Array.isArray(d.items))return d.items;if(d&&Array.isArray(d.result))return d.result;return[]}
function f(o){for(var i=1;i<arguments.length;i++){var k=arguments[i];if(o&&o[k]!=null)return o[k]}return""}
function fill(sel,items,ph){var old=sel.value;sel.innerHTML="";if(ph!==null)sel.append(new Option(ph||"— Selecciona —",""));items.forEach(function(x){sel.append(new Option(x.label||x.value,x.value))});if([].slice.call(sel.options).some(function(o){return o.value===old}))sel.value=old}
function resetSelect(id){if($(id)){$(id).innerHTML='<option value="">— Selecciona —</option>';$(id).disabled=true}}
function busy(v){document.body.classList.toggle("busy",v)}
function status(s,t){$("status").textContent=s||"";$("status").className=t||""}
function provider(){var p={idescat:{label:"Idescat",base:"https://api.idescat.cat/taules/v2",doc:"https://www.idescat.cat/dev/api/taules/"},pxweb:{label:"PXWeb",base:"",doc:"https://pxdata.stat.fi/api1.html"},ine:{label:"INE",base:"https://servicios.ine.es/wstempus/jsstat",doc:"https://www.ine.es/OpenAPI/"},eurostat:{label:"Eurostat",base:"https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0",doc:"https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access/"}};if(state.provider==="pxweb"){var x={finland:"https://pxdata.stat.fi/PxWeb/api/v1/en/StatFin",sweden:"https://api.scb.se/OV0104/v1/doris/en/ssd",unece:"https://w3.unece.org/PXWeb2015/api/v1/en/STAT",iceland:"https://px.hagstofa.is/pxen/api/v1/en"};p.pxweb.base=x[state.pxPreset]||x.finland}return p[state.provider]}
function pxUrl(path){return [provider().base].concat(path).join("/")}
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
function clearBelow(){["concept","cross","node","table","geo"].forEach(resetSelect);state.metadata=null;state.lastData=null;state.filters.clear();$("filters").innerHTML="";$("results").innerHTML='<div class="empty">Selecciona una taula i fes la consulta.</div>';$("query").disabled=true;$("exportCsv").disabled=true;$("exportXlsx").disabled=true;$("addToCart").disabled=true;$("tableInfo").hidden=true;$("cellInfo").hidden=true;$("resultCount").textContent=""}
function setLabels(){var p=state.provider,ls=p==="idescat"?["Organisme","Tema","Encreuament","Entrada","Taula","Geografia"]:p==="pxweb"?["Base PXWeb","Nivell 1","Nivell 2","Nivell 3","Taula","Geografia"]:p==="ine"?["Organisme","—","—","Taula","—","—"]:["Organisme","—","—","—","—","—"];var l=document.querySelectorAll("#step2 label");document.querySelector("#step1 label:nth-child(1)").firstChild.textContent=ls[0]+" ";l.forEach(function(x,i){x.firstChild.textContent=ls[i+1]+" "})}
function setProviderUI(){setLabels();var showPx=state.provider==="pxweb";$("pxPresetWrap").hidden=!showPx;$("pxPresetWrap").style.display=showPx?"":"none";$("docLink").href=provider().doc}
async function loadStats(){
 setProviderUI();var c=provider(),out=[];
 if(state.provider==="idescat"){out=collection(await fetchJson(c.base+"?lang=ca")).map(function(x){return{value:x.id,label:x.id+" · "+x.label}})}
 else if(state.provider==="ine"){var d=await fetchJson(c.base+"/ES/OPERACIONES_DISPONIBLES?det=1");out=a(d).map(function(x){var id=String(f(x,"Id","id","Codigo","Code"));return{value:id,label:id+" · "+String(f(x,"Nombre","nombre","Name","Descripcion","Description")||id)}}).filter(function(x){return x.value})}
 else if(state.provider==="eurostat"){var r=await fetch("https://ec.europa.eu/eurostat/api/dissemination/catalogue/toc/txt?lang=en");if(!r.ok)throw new Error("No s'ha pogut carregar el catàleg d'Eurostat.");var txt=await r.text();txt.split(/\r?\n/).forEach(function(line){var m=line.match(/^"([^"]*)"	"(.*?)"	"(table|dataset)"/);if(m)out.push({value:m[2],label:m[2]+" · "+m[1]})})}
 else {out=a(await fetchJson(c.base)).map(function(x){var id=String(f(x,"id","dbid","code","path"));return{value:id,label:String(f(x,"text","label","name","title")||id)}}).filter(function(x){return x.value})}
 out.sort(function(x,y){return x.value.localeCompare(y.value,"ca",{numeric:true})});state.stats=out;fill($("stat"),out);
 var initial=new URLSearchParams(location.search).get("stat")||"";if(initial&&[].slice.call($("stat").options).some(function(o){return o.value===initial})){$("stat").value=initial;await onStatChange()}
}
function deriveConcept(s){s=String(s||"");var p=s.indexOf(".");return p>=0?s.slice(0,p):s}
function deriveCross(s){s=String(s||"").trim();var p=s.indexOf(". ");if(p<0)return"";var r=s.slice(p+2),q=r.indexOf(". A");return(q>=0?r.slice(0,q):r).trim()}
async function onStatChange(){
 state.selected.stat=$("stat").value;clearBelow();if(!state.selected.stat)return;busy(true);
 try{
  if(state.provider==="idescat"){var d=await fetchJson(provider().base+"/"+encodeURIComponent(state.selected.stat)+"?lang=ca");state.catalog=collection(d).map(function(x){return{node:x.id,name:x.label,concept:deriveConcept(x.label),cross:deriveCross(x.label)}});var cs=[...new Set(state.catalog.map(function(x){return x.concept}).filter(Boolean))];fill($("concept"),cs.map(function(x){return{value:x,label:x}}));$("concept").disabled=!cs.length}
  else if(state.provider==="ine"){var t=await fetchJson(provider().base+"/ES/TABLAS_OPERACION/"+encodeURIComponent(state.selected.stat)+"?det=1");state.ineTables=a(t).map(function(x){var id=String(f(x,"Id","id","Codigo","Code"));return{value:id,label:String(f(x,"Nombre","nombre","Name","Descripcion","Description")||id)}}).filter(function(x){return x.value});fill($("node"),state.ineTables);$("node").disabled=!state.ineTables.length;$("concept").disabled=true;$("cross").disabled=true;$("table").disabled=true;$("geo").disabled=true}
  else if(state.provider==="eurostat"){await eurostatSelect(state.selected.stat)}
  else {state.pxPath=[];await pxChildren([],"concept")}
 }catch(e){status(e.message,"error")}finally{busy(false)}
}
async function eurostatSelect(code){state.selected.node=code;state.selected.table=code;var ds=await fetchJson(provider().base+"/data/"+encodeURIComponent(code)+"?format=JSON&lang=EN&lastTimePeriod=3");state.metadata=ds;renderMetadata(ds);$("tableInfo").hidden=false;$("tableInfo").innerHTML="<strong>Conjunt de dades:</strong> "+esc(ds.label||code)+"<span class=\"path\">"+esc(provider().base+"/data/"+code)+"</span>";$("query").disabled=false}
async function pxChildren(path,target){
 var d=await fetchJson(pxUrl(path)),items=a(d).map(function(x){return{id:String(f(x,"id","code","dbid","path")),label:String(f(x,"text","label","name","title")||f(x,"id","code","path")),type:String(f(x,"type","class"))}}).filter(function(x){return x.id});state.pxItems.set(target,items);fill($(target),items.map(function(x){return{value:x.id,label:x.id+" · "+x.label}}));$(target).disabled=!items.length
}
function pxTable(x){return/^(t|table)$/i.test(x&&x.type)||/\.px$/i.test(x&&x.id||"")}
async function pxSelect(target){
 var val=$(target).value;if(!val)return;var item=state.pxItems.get(target).find(function(x){return x.id===val}),order=["concept","cross","node","table"],i=order.indexOf(target);state.pxPath=state.pxPath.slice(0,i);state.pxPath.push(val);if(pxTable(item)){state.selected.node=val;state.selected.table=val;await pxMetadata();return}var next=order[i+1];if(next){["cross","node","table"].forEach(function(id,j){if(j>=i)resetSelect(id)});await pxChildren(state.pxPath,next)}}
function pxToJsonStat(m){var ds={version:"2.0",class:"dataset",label:m.title||m.label||state.selected.table,id:[],size:[],dimension:{}};(m.variables||[]).forEach(function(v){var id=String(v.code||v.id||"");var vals=v.values||[];var labs=v.valueTexts||v.labels||vals;var index={},label={};vals.forEach(function(x,i){index[String(x)]=i;label[String(x)]=String(labs[i]==null?x:labs[i])});ds.id.push(id);ds.size.push(vals.length);ds.dimension[id]={label:String(v.text||v.label||id),category:{index:index,label:label}}});return ds}
async function pxMetadata(){var raw=await fetchJson(pxUrl(state.pxPath)),ds=pxToJsonStat(raw);state.metadata=ds;renderMetadata(ds);$("tableInfo").hidden=false;$("tableInfo").innerHTML="<strong>Taula:</strong> "+esc(raw.title||raw.label||state.selected.table)+"<span class=\"path\">"+esc(pxUrl(state.pxPath))+"</span>";$("query").disabled=false}
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
 else if(state.provider==="ine"){state.selected.node=$("node").value;state.selected.table=state.selected.node;await ineMetadata(state.selected.node)}
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
function renderMetadata(ds){
 state.filters.clear();$("filters").innerHTML="";
 dims(ds).forEach(function(d){var cats=sortedCats(d.categories,d),set=new Set(cats.map(function(x){return x.code}));state.filters.set(d.id,set);var sec=document.createElement("section");sec.className="filter";sec.dataset.dim=d.id;sec.innerHTML="<div class=\"filter-head\"><div><h3>"+esc(d.label)+"</h3><span class=\"role\">"+esc(d.role||"")+"</span></div><span class=\"selected-count\"></span></div>";var tools=document.createElement("div");tools.className="filter-tools";var buttons=document.createElement("div");buttons.className="filter-buttons";var all=document.createElement("button");all.className="secondary";all.textContent="Tots";var none=document.createElement("button");none.className="secondary";none.textContent="Cap";var list=document.createElement("div");list.className="options";if(cats.length>1){buttons.append(all,none);tools.append(buttons)}
 cats.forEach(function(c){var b=document.createElement("button");b.type="button";b.className="option selected";b.dataset.code=c.code;b.innerHTML="<span class=\"option-label\">"+esc(c.label)+"</span><small>"+esc(c.code)+"</small>";b.onclick=function(){if(cats.length===1)return;var s=state.filters.get(d.id);if(s.has(c.code))s.delete(c.code);else s.add(c.code);b.classList.toggle("selected",s.has(c.code));updateCells()};list.append(b)});
 sec.append(tools,list);$("filters").append(sec);
 all.onclick=function(){state.filters.set(d.id,new Set(cats.map(function(c){return c.code})));list.querySelectorAll(".option").forEach(function(b){b.classList.add("selected")});updateCells()};none.onclick=function(){state.filters.set(d.id,new Set());list.querySelectorAll(".option").forEach(function(b){b.classList.remove("selected")});updateCells()}
 });updateCells()
}
function selectedFilters(){var q={};dims(state.metadata).forEach(function(d){var s=state.filters.get(d.id)||new Set(),n=d.categories.length;if(s.size&&s.size!==n)q[d.id]=Array.from(s)});return q}
function updateCells(){var n=1;state.filters.forEach(function(s){n*=s.size});var bad=n>MAX_CELLS||Array.from(state.filters.values()).some(function(s){return !s.size});$("cellInfo").hidden=false;$("cellInfo").innerHTML="<strong>Nombre de cel·les de la taula filtrada:</strong> "+n.toLocaleString("ca-ES")+" · <span class=\""+(bad?"bad":"ok")+"\">"+(bad?"Cal filtrar la taula o seleccionar valors a totes les dimensions.":"Es pot continuar.")+"</span>";document.querySelectorAll(".filter").forEach(function(x){x.querySelector(".selected-count").textContent=(state.filters.get(x.dataset.dim)||new Set()).size.toLocaleString("ca-ES")+" seleccionades"});$("query").disabled=bad||!state.metadata}
function buildEurostatParams(){var p=new URLSearchParams();p.set("format","JSON");p.set("lang","EN");var q=selectedFilters();Object.keys(q).forEach(function(k){q[k].forEach(function(v){p.append(k,v)})});return p}
async function runQuery(){
 var token=++state.requestToken;busy(true);$("query").disabled=true;status("Consultant l’API…");
 try{var ds;
  if(state.provider==="idescat"){var base=provider().base+"/"+state.selected.stat+"/"+state.selected.node+"/"+state.selected.table+"/"+state.selected.geo+"/data",q=new URLSearchParams();Object.keys(selectedFilters()).forEach(function(k){q.set(k,selectedFilters()[k].join(","))});q.set("lang","ca");var u=base+"?"+q.toString();ds=await fetchJson(u);state.lastQueryUrl=u}
  else if(state.provider==="eurostat"){var u2=provider().base+"/data/"+state.selected.stat+"?"+buildEurostatParams().toString();ds=await fetchJson(u2);state.lastQueryUrl=u2}
  else if(state.provider==="pxweb"){var query={query:[],response:{format:"json-stat2"}};dims(state.metadata).forEach(function(d){query.query.push({code:d.id,selection:{filter:"item",values:Array.from(state.filters.get(d.id)||[])}})});var up=pxUrl(state.pxPath);ds=await fetchJson(up,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(query)});state.lastQueryUrl=up}
  else {var qi=new URLSearchParams();qi.set("nult","3");Object.keys(selectedFilters()).forEach(function(k){selectedFilters()[k].forEach(function(v){qi.append("tv",k+":"+v)})});var ui=provider().base+"/ES/DATASET/"+state.selected.table+"?"+qi.toString();ds=await fetchJson(ui);state.lastQueryUrl=ui}
  if(token!==state.requestToken)return;state.lastData=ds;state.page=1;renderResults(ds);var n=Array.isArray(ds.value)?ds.value.length:Object.keys(ds.value||{}).length;$("resultCount").textContent=n.toLocaleString("ca-ES")+" valors retornats";$("exportCsv").disabled=false;$("exportXlsx").disabled=false;$("addToCart").disabled=false;status("")
 }catch(e){if(token===state.requestToken){$("results").innerHTML="<div class=\"error\">"+esc(e.message)+"</div>";status("Error","error")}}finally{busy(false);updateCells()}
}
function resultRows(ds){var ids=ds.id||[],sizes=ds.size||[],dd=ids.map(function(id){return{id:id,label:ds.dimension&&ds.dimension[id]&&ds.dimension[id].label||id,cats:jsonstatCats(ds,id)}}),vals=ds.value||[],get=function(i){return Array.isArray(vals)?vals[i]:vals[String(i)]},total=sizes.reduce(function(x,y){return x*y},1),rows=[];for(var flat=0;flat<total;flat++){var rem=flat,row={};for(var j=ids.length-1;j>=0;j--){var size=Number(sizes[j]||0),idx=rem%size;rem=Math.floor(rem/size);var c=dd[j].cats.find(function(x){return x.index===idx});row[ids[j]]={code:c?c.code:"",label:c?c.label:""}}row.value=get(flat);rows.push(row)}return{dims:dd,rows:rows}}
function decimals(ds){var found=[];function walk(x){if(!x||typeof x!=="object")return;if(Array.isArray(x)){x.forEach(walk);return}Object.keys(x).forEach(function(k){if(k.toLowerCase()==="unit"&&x[k]&&typeof x[k]==="object")Object.values(x[k]).forEach(function(v){var n=Number(v&&v.decimals);if(Number.isInteger(n))found.push(n)});walk(x[k])})}walk(ds);var u=[...new Set(found)];return u.length===1?u[0]:null}
function fmt(v,d){if(v==null||v==="")return"";var n=typeof v==="number"?v:Number(v);if(!Number.isFinite(n))return v;return n.toLocaleString("ca-ES",{minimumFractionDigits:d==null?0:d,maximumFractionDigits:d==null?20:d})}
function renderResults(ds){var z=resultRows(ds),rows=z.rows,dd=z.dims,start=(state.page-1)*state.pageSize,end=Math.min(start+state.pageSize,rows.length),page=rows.slice(start,end),h="<div class=\"result-meta\">"+rows.length.toLocaleString("ca-ES")+" files · mostrant "+(rows.length?start+1:0)+"–"+end+"</div><div class=\"table-wrap\"><table class=\"data-table\"><thead><tr>"+dd.map(function(d){return"<th>"+esc(d.id+"_Codi")+"</th><th>"+esc(d.id+"_Etiqueta")+"</th>"}).join("")+"<th>Valor</th></tr></thead><tbody>";page.forEach(function(r){h+="<tr>";dd.forEach(function(d){h+="<td>"+esc(r[d.id].code)+"</td><td>"+esc(r[d.id].label)+"</td>"});h+='<td class="num">'+esc(fmt(r.value,decimals(ds)))+"</td></tr>"});h+="</tbody></table></div>";$("results").innerHTML=h}
function exportCSV(){if(!state.lastData)return;var z=resultRows(state.lastData),h=z.dims.map(function(d){return[d.id+"_Codi",d.id+"_Etiqueta"]}).reduce(function(x,y){return x.concat(y)},[]).concat(["Valor"]),lines=[h].concat(z.rows.map(function(r){return z.dims.map(function(d){return[r[d.id].code,r[d.id].label]}).reduce(function(x,y){return x.concat(y)},[]).concat([r.value==null?"":r.value])})).map(function(row){return row.map(function(v){return'"'+String(v).replace(/"/g,'""')+'"'}).join(";")});var b=new Blob(["\uFEFF"+lines.join("\r\n")],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=state.provider+"_consulta.csv";a.click()}
function exportXLSX(){if(!state.lastData||typeof XLSX==="undefined")return;var z=resultRows(state.lastData),out=[[state.metadata&&state.metadata.label||"Consulta"],["Font: "+provider().label],[],z.dims.map(function(d){return[d.id+"_Codi",d.id+"_Etiqueta"]}).reduce(function(x,y){return x.concat(y)},[]).concat(["Valor"])];z.rows.forEach(function(r){out.push(z.dims.map(function(d){return[r[d.id].code,r[d.id].label]}).reduce(function(x,y){return x.concat(y)},[]).concat([r.value==null?"":r.value]))});var wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(out),"Dades");XLSX.writeFile(wb,state.provider+"_consulta.xlsx")}
function addCart(){if(!state.lastData)return;state.cart.push({title:state.metadata&&state.metadata.label||state.selected.table,data:state.lastData,url:state.lastQueryUrl,provider:provider().label});renderCart()}
function renderCart(){$("cartCount").textContent=state.cart.length;$("cartExport").disabled=!state.cart.length;$("cartClear").disabled=!state.cart.length;$("cartItems").innerHTML=state.cart.length?state.cart.map(function(x,i){return'<div class="cart-item"><div class="cart-item-info"><strong>'+esc(x.title)+'</strong><span>'+esc(x.provider)+"</span></div><button class=\"secondary cart-remove\" data-i=\""+i+"\">Suprimeix</button></div>"}).join(""):'<div class="cart-empty">La cistella és buida.</div>';$("cartItems").querySelectorAll(".cart-remove").forEach(function(b){b.onclick=function(){state.cart.splice(Number(b.dataset.i),1);renderCart()}})}
function exportCart(){if(!state.cart.length||typeof XLSX==="undefined")return;var wb=XLSX.utils.book_new();var index=[["Núm.","Consulta","Proveïdor","Dades"]];state.cart.forEach(function(x,i){var z=resultRows(x.data),out=[[x.title],["Font: "+x.provider],["URL: "+x.url],[],z.dims.map(function(d){return[d.id+"_Codi",d.id+"_Etiqueta"]}).reduce(function(a,b){return a.concat(b)},[]).concat(["Valor"])];z.rows.forEach(function(r){out.push(z.dims.map(function(d){return[r[d.id].code,r[d.id].label]}).reduce(function(a,b){return a.concat(b)},[]).concat([r.value==null?"":r.value]))});XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(out),"Taula "+(i+1));index.push([i+1,x.title,x.provider,"Taula "+(i+1)])});XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(index),"Índex");XLSX.writeFile(wb,"estadistica_cistella.xlsx")}
function bind(){
 $("provider").onchange=async function(){state.provider=$("provider").value;clearBelow();setProviderUI();await loadStats();updateUrl()};
 $("pxPreset").onchange=async function(){state.pxPreset=$("pxPreset").value;if(state.provider==="pxweb"){clearBelow();await loadStats()}};
 $("stat").onchange=onStatChange;
 $("concept").onchange=async function(){if(state.provider==="pxweb")await pxSelect("concept");else{state.selected.concept=$("concept").value;state.selected.cross="";state.selected.node="";state.selected.table="";state.selected.geo="";["cross","node","table","geo"].forEach(resetSelect);state.metadata=null;state.filters.clear();$("filters").innerHTML="";$("results").innerHTML='<div class="empty">Selecciona una taula i fes la consulta.</div>';$("query").disabled=true;$("exportCsv").disabled=true;$("exportXlsx").disabled=true;$("addToCart").disabled=true;$("tableInfo").hidden=true;$("cellInfo").hidden=true;var c=state.selected.concept,x=[...new Set((state.catalog||[]).filter(function(r){return r.concept===c}).map(function(r){return r.cross}).filter(Boolean))];fill($("cross"),x.map(function(v){return{value:v,label:v}}));$("cross").disabled=!x.length;if(x.length===1){$("cross").value=x[0];await $("cross").onchange()}}};
 $("cross").onchange=async function(){if(state.provider==="pxweb")await pxSelect("cross");else{var c=$("concept").value,x=$("cross").value;state.selected.cross=x;state.selected.node="";state.selected.table="";state.selected.geo="";resetSelect("node");resetSelect("table");resetSelect("geo");state.metadata=null;state.filters.clear();$("filters").innerHTML="";$("results").innerHTML='<div class="empty">Selecciona una taula i fes la consulta.</div>';$("query").disabled=true;$("exportCsv").disabled=true;$("exportXlsx").disabled=true;$("addToCart").disabled=true;$("tableInfo").hidden=true;$("cellInfo").hidden=true;var r=(state.catalog||[]).filter(function(v){return v.concept===c&&v.cross===x}),ids=[...new Set(r.map(function(v){return v.node}))];fill($("node"),ids.map(function(id){var q=r.find(function(v){return v.node===id});return{value:id,label:id+" · "+q.name}}));$("node").disabled=!ids.length;if(ids.length===1){$("node").value=ids[0];await onNodeChange()}}};
 $("node").onchange=onNodeChange;$("table").onchange=onTableChange;$("geo").onchange=onGeoChange;$("query").onclick=runQuery;$("exportCsv").onclick=exportCSV;$("exportXlsx").onclick=exportXLSX;$("addToCart").onclick=addCart;$("cartExport").onclick=exportCart;$("cartClear").onclick=function(){state.cart=[];renderCart()};$("cartToggle").onclick=function(){$("cartPanel").hidden=!$("cartPanel").hidden};$("clear").onclick=function(){if(state.metadata)renderMetadata(state.metadata)}
}
function updateUrl(){var q=new URLSearchParams();q.set("provider",state.provider);if(state.provider==="pxweb")q.set("px",state.pxPreset);if(state.selected.stat)q.set("stat",state.selected.stat);history.replaceState(null,"","?"+q.toString())}
(async function(){bind();renderCart();var q=new URLSearchParams(location.search);state.provider=q.get("provider")||"idescat";state.pxPreset=q.get("px")||"finland";$("provider").value=state.provider;$("pxPreset").value=state.pxPreset;setProviderUI();try{await loadStats()}catch(e){status(e.message,"error")}})();
