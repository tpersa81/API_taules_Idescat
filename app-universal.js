
const MAX_CELLS=20000;
const state={provider:"idescat",pxPreset:"finland",stats:[],istacDatasets:[],istacPath:[],icanePackages:[],icaneRawData:null,igeRoot:[],igePath:[],igeItems:new Map(),igeSelector:null,igeMode:null,igeSeriesTree:null,metadata:null,lastData:null,lastQueryUrl:"",finlandTableUrl:"",ineVarCache:new Map(),filters:new Map(),page:1,pageSize:100,temporalOrder:"desc",requestToken:0,pivot:{rows:[],columns:[]},selected:{stat:"",concept:"",cross:"",node:"",table:"",geo:""},cart:[],nextCartId:1,pxPath:[],pxItems:new Map(),ineTables:[],ineNav:null,ineNavLoaded:false,ineOperations:null,inePath:[],ineItems:new Map(),swedenV2Tables:null,swedenV2Table:false,swedenPath:[],eustatCatalog:[],eustatGroups:[],eustatOperations:[],eustatTables:[],eurostatTOC:null,eurostatRoots:[],eurostatNodes:[],eurostatPath:[],norwayPath:[],norwayCatalog:[],norwayRootItems:[]};
const $=id=>document.getElementById(id);
function debugGlobalError(e){
 var msg=e&&e.message?String(e.message):String(e||"Error"),
     file=e&&e.filename?String(e.filename):"",
     line=e&&e.lineno?String(e.lineno):"",
     col=e&&e.colno?String(e.colno):"",
     stack=e&&e.error&&e.error.stack?String(e.error.stack):(e&&e.stack?String(e.stack):"");
 var loc=(file?(file.split("/").pop()+(line?":"+line:"")+(col?":"+col:"")):"");
 var detail=msg+(loc?" · "+loc:"")+(stack?" · "+stack.split("\n").slice(0,3).join(" | "):"");
 try{status(detail,"error")}catch(_){}
}
window.addEventListener("error",function(e){debugGlobalError(e)});
window.addEventListener("unhandledrejection",function(e){
 var r=e&&e.reason?e.reason:e;
 debugGlobalError(r);
});
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]});
async function fetchJson(url,opt){
 opt=opt||{};
 if(state.provider==="istac"||/datos\.canarias\.es\/api\/estadisticas/i.test(String(url))){
  url=istacJsonUrl(url);
  opt.headers=Object.assign({"Accept":"application/json"},opt.headers||{});
 }
 if(state.provider==="ige"||/ige\.gal\/igebdt\/igeapi\//i.test(String(url))){
  opt.headers=Object.assign({"Accept":"application/json"},opt.headers||{});
 }
  if(state.provider==="nomis"||/nomisweb\.co\.uk\//i.test(String(url))){
  opt.headers=Object.assign({"Accept":"application/json, text/json, */*"},opt.headers||{});
 }
var r;try{r=await fetch(url,opt)}catch(e){
  if(state.provider==="pxweb"&&((state.pxPreset==="iceland"&&/^https:\/\/px\.hagstofa\.is\//i.test(url))||(state.pxPreset==="finland"&&/^https:\/\/pxdata\.stat\.fi\//i.test(url)))){
   try{r=await fetch("https://cors.tools/proxy?url="+encodeURIComponent(url),opt)}
   catch(e2){throw new Error("No s'ha pogut connectar amb l'API. "+(e2&&e2.message||"Failed to fetch")+" · "+url)}
  }else if(state.provider==="istac"&&/^https:\/\/datos\.canarias\.es\/api\/estadisticas\//i.test(url)){
   var ok=false,err=null,ps=[
    "https://cors.tools/proxy?url="+encodeURIComponent(url),
    "https://api.allorigins.win/raw?url="+encodeURIComponent(url),
    "https://api.codetabs.com/v1/proxy?quest="+encodeURIComponent(url),
    "https://corsproxy.io/?url="+encodeURIComponent(url)
   ];
   for(var pi=0;pi<ps.length&&!ok;pi++){
    try{
     var prx=await fetch(ps[pi],{cache:"no-store"});
     if(prx.ok){
      var pt=await prx.clone().text();
      var ptrim=String(pt||"").replace(/^\uFEFF/,"").trim();
      // Evita HTML de proxies trencats (p. ex. corsproxy.io)
      if(ptrim&&ptrim[0]!=="<"){r=prx;ok=true}
      else err=new Error("Proxy HTML invàlid");
     }else err=new Error("HTTP "+prx.status);
    }catch(ex){err=ex}
   }
   if(!ok)throw new Error("No s'ha pogut connectar amb l'API d'ISTAC. "+(err&&err.message||"Failed to fetch")+" · "+url)
  }
  else if(state.provider==="icane"&&/icane\.es\//i.test(url)){
   var icaneProxyOk=false,icaneProxyErr=null,icaneProxies=[
    "https://cors.tools/proxy?url="+encodeURIComponent(url),
    "https://api.allorigins.win/raw?url="+encodeURIComponent(url),
    "https://api.codetabs.com/v1/proxy?quest="+encodeURIComponent(url),
    "https://corsproxy.io/?url="+encodeURIComponent(url)
   ];
   for(var icp=0;icp<icaneProxies.length&&!icaneProxyOk;icp++){
    try{
     var ir=await fetch(icaneProxies[icp],{cache:"no-store"});
     if(ir.ok){
      var itx=await ir.clone().text();
      var itr=String(itx||"").replace(/^﻿/,"").trim();
      if(itr&&itr.charAt(0)!=="<"){r=ir;icaneProxyOk=true}
      else icaneProxyErr=new Error("Proxy HTML");
     }else icaneProxyErr=new Error("HTTP "+ir.status);
    }catch(ie){icaneProxyErr=ie}
   }
   if(!icaneProxyOk)throw new Error("No s'ha pogut connectar amb l'API d'ICANE. "+(icaneProxyErr&&icaneProxyErr.message||"Failed to fetch")+" · "+url);
  }
else if(state.provider==="ige"&&/^https:\/\/(?:www\.)?ige\.gal\/igebdt\//i.test(url)){
   var igeProxyOk=false,igeProxyErr=null;
   var igeProxies=[
    "https://cors.tools/proxy?url="+encodeURIComponent(url),
    "https://api.allorigins.win/raw?url="+encodeURIComponent(url),
    "https://api.codetabs.com/v1/proxy?quest="+encodeURIComponent(url),
    "https://corsproxy.io/?url="+encodeURIComponent(url)
   ];
   for(var igp=0;igp<igeProxies.length&&!igeProxyOk;igp++){
    try{
     var igr=await fetch(igeProxies[igp],{cache:"no-store"});
     if(igr.ok){
      var igt=await igr.clone().text();
      var igs=String(igt||"").replace(/^\uFEFF/,"").trim();
      // Descartem HTML de proxies trencats
      if(igs&&igs[0]!=="<"){r=igr;igeProxyOk=true}
      else igeProxyErr=new Error("Proxy HTML invàlid");
     }else igeProxyErr=new Error("HTTP "+igr.status);
    }catch(ige){igeProxyErr=ige}
   }
   if(!igeProxyOk)throw new Error("No s'ha pogut connectar amb l'API de l'IGE. "+(igeProxyErr&&igeProxyErr.message||"Failed to fetch")+" · "+url)
  }
else if(state.provider==="ine"&&/^https:\/\/servicios\.ine\.es\//i.test(url)){
   var ineProxyOk=false,ineProxyErr=null;
   var ineProxies=[
    "https://api.allorigins.win/raw?url="+encodeURIComponent(url),
    "https://corsproxy.io/?url="+encodeURIComponent(url),
    "https://api.codetabs.com/v1/proxy?quest="+encodeURIComponent(url)
   ];
   for(var ip=0;ip<ineProxies.length&&!ineProxyOk;ip++){try{var pr=await fetch(ineProxies[ip],{cache:"no-store"});if(pr.ok){r=pr;ineProxyOk=true}else ineProxyErr=new Error("HTTP "+pr.status)}catch(e2){ineProxyErr=e2}}
   if(!ineProxyOk)throw new Error("No s'ha pogut connectar amb l'API. "+(ineProxyErr&&ineProxyErr.message||"Failed to fetch")+" · "+url)
  }else throw new Error("No s'ha pogut connectar amb l'API. "+(e&&e.message||"Failed to fetch")+" · "+url)
}
if(state.provider==="ige"&&/^https:\/\/(?:www\.)?ige\.gal\/igebdt\//i.test(url)&&r&&!r.ok){
  var igeOk2=false,igeErr2=null;
  var igeProx2=[
   "https://cors.tools/proxy?url="+encodeURIComponent(url),
   "https://api.allorigins.win/raw?url="+encodeURIComponent(url),
   "https://api.codetabs.com/v1/proxy?quest="+encodeURIComponent(url)
  ];
  for(var ig2=0;ig2<igeProx2.length&&!igeOk2;ig2++){
   try{
    var igr2=await fetch(igeProx2[ig2],{cache:"no-store"});
    if(igr2.ok){
     var t2=await igr2.clone().text();
     var s2=String(t2||"").replace(/^\uFEFF/,"").trim();
     if(s2&&s2[0]!=="<"){r=igr2;igeOk2=true}
     else igeErr2=new Error("Proxy HTML invàlid");
    }else igeErr2=new Error("HTTP "+igr2.status);
   }catch(e5){igeErr2=e5}
  }
  if(!igeOk2)throw new Error("No s'ha pogut connectar amb l'API de l'IGE. "+(igeErr2&&igeErr2.message||("HTTP "+r.status))+" · "+url);
}
if(state.provider==="istac"&&/^https:\/\/datos\.canarias\.es\/api\/estadisticas\//i.test(url)&&r&&!r.ok){
  var istacOk=false,istacErr=null;
  var istacProxies=[
   "https://cors.tools/proxy?url="+encodeURIComponent(url),
   "https://api.allorigins.win/raw?url="+encodeURIComponent(url),
   "https://api.codetabs.com/v1/proxy?quest="+encodeURIComponent(url)
  ];
  for(var ipi=0;ipi<istacProxies.length&&!istacOk;ipi++){
   try{
    var ipr=await fetch(istacProxies[ipi],{cache:"no-store"});
    if(ipr.ok){
     var itx=await ipr.clone().text();
     var itr=String(itx||"").replace(/^\uFEFF/,"").trim();
     if(itr&&itr[0]!=="<"){r=ipr;istacOk=true}
     else istacErr=new Error("Proxy HTML invàlid");
    }else istacErr=new Error("HTTP "+ipr.status);
   }catch(e4){istacErr=e4}
  }
  if(!istacOk)throw new Error("No s'ha pogut connectar amb l'API d'ISTAC. "+(istacErr&&istacErr.message||("HTTP "+r.status))+" · "+url);
}
if(state.provider==="ine"&&/^https:\/\/servicios\.ine\.es\//i.test(url)&&!r.ok){
  var ineProxyOk2=false,ineProxyErr2=null;
  var ineProxies2=[
   "https://api.allorigins.win/raw?url="+encodeURIComponent(url),
   "https://corsproxy.io/?url="+encodeURIComponent(url),
   "https://api.codetabs.com/v1/proxy?quest="+encodeURIComponent(url)
  ];
  for(var ip2=0;ip2<ineProxies2.length&&!ineProxyOk2;ip2++){try{var pr2=await fetch(ineProxies2[ip2],{cache:"no-store"});if(pr2.ok){r=pr2;ineProxyOk2=true}else ineProxyErr2=new Error("HTTP "+pr2.status)}catch(e3){ineProxyErr2=e3}}
  if(!ineProxyOk2)throw new Error("No s'ha pogut connectar amb l'API. "+(ineProxyErr2&&ineProxyErr2.message||"HTTP "+r.status)+" · "+url)
}
var text="";
try{
  // L'API de dades de l'IGE (json/datos) retorna ISO-8859-1; metadatos sol ser UTF-8.
  // Fem decodificació explícita per evitar "A Coru�a".
  if(state.provider==="ige"||/ige\.gal\/igebdt\/igeapi\//i.test(String(url))){
   var buf=await r.arrayBuffer();
   var bytes=new Uint8Array(buf);
   var utf8=new TextDecoder("utf-8").decode(bytes);
   if(/\/json\/datos\//i.test(String(url))||utf8.indexOf("\uFFFD")>=0||/\uFFFD/.test(utf8)){
    text=new TextDecoder("iso-8859-1").decode(bytes);
   }else{
    text=utf8;
   }
  }else{
   text=await r.text();
  }
}catch(e){throw new Error("No s'ha pogut llegir la resposta de l'API (HTTP "+r.status+").")}
// ONS: de vegades arriba HTML amb HTTP 200
if((state.provider==="nomis"||/nomisweb\.co\.uk\//i.test(String(url)))&&String(text||"").replace(/^\uFEFF/,"").trim().charAt(0)==="<"){
  var nomisProxies=[
    "https://cors.tools/proxy?url="+encodeURIComponent(url),
    "https://api.allorigins.win/raw?url="+encodeURIComponent(url),
    "https://api.codetabs.com/v1/proxy?quest="+encodeURIComponent(url)
  ];
  var got=false,lastN=null;
  for(var ni=0;ni<nomisProxies.length&&!got;ni++){
    try{
      var nr=await fetch(nomisProxies[ni],{cache:"no-store"});
      if(!nr.ok){lastN=new Error("HTTP "+nr.status);continue}
      var nt=await nr.text();
      var ns=String(nt||"").replace(/^\uFEFF/,"").trim();
      if(ns&&ns.charAt(0)!=="<"){text=ns;r=nr;got=true}
      else lastN=new Error("Proxy HTML");
    }catch(ne){lastN=ne}
  }
  if(!got)throw new Error("ONS: s'ha rebut una pàgina HTML en lloc de JSON. "+(lastN&&lastN.message||"")+" · "+url);
}
var d=null;try{var cleanText=String(text).replace(/^\uFEFF/,"").trim();d=cleanText?JSON.parse(cleanText):null;if(d&&typeof d.contents==="string"){try{d=JSON.parse(String(d.contents).replace(/^\uFEFF/,"").trim())}catch(_){}}}catch(e){if(state.provider==="istac"&&r.ok){try{var m0=String(text).match(/\{[\s\S]*\}/);if(m0)d=JSON.parse(m0[0])}catch(_){}}if(!d){if(!r.ok)throw new Error("Error HTTP "+r.status+": "+text.slice(0,300));throw new Error("Resposta no vàlida de l'API (HTTP "+r.status+"). "+String(text||"").replace(/\s+/g," ").slice(0,180))}}
if(!r.ok||d&&(d.class==="error"||d.error||d.errors)){
 var detail=d&&(d.detail||d.label||d.message||d.error||d.errors||d.title);
 if(detail&&typeof detail==="object"){if(Array.isArray(detail))detail=detail.map(function(x){return x&&typeof x==="object"?String(x.message||x.detail||x.error||JSON.stringify(x)):String(x)}).join(" · ");else detail=detail.message||detail.detail||detail.error||JSON.stringify(detail)}
 throw new Error(String(detail||"Error HTTP "+r.status+"."));
}
return d}
function a(d){if(Array.isArray(d))return d;if(d&&Array.isArray(d.data))return d.data;if(d&&Array.isArray(d.items))return d.items;if(d&&Array.isArray(d.result))return d.result;return[]}
function f(o){for(var i=1;i<arguments.length;i++){var k=arguments[i];if(o&&o[k]!=null)return o[k]}return""}
function fill(sel,items,ph){if(!sel)return;var old=sel.value;sel.innerHTML="";if(ph!==null)sel.append(new Option(ph||"— Selecciona —",""));(items||[]).forEach(function(x){sel.append(new Option(x.label||x.value,x.value))});if([].slice.call(sel.options).some(function(o){return o.value===old}))sel.value=old}
function resetSelect(id){if($(id)){$(id).innerHTML='<option value="">— Selecciona —</option>';$(id).disabled=true}}
function busy(v){document.body.classList.toggle("busy",v)}
function status(s,t){var msg=s==null?"":String(s);if(msg==="Cannot read properties of undefined (reading 'id')"){var st="";try{st=String(new Error().stack||"").split("\n").slice(1,7).join(" | ")}catch(_){ }msg=msg+" [DEBUG 27]"+(st?" · CAPTURAT A: "+st:"")}$("status").textContent=msg;$("status").className=t||""}
function provider(){var p={idescat:{label:"Idescat",base:"https://api.idescat.cat/taules/v2",doc:"https://www.idescat.cat/dev/api/taules/"},pxweb:{label:"PXWeb",base:"",doc:"https://pxdata.stat.fi/api1.html"},ine:{label:"INE",base:"https://servicios.ine.es/wstempus/js",doc:"https://www.ine.es/OpenAPI/"},eurostat:{label:"Eurostat",base:"https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0",doc:"https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access/"},istac:{label:"Instituto Canario de Estadística (ISTAC)",base:"https://datos.canarias.es/api/estadisticas",doc:"https://www.gobiernodecanarias.org/istac/datos-abiertos/documentacion-api/"},icane:{label:"Instituto Cántabro de Estadística (ICANE)",base:"https://datos.icane.es/api/3/action",doc:"https://datos.icane.es/about"},ige:{label:"Instituto Galego de Estatística (IGE)",base:"https://www.ige.gal/igebdt/igeapi",doc:"https://www.ige.gal/web/mostrar_paxina.jsp?idioma=es&paxina=004015"},nomis:{label:"UK - Office for National Statistics (ONS)",base:"https://www.nomisweb.co.uk/api/v01",doc:"https://www.nomisweb.co.uk/api/v01/help"},dst:{label:"Statistics Denmark",base:"https://api.statbank.dk/v1",doc:"https://www.dst.dk/en/Statistik/hjaelp-til-statistikbanken/api"},cso:{label:"Central Statistics Office (Ireland)",base:"https://ws.cso.ie/public",doc:"https://github.com/CSOIreland/PxStat/wiki"}};if(state.provider==="pxweb"){var x={finland:"https://pxdata.stat.fi/PxWeb/api/v1/en/StatFin",sweden:"https://api.scb.se/OV0104/v1/doris/en/ssd",unece:"https://w3.unece.org/PXWeb2015/api/v1/en/STAT",iceland:"https://px.hagstofa.is/pxen/api/v1/en",eustat:"https://www.eustat.eus/bankupx/api/v1/es/DB",norway:"https://data.ssb.no/api/pxwebapi/v2",greenland:"https://bank.stat.gl/api/v1/en/Greenland"};p.pxweb.base=x[state.pxPreset]||x.finland}return p[state.provider]}
function jsonstatCats(ds,id){var c=ds.dimension&&ds.dimension[id]&&ds.dimension[id].category||{},lab=c.label&&typeof c.label==="object"?c.label:{};if(Array.isArray(c.index))return c.index.map(function(code,i){return{code:String(code),label:String(lab[code]==null?code:lab[code]),index:i}});if(c.index&&typeof c.index==="object")return Object.keys(c.index).map(function(code){return{code:String(code),label:String(lab[code]==null?code:lab[code]),index:Number(c.index[code])}}).sort(function(x,y){return x.index-y.index});return Object.keys(lab).map(function(code,i){return{code:String(code),label:String(lab[code]),index:i}})}
function dims(ds){return(ds&&Array.isArray(ds.id)?ds.id:[]).filter(function(id){return id!=null&&String(id)!==""}).map(function(id){var d=ds&&ds.dimension&&ds.dimension[id]||{};return{id:String(id),label:d.label||id,role:d.extension&&d.extension.role||d.role||"",categories:jsonstatCats(ds,String(id))}})}
function temporal(d){
 var id=String(d&&d.id||"").trim().toUpperCase(),
     label=String(d&&d.label||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase(),
     r=String(d&&d.role||"").toUpperCase(),
     cats=d&&Array.isArray(d.categories)?d.categories:[];
 var explicit=["YEAR","MONTH","QUARTER","SEMESTER","BIMONTH","WEEK","DAY","DATE","TIME","TIME_PERIOD","PERIOD","PERIODO","PERIODO_TEMPORAL"].indexOf(id)>=0;
 var named=id.indexOf("TIME")===0||id.indexOf("PER")===0||label==="PERIODO"||label.indexOf("PERIODO ")===0||label==="PERIOD"||label.indexOf("PERIOD ")===0||label.indexOf("TEMPORAL")>=0||label==="TEMPO"||label.indexOf("TEMPO ")===0||label==="TIEMPO"||label.indexOf("TIEMPO ")===0||label==="TIME"||label.indexOf("TIME ")===0||label.indexOf("YEAR")>=0||label.indexOf("MONTH")>=0||label.indexOf("QUARTER")>=0||label.indexOf("SEMESTER")>=0||label.indexOf("TRIMESTRE")>=0||label.indexOf("MES")===0||label.indexOf("AÑO")>=0||label.indexOf("ANO")>=0||label.indexOf("YEAR")>=0||r.indexOf("TIME")>=0||r.indexOf("TEMPOR")>=0;
 var temporalCodes=cats.length>0&&cats.every(function(c){
   var code=String(c&&c.code||"").trim(),lab=String(c&&c.label||"").trim();
   return /^\d{4}$/.test(code)||/^\d{4}M\d{1,2}$/i.test(code)||/^\d{4}(?:Q|T)\d$/i.test(code)||/^\d{4}S\d$/i.test(code)||/^\d{4}B\d{1,2}$/i.test(code)||/^\d{4}W\d{1,2}$/i.test(code)||/^\d{4}D\d{1,3}$/i.test(code)||/^\d{4}-(?:M|Q|S|B|W|D)\d{1,3}$/i.test(code)||/^\d{4}-\d{2}(?:-\d{2})?$/.test(code)||
          // IGE: 202615 = 2026/III, 202514 = 2025/II, etc.
          /^\d{6}$/.test(code)||
          /^\d{4}\s*[/.-]\s*(?:I{1,3}|IV|1[3-6]|[1-4])$/i.test(lab)||
          /^\d{4}\s*[/.-]\s*(?:I{1,3}|IV)$/i.test(code)||
          /^(?:Q|T|S|M|B|W|D)\s*\d{1,3}\s*[-/]?\s*\d{4}$/i.test(lab)||
          /^\d{4}\s*[-/]?\s*(?:Q|T|S|M|B|W|D)\s*\d{1,3}$/i.test(lab)||
          /^\d{4}\s*[-/]?\s*\d{1,2}[-/]\d{1,2}$/.test(lab);
 });
 return explicit||named||temporalCodes;
}
function temporalCodeRank(code){
 var v=String(code==null?"":code).trim().toUpperCase(),m;
 if(/^\d+$/.test(v))return Number(v);
 if(/^\d{4}$/.test(v))return Number(v)*100000000;
 m=v.match(/^(\d{4})M(\d{1,2})$/);if(m)return Number(m[1])*100000000+Number(m[2])*1000000;m=v.match(/^(\d{4})-M(\d{1,2})$/);if(m)return Number(m[1])*100000000+Number(m[2])*1000000;
 m=v.match(/^(\d{4})(?:Q|T)(\d)$/);if(m)return Number(m[1])*100000000+Number(m[2])*10000000;m=v.match(/^(\d{4})-Q(\d)$/);if(m)return Number(m[1])*100000000+Number(m[2])*10000000;
 m=v.match(/^(\d{4})S(\d)$/);if(m)return Number(m[1])*100000000+Number(m[2])*10000000;m=v.match(/^(\d{4})-S(\d)$/);if(m)return Number(m[1])*100000000+Number(m[2])*10000000;
 m=v.match(/^(\d{4})B(\d{1,2})$/);if(m)return Number(m[1])*100000000+Number(m[2])*1000000;
 m=v.match(/^(\d{4})W(\d{1,2})$/);if(m)return Number(m[1])*100000000+Number(m[2])*1000000;
 m=v.match(/^(\d{4})D(\d{1,3})$/);if(m)return Number(m[1])*100000000+Number(m[2])*1000000;
 m=v.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);if(m)return Number(m[1])*100000000+Number(m[2])*1000000+Number(m[3]||0);
 // IGE trimestral: 202615 → 2026 T3; 202516 → 2025 T4 (sufix 13-16)
 m=v.match(/^(\d{4})(1[3-6])$/);if(m)return Number(m[1])*100000000+(Number(m[2])-12)*10000000;
 // IGE etiqueta 2026/III, 2025/I, 2024/IV
 m=v.match(/^(\d{4})\s*[/.-]\s*(I{1,3}|IV)$/i);
 if(m){var q={I:1,II:2,III:3,IV:4}[m[2].toUpperCase()]||0;return Number(m[1])*100000000+q*10000000}
 return null;
}
function sortedCats(c,d){
 var x=c.slice();
 if(temporal(d)){
  x.sort(function(a,b){
   var ac=temporalCategoryCode(a),bc=temporalCategoryCode(b);
   var ar=temporalCodeRank(ac),br=temporalCodeRank(bc);
   if(ar!=null&&br!=null&&ar!==br)return br-ar;
   return Number(b.index)-Number(a.index);
  });
 }else x.sort(function(a,b){return Number(a.index)-Number(b.index)});
 return x;
}
async function fetchText(url,opt){
 opt=opt||{};var r=null,last=null;
 try{r=await fetch(url,opt);if(r.ok)return await r.text();last=new Error("HTTP "+r.status)}catch(e){last=e}
 var proxies=[
  "https://cors.tools/proxy?url="+encodeURIComponent(url),
  "https://api.allorigins.win/raw?url="+encodeURIComponent(url),
  "https://api.allorigins.win/get?url="+encodeURIComponent(url),
  "https://api.codetabs.com/v1/proxy?quest="+encodeURIComponent(url),
  "https://corsproxy.io/?url="+encodeURIComponent(url),
  "https://cors.isomorphic-git.org/"+url
 ];
 for(var i=0;i<proxies.length;i++){
  try{
   var pr=await fetch(proxies[i],{cache:"no-store"});
   if(!pr.ok){last=new Error("HTTP "+pr.status);continue}
   var txt=await pr.text();
   try{
    var jd=JSON.parse(txt);
    if(jd&&typeof jd.contents==="string")txt=jd.contents;
   }catch(e){}
   if(txt)return txt;
  }catch(e2){last=e2}
 }
 throw new Error("No s'ha pogut carregar la pàgina. "+(last&&last.message||"Failed to fetch")+" · "+url);
}
async function loadIneNavigation(){
 if(state.ineNavLoaded&&Array.isArray(state.ineNav)&&state.ineNav.length)return;
 var d=null;
 try{
  var r=await fetch("data/inebase-navigation.json",{cache:"no-store"});
  if(r.ok)d=await r.json();
 }catch(e){}
 if(!Array.isArray(d)||!d.length)throw new Error("No s'ha pogut carregar la navegació d'INEbase.");
 state.ineNav=d.map(function(x){
  return{
   name:String(x.name||"").trim(),
   href:String(x.href||"").trim(),
   group:String(x.group||"").trim(),
   topic:String(x.topic||"").trim()
  };
 }).filter(function(x){return x.name&&x.href&&x.group&&x.topic});
 state.ineNavLoaded=true;
}

function tDocTitle(doc,capsel){
 if(!doc)return"";
 var h=null;
 if(capsel)h=doc.querySelector('h1.inebase_titulo[id="c_'+String(capsel)+'"]');
 if(!h)h=doc.querySelector("h1.inebase_titulo");
 if(!h)h=doc.querySelector("h1");
 if(!h)return"";
 return String(h.textContent||"").replace(/\s+/g," ").trim();
}
/** Neteja títols de secció INE contaminats per proxies markdown/HTML. */

async function loadIneOperations(){
 if(Array.isArray(state.ineOperations)&&state.ineOperations.length)return;
 var d=await fetchJson("https://servicios.ine.es/wstempus/jsCache/ES/OPERACIONES_DISPONIBLES?det=2");
 state.ineOperations=a(d);
 if(!state.ineOperations.length)throw new Error("INE: no s'han trobat operacions disponibles a Tempus3.");
}


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
function clearQueryView(){state.pivot={rows:[],columns:[]};state.lastData=null;state.filters.clear();$("filters").innerHTML="";$("results").innerHTML='<div class="empty">Selecciona una taula i fes la consulta.</div>';if($("pivotBuilder"))$("pivotBuilder").innerHTML='<div class="empty">Selecciona una taula i fes la consulta.</div>';$("exportCsv").disabled=true;$("exportXlsx").disabled=true;$("addToCart").disabled=true;$("resultCount").textContent="";if($("temporalOrderWrap"))$("temporalOrderWrap").hidden=true;if($("cellInfo")){$("cellInfo").hidden=true;$("cellInfo").innerHTML=""}}
function clearBelow(keepStat){state.pivot={rows:[],columns:[]};if(state.provider==="ine")ineClearNavigation();if(!keepStat)fill($("stat"),[]);["concept","cross","node","table","geo"].forEach(resetSelect);eurostatClearLevels();state.metadata=null;clearQueryView();$("query").disabled=true;$("tableInfo").hidden=true;$("cellInfo").hidden=true}
function setLabels(){var p=state.provider,ls=p==="idescat"?["Organisme","Operació estadística","Tema","Encreuament","Entrada","Taula","Geografia"]:p==="istac"?["Organisme","Tema","Operació estadística","Taula","—","—"]:p==="pxweb"&&state.pxPreset==="sweden"?["Organisme","Grup temàtic","Nivell 2","Nivell 3","Taula","Geografia"]:p==="pxweb"&&state.pxPreset==="norway"?["Organisme","Grup temàtic","Nivell 2","Nivell 3","Nivell 4","Geografia"]:p==="pxweb"&&state.pxPreset?["Organisme","Grup temàtic","Nivell 2","Nivell 3","Taula","Geografia"]:p==="pxweb"?["Organisme","—","","","",""]:p==="ine"?["Organisme","Grup temàtic","","","","",""]:p==="nomis"?["Organisme","Grup temàtic","Dataset","","",""]:p==="dst"?["Organisme","Tema","Taula","","",""]:p==="cso"?["Organisme","Tema","Subjecte","Producte","Taula",""]:p==="ige"?["Organisme","Grup temàtic","Tema","Taula","—","—"]:["Organisme","Grup temàtic","Tema","Estadística","—","—"];var l=document.querySelectorAll("#step2 > .grid > label");var o1=document.querySelector("#step1 label:nth-child(1)");if(o1&&o1.firstChild)o1.firstChild.textContent=ls[0]+" ";l.forEach(function(x,i){if(x.firstChild&&ls[i+1]!=null)x.firstChild.textContent=ls[i+1]+" "})}
function recursiveProxyClearFrom(index){
 var box=$("eurostatLevels");if(!box)return;
 Array.from(box.querySelectorAll("[data-recursive-proxy]")).forEach(function(el){
  if(Number(el.dataset.recursiveProxy)>=Number(index))el.remove();
 });
}
function addUniversalRootLevel(items,labelText,onChange){var box=$("eurostatLevels");if(!box)return;box.innerHTML="";box.hidden=false;box.style.display="grid";var lab=document.createElement("label");lab.style.display="flex";lab.style.flexDirection="column";lab.style.alignItems="stretch";lab.appendChild(document.createTextNode((labelText!=null&&labelText!==""?labelText:"Opcions")+" "));var sel=document.createElement("select");sel.id="universalRootLevel";sel.appendChild(new Option("— Selecciona —",""));(items||[]).forEach(function(x){sel.appendChild(new Option(String(x.label||x.value||""),String(x.value||"")))});lab.appendChild(sel);box.appendChild(lab);sel.onchange=async function(){clearQueryView();if(!sel.value)return;try{await onChange(sel.value)}catch(e){status(e&&e.message?String(e.message):String(e),"error")}};if((items||[]).length===1){sel.value=String(items[0].value||"");sel.onchange()}}
function recursiveProxyStart(kind){
 var box=$("eurostatLevels");if(!box)return;
 var defs=kind==="idescat"
  ?[{id:"stat",label:"Operació estadística"},{id:"concept",label:"Tema"},{id:"cross",label:"Encreuament"},{id:"node",label:"Entrada"},{id:"table",label:"Taula"},{id:"geo",label:"Geografia"}]
  :[{id:"stat",label:"Tema"},{id:"concept",label:"Operació estadística"},{id:"cross",label:"Taula"}];
 function optionsFor(id){
  var orig=$(id);return orig?Array.from(orig.options||[]).filter(function(o){return o.value!==""}):[];
 }
 function draw(level){
  box.innerHTML="";box.hidden=false;box.style.display="grid";
  for(var i=0;i<=level&&i<defs.length;i++){
   var def=defs[i],orig=$(def.id),opts=optionsFor(def.id);if(!orig||!opts.length)break;
   var lab=document.createElement("label");lab.dataset.recursiveProxy=String(i);
   lab.style.display="flex";lab.style.flexDirection="column";lab.style.alignItems="stretch";
   lab.appendChild(document.createTextNode(def.label+" "));
   var sel=document.createElement("select");sel.appendChild(new Option("— Selecciona —",""));
   opts.forEach(function(o){sel.appendChild(new Option(o.textContent,o.value))});
   if(orig.value&&opts.some(function(o){return o.value===orig.value}))sel.value=orig.value;
   lab.appendChild(sel);box.appendChild(lab);
   (function(index,original,proxy){
    proxy.onchange=async function(){
     clearQueryView();
     if(!proxy.value)return;
     original.value=proxy.value;
     try{
      await original.onchange();
      var last=index;
      for(var j=index+1;j<defs.length;j++){
       var oo=$(defs[j].id),op=optionsFor(defs[j].id);
       if(!oo||!op.length)break;
       last=j;
       if(!oo.value)break;
      }
      draw(last);
     }catch(e){status(e&&e.message?String(e.message):String(e),"error")}
    };
   })(i,orig,sel);
  }
 }
 var highest=0;
 for(var k=0;k<defs.length;k++){
  var o=$(defs[k].id),opts=optionsFor(defs[k].id);
  if(!o||!opts.length)break;
  highest=k;
  if(!o.value)break;
 }
 draw(highest);
}

function setProviderUI(){
 setLabels();
 var isEuro=state.provider==="eurostat",
     isIne=state.provider==="ine",
     isIstac=state.provider==="istac",
     isIcane=state.provider==="icane",
     isIge=state.provider==="ige",
     isNomis=state.provider==="nomis",
     isDst=state.provider==="dst",
     isCso=state.provider==="cso",
     isIdescat=state.provider==="idescat",
     isSweden=state.provider==="pxweb"&&state.pxPreset==="sweden",
     isFinland=state.provider==="pxweb"&&state.pxPreset==="finland",
     isIceland=state.provider==="pxweb"&&state.pxPreset==="iceland",
     isGreenland=state.provider==="pxweb"&&state.pxPreset==="greenland",
     isNorway=state.provider==="pxweb"&&state.pxPreset==="norway",
     isEustat=state.provider==="pxweb"&&state.pxPreset==="eustat",
     isUnece=state.provider==="pxweb"&&state.pxPreset==="unece";
 var isOtherProv=state.provider==="pxweb"||isIstac||isIcane||isIge||isNomis||isDst||isCso;

 if($("provider")&&isOtherProv&&[].slice.call($("provider").options).some(function(o){return o.value==="other"})){
  $("provider").value="other";
 }
 var otherBox=$("otherProviderWrap");
 if(otherBox)otherBox.hidden=!($("provider")&&$("provider").value==="other");
 if($("otherProvider")){
  var ov="";
  if(isIstac)ov="istac";
  else if(isIcane)ov="icane";
  else if(isIge)ov="ige";
  else if(isNomis)ov="nomis";
  else if(isDst)ov="dst";
  else if(isCso)ov="cso";
  else if(state.provider==="pxweb"&&state.pxPreset)ov="pxweb:"+state.pxPreset;
  if(ov)$("otherProvider").value=ov;
 }

 var fixedGrid=document.querySelector("#step2>.grid"),euroBox=$("eurostatLevels");
 if(fixedGrid){
  fixedGrid.hidden=false;
  fixedGrid.style.display="";
  var labels=Array.from(fixedGrid.querySelectorAll(":scope > label"));
  function showOnly(indexes){
   var set={};
   (indexes||[]).forEach(function(ix){set[ix]=true});
   labels.forEach(function(l,ix){l.style.display=set[ix]?"":"none"});
  }
  function hideAll(){labels.forEach(function(l){l.style.display="none"});}

  // Navegació només amb #eurostatLevels
  if(isEuro||isIne||isIstac||isIcane||isIge||isNomis||isDst||isCso){
   hideAll();
  }else if(isSweden||isFinland||isIceland||isGreenland||isEustat||isNorway||isUnece){
   // PxWeb / SSB: només el selector arrel del grid; la resta va a eurostatLevels o es va revelant
   showOnly([0]);
  }else if(isIdescat){
   updateIdescatLevelVisibility();
  }else if(state.provider==="pxweb"&&!state.pxPreset){
   hideAll();
  }else{
   hideAll();
  }
 }
 if(euroBox){
  euroBox.hidden=!(isEuro||isIstac||isIcane||isIge||isNomis||isDst||isCso||isSweden||isFinland||isIceland||isGreenland||isNorway||isUnece||isIne||isEustat);
 }
}


function updateIdescatLevelVisibility(){
 if(state.provider!=="idescat")return;
 var fixedGrid=document.querySelector("#step2>.grid");
 if(!fixedGrid)return;
 var order=["stat","concept","cross","node","table","geo"];
 var labels=Array.from(fixedGrid.querySelectorAll(":scope > label"));
 var lastActive=-1;
 order.forEach(function(id,i){
  var sel=$(id);
  if(!sel)return;
  var hasChoice=sel.options&&sel.options.length>1; // més que el placeholder
  var enabled=!sel.disabled;
  // Mostra si és el primer, o si ja hi ha opcions / està habilitat, o és el següent pas després d'una selecció
  var show=false;
  if(i===0)show=true; // operació estadística sempre visible
  else if(hasChoice&&enabled)show=true;
  else if(lastActive===i-1&&$(order[i-1])&&$(order[i-1]).value)show=true;
  if(show)lastActive=i;
  if(labels[i])labels[i].style.display=show?"":"none";
 });
}


function igeClearLevels(){
 var box=$("eurostatLevels");if(box){box.innerHTML="";box.hidden=true}
 state.igePath=[];state.igeItems.clear();state.igeSelector=null;
}
function igeAddLevel(items,index,labelText){
 var box=$("eurostatLevels");if(!box)return;
 var list=(items||[]).filter(function(x){return x&&x.id&&x.label});
 if(!list.length)return;
 var lab=document.createElement("label");lab.dataset.igeLevel=String(index);lab.style.display="flex";lab.style.flexDirection="column";lab.style.alignItems="stretch";
 lab.appendChild(document.createTextNode((labelText!=null&&labelText!==""?labelText:"Opcions")+" "));
 var sel=document.createElement("select");sel.appendChild(new Option("— Selecciona —",""));
 list.forEach(function(x){sel.appendChild(new Option(x.label,x.id))});
 lab.appendChild(sel);box.appendChild(lab);box.hidden=false;box.style.display="grid";
 state.igeItems.set("igeLevel"+index,list);
 sel.onchange=async function(){
  clearQueryView();if(!sel.value)return;
  try{await igeSelectDynamic(index,sel.value)}catch(e){var msg=String(e&&e.message||e);var pre=state.provider==="nomis"?"ONS: ":"IGE: ";if(/^(IGE|ONS):/i.test(msg))pre="";status(pre+msg,"error")}
 };
 if(list.length===1){sel.value=list[0].id;sel.onchange()}
}
async function igeSelectDynamic(index,val){
 var items=state.igeItems.get("igeLevel"+index)||[],item=items.find(function(x){return String(x.id)===String(val)});
 if(!item)throw new Error(state.provider==="nomis"?"ONS: element no trobat.":(state.provider==="dst"?"Statistics Denmark: element no trobat.":(state.provider==="cso"?"CSO Ireland: element no trobat.":"No s'ha trobat l'element seleccionat de l'IGE.")));
 var box=$("eurostatLevels");
 if(box)Array.from(box.querySelectorAll("[data-ige-level]")).forEach(function(l){if(Number(l.dataset.igeLevel)>index)l.remove()});
 state.igePath=state.igePath.slice(0,index+1);state.igePath[index]=item.id;
 if(/^nomis-/.test(String(item.type||""))){await nomisSelectFromLevel(index,val);return}
 if(/^dst-/.test(String(item.type||""))){await dstSelectFromLevel(index,val);return}
 if(/^cso-/.test(String(item.type||""))){await csoSelectFromLevel(index,val);return}
 if(item.type==="table"){await igeSelectTable(item);return}
 if(item.type==="ige-indicator"||item.type==="ige-series"){await igeSelectIndiOrSeries(item);return}
 if(item.type==="ige-mode"){
  state.igeMode=item.mode;
  if(item.mode==="tables"){
   status("Carregant grups temàtics de l'IGE…");
   var roots=await igeLoadRoot();
   igeAddLevel(roots,index+1,"Grup temàtic");
   status("");
   return;
  }
  if(item.mode==="indicators"){
   status("Carregant grups d'indicadors…");
   var igroups=await igeLoadIndicatorGroups();
   igeAddLevel(igroups,index+1,"Grup d'indicadors");
   status("");
   return;
  }
  if(item.mode==="series"){
   status("Carregant grups de sèries…");
   var sgroups=await igeLoadSeriesGroups();
   igeAddLevel(sgroups,index+1,"Grup de sèries");
   status("");
   return;
  }
 }
 if(item.type==="ige-indicator-group"){
  status("Carregant indicadors…");
  var indis=await igeLoadIndicators(item.code);
  igeAddLevel(indis,index+1,"Indicador");
  status("");
  return;
 }
 if(item.type==="ige-series-group"){
  status("Carregant subgrups de sèries…");
  var subs=await igeLoadSeriesSubgroups(item.code);
  if(subs.length){
   // Pot barrejar subcarpetes (ige-series-group) i subgrups fulla
   var onlyFolders=subs.every(function(x){return x.type==="ige-series-group"});
   var onlyLeaves=subs.every(function(x){return x.type==="ige-series-subgroup"});
   var caption=onlyFolders?"Subtema":(onlyLeaves?"Subgrup":"Apartat");
   igeAddLevel(subs,index+1,caption);
   status("");
   return;
  }
  var series=await igeLoadSeriesList(item.code,null);
  if(series.length){igeAddLevel(series,index+1,"Sèrie");status("");return}
  throw new Error("no s'han trobat sèries en aquest grup.");
 }
 if(item.type==="ige-series-subgroup"){
  status("Carregant sèries…");
  var series2=await igeLoadSeriesList(item.groupCode,item.code);
  igeAddLevel(series2,index+1,"Sèrie");
  status("");
  return;
 }
 if(item.type==="group"&&Array.isArray(item._children)&&item._children.length){
  igeAddLevel(item._children,index+1,"Tema");
  status("");
  return;
 }
 status("Consultant l'IGE…");
 var children=await igePageItems(item.url,false);
 var parentCode=String(item.code||"").trim();
 var pathIds=new Set(state.igePath.slice(0,index+1).map(function(x){return String(x)}));
 var pathCodes=new Set();
 for(var pi=0;pi<=index;pi++){
  var prev=state.igeItems.get("igeLevel"+pi)||[];
  var prevItem=prev.find(function(x){return String(x.id)===String(state.igePath[pi])});
  if(prevItem&&prevItem.code)pathCodes.add(String(prevItem.code).trim());
 }
 var currentLabels=new Set((items||[]).map(function(x){return String(x.label||"").trim().toLowerCase()}));

 function isDescendantCode(code){
  code=String(code||"").trim();
  if(!code||!parentCode)return !!code;
  if(code.indexOf(parentCode)===0&&code.length>parentCode.length)return true;
  if(parentCode.length<=2&&code.indexOf(parentCode)===0&&code.length>parentCode.length)return true;
  return false;
 }
 function sameBranch(code){
  code=String(code||"").trim();
  if(!code||!parentCode)return true;
  if(isDescendantCode(code))return true;
  return code.slice(0,2)===parentCode.slice(0,2)&&code.length>=4;
 }

 // —— Taules: principals (principais.jsp) vs catàleg complet (bancodatos) ——
 if(item.type==="activity"||item.type==="ige-more-tables"){
  var featured=children.filter(function(x){return x.type==="table"&&x.featured&&!igeIsNoiseLabel(x.label)});
  // Dedup featured by code
  var seenF=new Set();
  featured=featured.filter(function(x){var k=String(x.code);if(seenF.has(k))return false;seenF.add(k);return true});
  featured.sort(function(a,b){return a.label.localeCompare(b.label,"gl",{numeric:true})});

  if(item.type==="ige-more-tables"||(!featured.length&&item.type==="activity")){
   // Catàleg complet des del banc de dades
   status("Carregant el catàleg de taules de l'IGE…");
   var allTables=[];
   try{
    var bancoCode=parentCode||String(item.code||"").trim();
    if(item.type==="ige-more-tables"&&item.activityCode)bancoCode=String(item.activityCode);
    var bancoUrl="https://www.ige.gal/igebdt/bancodatos/?idioma=es&API=true&codigo="+encodeURIComponent(bancoCode);
    var bancoItems=await igePageItems(bancoUrl,false);
    var seenA=new Set();
    bancoItems.forEach(function(x){
     if(x.type!=="table"||igeIsNoiseLabel(x.label))return;
     var k=String(x.code||"");
     if(!k||seenA.has(k))return;
     seenA.add(k);
     allTables.push({id:"ige-tab-"+k,label:x.label,type:"table",url:x.url,code:k,featured:false});
    });
   }catch(eBanco){}
   // Afegeix també les que hi hagués a la pàgina d'activitat
   children.filter(function(x){return x.type==="table"}).forEach(function(x){
    var k=String(x.code||"");
    if(!k||seenA&&seenA.has(k))return;
    if(!seenA)seenA=new Set();
    seenA.add(k);
    allTables.push({id:"ige-tab-"+k,label:x.label,type:"table",url:x.url,code:k,featured:!!x.featured});
   });
   allTables.sort(function(a,b){return a.label.localeCompare(b.label,"gl",{numeric:true})});
   if(allTables.length){
    igeAddLevel(allTables,index+1,"Taula");
    status("");
    return;
   }
   throw new Error("no s'han trobat taules en aquest apartat.");
  }

  // Hi ha taules principals: primer desplegable + opció "Més taules"
  if(featured.length){
   var moreOpt={
    id:"ige-more-"+parentCode,
    label:"Més taules",
    type:"ige-more-tables",
    url:item.url,
    code:parentCode,
    activityCode:parentCode
   };
   var principalList=featured.concat([moreOpt]);
   igeAddLevel(principalList,index+1,"Taules principals");
   status("");
   return;
  }
 }

 var tables=children.filter(function(x){return x.type==="table"&&!igeIsNoiseLabel(x.label)});
 if(tables.length){
  tables.sort(function(a,b){return a.label.localeCompare(b.label,"gl",{numeric:true})});
  igeAddLevel(tables,index+1,"Taula");
  status("");
  return;
 }

 function pickActivities(strict){
  return children.filter(function(x){
   if(x.type!=="activity")return false;
   if(igeIsNoiseLabel(x.label))return false;
   var id=String(x.id||""),code=String(x.code||"").trim();
   if(pathIds.has(id))return false;
   if(code&&pathCodes.has(code))return false;
   if(strict&&parentCode&&code&&!isDescendantCode(code))return false;
   if(!strict&&parentCode&&code&&!sameBranch(code))return false;
   // Descarta activitats "promocionals" del menú lateral (codi d'una altra branca)
   if(parentCode&&code&&code.length>=4&&parentCode.length>=4&&code.slice(0,4)!==parentCode.slice(0,4)&&!isDescendantCode(code))return false;
   return true;
  });
 }
 function pickSections(strict){
  return children.filter(function(x){
   if(x.type!=="section")return false;
   if(igeIsNoiseLabel(x.label))return false;
   var id=String(x.id||""),code=String(x.code||"").trim();
   var label=String(x.label||"").trim().toLowerCase();
   if(pathIds.has(id))return false;
   if(currentLabels.has(label))return false;
   if(code&&pathCodes.has(code))return false;
   if(strict&&parentCode&&code&&!isDescendantCode(code))return false;
   if(!strict&&parentCode&&code&&!sameBranch(code))return false;
   return true;
  });
 }

 var activities=pickActivities(true);
 var sections=pickSections(true);
 // Fallback menys estricte si el filtre jeràrquic deixa la llista buida
 if(!activities.length&&!sections.length){
  activities=pickActivities(false);
  sections=pickSections(false);
 }
 // Últim recurs: només si el node actual NO és una activitat estadística.
 // En una activitat, les seccions del menú lateral (Benestar, Cultura...) no són filles.
 if(!activities.length&&!sections.length&&item.type!=="activity"){
  activities=children.filter(function(x){
   return x.type==="activity"&&!igeIsNoiseLabel(x.label)&&!pathIds.has(String(x.id||""))&&!pathCodes.has(String(x.code||"").trim());
  });
 }
 // Si el pare és activitat i no hi ha taules, no mostrem seccions del menú
 if(item.type==="activity"){
  sections=[];
 }

 var next=sections.concat(activities);
 // Dedup per codi/label
 var seen=new Set();
 next=next.filter(function(x){
  var k=(x.code||"")+"|"+String(x.label||"").toLowerCase();
  if(seen.has(k))return false;seen.add(k);return true;
 });
 next.sort(function(a,b){return a.label.localeCompare(b.label,"ca",{numeric:true})});
 if(next.length){
  var onlyAct=next.every(function(x){return x.type==="activity"});
  igeAddLevel(next,index+1,onlyAct?"Operació estadística":"Tema");
  status("");
  return;
 }
 throw new Error("no s'han trobat temes ni taules en aquest apartat.");
}
/** Converteix la resposta plana {variables,datos} d'indicadors/sèries a JSON-stat 2.0 */
let ISTAC_THEMES=[]; // omplert des de TEMAS_CANARIAS (nivell arrel)
state.istacThemeMap=state.istacThemeMap||new Map(); // id T010000 → nom


async function loadStats(){
 var loadToken=state.requestToken,loadProvider=state.provider,loadPreset=state.pxPreset;
 state.swedenPath=[];state.swedenV2Table=false;state.norwayPath=[];state.norwayCatalog=[];state.norwayRootItems=[];
 setProviderUI();state.stats=[];state.selected.stat="";fill($("stat"),[]);$("stat").disabled=true;
 if(state.provider==="pxweb"&&!state.pxPreset){
  status("Tria un organisme al desplegable d'Altres.");
  return;
 }
 // INE: mostra la navegació jeràrquica abans de consultar Tempus3.
 if(state.provider==="ine"){
  hideStatSelector(true);
  try{
   await ineSelectRoot();
   // La navegació d'INE és local i jeràrquica; no continuem amb el
   // carregador genèric d'estadístiques, que podria sobreescriure l'estat
   // de navegació acabat de construir.
   if(loadToken!==state.requestToken||loadProvider!==state.provider)return;
   return;
  }catch(e){
   status("INE: "+(e&&e.message?e.message:String(e)),"error");
   return;
  }
 }
 var c=provider(),out=[];
 if(state.provider==="idescat")out=collection(await fetchJson(c.base+"?lang=ca")).map(function(x){return{value:x.id,label:x.id+" · "+x.label}});
 else if(state.provider==="ine"){
 await loadIneNavigation();
 var seenIne=new Set();
 out=(state.ineNav||[]).filter(function(x){if(seenIne.has(x.name))return false;seenIne.add(x.name);return true})
   .map(function(x){return{value:x.name,label:x.name,name:x.name,code:""}});
}
 else if(state.provider==="eurostat"){await loadEurostatTOC();out=state.eurostatRoots.map(function(x){return{value:x.code,label:x.label}})}
 else if(state.provider==="istac"){await istacLoadOperations();out=[]}
 else if(state.provider==="icane"){await icaneLoadCatalog();out=[]}
 else if(state.provider==="ige"){await igeLoadRoot();out=[]}
 else if(state.provider==="nomis"){out=[]}
 else if(state.provider==="dst"){out=[]}
 else if(state.provider==="cso"){out=[]}
 else if(state.pxPreset==="sweden"){await loadSwedenV2Tables();var swRoot=await swedenV2Children([],null);out=swRoot.map(function(x){return{value:x.id,label:x.label}})}
 else if(state.pxPreset==="eustat"){
 var euCatalog=await fetchJson(c.base);
 state.eustatCatalog=a(euCatalog).filter(function(x){return String(f(x,"type","class")).toLowerCase()==="t"||!f(x,"type","class")}).map(function(x){
   var id=String(f(x,"id","code","dbid","path")).trim(),label=String(f(x,"text","label","name","title")||id).trim();
   return{value:id,label:label,id:id,name:label};
 }).filter(function(x){return x.value});
 await eustatLoadOperationTree();
 out=state.eustatGroups.map(function(x){return{value:x.id,label:x.label}});
}
 else if(state.pxPreset==="norway"){await norwayLoadV2Catalog();out=state.norwayRootItems.map(function(x){return{value:x.id,label:x.label}})}
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
else out=a(await fetchJson(c.base)).map(function(x){var id=String(f(x,"id","dbid","code","path")),rawLabel=String(f(x,"text","label","name","title")||id),label=state.pxPreset==="iceland"?icelandEnglishRootLabel(rawLabel):rawLabel;return{value:id,label:label}}).filter(function(x){return x.value});
 if(loadToken!==state.requestToken||loadProvider!==state.provider||(loadProvider==="pxweb"&&loadPreset!==state.pxPreset))return;
 out.sort(function(x,y){return x.label.localeCompare(y.label,"ca",{numeric:true})});state.stats=out;fill($("stat"),out);$("stat").disabled=!out.length;
 if(state.provider==="eurostat"){hideStatSelector(true);await eurostatAddRootLevel()}
 else if(state.provider==="istac"){hideStatSelector(true);istacDraw(0,"");status("")}
 else if(state.provider==="icane"){hideStatSelector(true);icaneDraw();status("")}
 else if(state.provider==="ige"){hideStatSelector(true);await igeSelectRoot();status("")}
 else if(state.provider==="nomis"){state.pxPreset="";hideStatSelector(true);await nomisSelectRoot();setProviderUI();status("")}
 else if(state.provider==="dst"){hideStatSelector(true);await dstSelectRoot();setProviderUI();status("")}
 else if(state.provider==="cso"){hideStatSelector(true);await csoSelectRoot();setProviderUI();status("")}
 else if(state.provider==="idescat"){hideStatSelector(true);recursiveProxyStart("idescat")}
 else if(state.pxPreset==="eustat"){hideStatSelector(true);recursiveProxyStart("eustat")}
 else if(state.pxPreset==="unece"){hideStatSelector(true);addUniversalRootLevel(out,"Grup temàtic",async function(v){state.selected.stat=v;await pxRecursiveSelectRoot(v)})}
 else if(state.provider!=="ine"){hideStatSelector(false)}
 var initial=new URLSearchParams(location.search).get("stat")||"";
 if(state.provider!=="ine"&&state.provider!=="eurostat"&&state.provider!=="istac"&&state.provider!=="icane"&&state.provider!=="ige"&&initial&&[].slice.call($("stat").options).some(function(o){return o.value===initial})){$("stat").value=initial;await onStatChange();if(state.provider==="idescat")recursiveProxyStart("idescat")}
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

function deriveConcept(s){s=String(s||"");var p=s.indexOf(".");return p>=0?s.slice(0,p):s}
function deriveCross(s){s=String(s||"").trim();var p=s.indexOf(". ");if(p<0)return"";var r=s.slice(p+2),q=r.indexOf(". A");return(q>=0?r.slice(0,q):r).trim()}


async function onStatChange(){
 state.selected.stat=$("stat").value;clearBelow(true);if(!state.selected.stat)return;busy(true);
 try{
  if(state.provider==="idescat"){var d=await fetchJson(provider().base+"/"+encodeURIComponent(state.selected.stat)+"?lang=ca");state.catalog=collection(d).map(function(x){return{node:x.id,name:x.label,concept:deriveConcept(x.label),cross:deriveCross(x.label)}});var cs=[...new Set(state.catalog.map(function(x){return x.concept}).filter(Boolean))];fill($("concept"),cs.map(function(x){return{value:x,label:x}}));$("concept").disabled=!cs.length;updateIdescatLevelVisibility();if(cs.length===1){$("concept").value=cs[0];await $("concept").onchange()}}
  else if(state.provider==="ine"){await ineSelectRoot();$("stat").disabled=true;$("concept").disabled=true;$("cross").disabled=true;$("node").disabled=true;$("table").disabled=true;$("geo").disabled=true}
  else if(state.provider==="eurostat"){await eurostatSelectRoot(state.selected.stat)}
  else if(state.provider==="nomis"){await nomisSelectDataset(state.selected.stat)}
  else if(state.pxPreset==="sweden"){await swedenSelectRoot(state.selected.stat)}
  else if(state.pxPreset==="finland"||state.pxPreset==="iceland"||state.pxPreset==="greenland"){await pxRecursiveSelectRoot(state.selected.stat)}
  else if(state.pxPreset==="eustat"){
 state.selected.concept="";state.selected.cross="";state.selected.node="";state.selected.table="";
 ["concept","cross","node","table","geo"].forEach(resetSelect);
 var eo=await eustatLoadOperations(state.selected.stat);
 if(eo.length===1){$("concept").value=eo[0].id;await $("concept").onchange()}
 recursiveProxyStart("eustat");
}else if(state.pxPreset==="norway"){await norwaySelectRoot(state.selected.stat)}
  else{state.pxPath=[state.selected.stat];await pxChildren(state.pxPath,"concept")}
 }catch(e){var em=e&&e.message?String(e.message):String(e),st=e&&e.stack?String(e.stack):"";if(state.provider==="pxweb"&&(state.pxPreset==="finland"||state.pxPreset==="iceland")){status("PX-"+String(state.pxPreset).toUpperCase()+": "+em+(st?" · STACK: "+st.split("\n").slice(0,4).join(" | "):""),"error")}else status(em,"error")}finally{busy(false)}
}
async function norwayLoadV2Catalog(){
 var all=[],page=1,pageSize=500;
 for(var k=0;k<30;k++,page++){
  var u=provider().base+"/tables?pageNumber="+page+"&pageSize="+pageSize+"&lang=en";
  var d=await fetchJson(u),rows=Array.isArray(d&&d.tables)?d.tables:a(d);
  all=all.concat(rows||[]);
  var pg=d&&d.page||d&&d.pagination||{},total=Number(f(pg,"totalPages","pages","pageCount"));
  if(total&&page>=total)break;
  if(!rows||!rows.length||rows.length<pageSize)break;
 }
 state.norwayCatalog=all.map(function(t){
  var id=String(f(t,"id","tableId","code","tableCode")).trim();
  var label=String(f(t,"label","title","text","name")||id).trim();
  return{id:id,label:label,paths:Array.isArray(t.paths)?t.paths:[]};
 }).filter(function(t){return t.id});
 var roots=new Map();
 state.norwayCatalog.forEach(function(t){
  (t.paths||[]).forEach(function(path){
   var raw=Array.isArray(path)?path:(path&&Array.isArray(path.path)?path.path:(path&&Array.isArray(path.elements)?path.elements:[path]));
   var p=(raw||[]).map(function(x){return{id:String(f(x,"id","code","path")).trim(),label:String(f(x,"label","text","name","title")||f(x,"id","code","path")).trim()}}).filter(function(x){return x.id});
   if(!p.length)return;
   var r=p[0];if(!roots.has(r.id))roots.set(r.id,{id:r.id,label:r.label,type:"l",path:[r.id]});
  });
 });
 state.norwayRootItems=Array.from(roots.values());
}
function norwayCatalogPath(t){
 var paths=t&&t.paths||[];
 for(var j=0;j<paths.length;j++){
  var path=paths[j],raw=Array.isArray(path)?path:(path&&Array.isArray(path.path)?path.path:(path&&Array.isArray(path.elements)?path.elements:[path]));
  var p=(raw||[]).map(function(x){return{id:String(f(x,"id","code","path")).trim(),label:String(f(x,"label","text","name","title")||f(x,"id","code","path")).trim()}}).filter(function(x){return x.id});
  if(p.length)return p;
 }
 return [];
}
function norwayCatalogChildren(path){
 var p=(path||[]).slice(),out=new Map();
 state.norwayCatalog.forEach(function(t){
  var a1=norwayCatalogPath(t);
  if(a1.length===p.length){
   var same=true;for(var i=0;i<p.length;i++)if(a1[i].id!==p[i])same=false;
   if(same)out.set(t.id,{id:t.id,label:t.label,type:"t",path:p.slice(),tableId:t.id});
   return;
  }
  if(a1.length<=p.length)return;
  for(var i=0;i<p.length;i++)if(a1[i].id!==p[i])return;
  var x=a1[p.length],key=x.id;
  if(!out.has(key))out.set(key,{id:key,label:x.label,type:"l",path:p.concat([key])});
 });
 return Array.from(out.values());
}

function norwayNavUrl(path){
 var p=(path||[]).slice();
 return "https://data.ssb.no/api/v0/en/table/"+p.map(function(x){return encodeURIComponent(String(x))}).join("/");
}
async function norwayV0Children(path){
 var raw=await fetchJson(norwayNavUrl(path||[]));
 return a(raw).map(function(x){
  var id=String(f(x,"id","code","dbid","path")).trim();
  var type=String(f(x,"type","class")).trim().toLowerCase();
  return{id:id,label:String(f(x,"text","label","name","title")||id).trim(),type:type,path:(path||[]).concat([id])};
 }).filter(function(x){return x.id});
}
function norwayClearLevels(){
 var box=$("eurostatLevels");
 if(box){box.innerHTML="";box.hidden=true}
 state.norwayPath=[];
}
function norwayLevelLabel(index,list){
 return list&&list.length&&list.every(function(x){return x.type==="t"||x.type==="table"||pxTable(x)})?"Taula":"Nivell "+(index+1);
}
async function norwaySelectRoot(rootCode){
 norwayClearLevels();
 state.norwayPath=[rootCode];
 var children=norwayCatalogChildren([rootCode]);
 state.pxItems.set("norwayLevel0",children);
 if(children.length===1&&(children[0].type==="t"||children[0].type==="table"||pxTable(children[0]))){
  await pxFlatSelectTable(children[0].id);
  return;
 }
 norwayAddLevel(children,0);
}
function norwayAddLevel(children,index){
 var box=$("eurostatLevels");if(!box)return;
 var list=(children||[]).filter(function(x){return x&&x.id&&x.label});
 if(!list.length)return;
 box.hidden=false;box.style.display="grid";
 var lab=document.createElement("label");
 lab.dataset.norwayLevel=String(index);
 lab.textContent=norwayLevelLabel(index,list)+" ";
 var sel=document.createElement("select");
 sel.id="norwayLevel"+index;
 sel.appendChild(new Option("— Selecciona —",""));
 list.forEach(function(x){sel.appendChild(new Option(x.label,x.id))});
 lab.appendChild(sel);box.appendChild(lab);
 state.pxItems.set("norwayLevel"+index,list);
 sel.onchange=async function(){
  if(!sel.value)return;
  try{await norwaySelectDynamic(index,sel.value)}catch(e){status("Statistics Norway: "+(e&&e.message?e.message:String(e)),"error")}
 };
 if(list.length===1){
  sel.value=list[0].id;
  norwaySelectDynamic(index,list[0].id).catch(function(e){status("Statistics Norway: "+(e&&e.message?e.message:String(e)),"error")});
 }
}
async function norwaySelectDynamic(index,val){
 var items=state.pxItems.get("norwayLevel"+index)||[];
 var item=items.find(function(x){return String(x.id)===String(val)});
 if(!item)throw new Error("No s'ha trobat l'element seleccionat de Statistics Norway.");
 var box=$("eurostatLevels");
 if(box)Array.from(box.querySelectorAll("label")).forEach(function(l){
  if(Number(l.dataset.norwayLevel)>index)l.remove();
 });
 state.norwayPath=(item.path||[]).slice();
 state.metadata=null;$("query").disabled=true;$("tableInfo").hidden=true;$("cellInfo").hidden=true;
 $("filters").innerHTML="";state.filters.clear();
 var isTable=item.type==="t"||item.type==="table"||pxTable(item);
 if(isTable){
  state.selected.table=item.id;state.selected.node=item.id;
  await pxFlatSelectTable(item.id);
  return;
 }
 var next=norwayCatalogChildren(item.path||state.norwayPath);
 state.pxItems.set("norwayLevel"+(index+1),next);
 norwayAddLevel(next,index+1);
}
/** Buida nivells posteriors + secció 3 (filtres) + secció 4 (resultats). */
function hideStatSelector(hidden){
 var lab=$("stat")&&$("stat").parentElement;
 if(lab)lab.style.display=hidden?"none":"";
}


function isPxMetadata(d){
 var s=d&&d.dataset&&typeof d.dataset==="object"?d.dataset:d;
 return !!(s&&((Array.isArray(s.variables)&&s.variables.length)||(Array.isArray(s.id)&&s.dimension)));
}
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
   fill($("table"),t.map(function(x){return{value:x.id,label:x.id+" · "+x.label}}));updateIdescatLevelVisibility();
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
 clearQueryView();
 if(state.provider==="idescat"){
  state.selected.table=$("table").value;
  resetSelect("geo");
  if(!state.selected.table)return;
  try{
   var d=await fetchJson(idesPath()+"?lang=ca"),g=collection(d);
   fill($("geo"),g.map(function(x){return{value:x.id,label:x.id+" · "+x.label}}));updateIdescatLevelVisibility();
   $("geo").disabled=!g.length;
   if(g.length===1){
    $("geo").value=g[0].id;
    await onGeoChange();
   }
  }catch(e){status(e.message,"error")}
 }else if(state.provider==="pxweb")await pxSelect("table")
}
async function onGeoChange(){
 clearQueryView();
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
 var arr=(categories||[]).map(function(c){return{code:temporalCategoryCode(c),label:String(c&&c.label||"").trim()}}).filter(function(x){return x.code||x.label});
 function isMonth(code,label){
  return /^\d{4}M\d{1,2}$/i.test(code)||/^\d{4}-M\d{1,2}$/i.test(code)||/^\d{4}-\d{2}$/.test(code)||/^\d{4}\s*[-/]?\s*M\d{1,2}$/i.test(label);
 }
 function isQuarter(code,label){
  // IGE: 202514 = 2025/II (sufix 13-16)
  return /^\d{4}1[3-6]$/.test(code)||
   /^\d{4}\s*[/.-]\s*(?:I{1,3}|IV)$/i.test(label)||/^\d{4}\s*[/.-]\s*(?:I{1,3}|IV)$/i.test(code)||
   /^\d{4}(?:Q|T)\d$/i.test(code)||/^\d{4}-Q\d$/i.test(code)||/^\d{4}\s*[-/]?\s*(?:Q|T)\d$/i.test(label);
 }
 function isSemester(code,label){
  return /^\d{4}S\d$/i.test(code)||/^\d{4}-S\d$/i.test(code)||/^\d{4}\s*[-/]?\s*S\d$/i.test(label);
 }
 // Prioritza freqüència infraanual si n'hi ha (les jerarquies IGE barregen any + trimestre)
 if(arr.some(function(x){return isMonth(x.code,x.label)}))return"month";
 if(arr.some(function(x){return isQuarter(x.code,x.label)}))return"quarter";
 if(arr.some(function(x){return isSemester(x.code,x.label)}))return"semester";
 if(arr.some(function(x){return /^\d{4}$/.test(x.code)||/^\d{4}$/.test(x.label)}))return"year";
 // Codis numèrics curts (1-4) poden ser trimestres en alguns sistemes
 if(arr.some(function(x){return /^\d{1,2}$/.test(x.code)&&Number(x.code)>=1&&Number(x.code)<=16}))return"quarter";

 for(var i=0;i<arr.length;i++){var code=arr[i].code,label=arr[i].label;
  if(/^\d{4}$/.test(code)||/^\d{4}$/.test(label))return"year";
  if(isMonth(code,label))return"month";
  if(isQuarter(code,label))return"quarter";
  if(/^\d{4}S\d$/i.test(code)||/^\d{4}-S\d$/i.test(code)||/^\d{4}\s*[-/]?\s*S\d$/i.test(label))return"semester";
  if(/^\d{4}B\d{1,2}$/i.test(code)||/^\d{4}-B\d{1,2}$/i.test(code)||/^\d{4}\s*[-/]?\s*B\d{1,2}$/i.test(label))return"bimonth";
  if(/^\d{4}W\d{1,2}$/i.test(code)||/^\d{4}-W\d{1,2}$/i.test(code)||/^\d{4}\s*[-/]?\s*W\d{1,2}$/i.test(label))return"week";
  if(/^\d{4}D\d{1,3}$/i.test(code)||/^\d{4}-D\d{1,3}$/i.test(code)||/^\d{4}-\d{2}-\d{2}$/.test(code)||/^\d{4}\s*[-/]?\s*D\d{1,3}$/i.test(label))return"day";
 }
 return null
}
function temporalCategoryCode(c){
 var v=c&&c.code!=null?c.code:(c&&c.id!=null?c.id:(c&&c.label!=null?c.label:""));
 return String(v||"").trim()
}
function previousYearPeriodCode(code){
 var v=String(code||"").trim();
 // Anys de 4 dígits
 if(/^\d{4}$/.test(v))return String(Math.max(0,Number(v)-1));
 // IGE trimestral: 202514 → 202414 (mateix trimestre any anterior)
 if(/^\d{4}1[3-6]$/.test(v))return String(Number(v.slice(0,4))-1)+v.slice(4);
 // IGE etiqueta 2025/II → 2024/II
 var mIge=v.match(/^(\d{4})(\s*[/.-]\s*)(I{1,3}|IV)$/i);
 if(mIge)return String(Number(mIge[1])-1)+mIge[2]+mIge[3];
 // Codis numèrics curts (trimestres 1-4, mesos 1-12...): resta 4
 if(/^\d{1,2}$/.test(v))return String(Math.max(0,Number(v)-4));
 if(/^\d{4}[MQSBDW]\d{1,3}$/i.test(v)||/^\d{4}-(?:M|Q|S|B|W|D)\d{1,3}$/i.test(v)||/^\d{4}-\d{2}(?:-\d{2})?$/.test(v))return v.replace(/^(\d{4})/,function(_,y){return String(Number(y)-1)});
 var m=v.match(/^(.*?)(\d{4})(.*)$/);
 return m?m[1]+String(Number(m[2])-1)+m[3]:""
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
 var choose=function(){var n=Number(input.value);if(!Number.isFinite(n))n=1;n=Math.max(1,Math.min(categories.length,Math.trunc(n)));input.value=String(n);setFilterSelection(dim,categories,categories.slice(0,n).map(temporalCategoryCode),list)};
 btn.onclick=choose;input.onkeydown=function(e){if(e.key==="Enter"){e.preventDefault();choose()}};
 row.append(text1,input,text2,btn);toolbar.append(row);
 // Botó de períodes relatius: només té sentit en freqüències infraanuals
 // (mes, trimestre...). En sèries anuals, "període anterior" i "mateix de l'any
 // anterior" són el mateix.
 if(categories.length>1&&periodicity&&periodicity!=="year"){
  // En jerarquies IGE (any + trimestre), usa només períodes infraanuals per al botó relatiu
  var pool=categories;
  if(periodicity==="quarter"){
   var sub=categories.filter(function(c){
    var code=temporalCategoryCode(c),lab=String(c&&c.label||"").trim();
    return /^\d{4}1[3-6]$/.test(code)||/^\d{4}\s*[/.-]\s*(?:I{1,3}|IV)$/i.test(lab)||/^\d{4}(?:Q|T)\d$/i.test(code)||/^\d{4}-Q\d$/i.test(code);
   });
   if(sub.length>=2)pool=sub;
  }else if(periodicity==="month"){
   var subM=categories.filter(function(c){
    var code=temporalCategoryCode(c),lab=String(c&&c.label||"").trim();
    return /^\d{4}M\d{1,2}$/i.test(code)||/^\d{4}-M\d{1,2}$/i.test(code)||/^\d{4}-\d{2}$/.test(code)||(/^\d{6}$/.test(code)&&!/^\d{4}1[3-6]$/.test(code));
   });
   if(subM.length>=2)pool=subM;
  }
  var latest=temporalCategoryCode(pool[0]),prev=temporalCategoryCode(pool[1]),target=previousYearPeriodCode(latest);
  var found=target&&target!==latest&&target!==prev&&categories.some(function(c){return temporalCategoryCode(c)===target||String(c&&c.label||"").trim()===target});
  if(found){
   var rr=document.createElement("div");rr.className="temporal-row";
   var rb=document.createElement("button");rb.type="button";rb.className="secondary";rb.textContent="Últim període, període anterior i mateix període de l'any anterior";
   rb.onclick=function(){setFilterSelection(dim,categories,[latest,prev,target],list)};rr.append(rb);toolbar.append(rr)
  }
 }
}
function renderMetadata(ds){
 state.filters.clear();$("filters").innerHTML="";
 var metadataDims=dims(ds||{}).filter(function(d){return d&&d.id});
 metadataDims.forEach(function(d){
  try{
   var cats=sortedCats(Array.isArray(d.categories)?d.categories:[],d),set=new Set(cats.map(function(x){return x.code}));
   state.filters.set(d.id,set);
   var sec=document.createElement("section");sec.className="filter";sec.dataset.dim=d.id;
   sec.innerHTML="<div class=\"filter-head\"><div><h3>"+esc(d.label||d.id)+"</h3><span class=\"role\">"+esc(d.role||"")+"</span></div><span class=\"selected-count\"></span></div>";
   var tools=document.createElement("div");tools.className="filter-tools",buttons=document.createElement("div");buttons.className="filter-buttons";
   var all=document.createElement("button");all.className="secondary";all.textContent="Tots";
   var none=document.createElement("button");none.className="secondary";none.textContent="Cap";
   var list=document.createElement("div");list.className="options";
   if(cats.length>1){buttons.append(all,none);tools.append(buttons);addTemporalQuickControls(tools,d,cats,list)}
   cats.forEach(function(c){
    var b=document.createElement("button");b.type="button";b.className="option selected";b.dataset.code=c.code;
    b.innerHTML="<span class=\"option-label\">"+esc(c.label)+"</span><small>"+esc(c.code)+"</small>";
    b.onclick=function(){if(cats.length===1)return;var fs=state.filters.get(d.id)||new Set();if(fs.has(c.code))fs.delete(c.code);else fs.add(c.code);state.filters.set(d.id,fs);b.classList.toggle("selected",fs.has(c.code));updateCells()};
    list.append(b)
   });
   sec.append(tools,list);$("filters").append(sec);
   all.onclick=function(){state.filters.set(d.id,new Set(cats.map(function(c){return c.code})));list.querySelectorAll(".option").forEach(function(b){b.classList.add("selected")});updateCells()};
   none.onclick=function(){state.filters.set(d.id,new Set());list.querySelectorAll(".option").forEach(function(b){b.classList.remove("selected")});updateCells()};
  }catch(e){
   console.warn("No s'ha pogut construir el filtre PxWeb",d,e);
  }
 });
 updateCells()
}
function selectedFilters(){var q={};dims(state.metadata).forEach(function(d){var s=state.filters.get(d.id)||new Set(),n=d.categories.length;if(s.size&&s.size!==n)q[d.id]=Array.from(s)});return q}
function updateCells(){var n=1;state.filters.forEach(function(s){n*=s.size});var missing=Array.from(state.filters.values()).some(function(s){return !s.size});var cellLimit=(function(){
  if(state.provider==="idescat"||state.provider==="istac")return MAX_CELLS;
  if(state.provider==="dst")return 10000;
  if(state.provider==="nomis")return 25000;
  if(state.provider==="pxweb"&&state.pxPreset==="finland")return 100000;
  if(state.provider==="pxweb"&&state.pxPreset==="sweden")return 150000;
  return Infinity;
 })();var tooMany=n>cellLimit;var bad=missing||tooMany;$("cellInfo").hidden=false;var icon=bad?"✕":"✓";var limitText=Number.isFinite(cellLimit)?cellLimit.toLocaleString("ca-ES"):"—";var msg=missing?"Cal seleccionar valors a totes les dimensions.":tooMany?"Cal filtrar la taula (màxim "+limitText+" cel·les)":"Es pot continuar."; $("cellInfo").innerHTML="<span class=\"status-icon "+(bad?"bad":"ok")+"\" aria-hidden=\"true\">"+icon+"</span> <strong>Nombre de cel·les de la taula filtrada:</strong> "+n.toLocaleString("ca-ES")+" · <span class=\""+(bad?"bad":"ok")+"\">"+msg+"</span>";document.querySelectorAll(".filter").forEach(function(x){x.querySelector(".selected-count").textContent=(state.filters.get(x.dataset.dim)||new Set()).size.toLocaleString("ca-ES")+" seleccionades"});$("query").disabled=bad||!state.metadata}
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
  else if(state.provider==="istac"){var parts=[],sf=selectedFilters();Object.keys(sf).forEach(function(k){if(sf[k]&&sf[k].length)parts.push(k+":"+sf[k].join("|"))});var iu=provider().base+"/statistical-resources/v1.0/datasets/ISTAC/"+encodeURIComponent(state.selected.table)+"/~latest.json?lang=es";if(parts.length)iu+="&dim="+encodeURIComponent(parts.join(":"));ds=await fetchJson(iu);ds=istacMetadataToJsonStat(ds);state.lastQueryUrl=iu}
  else if(state.provider==="icane"){ds=icaneSubsetJsonStat(state.icaneRawData,selectedFilters());state.lastQueryUrl=state.lastQueryUrl||""}
  else if(state.provider==="ige"){var iq=await igeQuery(selectedFilters());ds=iq.data;state.lastQueryUrl=iq.url}
  else if(state.provider==="nomis"){var nq=await nomisQuery(selectedFilters());ds=nq.data;state.lastQueryUrl=nq.url}
  else if(state.provider==="dst"){var dq=await dstQuery(selectedFilters());ds=dq.data;state.lastQueryUrl=dq.url}
  else if(state.provider==="cso"){var cq=await csoQuery(selectedFilters());ds=cq.data;state.lastQueryUrl=cq.url}
  else if(state.provider==="pxweb"){
   var query={query:[],response:{format:state.pxPreset==="eustat"?"json-stat":"json-stat2"}};
   dims(state.metadata).forEach(function(d){
    var selected=Array.from(state.filters.get(d.id)||[]),all=d.categories.map(function(c){return c.code});
    if(!selected.length)return;
    // A Greenland (i altres PxWeb) ometre una dimensió NO vol dir "totes":
    // l'API deixa només el Total. Cal enviar explicitament all o tots els items.
    var mustSendAll=state.pxPreset==="finland"||state.pxPreset==="greenland"||state.pxPreset==="iceland"||state.pxPreset==="eustat"||state.pxPreset==="unece";
    if(selected.length===all.length){
     if(mustSendAll)query.query.push({code:d.id,selection:{filter:"all",values:["*"]}});
     // si no mustSendAll, s'omet (comportament històric d'alguns PX)
    }else{
     query.query.push({code:d.id,selection:{filter:"item",values:selected}});
    }
   });
   var up=state.pxPreset==="eustat"?provider().base+"/"+encodeURIComponent(state.selected.table):state.pxPreset==="norway"?provider().base+"/tables/"+encodeURIComponent(state.selected.table)+"/data":state.pxPreset==="finland"&&state.finlandTableUrl?state.finlandTableUrl:pxUrl(state.pxPath);
   if(state.pxPreset==="norway"){var nq=new URL(up);nq.searchParams.set("lang","en");nq.searchParams.set("outputFormat","json-stat2");dims(state.metadata).forEach(function(d){nq.searchParams.set("valueCodes["+d.id+"]",Array.from(state.filters.get(d.id)||[]).join(","))});ds=await fetchJson(nq.toString())}
   else if(state.pxPreset==="sweden"){
    ds=await swedenV2Query(query);
   }else{
    try{
     var rawPxResponse=await fetchJson(up,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(query)});
     // Eustat retorna JSON-stat 1.2. El normalitzem abans de passar-lo al
     // renderitzador com fem amb les metadades PxWeb.
     if(state.pxPreset==="eustat"){
      var rawPx=rawPxResponse&&rawPxResponse.dataset&&typeof rawPxResponse.dataset==="object"?rawPxResponse.dataset:rawPxResponse;
      ds=pxToJsonStat(rawPxResponse);
      var eustatIds=Array.isArray(ds.id)?ds.id:[],
          eustatSizes=Array.isArray(ds.size)?ds.size:[],
          eustatValue=ds.value!=null?ds.value:(ds.values!=null?ds.values:null),
          eustatTotal=eustatSizes.length?eustatSizes.reduce(function(a,b){return a*Number(b||0)},1):0;
      if(!eustatIds.length||!eustatSizes.length||eustatTotal<=0||eustatValue==null){
       var rawKeys=rawPx&&typeof rawPx==="object"?Object.keys(rawPx).join(","):"",
           dimKeys=rawPx&&rawPx.dimension&&typeof rawPx.dimension==="object"?Object.keys(rawPx.dimension).join(","):"",
           valueInfo=eustatValue==null?"absent":(Array.isArray(eustatValue)?"array("+eustatValue.length+")":"object("+Object.keys(eustatValue||{}).length+")");
       throw new Error("Eustat: resposta JSON-stat no vàlida per a la taula. id=["+eustatIds.join(",")+"] · size=["+eustatSizes.join(",")+"] · total="+eustatTotal+" · value="+valueInfo+" · camps="+rawKeys+" · dimensions="+dimKeys);
      }
     }else{
      // Finland, Iceland i la resta de PxWeb retornen JSON-stat/json-stat2.
      // Cal convertir sempre la resposta de dades abans de renderitzar-la.
      ds=pxToJsonStat(rawPxResponse);
      if(!ds||!Array.isArray(ds.id)||!ds.id.length){
       throw new Error("PxWeb: la resposta de dades no conté una estructura JSON-stat vàlida.");
      }
     }
    }catch(pxErr){
     // Statistics Iceland pot servir JSON-stat clàssic encara que la
     // interfície PxWeb publiqui l'opció json-stat2.
     if(state.pxPreset==="iceland"){
      var fallbackQuery={query:query.query,response:{format:"json"}};
      var fallbackPxResponse=await fetchJson(up,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(fallbackQuery)});
      ds=pxToJsonStat(fallbackPxResponse);
      if(!ds||!Array.isArray(ds.id)||!ds.id.length){
       throw new Error("Statistics Iceland: la resposta JSON-stat alternativa no és vàlida.");
      }
     }else throw pxErr;
    }
   }
   state.lastQueryUrl=up
  }
  else {
   var sf=selectedFilters();
   var hasIneFilters=Object.keys(sf).some(function(k){return sf[k]&&sf[k].length});
   if(hasIneFilters){
    var ir=await ineDatosTablaFiltered(state.selected.table,sf);
    ds=ir.data;state.lastQueryUrl=ir.url;
   }else{
    var iu=ineJsonStatUrl(state.selected.table);
    ds=await fetchJson(iu);
    ds=ineNormalizeMetadataCodes(ds);
    state.lastQueryUrl=iu;
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
function sortRowsByJsonStatIndex(rows,dims,temporalDesc){
 temporalDesc=temporalDesc!==false;
 var ranks=new Map();
 dims.forEach(function(dim){
  var rank=new Map();
  (dim.cats||[]).forEach(function(cat){rank.set(String(cat.code),Number(cat.index))});
  ranks.set(dim.id,rank);
 });
 return rows.slice().sort(function(a,b){
  for(var i=0;i<dims.length;i++){
   var dim=dims[i],rank=ranks.get(dim.id),
       ac=String(a[dim.id]&&a[dim.id].code||""),
       bc=String(b[dim.id]&&b[dim.id].code||""),
       ai=rank&&rank.has(ac)?rank.get(ac):Number.MAX_SAFE_INTEGER,
       bi=rank&&rank.has(bc)?rank.get(bc):Number.MAX_SAFE_INTEGER;
   if(temporal(dim)){
    var ar=temporalCodeRank(ac),br=temporalCodeRank(bc);
    if(ar!=null&&br!=null&&ar!==br)return temporalDesc?br-ar:ar-br;
   }
   if(ai!==bi)return ai-bi;
  }
  return 0;
 });
}
function temporalSortDescending(){return state.temporalOrder!=="asc"}
function resultRows(ds){var ids=ds.id||[],sizes=(ds.size||[]).map(Number),dd=ids.map(function(id){return{id:id,label:ds.dimension&&ds.dimension[id]&&ds.dimension[id].label||id,cats:jsonstatCats(ds,id)}}),vals=ds.value!=null?ds.value:ds.values!=null?ds.values:[],get=function(i){return Array.isArray(vals)?vals[i]:vals[String(i)]},total=0,rows=[];ids.forEach(function(id,j){var n=Number(sizes[j]||0);if(n<1)n=jsonstatCats(ds,id).length;sizes[j]=n});total=sizes.length?sizes.reduce(function(x,y){return x*y},1):0;for(var flat=0;flat<total;flat++){var rem=flat,row={};for(var j=ids.length-1;j>=0;j--){var size=Number(sizes[j]||0),idx=rem%size;rem=Math.floor(rem/size);var c=dd[j].cats.find(function(x){return x.index===idx});row[ids[j]]={code:c?c.code:"",label:c?c.label:""}}row.value=get(flat);rows.push(row)}rows=sortRowsByJsonStatIndex(rows,dd,temporalSortDescending());return{dims:dd,rows:rows}}
function decimals(ds){var found=[];function walk(x){if(!x||typeof x!=="object")return;if(Array.isArray(x)){x.forEach(walk);return}Object.keys(x).forEach(function(k){if(k.toLowerCase()==="unit"&&x[k]&&typeof x[k]==="object")Object.values(x[k]).forEach(function(v){var n=Number(v&&v.decimals);if(Number.isInteger(n))found.push(n)});walk(x[k])})}walk(ds);var u=[...new Set(found)];return u.length===1?u[0]:null}
function fmt(v,d){if(v==null||v==="")return"";var n=typeof v==="number"?v:Number(v);if(!Number.isFinite(n))return v;return n.toLocaleString("ca-ES",{minimumFractionDigits:d==null?0:d,maximumFractionDigits:d==null?20:d})}
function renderTemporalOrderControl(ds){
 var wrap=$("temporalOrderWrap"),sel=$("temporalOrder");
 if(!wrap||!sel)return;
 var temporalDim=dims(ds||{}).find(function(d){return temporal(d)}),show=false;
 if(temporalDim){
  var selected=state.filters&&state.filters.get(temporalDim.id);
  var selectedCount=selected instanceof Set?selected.size:temporalDim.categories.length;
  show=temporalDim.categories.length>1&&selectedCount>1;
 }
 wrap.hidden=!show;
 if(show)sel.value=state.temporalOrder;
}
function setTemporalOrder(value){
 state.temporalOrder=value==="asc"?"asc":"desc";
 if(state.lastData){var p=state.pivot||{rows:[],columns:[]};state.page=1;renderResults(state.lastData);state.pivot={rows:p.rows.slice(),columns:p.columns.slice()};renderPivotBuilder();}
}
function renderResults(ds){
 state.pivot={rows:[],columns:[]};
 var z=resultRows(ds),rows=z.rows,dd=z.dims;
 // Ordenació temporal també s'aplica a les files retornades, no només al selector.
 var td=dd.find(function(d){return temporal(d)});
 if(td&&state.temporalOrder){
  rows=rows.slice().sort(function(a,b){
   var ar=temporalCodeRank(temporalCategoryCode(a[td.id])),br=temporalCodeRank(temporalCategoryCode(b[td.id]));
   if(ar==null||br==null||ar===br)return 0;
   return state.temporalOrder==="asc"?ar-br:br-ar;
  });
 }
 var zRows=rows,
     totalPages=Math.max(1,Math.ceil(rows.length/state.pageSize)),
     current=Math.min(Math.max(1,Number(state.page)||1),totalPages);
 state.page=current;
 var start=(current-1)*state.pageSize,
     end=Math.min(start+state.pageSize,rows.length),
     page=rows.slice(start,end),
     h='<div class="result-meta">'+rows.length.toLocaleString("ca-ES")+' files · mostrant '+(rows.length?start+1:0)+'–'+end+'</div>'+
       '<div class="table-wrap"><table class="data-table"><thead><tr>'+
       dd.map(function(d){return'<th>'+esc(d.id+"_Codi")+'</th><th>'+esc(d.id+"_Etiqueta")+'</th>'}).join("")+
       '<th>Valor</th></tr></thead><tbody>';
 page.forEach(function(r){
  h+='<tr>';
  dd.forEach(function(d){h+='<td>'+esc(r[d.id].code)+'</td><td>'+esc(r[d.id].label)+'</td>'});
  h+='<td class="num">'+esc(fmt(r.value,decimals(ds)))+'</td></tr>';
 });
 h+='</tbody></table></div>';
 h+='<div class="pager">'+
    '<button class="secondary" aria-label="Anterior" title="Anterior" data-page="'+(current-1)+'"'+(current<=1?' disabled':'')+'><span aria-hidden="true">◀</span></button>'+
    '<span>Pàgina '+current+' / '+totalPages+'</span>'+
    '<button class="secondary" aria-label="Següent" title="Següent" data-page="'+(current+1)+'"'+(current>=totalPages?' disabled':'')+'><span aria-hidden="true">▶</span></button>'+
    '<select data-page-size aria-label="Nombre de files per pàgina">'+
      '<option value="50"'+(state.pageSize===50?' selected':'')+'>50</option>'+
      '<option value="100"'+(state.pageSize===100?' selected':'')+'>100</option>'+
      '<option value="250"'+(state.pageSize===250?' selected':'')+'>250</option>'+
    '</select></div>';
 $("results").innerHTML=h;
 renderTemporalOrderControl(ds);
 renderPivotBuilder();
 updateXlsxAvailability();
}
function setResultPage(page){
 var ds=state.lastData;
 if(!ds)return;
 var z=resultRows(ds),totalPages=Math.max(1,Math.ceil(z.rows.length/state.pageSize));
 state.page=Math.min(Math.max(1,Number(page)||1),totalPages);
 renderResults(ds);
}
function setResultPageSize(size){
 var ds=state.lastData;
 if(!ds)return;
 state.pageSize=Number(size)||100;
 state.page=1;
 renderResults(ds);
}

var EXCEL_MAX_ROWS=1048576;
function pivotRowCount(){
 if(!state.lastData)return 0;
 var z=resultRows(state.lastData),rowIds=(state.pivot&&state.pivot.rows)||[],colIds=(state.pivot&&state.pivot.columns)||[],all=[].concat(rowIds,colIds),avail=pivotDims();
 if(!all.length||all.length!==avail.length||new Set(all).size!==all.length)return 0;
 return pivotComb(z.rows,rowIds).length;
}
function xlsxExportMode(){
 if(!state.lastData)return "none";
 var rawCount=resultRows(state.lastData).rows.length;
 if(rawCount<=EXCEL_MAX_ROWS)return "data";
 var pr=pivotRowCount();
 return pr>0&&pr<=EXCEL_MAX_ROWS?"pivot":"none";
}
function updateXlsxAvailability(){
 var b=$("exportXlsx");if(!b)return;
 var mode=xlsxExportMode();
 b.disabled=mode==="none";
 b.textContent=mode==="pivot"?"Exporta XLSX (taula construïda)":"Exporta XLSX";
 b.title=mode==="none"&&state.lastData&&resultRows(state.lastData).rows.length>EXCEL_MAX_ROWS
  ?"La consulta supera el límit de 1.048.576 files d'Excel. Construeix una taula amb Files i genera-la abans d'exportar a XLSX."
  :mode==="pivot"
   ?"La consulta supera el límit d'Excel; s'exportarà només la Taula construïda."
   :"";
}
function exportCSV(){if(!state.lastData)return;var z=resultRows(state.lastData),h=z.dims.map(function(d){return[d.id+"_Codi",d.id+"_Etiqueta"]}).reduce(function(x,y){return x.concat(y)},[]).concat(["Valor"]),lines=[h].concat(z.rows.map(function(r){return z.dims.map(function(d){return[r[d.id].code,r[d.id].label]}).reduce(function(x,y){return x.concat(y)},[]).concat([r.value==null?"":r.value])})).map(function(row){return row.map(function(v){return'"'+String(v).replace(/"/g,'""')+'"'}).join(";")});var b=new Blob(["\uFEFF"+lines.join("\r\n")],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=state.provider+"_consulta.csv";a.click()}
function exportXLSX(){
 if(!state.lastData||typeof XLSX==="undefined")return;
 var mode=xlsxExportMode();
 if(mode==="none"){
  status("La consulta supera el límit de 1.048.576 files d'Excel. Construeix una taula amb Files i genera-la abans d'exportar a XLSX.","error");
  return;
 }
 var z=resultRows(state.lastData),info=exportInfo(),po=pivotExport(),wb=XLSX.utils.book_new();
 if(mode==="data"){
  var headers=z.dims.map(function(d){return[d.id+"_Codi",d.id+"_Etiqueta"]}).reduce(function(a,b){return a.concat(b)},[]).concat(["Valor"]),
      out=[[info.tableName],[info.source],["URL: "+info.queryUrl],["Data de consulta: "+info.exportDate],[],headers];
  z.rows.forEach(function(r){out.push(z.dims.map(function(d){return[r[d.id].code,r[d.id].label]}).reduce(function(a,b){return a.concat(b)},[]).concat([r.value==null?"":r.value]))});
  var ws=XLSX.utils.aoa_to_sheet(out);
  ws["!autofilter"]={ref:XLSX.utils.encode_range({s:{r:5,c:0},e:{r:out.length-1,c:headers.length-1}})};ws["!merges"]=[];
  if(ws.A1)ws.A1.s={font:{bold:true}};XLSX.utils.book_append_sheet(wb,ws,"Dades");
 }
 if(po){
  var pw=XLSX.utils.aoa_to_sheet(po),hr=4;
  if(po.length>hr)pw["!autofilter"]={ref:XLSX.utils.encode_range({s:{r:hr,c:0},e:{r:po.length-1,c:(po[hr]||[]).length-1}})};
  pw["!merges"]=[];if(pw.A1)pw.A1.s={font:{bold:true}};
  XLSX.utils.book_append_sheet(wb,pw,"Taula construïda");
 }
 if(!wb.SheetNames.length)return;
 XLSX.writeFile(wb,state.provider+"_"+state.selected.table+"_"+state.selected.geo+".xlsx");
}

function pivotLabel(d){return String(d&&d.label||d&&d.id||'')}
function pivotDims(){return dims(state.lastData||{}).filter(function(d){return !(d.categories&&d.categories.length===1)})}
function pivotKey(row,ids){return ids.map(function(id){return row[id]&&row[id].code||''}).join('¦')}
function pivotComb(rows,ids){var m=new Map();rows.forEach(function(r){var k=pivotKey(r,ids);if(!m.has(k))m.set(k,{key:k,row:r})});var dsx=dims(state.lastData||{}),rank=new Map();ids.forEach(function(id){var d=dsx.find(function(x){return x.id===id}),m2=new Map();(d&&d.categories||[]).slice().sort(function(a,b){if(temporal(d)){var ar=temporalCodeRank(a.code),br=temporalCodeRank(b.code);if(ar!=null&&br!=null&&ar!==br)return temporalSortDescending()?br-ar:ar-br}return Number(a.index)-Number(b.index)}).forEach(function(c,i){m2.set(String(c.code),i)});rank.set(id,m2)});return Array.from(m.values()).sort(function(a,b){for(var i=0;i<ids.length;i++){var id=ids[i],ra=rank.get(id),x=ra&&ra.has(String(a.row[id]&&a.row[id].code))?ra.get(String(a.row[id].code)):999999,y=ra&&ra.has(String(b.row[id]&&b.row[id].code))?ra.get(String(b.row[id].code)):999999;if(x!==y)return x-y}return 0})}
function pivotMove(id,target){state.pivot=state.pivot||{rows:[],columns:[]};state.pivot.rows=state.pivot.rows.filter(function(x){return x!==id});state.pivot.columns=state.pivot.columns.filter(function(x){return x!==id});if(target==="rows")state.pivot.rows.push(id);else state.pivot.columns.push(id);renderPivotBuilder()}
function pivotRemove(id){state.pivot.rows=state.pivot.rows.filter(function(x){return x!==id});state.pivot.columns=state.pivot.columns.filter(function(x){return x!==id});renderPivotBuilder()}
function pivotDragStart(e,id){e.dataTransfer.setData("text/plain",id);e.dataTransfer.effectAllowed="move"}
function pivotAllow(e){e.preventDefault();e.dataTransfer.dropEffect="move"}
function pivotDrop(e,target){e.preventDefault();var id=e.dataTransfer.getData("text/plain");if(id)pivotMove(id,target)}
function pivotDropItem(e,target,targetId){e.preventDefault();e.stopPropagation();var id=e.dataTransfer.getData("text/plain");if(!id||id===targetId)return;state.pivot.rows=state.pivot.rows.filter(function(x){return x!==id});state.pivot.columns=state.pivot.columns.filter(function(x){return x!==id});var list=target==="rows"?state.pivot.rows:state.pivot.columns,idx=list.indexOf(targetId);list.splice(idx<0?list.length:idx,0,id);renderPivotBuilder()}
function pivotZone(title,zone,ids,dsx){var html=ids.map(function(id){var d=dsx.find(function(x){return x.id===id});return '<div class="pivot-dimension" draggable="true" ondragstart="pivotDragStart(event,\''+esc(id)+'\')" ondragover="pivotAllow(event)" ondrop="pivotDropItem(event,\''+zone+'\',\''+esc(id)+'\')"><span class="pivot-drag">☷</span><span>'+esc(pivotLabel(d))+'</span><button type="button" class="pivot-remove" onclick="pivotRemove(\''+esc(id)+'\')">×</button></div>'}).join('');return '<div class="pivot-zone"><div class="pivot-zone-title">'+esc(title)+'</div><div class="pivot-dropzone '+(ids.length?'has-items':'')+'" ondragover="pivotAllow(event)" ondrop="pivotDrop(event,\''+zone+'\')">'+(html||'<span class="pivot-placeholder">Arrossega variables aquí</span>')+'</div></div>'}
function renderPivotBuilder(){var b=$("pivotBuilder");if(!b)return;if(!state.lastData){b.innerHTML='<div class="empty">Primer fes una consulta.</div>';return}state.pivot=state.pivot||{rows:[],columns:[]};var dsx=pivotDims(),assigned=new Set([].concat(state.pivot.rows,state.pivot.columns)),available=dsx.filter(function(d){return !assigned.has(d.id)});var ah=available.map(function(d){return '<div class="pivot-dimension available" draggable="true" ondragstart="pivotDragStart(event,\''+esc(d.id)+'\')"><span class="pivot-drag">☷</span><span>'+esc(pivotLabel(d))+'</span></div>'}).join('')||'<span class="pivot-placeholder">Totes les variables estan assignades.</span>';var all=assigned.size===dsx.length,axes=dsx.length<=1?(state.pivot.rows.length+state.pivot.columns.length>0):(state.pivot.rows.length>0&&state.pivot.columns.length>0);b.innerHTML='<div class="pivot-intro"><strong>Constructor de taula</strong><span>Arrossega cada variable a Files o Columnes. Pots canviar-ne l’ordre.</span></div><div class="pivot-layout"><div class="pivot-panel"><div class="pivot-panel-title">Variables disponibles</div><div class="pivot-available">'+ah+'</div></div><div class="pivot-panel">'+pivotZone("Files","rows",state.pivot.rows,dsx)+'</div><div class="pivot-panel">'+pivotZone("Columnes","columns",state.pivot.columns,dsx)+'</div></div><div class="pivot-actions"><button id="pivotBuild" class="primary" '+(all&&axes?'':'disabled')+'>Genera la taula</button><button id="pivotReset" class="secondary">Restableix</button><span class="pivot-help">'+(!all?'Assigna totes les variables a Files o Columnes.':!axes?'Cal tenir almenys una variable a cada eix.':'Configuració correcta.')+'</span></div><div id="pivotResult"></div>';$("pivotBuild").onclick=renderPivotTable;$("pivotReset").onclick=function(){state.pivot={rows:[],columns:[]};renderPivotBuilder()}}
function pivotHeaderGroups(combs,id){var out=[],i=0;while(i<combs.length){var code=String(combs[i].row[id]&&combs[i].row[id].code||''),j=i+1;while(j<combs.length&&String(combs[j].row[id]&&combs[j].row[id].code||'')===code)j++;out.push({label:combs[i].row[id]&&combs[i].row[id].label||'',span:j-i});i=j}return out}
function renderPivotTable(){var out=$("pivotResult");if(!state.lastData||!out)return;var z=resultRows(state.lastData),rows=z.rows,dsx=z.dims,rowIds=state.pivot.rows,colIds=state.pivot.columns,all=[].concat(rowIds,colIds),avail=pivotDims();if(!all.length||all.length!==avail.length||new Set(all).size!==all.length){out.innerHTML='<div class="error">Cal assignar totes les variables a Files o Columnes.</div>';return}var rc=pivotComb(rows,rowIds),cc=pivotComb(rows,colIds),values=new Map();rows.forEach(function(r){values.set(pivotKey(r,rowIds)+"§"+pivotKey(r,colIds),r.value)});var h='<div class="pivot-table-title">'+esc(state.metadata&&state.metadata.label||state.selected.table)+'</div><div class="pivot-result-meta">'+rc.length.toLocaleString("ca-ES")+' files · '+cc.length.toLocaleString("ca-ES")+' columnes</div><div class="table-wrap pivot-table-wrap"><table class="data-table pivot-table"><thead>';if(colIds.length){for(var l=0;l<colIds.length;l++){h+='<tr>';if(l===0)rowIds.forEach(function(id){h+='<th class="pivot-row-header" rowspan="'+colIds.length+'">'+esc(pivotLabel(dsx.find(function(d){return d.id===id})))+'</th>'});pivotHeaderGroups(cc,colIds[l]).forEach(function(g){h+='<th class="pivot-value-header" colspan="'+g.span+'">'+esc(String(g.label))+'</th>'});h+='</tr>'}}else{h+='<tr>';rowIds.forEach(function(id){h+='<th class="pivot-row-header">'+esc(pivotLabel(dsx.find(function(d){return d.id===id})))+'</th>'});h+='<th class="pivot-value-header">Valor</th></tr>'}h+='</thead><tbody>';function rowspan(combs,idx,level){if(idx>0){var same=true;for(var q=0;q<=level;q++){if(String(combs[idx].row[rowIds[q]]&&combs[idx].row[rowIds[q]].code||'')!==String(combs[idx-1].row[rowIds[q]]&&combs[idx-1].row[rowIds[q]].code||''))same=false}if(same)return 0}var n=1;while(idx+n<combs.length){var same2=true;for(var q2=0;q2<=level;q2++){if(String(combs[idx].row[rowIds[q2]]&&combs[idx+n].row[rowIds[q2]]&&combs[idx+n].row[rowIds[q2]].code||'')!==String(combs[idx].row[rowIds[q2]]&&combs[idx].row[rowIds[q2]].code||''))same2=false}if(!same2)break;n++}return n}rc.forEach(function(r,i){h+='<tr>';rowIds.forEach(function(id,l){var sp=rowspan(rc,i,l);if(sp)h+='<td class="pivot-label pivot-row-header" rowspan="'+sp+'">'+esc(String(r.row[id]&&r.row[id].label||''))+'</td>'});cc.forEach(function(c){var v=values.get(r.key+"§"+c.key);h+='<td class="num pivot-cell">'+(v==null?'':esc(fmt(v,decimals(state.lastData))))+'</td>'});h+='</tr>'});h+='</tbody></table></div>';out.innerHTML=h;updateXlsxAvailability()}
function exportSourceLabel(){if(state.provider==="nomis")return"UK - Office for National Statistics (ONS)";if(state.provider==="istac")return"Instituto Canario de Estadística (ISTAC)";if(state.provider==="icane")return"Instituto Cántabro de Estadística (ICANE)";if(state.provider==="ige")return"Instituto Galego de Estatística (IGE)";if(state.provider==="pxweb"){var names={eustat:"Eustat",finland:"Statistics Finland",iceland:"Statistics Iceland",norway:"Statistics Norway",sweden:"Statistics Sweden",unece:"UNECE - United Nations Economic Comission for Europe"};return names[state.pxPreset]||provider().label}return provider().label}
 function exportInfo(){var now=new Date(),pad=function(n){return String(n).padStart(2,"0")},date=pad(now.getDate())+"-"+pad(now.getMonth()+1)+"-"+now.getFullYear()+" "+pad(now.getHours())+":"+pad(now.getMinutes());return{tableName:state.metadata&&state.metadata.label||state.selected.table,queryUrl:state.lastQueryUrl,exportDate:date,source:"Font: "+exportSourceLabel()}}
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
 $("provider").onchange=async function(){var v=$("provider").value;if(v==="other"){state.requestToken++;clearBelow();state.selected.stat="";fill($("stat"),[]);$("stat").disabled=true;state.provider="pxweb";state.pxPreset="";if($("otherProvider"))$("otherProvider").value="";setProviderUI();updateUrl();status("Tria un organisme a Altres.");return}if(v==="istac"){state.provider="istac";state.pxPreset=""}else if(v==="nomis"){state.provider="nomis";state.pxPreset=""}else if(v==="icane"){state.provider="icane";state.pxPreset=""}else if(v==="ige"){state.provider="ige";state.pxPreset=""}else if(v.indexOf("pxweb:")===0){state.provider="pxweb";state.pxPreset=v.slice(6)}else{state.provider=v}state.requestToken++;clearBelow();state.selected.stat="";fill($("stat"),[]);$("stat").disabled=true;setProviderUI();updateUrl();status("Carregant estadístiques…");try{await loadStats();status("")}catch(e){status(e.message,"error")}};$("otherProvider").onchange=async function(){var v=$("otherProvider").value;if(!v)return;
 if($("provider"))$("provider").value="other";
 if(v==="istac"){state.provider="istac";state.pxPreset=""}
 else if(v==="nomis"){state.provider="nomis";state.pxPreset=""}
 else if(v==="icane"){state.provider="icane";state.pxPreset=""}
 else if(v==="ige"){state.provider="ige";state.pxPreset=""}
 else if(v==="dst"){state.provider="dst";state.pxPreset=""}
 else if(v==="cso"){state.provider="cso";state.pxPreset=""}
 else if(v.indexOf("pxweb:")===0){state.provider="pxweb";state.pxPreset=v.slice(6)}
 else{state.provider="pxweb";state.pxPreset=v.indexOf("pxweb:")===0?v.slice(6):v}
 state.requestToken++;clearBelow();state.selected.stat="";fill($("stat"),[]);$("stat").disabled=true;
 setProviderUI();updateUrl();status("Carregant estadístiques…");
 try{await loadStats();status("")}catch(e){status(e.message,"error")}
};
 
  $("stat").onchange=async function(){clearQueryView();await onStatChange();updateUrl()};
 $("concept").onchange=async function(){clearQueryView();if(state.provider==="ine")return;if(state.provider==="pxweb"&&state.pxPreset!=="eustat")await pxSelect("concept");else if(state.provider==="eurostat")await eurostatSelectLevel("concept");else if(state.provider==="pxweb"&&state.pxPreset==="eustat"){state.selected.concept=$("concept").value;state.selected.cross="";state.selected.node="";state.selected.table="";resetSelect("cross");resetSelect("node");resetSelect("table");resetSelect("geo");var et=await eustatLoadOperationTables(state.selected.concept);if(et.length===1){$("cross").value=et[0].id;await $("cross").onchange()}}else{state.selected.concept=$("concept").value;state.selected.cross="";state.selected.node="";state.selected.table="";state.selected.geo="";["cross","node","table","geo"].forEach(resetSelect);state.metadata=null;state.filters.clear();$("filters").innerHTML="";$("results").innerHTML='<div class="empty">Selecciona una taula i fes la consulta.</div>';$("query").disabled=true;$("exportCsv").disabled=true;$("exportXlsx").disabled=true;$("addToCart").disabled=true;$("tableInfo").hidden=true;$("cellInfo").hidden=true;var c=state.selected.concept,rows=(state.catalog||[]).filter(function(r){return r.concept===c}),x=[...new Set(rows.map(function(r){return r.cross}).filter(Boolean))];fill($("cross"),x.map(function(v){return{value:v,label:v}}));updateIdescatLevelVisibility();$("cross").disabled=!x.length;if(x.length===1){$("cross").value=x[0];await $("cross").onchange()}else if(x.length===0){var ids=[...new Set(rows.map(function(r){return String(r.node)}).filter(Boolean))];fill($("node"),ids.map(function(id){var q=rows.find(function(r){return String(r.node)===id});updateIdescatLevelVisibility();return{value:id,label:id+" · "+q.name}}));$("node").disabled=!ids.length;if(ids.length===1){$("node").value=ids[0];await onNodeChange()}}}};
 $("cross").onchange=async function(){clearQueryView();if(state.provider==="pxweb"&&state.pxPreset!=="eustat")await pxSelect("cross");else if(state.provider==="eurostat")await eurostatSelectLevel("cross");else if(state.provider==="pxweb"&&state.pxPreset==="eustat"){var et=(state.eustatTables||[]).find(function(r){return r.id===$("cross").value});if(et){state.selected.cross=et.id;state.selected.node=et.id;state.selected.table=et.id;if(et.type==="px"){await pxFlatSelectTable(et.id)}else{state.metadata=null;$("query").disabled=true;$("exportCsv").disabled=true;$("exportXlsx").disabled=true;$("addToCart").disabled=true;$("tableInfo").hidden=false;$("cellInfo").hidden=true;$("tableInfo").innerHTML="<strong>Taula:</strong> "+esc(et.label)+"<span class=\"path\">"+esc(et.url)+"</span><p><a href=\""+esc(et.url)+"\" target=\"_blank\" rel=\"noopener\">Obre/descarrega la taula</a></p>"}}}else{var c=$("concept").value,x=$("cross").value;state.selected.cross=x;state.selected.node="";state.selected.table="";state.selected.geo="";resetSelect("node");resetSelect("table");resetSelect("geo");state.metadata=null;state.filters.clear();$("filters").innerHTML="";$("results").innerHTML='<div class="empty">Selecciona una taula i fes la consulta.</div>';$("query").disabled=true;$("exportCsv").disabled=true;$("exportXlsx").disabled=true;$("addToCart").disabled=true;$("tableInfo").hidden=true;$("cellInfo").hidden=true;var r=(state.catalog||[]).filter(function(v){return v.concept===c&&v.cross===x}),ids=[...new Set(r.map(function(v){return v.node}))];fill($("node"),ids.map(function(id){var q=r.find(function(v){return v.node===id});updateIdescatLevelVisibility();return{value:id,label:id+" · "+q.name}}));$("node").disabled=!ids.length;if(ids.length===1){$("node").value=ids[0];await onNodeChange()}}};
 $("node").onchange=async function(){clearQueryView();if(state.provider==="ine")return;if(state.provider==="eurostat")await eurostatSelectLevel("node");else await onNodeChange()};$("table").onchange=onTableChange;$("geo").onchange=onGeoChange;$("tabData").onclick=function(){$("tabData").classList.add("active");$("tabPivot").classList.remove("active");$("results").hidden=false;$("pivotBuilder").hidden=true};$("tabPivot").onclick=function(){$("tabPivot").classList.add("active");$("tabData").classList.remove("active");$("results").hidden=true;$("pivotBuilder").hidden=false;renderPivotBuilder()};$("results").addEventListener("click",function(e){var b=e.target.closest("button[data-page]");if(b&&!b.disabled)setResultPage(Number(b.dataset.page))});$("results").addEventListener("change",function(e){if(e.target.matches("select[data-page-select]"))setResultPage(Number(e.target.value));if(e.target.matches("select[data-page-size]"))setResultPageSize(Number(e.target.value))});$("temporalOrder").onchange=function(){setTemporalOrder(this.value)};$("query").onclick=runQuery;$("exportCsv").onclick=exportCSV;$("exportXlsx").onclick=exportXLSX;$("addToCart").onclick=addCart;$("cartExport").onclick=exportCart;$("cartClear").onclick=function(){state.cart=[];renderCart()};$("cartToggle").onclick=function(){var p=$("cartPanel");p.hidden=false;$("cartToggle").setAttribute("aria-expanded","true");p.scrollIntoView({behavior:"smooth",block:"start"})};$("clear").onclick=function(){if(state.metadata)renderMetadata(state.metadata)}
}
function updateUrl(){var q=new URLSearchParams();q.set("provider",state.provider==="nomis"?"ons":state.provider);if(state.provider==="pxweb")q.set("px",state.pxPreset);if(state.selected.stat)q.set("stat",state.selected.stat);history.replaceState(null,"","?"+q.toString())}
