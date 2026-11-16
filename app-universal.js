
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
  else if(state.provider==="icane"&&/^https:\/\/datos\.icane\.es\//i.test(url)){var icaneProxyOk=false,icaneProxyErr=null,icaneProxies=["https://api.allorigins.win/raw?url="+encodeURIComponent(url),"https://corsproxy.io/?url="+encodeURIComponent(url),"https://api.codetabs.com/v1/proxy?quest="+encodeURIComponent(url)];for(var icp=0;icp<icaneProxies.length&&!icaneProxyOk;icp++){try{var ir=await fetch(icaneProxies[icp],{cache:"no-store"});if(ir.ok){r=ir;icaneProxyOk=true}else icaneProxyErr=new Error("HTTP "+ir.status)}catch(ie){icaneProxyErr=ie}}if(!icaneProxyOk)throw new Error("No s'ha pogut connectar amb l'API d'ICANE. "+(icaneProxyErr&&icaneProxyErr.message||"Failed to fetch")+" · "+url)}
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
// Nomis: de vegades arriba HTML amb HTTP 200
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
  if(!got)throw new Error("ONS/Nomis: s'ha rebut una pàgina HTML en lloc de JSON. "+(lastN&&lastN.message||"")+" · "+url);
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
function provider(){var p={idescat:{label:"Idescat",base:"https://api.idescat.cat/taules/v2",doc:"https://www.idescat.cat/dev/api/taules/"},pxweb:{label:"PXWeb",base:"",doc:"https://pxdata.stat.fi/api1.html"},ine:{label:"INE",base:"https://servicios.ine.es/wstempus/js",doc:"https://www.ine.es/OpenAPI/"},eurostat:{label:"Eurostat",base:"https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0",doc:"https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access/"},istac:{label:"Instituto Canario de Estadística (ISTAC)",base:"https://datos.canarias.es/api/estadisticas",doc:"https://www.gobiernodecanarias.org/istac/datos-abiertos/documentacion-api/"},icane:{label:"Instituto Cántabro de Estadística (ICANE)",base:"https://datos.icane.es/api/3/action",doc:"https://datos.icane.es/about"},ige:{label:"Instituto Galego de Estatística (IGE)",base:"https://www.ige.gal/igebdt/igeapi",doc:"https://www.ige.gal/web/mostrar_paxina.jsp?idioma=es&paxina=004015"},nomis:{label:"Office for National Statistics (ONS)",base:"https://www.nomisweb.co.uk/api/v01",doc:"https://www.nomisweb.co.uk/api/v01/help"}};if(state.provider==="pxweb"){var x={finland:"https://pxdata.stat.fi/PxWeb/api/v1/en/StatFin",sweden:"https://api.scb.se/OV0104/v1/doris/en/ssd",unece:"https://w3.unece.org/PXWeb2015/api/v1/en/STAT",iceland:"https://px.hagstofa.is/pxen/api/v1/en",eustat:"https://www.eustat.eus/bankupx/api/v1/es/DB",norway:"https://data.ssb.no/api/pxwebapi/v2"};p.pxweb.base=x[state.pxPreset]||x.finland}return p[state.provider]}
function pxUrl(path){
 var p=(path||[]).slice();
 // Statistics Finland mostra els identificadors de carpeta com StatFin__xxx,
 // però l'API REST construeix la ruta amb xxx (p. ex. /StatFin/synt/12dj.px).
 if(state.provider==="pxweb"&&state.pxPreset==="finland"&&p.length&&/^StatFin__/i.test(String(p[0])))
  p[0]=String(p[0]).replace(/^StatFin__/i,"");
 return [provider().base.replace(/\/+$/,"")].concat(p).join("/");
}
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
function ineClearNavigation(){
 state.inePath=[];state.ineItems.clear();
 var box=$("eurostatLevels");
 if(box){box.innerHTML="";box.hidden=true}
 ["concept","cross","node","table","geo"].forEach(resetSelect);
 state.selected.concept="";state.selected.cross="";state.selected.node="";state.selected.table="";state.selected.geo="";
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
function ineNavGroups(){
 var seen=new Set(),out=[];
 (state.ineNav||[]).forEach(function(x){if(!seen.has(x.group)){seen.add(x.group);out.push({id:x.group,label:x.group,type:"group"})}});
 return out;
}
function ineNavTopics(group){
 var seen=new Set(),out=[];
 (state.ineNav||[]).filter(function(x){return x.group===group}).forEach(function(x){
  if(!seen.has(x.topic)){seen.add(x.topic);out.push({id:x.topic,label:x.topic,type:"topic"})}
 });
 return out;
}
function ineNavOperations(group,topic){
 var seen=new Set(),out=[];
 (state.ineNav||[]).filter(function(x){return x.group===group&&x.topic===topic}).forEach(function(x){
  var id=x.name;
  if(!seen.has(id)){seen.add(id);out.push({id:id,label:id,type:"operation",href:x.href})}
 });
 return out;
}
async function ineExplainCapselItems(items){
 var list=(items||[]).map(function(x){return Object.assign({},x)});
 await Promise.all(list.map(async function(x){
  if(!/^Apartat\s+\d+$/i.test(String(x.label||"")))return;
  function cleanTitle(s){
   return ineCleanSectionTitle(s);
  }
  function titlesFromDoc(doc,capsel){
   var out=[],seen=new Set();
   function add(t){t=cleanTitle(t);if(t&&!seen.has(t)){seen.add(t);out.push(t)}}
   if(capsel){
    var h=doc.querySelector('h1.inebase_titulo[id="c_'+String(capsel)+'"]');
    if(h)add(h.textContent);
   }
   ["h1.inebase_titulo","h1","h2","h3",".inebase_titulo","span.title",".title","span.titulo",".titulo","td.titulo"].forEach(function(q){
    try{doc.querySelectorAll(q).forEach(function(el){
     if(el.closest&&el.closest("a"))return;
     add(el.textContent);
    })}catch(e){}
   });
   var tt=doc.querySelector("title");if(tt)add(tt.textContent);
   return out;
  }
  try{
   var cap=String(x.capsel||x.padre||"").trim();
   var urls=[];
   if(cap){
    try{var tu=new URL("https://www.ine.es/dynt3/inebase/index.htm");tu.searchParams.set("padre",cap);urls.push(tu.href)}catch(e){}
    try{var tu2=new URL("https://www.ine.es/dynt3/inebase/index.htm");tu2.searchParams.set("capsel",cap);urls.push(tu2.href)}catch(e){}
   }
   if(x.url)urls.push(x.url);
   for(var ui=0;ui<urls.length;ui++){
    try{
     var html=await fetchText(urls[ui],{cache:"no-store"});
     var doc=new DOMParser().parseFromString(html,"text/html");
     var cands=titlesFromDoc(doc,cap);
     var preferred=cands.find(function(v){return /^(Resultados|Resultats|National results)\b/i.test(v)})||cands[0]||"";
     if(preferred){x.label=preferred;return}
    }catch(e){}
   }
  }catch(e){}
 }));
 return list
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
function ineAddLevel(items,index,labelText){
 var box=$("eurostatLevels");if(!box)return;
 var list=(items||[]).filter(function(x){return x&&x.id&&x.label});
 if(!list.length)return;
 box.hidden=false;
 box.style.display="grid";
 var lab=document.createElement("label");
 lab.style.display="flex";
 lab.style.flexDirection="column";
 lab.style.alignItems="stretch";
 lab.dataset.ineLevel=String(index);
 lab.textContent=labelText+" ";
 var sel=document.createElement("select");
 sel.id="ineLevel"+index;
 sel.appendChild(new Option("— Selecciona —",""));
 list.forEach(function(x){sel.appendChild(new Option(x.label,x.id))});
 lab.appendChild(sel);box.appendChild(lab);
 state.ineItems.set("ineLevel"+index,list);
 sel.addEventListener("change",async function(){
  clearQueryView();
  if(!sel.value)return;
  try{await ineSelectLevel(index,sel.value)}catch(e){status("INE: "+(e&&e.message?e.message:String(e)),"error")}
 });
 if(list.length===1){sel.value=list[0].id;ineSelectLevel(index,list[0].id).catch(function(e){status("INE: "+(e&&e.message?e.message:String(e)),"error")})}
}
function ineTrimTitle(s){
 return String(s||"").replace(/\s+/g," ").replace(/\s*[·|]+\s*$/,"").trim();
}
/** Neteja títols de secció INE contaminats per proxies markdown/HTML. */
function ineCleanSectionTitle(s){
 s=String(s==null?"":s);
 s=s.replace(/!?\[[^\]]*\]\([^)]*\)/g," ");
 s=s.replace(/!\[[^\]]*\]/g," ");
 s=s.replace(/\[[^\]]*\]\([^)]*\)/g," ");
 s=s.replace(/https?:\/\/\S+/gi," ");
 s=s.replace(/<[^>]+>/g," ");
 s=s.replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"');
 s=s.replace(/&ntilde;/gi,"ñ").replace(/&Ntilde;/gi,"Ñ");
 s=s.replace(/&aacute;/gi,"á").replace(/&eacute;/gi,"é").replace(/&iacute;/gi,"í").replace(/&oacute;/gi,"ó").replace(/&uacute;/gi,"ú");
 s=s.replace(/\[+/g," ").replace(/\]+/g," ");
 s=s.replace(/\s+/g," ").trim();
 s=s.replace(/\s*[|·-]\s*(?:Instituto Nacional de Estadística|INE).*$/i,"").trim();
 var m;
 m=s.match(/^(Resultados\s+nacionales)\b/i);
 if(m)return "Resultados nacionales";
 m=s.match(/^(Resultados\s+por\s+comunidades\s+aut[oó]nomas)\b/i);
 if(m)return "Resultados por comunidades autónomas";
 m=s.match(/^(Resultats\s+nacionals)\b/i);
 if(m)return "Resultats nacionals";
 m=s.match(/^(Resultats\s+per\s+comunitats\s+aut[oò]nomes)\b/i);
 if(m)return "Resultats per comunitats autònomes";
 m=s.match(/^(National\s+results)\b/i);
 if(m)return "National results";
 if(/logoinebase|menus\/img|Image\s+\d+/i.test(s))return "";
 if(s.length>80)s=s.slice(0,80).replace(/\s+\S*$/,"").trim();
 if(!s||/^Apartat\s+\d+$/i.test(s))return "";
 return s;
}

function ineAbsoluteUrl(href){
 try{return new URL(href,"https://www.ine.es/").href}catch(e){return String(href||"")}
}
async function loadIneOperations(){
 if(Array.isArray(state.ineOperations)&&state.ineOperations.length)return;
 var d=await fetchJson("https://servicios.ine.es/wstempus/jsCache/ES/OPERACIONES_DISPONIBLES?det=2");
 state.ineOperations=a(d);
 if(!state.ineOperations.length)throw new Error("INE: no s'han trobat operacions disponibles a Tempus3.");
}
function ineNormalizeUrl(url){
 try{
  var u=new URL(ineAbsoluteUrl(url));
  return u.pathname.toLowerCase()+"?"+Array.from(u.searchParams.entries()).filter(function(x){return x[0]!=="menu"}).sort(function(x,y){return x[0].localeCompare(y[0])||x[1].localeCompare(y[1])}).map(function(x){return x[0]+"="+x[1]}).join("&");
 }catch(e){return String(url||"").toLowerCase()}
}
function ineFindOperation(op){
 var ops=Array.isArray(state.ineOperations)?state.ineOperations:[];
 var target=ineNormalizeUrl(op&&op.href);
 if(target){
  var hit=ops.find(function(x){return x&&x.Url&&ineNormalizeUrl(x.Url)===target});
  if(hit)return hit;
 }
 // Si la URL no coincideix exactament, utilitzem el cid de la URL
 // de l'operació seleccionada. El cid és l'identificador estable
 // que comparteixen la navegació INEbase i OPERACIONES_DISPONIBLES.
 var cid="";
 try{
  var u=new URL(ineAbsoluteUrl(op&&op.href));
  cid=String(u.searchParams.get("cid")||"").trim();
 }catch(e){}
 if(cid){
  var byCid=ops.filter(function(x){
   var url=String(x&&x.Url||"");
   try{
    var u2=new URL(ineAbsoluteUrl(url));
    return String(u2.searchParams.get("cid")||"").trim()===cid;
   }catch(e2){
    return new RegExp("(?:[?&])cid="+cid+"(?:&|$)","i").test(url);
   }
  });
  if(byCid.length===1)return byCid[0];
 }
 return null;
}
function ineOperationId(op){
 return String(op&&op.Id!=null?op.Id:"").trim();
}
async function ineLoadTablesFromBase(op){
 // Les pàgines d'INEbase poden arribar com HTML o com Markdown
 // quan entren per un proxy CORS. Detectem les taules TPX en tots dos formats.
 var href=ineAbsoluteUrl(op&&op.href);
 if(!href)throw new Error("INE: l'operació no té URL d'INEbase.");
 var queue=[href],visited=new Set(),out=[],seen=new Set(),lastErr=null;
 function addTable(id,label,kind){
  id=String(id||"").trim();label=String(label||"").replace(/\\s+/g," ").trim();
  if(!id||seen.has(kind+":"+id))return;
  seen.add(kind+":"+id);
  out.push({id:id,label:id+" · "+(label||id),type:"table",tableId:id});
 }
 function scanText(text,pageUrl){
  var s=String(text||"");
  var re=/https?:\/\/(?:www\.)?ine\.es\/jaxi\/Tabla\.htm\?[^\s)"'<>]*?tpx=([0-9]+)/gi,m;
  while((m=re.exec(s)))addTable(m[1],"", "tpx");
  var re2=/\/jaxi\/Tabla\.htm\?[^\s)"'<>]*?tpx=([0-9]+)/gi;
  while((m=re2.exec(s)))addTable(m[1],"","tpx");
  var re3=/\/jaxiT3\/Tabla\.htm\?[^\s)"'<>]*?t=([0-9]+)/gi;
  while((m=re3.exec(s)))addTable(m[1],"","table");
  var links=[...s.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)];
  links.forEach(function(x){
   var raw=x[2].replace(/&amp;/g,"&"),abs;
   try{abs=new URL(raw,pageUrl).href}catch(e){return}
   var u;try{u=new URL(abs)}catch(e2){return}
   var p=u.pathname.toLowerCase(),tpx=u.searchParams.get("tpx"),t=u.searchParams.get("t");
   if(tpx&&p.indexOf("/jaxi/")>=0)addTable(tpx,x[1],"tpx");
   else if(t&&p.indexOf("/jaxit3/")>=0)addTable(t,x[1],"table");
  });
 }
 while(queue.length&&visited.size<20){
  var pageUrl=queue.shift();
  if(visited.has(pageUrl))continue;
  visited.add(pageUrl);
  var html;
  try{html=await fetchText(pageUrl,{cache:"no-store"});}catch(e){lastErr=e;continue;}
  scanText(html,pageUrl);
  var doc=new DOMParser().parseFromString(html,"text/html");
  Array.from(doc.querySelectorAll("a[href]")).forEach(function(aEl){
   var raw=aEl.getAttribute("href")||"",abs;
   try{abs=new URL(raw,pageUrl).href}catch(e){return}
   var u;try{u=new URL(abs)}catch(e2){return}
   var host=u.hostname.toLowerCase(),path=u.pathname.toLowerCase();
   if(host!=="www.ine.es"&&host!=="ine.es")return;
   var tpx=u.searchParams.get("tpx"),t=u.searchParams.get("t"),label=aEl.textContent||"";
   if(tpx&&path.indexOf("/jaxi/tabla.htm")>=0){addTable(tpx,label,"tpx");return}
   if(t&&path.indexOf("/jaxit3/tabla.htm")>=0){addTable(t,label,"table");return}
   if(path.indexOf("/dynt3/inebase/")>=0&&!visited.has(abs))queue.push(abs);
  });
  if(out.length)break;
 }
 out.sort(function(x,y){return x.label.localeCompare(y.label,"ca",{numeric:true})});
 if(!out.length){
  if(lastErr)throw new Error("No s'han pogut llegir les pàgines d'INEbase.");
  throw new Error("INE: no s'han trobat taules a INEbase per a aquesta operació.");
 }
 return out;
}

async function ineLoadBaseLevel(pageUrl){
 var html=await fetchText(pageUrl,{cache:"no-store"});
 var doc=new DOMParser().parseFromString(html,"text/html");
 var currentCapsel="";
 try{currentCapsel=new URL(pageUrl).searchParams.get("capsel")||""}catch(e){}
 var capsels=[],tables=[],seenCapsel=new Set(),seenTable=new Set();
 function inspectLink(raw,label){
  var abs;
  try{abs=new URL(String(raw||"").replace(/&amp;/g,"&"),pageUrl).href}catch(e){return}
  var u;try{u=new URL(abs)}catch(e2){return}
  var host=u.hostname.toLowerCase(),path=u.pathname.toLowerCase();
  if(host!=="www.ine.es"&&host!=="ine.es")return;
  label=String(label||"").replace(/\s+/g," ").trim();
  var tpx=u.searchParams.get("tpx"),t=u.searchParams.get("t"),capsel=u.searchParams.get("capsel"),padre=u.searchParams.get("padre");
  if(capsel&&capsel!==currentCapsel&&path.indexOf("/inebase/")>=0){
   var key="capsel:"+capsel;
   if(!seenCapsel.has(key)){
    seenCapsel.add(key);
    capsels.push({id:abs,label:label||("Apartat "+capsel),type:"capsel",url:abs,capsel:capsel,padre:padre||""});
   }
   return;
  }
  if(tpx&&path.indexOf("/jaxi/tabla.htm")>=0){
   var tid=String(tpx).trim(),tk="tpx:"+tid;
   if(tid&&!seenTable.has(tk)){seenTable.add(tk);tables.push({id:tid,label:label||("Taula "+tid),type:"table",tableId:tid});}
   return;
  }
  if(t&&path.indexOf("/jaxit3/tabla.htm")>=0){
   var tid2=String(t).trim(),tk2="table:"+tid2;
   if(tid2&&!seenTable.has(tk2)){seenTable.add(tk2);tables.push({id:tid2,label:label||("Taula "+tid2),type:"table",tableId:tid2});}
  }
 }
 Array.from(doc.querySelectorAll("a[href]")).forEach(function(aEl){
  inspectLink(aEl.getAttribute("href")||"",aEl.textContent||"");
 });
 var md=/\[([^\]]+)\]\(([^)]+)\)/g,m;
 while((m=md.exec(String(html||""))))inspectLink(m[2],m[1]);

 var capRe=new RegExp("https?:\\\\/\\\\/(?:www\\\\.)?ine\\\\.es\\\\/[^\\\\s\\\"'<>)]*?[?&]capsel=(\\\\d+)(?:&[^\\\\s\\\"'<>)]*)?","gi"),cm;
 while((cm=capRe.exec(String(html||"")))){
  var rawUrl=cm[0].replace(/[),.;]+$/,""),uu;
  try{uu=new URL(rawUrl);var cc=uu.searchParams.get("capsel"),pp=uu.searchParams.get("padre")||"";if(cc&&cc!==currentCapsel&&!seenCapsel.has("capsel:"+cc)){seenCapsel.add("capsel:"+cc);capsels.push({id:uu.href,label:"Apartat "+cc,type:"capsel",url:uu.href,capsel:cc,padre:pp})}}catch(e){}
 }
 var capRe2=new RegExp("[?&]capsel=(\\\\d+)(?:&[^\\\\s\\\"'<>)]*)?","gi");
 while((cm=capRe2.exec(String(html||"")))){
  var cc2=cm[1],uu2;
  try{uu2=new URL(pageUrl);uu2.searchParams.set("capsel",cc2);var pp2=uu2.searchParams.get("padre")||"";if(cc2&&cc2!==currentCapsel&&!seenCapsel.has("capsel:"+cc2)){seenCapsel.add("capsel:"+cc2);capsels.push({id:uu2.href,label:"Apartat "+cc2,type:"capsel",url:uu2.href,capsel:cc2,padre:pp2})}}catch(e){}
 }

 // El text de l'enllaç d'INEbase sovint només conté el número de capsel.
 // El títol de la pàgina és el nom real que volem mostrar a la navegació.
 capsels=await ineExplainCapselItems(capsels);

 if(currentCapsel){
  var children=capsels.filter(function(x){return x.padre===currentCapsel});
  return children.length?children:tables;
 }

 if(capsels.length){
  var groups=[],byParent=new Map();
  capsels.forEach(function(x){
   var p=x.padre||"";
   if(!p){groups.push(x);return}
   if(!byParent.has(p)){
    var g={id:"capsel-group:"+p,label:"Apartat "+p,type:"capsel-group",padre:p,children:[],url:(function(){try{var u=new URL("https://www.ine.es/dynt3/inebase/index.htm");u.searchParams.set("capsel",String(p));return u.href}catch(e){return ""}})()};
    byParent.set(p,g);groups.push(g);
   }
   byParent.get(p).children.push(x);
  });
  // Resolució de títols de grup. Els proxies CORS (jina, etc.) sovint tornen
  // markdown i trenquen el DOM; combinem text cru + neteja agressiva.
  var padreTitle=new Map();
  var htmlStr=String(html||"");

  function setPadreTitle(p,t){
   p=String(p||"").trim();
   t=ineCleanSectionTitle(t);
   if(!p||!t)return;
   if(!padreTitle.has(p))padreTitle.set(p,t);
  }

  // A) span.title fora d'enllaços + padre= del bloc següent
  try{
   var reTitle=/<span\s+class=["'][^"']*\btitle\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi,m;
   var sections=[];
   while((m=reTitle.exec(htmlStr))){
    var before=htmlStr.slice(Math.max(0,m.index-60),m.index);
    if(/<a\b[^>]*$/i.test(before))continue;
    var t=ineCleanSectionTitle(String(m[1]||""));
    if(!t)continue;
    sections.push({title:t,end:m.index+m[0].length,index:m.index});
   }
   for(var si=0;si<sections.length;si++){
    var from=sections[si].end;
    var to=si+1<sections.length?sections[si+1].index:Math.min(htmlStr.length,from+2500);
    var chunk=htmlStr.slice(from,to);
    if(!/[?&]padre=\d+/i.test(chunk))continue;
    var seenP={},pm,pre=/[?&]padre=(\d+)/gi;
    while((pm=pre.exec(chunk))){
     if(!seenP[pm[1]]){seenP[pm[1]]=1;setPadreTitle(pm[1],sections[si].title)}
    }
   }
  }catch(e){}

  // B) DOM: li > span.title + enllaços amb padre=
  try{
   Array.from(doc.querySelectorAll("li")).forEach(function(li){
    var titleEl=null;
    Array.from(li.children||[]).some(function(ch){
     if(ch.matches&&ch.matches("span.title, .title, span[class*='title']")&&!(ch.closest&&ch.closest("a"))){titleEl=ch;return true}
     return false;
    });
    if(!titleEl)return;
    var title=ineCleanSectionTitle(titleEl.textContent);
    if(!title)return;
    Array.from(li.querySelectorAll("a[href]")).forEach(function(aEl){
     var href=aEl.getAttribute("href")||"";
     var abs;try{abs=new URL(href.replace(/&amp;/g,"&"),pageUrl).href}catch(err){return}
     var u;try{u=new URL(abs)}catch(err2){return}
     var padre=u.searchParams.get("padre")||"";
     if(padre)setPadreTitle(padre,title);
    });
   });
  }catch(e){}

  // C) Proximitat: des de cada padre del grup, cerca enrere "Resultados ..."
  try{
   groups.filter(function(x){return x.type==="capsel-group"}).forEach(function(g){
    var p=String(g.padre||"");
    if(!p||padreTitle.has(p))return;
    var reP=new RegExp("[?&]padre="+p+"(?:\\D|$)","i");
    var mm=reP.exec(htmlStr);
    if(!mm)return;
    var win=htmlStr.slice(Math.max(0,mm.index-1000),mm.index);
    var best="",rm,rr=/(?:Resultados|Resultats|National results)[^\n<]{0,60}/gi;
    while((rm=rr.exec(win))){
     var cand=ineCleanSectionTitle(rm[0]);
     if(cand)best=cand;
    }
    if(best)setPadreTitle(p,best);
   });
  }catch(e){}

  // D) Si el HTML conté els dos títols clàssics, assigna per ordre als grups pendents
  try{
   var hasRN=/Resultados\s+nacionales/i.test(htmlStr);
   var hasRC=/Resultados\s+por\s+comunidades/i.test(htmlStr);
   if(hasRN&&hasRC){
    var order=["Resultados nacionales","Resultados por comunidades autónomas"];
    var gi=0;
    groups.forEach(function(g){
     if(g.type!=="capsel-group")return;
     var p=String(g.padre||"");
     if(p&&!padreTitle.has(p)&&order[gi]){setPadreTitle(p,order[gi]);gi++}
    });
   }
  }catch(e){}

  var groupList=groups.filter(function(x){return x.type==="capsel-group"});
  groupList.forEach(function(g){
   var t=padreTitle.get(String(g.padre||""));
   if(t)g.label=t;
  });

  // E) Neteja final d'etiquetes contaminades per markdown
  groups.forEach(function(g){
   if(g.type!=="capsel-group")return;
   var c=ineCleanSectionTitle(g.label);
   if(c)g.label=c;
  });

  // F) Recurs: ineExplainCapselItems per als que encara diguin Apartat
  var unresolved=groupList.filter(function(g){return /^Apartat\s+\d+$/i.test(String(g.label||""))});
  if(unresolved.length){
   try{
    var explained=await ineExplainCapselItems(unresolved.map(function(g){
     return Object.assign({},g,{label:g.label,url:g.url,capsel:g.padre});
    }));
    explained.forEach(function(g){
     var dst=groups.find(function(x){return x.id===g.id});
     var cl=ineCleanSectionTitle(g.label);
     if(dst&&cl)dst.label=cl;
    });
   }catch(e){}
  }

  // G) Si encara queden Apartat i el HTML té els títols, assignació directa per ordre
  try{
   var pending=groups.filter(function(g){return g.type==="capsel-group"&&/^Apartat\s+\d+$/i.test(String(g.label||""))});
   if(pending.length&&/Resultados\s+nacionales/i.test(htmlStr)&&/Resultados\s+por\s+comunidades/i.test(htmlStr)){
    var labs=["Resultados nacionales","Resultados por comunidades autónomas"];
    pending.forEach(function(g,i){if(labs[i])g.label=labs[i]});
   }
  }catch(e){}

  return groups;
 }

 return tables;
}

async function ineLoadTablesFromBase(op){
 var href=ineAbsoluteUrl(op&&op.href);
 if(!href)throw new Error("INE: l'operació no té URL d'INEbase.");
 var items=await ineLoadBaseLevel(href);
 if(items.length)return items.filter(function(x){return x.type==="table"});
 throw new Error("INE: no s'han trobat capsel ni taules a INEbase per a aquesta operació.");
}

async function ineLoadTablesFromBaseCatalog(op){
 // Mantingut només per compatibilitat amb versions anteriors; la navegació actual
 // ja és genèrica i no depèn de cap cid concret.
 var items=await ineLoadBaseLevel(ineAbsoluteUrl(op&&op.href));
 return {label:"Resultats",sections:items};
}

function ineTableGroupLabel(code){
 var c=String(code==null?"":code).trim();
 if(!c)return "Altres";
 var geoMap={
  "NAC":"Resultats nacionals",
  "NAC-CCAA":"Resultats per comunitats autònomes",
  "NAC-PROV":"Resultats per províncies",
  "CCAA":"Resultats per comunitats autònomes",
  "PROV":"Resultats per províncies",
  "MUN":"Resultats per municipis"
 };
 var parts=c.split("_"),geo=parts.pop()||"",cls=parts.join("_");
 var geoLabel=geoMap[geo]||geo;
 if(!cls)return geoLabel||c;
 var clsLabel=cls.replace(/^CNAE(\d+)$/i,"CNAE $1").replace(/_/g," ");
 return clsLabel+" — "+(geoLabel||geo||c);
}
async function ineLoadTables(op){
 await loadIneOperations();
 var apiOp=ineFindOperation(op);
 if(!apiOp)throw new Error("INE: no s'ha pogut identificar l'operació a Tempus3.");

 // Per a les operacions d'INE, Resultados d'INEbase és la font de navegació
 // estructural preferent. Si no hi ha estructura de resultats, continuem amb Tempus3.
 try{
  var resultUrl=ineAbsoluteUrl(op&&op.href),ru0=new URL(resultUrl);ru0.searchParams.set("menu","resultados");
  var resultItems=await ineLoadBaseLevel(ru0.href);
  if(resultItems.length)return {operation:apiOp,tree:{label:"Resultats",sections:resultItems}};
 }catch(e){}

 // Primer intentem sempre Tempus3. Si l'operació té taules en Tempus3,
 // aquest és el flux preferent i no entrem a la navegació d'INEbase.
 var candidates=[];
 [apiOp.Id,apiOp.Codigo,apiOp.Cod_IOE].forEach(function(v){
  var s=String(v==null?"":v).trim();
  if(s&&!candidates.includes(s))candidates.push(s);
 });
 var rows=[],lastErr=null;
 for(var ci=0;ci<candidates.length;ci++){
  try{
   var d=await fetchJson("https://servicios.ine.es/wstempus/js/ES/TABLAS_OPERACION/"+encodeURIComponent(candidates[ci])+"?det=2");
   var rr=a(d);
   if(rr.length){rows=rr;break;}
  }catch(e){lastErr=e;}
 }
 if(rows.length){
  var seen=new Set(),out=[];
  rows.forEach(function(x){
   var id=String(f(x,"Id","id","Codigo","codigo")).trim();
   var name=String(f(x,"Nombre","nombre","Name","name","Titulo","titulo")||id).trim();
   var codigo=String(f(x,"Codigo","codigo","Code","code")).trim();
   if(!id||seen.has(id))return;
   seen.add(id);
   out.push({id:id,label:id+" · "+name,type:"table",tableId:id,codigo:codigo});
  });
  if(out.length){
   out.sort(function(x,y){return x.label.localeCompare(y.label,"ca",{numeric:true})});
   var codeMap=new Map();
   out.forEach(function(x){
    var key=x.codigo||"";
    if(!codeMap.has(key))codeMap.set(key,[]);
    codeMap.get(key).push(x);
   });
   var codes=Array.from(codeMap.keys());
   if(codes.length>1){
    var groups=codes.map(function(code){
     return{
      id:"table-group:"+code,
      label:ineTableGroupLabel(code),
      type:"table-group",
      codigo:code,
      children:codeMap.get(code)||[]
     };
    });
    groups.sort(function(x,y){return x.label.localeCompare(y.label,"ca",{numeric:true})});
    return {operation:apiOp,items:out,tableGroups:groups};
   }
   return {operation:apiOp,items:out};
  }
 }

 // Si Tempus3 no té taules per a l'operació, utilitzem el flux INEbase
 // que ja tenim: Resultados -> capsel -> taules, de manera genèrica.
 try{
  var rootBase=ineAbsoluteUrl(op&&op.href),menus=["resultados","ultiDatos"];
 for(var mi=0;mi<menus.length;mi++){
  try{
   var ru=new URL(rootBase);
   ru.searchParams.set("menu",menus[mi]);
   var rootItems=await ineLoadBaseLevel(ru.href);
   if(rootItems.length)return {operation:apiOp,tree:{label:"Resultats",sections:rootItems}};
  }catch(e){}
 }
 // Darrer recurs: taules directes d'INEbase, només si Resultados no ha
 // proporcionat capsel ni taules.
 try{
  var baseItems=await ineLoadTablesFromBase(op);
  if(baseItems.length)return {operation:apiOp,items:baseItems};
 }catch(e){lastErr=e;}

 throw new Error(lastErr&&lastErr.message||"INE: no s'han trobat taules per a aquesta operació.");
}catch(e){lastErr=e;}
}
function ineLevelLabel(index){return index===0?"Grup temàtic":index===1?"Tema":index===2?"Operació estadística":"Nivell "+(index-2)}
async function ineSelectRoot(){
 await loadIneNavigation();ineClearNavigation();ineAddLevel(ineNavGroups(),0,ineLevelLabel(0));
}
async function ineSelectLevel(index,val){
 var items=state.ineItems.get("ineLevel"+index)||[],item=items.find(function(x){return String(x.id)===String(val)});
 if(!item)throw new Error("No s'ha trobat l'element de navegació seleccionat.");
 var box=$("eurostatLevels");
 if(box)Array.from(box.querySelectorAll("label")).forEach(function(l){if(Number(l.dataset.ineLevel)>index)l.remove()});
 state.inePath=state.inePath.slice(0,index);state.inePath[index]=item.id;
 if(index===0){
  var topics=await ineExplainCapselItems(ineNavTopics(item.id));ineAddLevel(topics,1,ineLevelLabel(1));return;
 }
 if(index===1){
  var group=state.inePath[0],ops=await ineExplainCapselItems(ineNavOperations(group,item.id));ineAddLevel(ops,2,ineLevelLabel(2));return;
 }
 if(index===2){
  status("Consultant l'INE…");
  var op=item,match=await ineLoadTables(op);
  state.selected.stat=String(match.operation.Id||match.operation.Codigo||"");
  state.inePath[2]=op.id;
  state.selected.node="";state.selected.table="";state.metadata=null;state.filters.clear();
  $("filters").innerHTML="";$("query").disabled=true;$("tableInfo").hidden=true;
  if(match.tree)ineAddLevel(match.tree.sections,3,match.tree.label||"Resultats");
  else if(match.tableGroups&&match.tableGroups.length>1)ineAddLevel(match.tableGroups,3,"Tipus de taula");
  else ineAddLevel(match.items,3,"Taula");
  status("");
  return;
 }
 if(item.type==="section"){
  status("Consultant l'INE…");
  var children=item.children||[];
  if(!children.length){
   try{children=await ineLoadBaseLevel(item.url)}catch(e){status("INE: "+(e&&e.message?e.message:String(e)),"error");return}
  }
  ineAddLevel(children,4,item.label||"Apartat");
  status("");
  return;
 }
 if(item.type==="capsel-group"){
  var groupLabel=item.label||"Apartat";
  if(/^Apartat\s+\d+$/i.test(String(groupLabel))){
   try{
    // El grup representa un capsel pare: el títol real és a ?padre=<id>.
    var gu=new URL("https://www.ine.es/dynt3/inebase/index.htm");
    gu.searchParams.set("padre",String(item.padre||""));
    var gh=await fetchText(gu.href,{cache:"no-store"});
    var gd=new DOMParser().parseFromString(gh,"text/html");
    var gh1=gd.querySelector('h1.inebase_titulo[id="c_'+String(item.padre||"")+'"]')||gd.querySelector("h1.inebase_titulo")||gd.querySelector("h1");
    if(gh1){
     var gt=String(gh1.textContent||"").replace(/\s+/g," ").trim().replace(/\s*[|·-]\s*(?:Instituto Nacional de Estadística|INE).*$/i,"").trim();
     if(gt)groupLabel=gt;
    }
   }catch(e){}
  }
  ineAddLevel(item.children||[],index+1,groupLabel);
  return;
 }
 if(item.type==="capsel"){
  status("Consultant l'INE…");
  var sub=[];
  try{sub=await ineLoadBaseLevel(item.url)}catch(e){status("INE: "+(e&&e.message?e.message:String(e)),"error");return}
  ineAddLevel(sub,index+1,item.label||"Apartat");
  status("");
  return;
 }
 if(item.type==="table-group"){
  ineAddLevel(item.children||[],index+1,"Taula");
  return;
 }
 if(item.type==="table"){
  state.selected.table=item.tableId;
  state.selected.node=item.tableId;
  await ineMetadata(item.tableId);
  return;
 }
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
function setLabels(){var p=state.provider,ls=p==="idescat"?["Organisme","Operació estadística","Tema","Encreuament","Entrada","Taula","Geografia"]:p==="istac"?["Organisme","Tema","Operació estadística","Taula","—","—"]:p==="pxweb"&&state.pxPreset==="sweden"?["Organisme","Grup temàtic","Nivell 2","Nivell 3","Taula","Geografia"]:p==="pxweb"&&state.pxPreset==="norway"?["Organisme","Grup temàtic","Nivell 2","Nivell 3","Nivell 4","Geografia"]:p==="pxweb"?["Organisme","Grup temàtic","Nivell 2","Nivell 3","Taula","Geografia"]:p==="ine"?["Organisme","Grup temàtic","","","","",""]:p==="nomis"?["Organisme","Estadística","","","",""]:p==="ige"?["Organisme","Grup temàtic","Tema","Taula","—","—"]:["Organisme","Grup temàtic","Tema","Estadística","—","—"];var l=document.querySelectorAll("#step2 label");document.querySelector("#step1 label:nth-child(1)").firstChild.textContent=ls[0]+" ";l.forEach(function(x,i){x.firstChild.textContent=ls[i+1]+" "})}
function recursiveProxyClearFrom(index){
 var box=$("eurostatLevels");if(!box)return;
 Array.from(box.querySelectorAll("[data-recursive-proxy]")).forEach(function(el){
  if(Number(el.dataset.recursiveProxy)>=Number(index))el.remove();
 });
}
function addUniversalRootLevel(items,labelText,onChange){var box=$("eurostatLevels");if(!box)return;box.innerHTML="";box.hidden=false;box.style.display="grid";var lab=document.createElement("label");lab.style.display="flex";lab.style.flexDirection="column";lab.style.alignItems="stretch";lab.appendChild(document.createTextNode(labelText+" "));var sel=document.createElement("select");sel.id="universalRootLevel";sel.appendChild(new Option("— Selecciona —",""));(items||[]).forEach(function(x){sel.appendChild(new Option(String(x.label||x.value||""),String(x.value||"")))});lab.appendChild(sel);box.appendChild(lab);sel.onchange=async function(){clearQueryView();if(!sel.value)return;try{await onChange(sel.value)}catch(e){status(e&&e.message?String(e.message):String(e),"error")}};if((items||[]).length===1){sel.value=String(items[0].value||"");sel.onchange()}}
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

function setProviderUI(){setLabels();var isEuro=state.provider==="eurostat",isIne=state.provider==="ine",isIstac=state.provider==="istac",isIcane=state.provider==="icane",isIge=state.provider==="ige",isNomis=state.provider==="nomis",isSweden=state.provider==="pxweb"&&state.pxPreset==="sweden",isFinland=state.provider==="pxweb"&&state.pxPreset==="finland",isIceland=state.provider==="pxweb"&&state.pxPreset==="iceland",isNorway=state.provider==="pxweb"&&state.pxPreset==="norway",isEustat=state.provider==="pxweb"&&state.pxPreset==="eustat",isFlatPx=state.provider==="pxweb"&&isEustat,sl=null;
 if(!isNomis)nomisHideSearchUI();
 otherBox=$("otherProviderWrap");if(otherBox)otherBox.hidden=!$("provider")||$("provider").value!=="other";var fixedGrid=document.querySelector("#step2>.grid"),euroBox=$("eurostatLevels");if(fixedGrid){fixedGrid.hidden=false;fixedGrid.style.display="";if(isSweden||isFinland||isIceland){Array.from(fixedGrid.querySelectorAll("label")).forEach(function(l,i){l.style.display=i===0?"":"none"})}}if(euroBox)euroBox.hidden=!(isEuro||isIstac||isIcane||isIge||isNomis||isSweden||isFinland||isIceland||isNorway||isIne||state.provider==="idescat"||isEustat);if((isEuro||isIne||isIstac||isIcane||isIge)&&fixedGrid){Array.from(fixedGrid.querySelectorAll("label")).forEach(function(l){l.style.display="none"})}else if(isNomis&&fixedGrid){Array.from(fixedGrid.querySelectorAll("label")).forEach(function(l,i){l.style.display=i===0?"":"none"});if(fixedGrid.querySelector("label"))fixedGrid.querySelector("label").firstChild.textContent="Dataset "}else if(isEustat&&fixedGrid){Array.from(fixedGrid.querySelectorAll("label")).forEach(function(l,i){l.style.display=i<3?"":"none"});if(fixedGrid.querySelector("label:nth-child(2)"))fixedGrid.querySelector("label:nth-child(2)").firstChild.textContent="Operació ";if(fixedGrid.querySelector("label:nth-child(3)"))fixedGrid.querySelector("label:nth-child(3)").firstChild.textContent="Taula "}else if(isNorway&&fixedGrid){Array.from(fixedGrid.querySelectorAll("label")).forEach(function(l){l.style.display="none"})}else if(isFlatPx&&fixedGrid){Array.from(fixedGrid.querySelectorAll("label")).forEach(function(l,i){l.style.display=i===0?"":"none"})}else if(fixedGrid&&!isSweden&&!isFinland&&!isIceland){Array.from(fixedGrid.querySelectorAll("label")).forEach(function(l){l.style.display=""})}if(fixedGrid&&(state.provider==="idescat"||isIstac||isIcane||isIge||isEustat||state.pxPreset==="unece")){fixedGrid.hidden=true;fixedGrid.style.display="none"} if(isNomis&&fixedGrid){fixedGrid.hidden=false;fixedGrid.style.display="";Array.from(fixedGrid.querySelectorAll("label")).forEach(function(l,i){l.style.display=i===0?"":"none"})}var tl=$("table")&&$("table").parentElement,gl=$("geo")&&$("geo").parentElement;if(tl)tl.style.display=(isEuro||isIne||isIstac||isIcane||isIge||isFlatPx||isNorway||isSweden||isFinland||isIceland)?"none":"";if(gl)gl.style.display=(isEuro||isIne||isIstac||isIcane||isIge||isFlatPx||isNorway||isSweden||isFinland||isIceland)?"none":""; var sel=(state.provider==="pxweb"||state.provider==="istac"||state.provider==="icane"||state.provider==="ige"||state.provider==="nomis")?"other":state.provider;if($("provider")&&[].slice.call($("provider").options).some(function(o){return o.value===sel}))$("provider").value=sel;if($("otherProvider"))$("otherProvider").value=state.provider==="istac"?"istac":state.provider==="icane"?"icane":state.provider==="ige"?"ige":state.provider==="nomis"?"nomis":state.provider==="nomis"?"nomis":(state.provider==="pxweb"&&state.pxPreset?"pxweb:"+state.pxPreset:"")}
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
function igeAbsUrl(href,base){
 try{return new URL(String(href||""),base||"https://www.ige.gal/").href}catch(e){return String(href||"")}
}
function igeCleanLabel(s){
 return String(s||"").replace(/\s+/g," ").replace(/\s*[-|·]\s*(?:Instituto Galego de Estatística|IGE).*$/i,"").trim();
}
function igeRootUrl(){
 return "https://www.ige.gal/web/index.jsp?idioma=es";
}
function igeIsNoiseLabel(label){
 label=String(label||"").replace(/\s+/g," ").trim();
 if(!label||label.length<2)return true;
 if(/^(Galego|Castellano|Español|English|English \(en\)|Escuchar|Escoitar)$/i.test(label))return true;
 if(/^(De acordo|Aceptar|Cookies|Aviso legal|Pol[ií]tica de|Contacto|Mapa web|RSS)$/i.test(label))return true;
 if(/redes sociais|redes sociales|facebook|twitter|instagram|youtube|linkedin/i.test(label))return true;
 if(/informaci[oó]n por cuadr[ií]cula|cuadr[ií]cula de 1\s*km/i.test(label))return true;
 if(/observatorio transfronterizo|readspeaker|compartir/i.test(label))return true;
 if(/resultados detallados|publicaciones\s*\/\s*folletos|banco de datos municipal/i.test(label))return true;
 return false;
}
async function igePageItems(url,isRoot){
 var html=await fetchText(url,{cache:"no-store"});
 var doc=new DOMParser().parseFromString(html,"text/html"),out=[],seen=new Set();
 var rootCodes=new Set((state.igeRoot||[]).map(function(x){return String(x.code||"")}));
 function add(type,href,label,code){
  href=igeAbsUrl(href,url);label=igeCleanLabel(label);code=String(code||"").trim();
  if(!href||!label||igeIsNoiseLabel(label)||seen.has(type+"|"+href))return;
  seen.add(type+"|"+href);out.push({id:href,label:label,type:type,url:href,code:code});
 }
 function inspectLink(href,label){
  href=String(href||"").replace(/&amp;/g,"&").trim();
  if(!href)return;
  var abs=igeAbsUrl(href,url),u;
  try{u=new URL(abs)}catch(e){return}
  if(u.hostname.toLowerCase()!=="www.ige.gal"&&u.hostname.toLowerCase()!=="ige.gal")return;
  var path=u.pathname.toLowerCase();
  var sec=u.searchParams.get("codigo");
  var cod=u.searchParams.get("COD")||u.searchParams.get("cod");
  // Seccions temàtiques
  if(path.indexOf("/mostrar_seccion.jsp")>=0&&sec){
   var sc=String(sec);
   if(isRoot){
    // arrels reals: 0101, 0201, 0306... (4 dígits) o 2 dígits de grup
    if(sc.length<=4)add("section",abs,label,sc);
    return;
   }
   if(rootCodes.has(sc))return;
   // Evita reintroduir menú global (codis curts de primer nivell)
   if(sc.length<=4&&(state.igeRoot||[]).some(function(r){return String(r.code)===sc||String(r.code).slice(0,2)===sc.slice(0,2)&&sc.length===4&&String(r.code).length===4&&String(r.code)!==sc})){
    // menú lateral amb altres seccions del mateix nivell: només si no és descendent del context es filtrarà després
   }
   add("section",abs,label,sc);
   return;
  }
  // Activitats estadístiques
  if(path.indexOf("/mostrar_actividade_estatistica.jsp")>=0&&sec){
   add("activity",abs,label,String(sec));
   return;
  }
  // Taules del banc de dades (selector i principals/hipertables)
  if((path.indexOf("/selector.jsp")>=0||path.indexOf("/principais.jsp")>=0||path.indexOf("/principales.jsp")>=0||path.indexOf("/verTabla.jsp")>=0||path.indexOf("/vertabla.jsp")>=0)&&cod){
   var canon="https://www.ige.gal/igebdt/selector.jsp?idioma=es&COD="+encodeURIComponent(String(cod));
   var featured=path.indexOf("/principais.jsp")>=0||path.indexOf("/principales.jsp")>=0;
   // id únic: featured vs catàleg (evita dedup prematur)
   var tid=featured?("ige-feat-"+cod):("ige-tab-"+cod);
   if(seen.has("table|"+tid))return;
   seen.add("table|"+tid);
   out.push({id:tid,label:label,type:"table",url:canon,code:String(cod),featured:!!featured});
   return;
  }
  // Enllaços amb COD= en rutes del banc de dades
  if(path.indexOf("/igebdt/")>=0&&cod&&!path.match(/actividade|seccion|mostrar_/i)){
   var canon2="https://www.ige.gal/igebdt/selector.jsp?idioma=es&COD="+encodeURIComponent(String(cod));
   var tid2="ige-tab-"+String(cod);
   if(seen.has("table|"+tid2))return;
   seen.add("table|"+tid2);
   out.push({id:tid2,label:label,type:"table",url:canon2,code:String(cod),featured:false});
   return;
  }
 }
 // Prioritza el contingut principal, però sempre completa amb la resta del document
 // per si el proxy retalla el DOM o el menú porta seccions filles.
 var scope=doc.querySelector("#paxina-contenido, #contenido, main, .paxina-contenido, #main");
 if(scope){
  Array.from(scope.querySelectorAll("a[href]")).forEach(function(aEl){
   inspectLink(aEl.getAttribute("href")||"",aEl.textContent||"");
  });
 }
 Array.from(doc.querySelectorAll("a[href]")).forEach(function(aEl){
  inspectLink(aEl.getAttribute("href")||"",aEl.textContent||"");
 });
 // Markdown de proxies
 var md=/\[([^\]]+)\]\(([^)]+)\)/g,mm;
 while((mm=md.exec(String(html||""))))inspectLink(mm[2],mm[1]);
 return out;
}
async function igeLoadRoot(){
 if(state.igeRoot&&state.igeRoot.length)return state.igeRoot;
 status("Carregant grups temàtics de l'IGE…");
 var items=await igePageItems(igeRootUrl(),true);
 var themes=items.filter(function(x){
  if(x.type!=="section")return false;
  var c=String(x.code||"");
  return /^\d{4}$/.test(c);
 });
 var seen=new Set();
 themes=themes.filter(function(x){var c=String(x.code);if(seen.has(c))return false;seen.add(c);return true});
 // Agrupa per prefix de 2 dígits per tenir "Estructura productiva", etc.
 var groupNames={
  "01":"Territorio y medio ambiente",
  "02":"Población y condiciones sociales",
  "03":"Estructura productiva",
  "04":"Conocimiento y tecnología",
  "05":"Temas transversales",
  "07":"Síntesis y panoramas"
 };
 var byGroup=new Map();
 themes.forEach(function(th){
  var g=String(th.code).slice(0,2);
  if(!byGroup.has(g))byGroup.set(g,[]);
  byGroup.get(g).push(th);
 });
 var roots=[];
 // Nivell 0 = grups; els fills es carregaran des de la home filtrant pel prefix
 byGroup.forEach(function(list,g){
  var label=groupNames[g]||("Grupo "+g);
  // URL del primer tema del grup (o cerca per codigo del grup)
  var url="https://www.ige.gal/web/index.jsp?idioma=es";
  roots.push({id:"ige-group-"+g,label:label,type:"group",url:url,code:g,_children:list.slice().sort(function(a,b){return a.label.localeCompare(b.label,"es",{numeric:true})})});
 });
 if(!roots.length){
  roots=themes.map(function(x){return x});
 }
 roots.sort(function(a,b){return a.label.localeCompare(b.label,"ca",{numeric:true})});
 state.igeRoot=roots;
 return roots;
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
 lab.appendChild(document.createTextNode(labelText+" "));
 var sel=document.createElement("select");sel.appendChild(new Option("— Selecciona —",""));
 list.forEach(function(x){sel.appendChild(new Option(x.label,x.id))});
 lab.appendChild(sel);box.appendChild(lab);box.hidden=false;box.style.display="grid";
 state.igeItems.set("igeLevel"+index,list);
 sel.onchange=async function(){
  clearQueryView();if(!sel.value)return;
  try{await igeSelectDynamic(index,sel.value)}catch(e){status((/^IGE:/i.test(String(e&&e.message||e))?"":"IGE: ")+(e&&e.message?String(e.message):String(e)),"error")}
 };
 if(list.length===1){sel.value=list[0].id;sel.onchange()}
}
async function igeSelectRoot(){
 igeClearLevels();
 state.igeMode=null;
 state.igeSelector=null;
 var modes=[
  {id:"ige-mode-tables",label:"Taules del banc de dades",type:"ige-mode",mode:"tables"},
  {id:"ige-mode-indicators",label:"Indicadors",type:"ige-mode",mode:"indicators"},
  {id:"ige-mode-series",label:"Sèries de conjuntura",type:"ige-mode",mode:"series"}
 ];
 igeAddLevel(modes,0,"Tipus de dades");
}
async function igeSelectDynamic(index,val){
 var items=state.igeItems.get("igeLevel"+index)||[],item=items.find(function(x){return String(x.id)===String(val)});
 if(!item)throw new Error("No s'ha trobat l'element seleccionat de l'IGE.");
 var box=$("eurostatLevels");
 if(box)Array.from(box.querySelectorAll("[data-ige-level]")).forEach(function(l){if(Number(l.dataset.igeLevel)>index)l.remove()});
 state.igePath=state.igePath.slice(0,index+1);state.igePath[index]=item.id;
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
function igeParseSelectorMeta(html,url,tableCode){
 var doc=new DOMParser().parseFromString(html,"text/html"),title="";
 var h=doc.querySelector("h1");if(h)title=igeCleanLabel(h.textContent||"");
 var download="";
 Array.from(doc.querySelectorAll("a[href]")).some(function(aEl){
  var h=aEl.getAttribute("href")||"";
  if(/\/igebdt\/igeapi\/csv\/datos\//i.test(h)){download=igeAbsUrl(h,url);return true}
  return false;
 });
 if(!download){
  var mm=String(html||"").match(/https?:\/\/www\.ige\.gal\/igebdt\/igeapi\/csv\/datos\/[^"'<>\s]+/i);
  if(mm)download=mm[0];
 }
 var spec="";
 if(download){
  var m=download.match(/\/datos\/([^/]+)\/([^?]+)$/i);
  if(m)spec=decodeURIComponent(m[2]);
 }
 var rawDims=[],dimMap=new Map();
 if(spec){
  spec.split(",").forEach(function(seg){
   seg=String(seg||"").trim();if(!seg)return;
   var mm=seg.match(/^([^\[]+)(?:\[([^\]]+)\])?:(.*)$/);
   if(!mm)return;
   rawDims.push({id:String(mm[1]).trim(),defaultSpec:seg,rawValue:mm[3]});
  });
 }
 var selects=Array.from(doc.querySelectorAll("select"));
 var selectInfo=selects.map(function(sel){
  var opts=Array.from(sel.options||[]).map(function(o){return{raw:String(o.value||"").trim(),label:igeCleanLabel(o.textContent||"")}}).filter(function(o){return o.raw!==""});
  return{sel:sel,opts:opts,used:false};
 }).filter(function(x){return x.opts.length});
 function selectorLabel(sel,fallback){
  var label="";
  try{
   var p=sel.previousElementSibling;if(p)label=igeCleanLabel(p.textContent||"");
   if(!label){var par=sel.parentElement;if(par)label=igeCleanLabel(par.textContent||"").replace(/(?:— Selecciona —|Seleccionar|Seleccionados:).*$/i,"").trim()}
  }catch(e){}
  return label||fallback;
 }
 rawDims.forEach(function(rd){
  if(dimMap.has(rd.id))return;
  var candidate=selectInfo.find(function(si){
   return !si.used&&si.opts.some(function(o){
    if(o.raw===rd.defaultSpec)return true;
    var mm=o.raw.match(/^([^:]+):(.+)$/);
    return mm&&String(mm[1]).trim()===rd.id;
   });
  });
  if(!candidate)return;
  var candidates=candidate.opts.filter(function(o){
   var mm=o.raw.match(/^([^:]+):(.+)$/);
   return mm&&String(mm[1]).trim()===rd.id;
  });
  if(!candidates.length)candidates=candidate.opts;
  var cats=candidates.map(function(o){
   var mm=o.raw.match(/^([^:]+):(.+)$/),code=mm?mm[2]:o.raw;
   return{code:String(code),label:o.label||String(code)};
  });
  candidate.used=true;
  dimMap.set(rd.id,{id:rd.id,label:selectorLabel(candidate.sel,rd.id),categories:cats,defaultSpec:rd.defaultSpec});
 });
 // Darrer recurs: assignem selectores encara no utilitzats per ordre a les dimensions
 // que encara no han pogut ser identificades. Això cobreix taules on l'HTML no
 // exposa el prefix de dimensió en el value de l'opció.
 rawDims.forEach(function(rd){
  if(dimMap.has(rd.id))return;
  var candidate=selectInfo.find(function(si){return !si.used});
  if(!candidate)return;
  var cats=candidate.opts.map(function(o){
   var mm=o.raw.match(/^([^:]+):(.+)$/),code=mm?mm[2]:o.raw;
   return{code:String(code),label:o.label||String(code)};
  });
  candidate.used=true;
  dimMap.set(rd.id,{id:rd.id,label:selectorLabel(candidate.sel,rd.id),categories:cats,defaultSpec:rd.defaultSpec});
 });
 rawDims.forEach(function(rd){if(!dimMap.has(rd.id))dimMap.set(rd.id,{id:rd.id,label:rd.id,categories:[],defaultSpec:rd.defaultSpec})});
 return{title:title||"Taula "+tableCode,tableCode:String(tableCode),downloadUrl:download,dims:rawDims.map(function(rd){return dimMap.get(rd.id)})};
}
async function igeLoadIndicatorGroups(){
 var html=await fetchText("https://www.ige.gal/igebdt/igeapi/indicadores.jsp?idioma=es",{cache:"no-store"});
 var out=[],seen=new Set();
 function add(code,label){
  code=String(code||"").toUpperCase();
  label=igeCleanLabel(label);
  if(!code||!/^G\d+$/i.test(code)||seen.has(code))return;
  if(!label||igeIsNoiseLabel(label))label=code;
  seen.add(code);
  out.push({id:"ige-indig-"+code,label:label,type:"ige-indicator-group",code:code,url:"https://www.ige.gal/igebdt/igeapi/indicadores.jsp?idioma=es&grupo="+encodeURIComponent(code)});
 }
 try{
  var doc=new DOMParser().parseFromString(html,"text/html");
  Array.from(doc.querySelectorAll('a[href*="grupo="]')).forEach(function(a){
   var href=a.getAttribute("href")||"";
   var m=href.match(/grupo=(G\d+)/i);
   if(m)add(m[1],a.textContent||"");
  });
 }catch(e){}
 // Regex fallback (proxies markdown / HTML parcial)
 var re=/grupo=(G\d+)/gi,m;
 var labels={};
 var reLab=/indicadores\.jsp\?grupo=(G\d+)[^"']*["'][^>]*>([^<]+)/gi;
 while((m=reLab.exec(String(html||""))))labels[m[1].toUpperCase()]=m[2];
 while((m=re.exec(String(html||""))))add(m[1],labels[m[1].toUpperCase()]||m[1]);
 // Grups coneguts si la pàgina falla del tot
 if(!out.length){
  [["G0001","Población"],["G0002","Sanidad"],["G0003","Educación"],["G0004","Trabajo"],["G0005","Bienestar y condiciones de vida"],["G0006","Cultura y ocio"],["G0007","Agricultura y pesca"],["G0008","Energía e industria"],["G0009","Construcción y vivienda"],["G0010","Servicios"],["G0011","Administración Pública"],["G0014","Sector exterior"],["G0015","Precios"],["G0016","Actividad empresarial"],["G0017","Sistema de cuentas"],["G0018","Sociedad de la información"],["G0019","Ciencia y tecnología"],["G0020","Territorio"]].forEach(function(p){add(p[0],p[1])});
 }
 out.sort(function(a,b){return a.label.localeCompare(b.label,"es",{numeric:true,sensitivity:"base"})});
 return out;
}
async function igeLoadIndicators(groupCode){
 var url="https://www.ige.gal/igebdt/igeapi/indicadores.jsp?idioma=es&grupo="+encodeURIComponent(groupCode);
 var html=await fetchText(url,{cache:"no-store"});
 var out=[],seen=new Set();
 function add(code,label){
  code=String(code||"").trim();
  label=igeCleanLabel(label);
  if(!code||seen.has(code))return;
  if(!label||igeIsNoiseLabel(label))label=code;
  seen.add(code);
  out.push({id:"ige-indi-"+code,label:label,type:"ige-indicator",code:code,url:"https://www.ige.gal/igebdt/igeapi/json/datosindi/"+encodeURIComponent(code)});
 }
 try{
  var doc=new DOMParser().parseFromString(html,"text/html");
  Array.from(doc.querySelectorAll('a[href*="indicador="]')).forEach(function(a){
   var href=a.getAttribute("href")||"";
   var m=href.match(/indicador=([A-Za-z0-9_]+)/);
   if(m)add(m[1],a.textContent||"");
  });
 }catch(e){}
 var re=/indicador=([A-Za-z0-9_]+)/g,m;
 var reLab=/indicador=([A-Za-z0-9_]+)[^"']*["'][^>]*>([^<]+)/gi;
 var labels={};
 while((m=reLab.exec(String(html||""))))labels[m[1]]=m[2];
 // markdown
 var md=/\[([^\]]+)\]\(([^)]*indicador=([A-Za-z0-9_]+)[^)]*)\)/g;
 while((m=md.exec(String(html||""))))labels[m[3]]=m[1];
 while((m=re.exec(String(html||""))))add(m[1],labels[m[1]]||m[1]);
 out.sort(function(a,b){return a.label.localeCompare(b.label,"es",{numeric:true})});
 if(!out.length)throw new Error("no s'han trobat indicadors en aquest grup.");
 return out;
}
function igeExtractDivInner(html, id){
 html=String(html||"");
 var re=new RegExp('id=["\']'+String(id).replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+'["\'][^>]*>','i');
 var m=re.exec(html);
 if(!m)return"";
 var i=m.index+m[0].length;
 var depth=1,j=i;
 var low=html.toLowerCase();
 while(j<html.length&&depth>0){
  var nextOpen=low.indexOf("<div",j);
  var nextClose=low.indexOf("</div",j);
  if(nextClose<0)break;
  if(nextOpen>=0&&nextOpen<nextClose){
   depth++;
   j=nextOpen+4;
  }else{
   depth--;
   if(depth===0)return html.slice(i,nextClose);
   j=nextClose+5;
  }
 }
 return html.slice(i,i+50000);
}
function igeSeriesParentMap(html){
 html=String(html||"");
 var labels={}, positions=[];
 var reLab=/procGrupo\('([^']+)'\)[^>]*>([^<]+)</g,m;
 while((m=reLab.exec(html))){
  labels[m[1]]=igeCleanLabel(m[2]);
  positions.push({code:m[1],pos:m.index});
 }
 // Div ranges for each group id
 var ranges={};
 var reDiv=/<div id="([A-Za-z0-9_]+)"/gi;
 while((m=reDiv.exec(html))){
  var code=m[1], start=m.index;
  var i=html.indexOf(">",start)+1, depth=1, j=i, end=-1;
  var low=html.toLowerCase();
  while(j<low.length&&depth>0){
   var no=low.indexOf("<div",j), nc=low.indexOf("</div",j);
   if(nc<0)break;
   if(no>=0&&no<nc){depth++;j=no+4;}
   else{depth--;if(depth===0){end=nc;break;}j=nc+5;}
  }
  if(end>start)ranges[code]={start:start,end:end};
 }
 function parentOf(pos){
  var parent=null,best=-1;
  Object.keys(ranges).forEach(function(code){
   var r=ranges[code];
   if(r.start<pos&&pos<r.end&&r.start>best){best=r.start;parent=code;}
  });
  return parent;
 }
 var roots=[], children={};
 positions.forEach(function(p){
  var par=parentOf(p.pos);
  if(!par){
   roots.push({code:p.code,label:labels[p.code]||p.code});
  }else{
   if(!children[par])children[par]=[];
   children[par].push({code:p.code,label:labels[p.code]||p.code});
  }
 });
 return{labels:labels,roots:roots,children:children};
}
async function igeLoadSeriesGroups(){
 var html=await fetchText("https://www.ige.gal/igebdt/igeapi/series.jsp?idioma=es",{cache:"no-store"});
 var map=igeSeriesParentMap(html);
 // Només grups arrel (ex.: Construción, no Accesibilidade)
 var out=map.roots.map(function(r){
  return{id:"ige-serg-"+r.code,label:r.label,type:"ige-series-group",code:r.code,url:"https://www.ige.gal/igebdt/igeapi/series.jsp?idioma=es&grupo="+encodeURIComponent(r.code)};
 }).filter(function(x){return x.label&&!igeIsNoiseLabel(x.label)});
 out.sort(function(a,b){return a.label.localeCompare(b.label,"gl",{numeric:true,sensitivity:"base"})});
 if(!out.length)throw new Error("no s'han trobat grups de sèries.");
 // Desa mapa per reutilitzar fills
 state.igeSeriesTree=map;
 return out;
}
async function igeLoadSeriesSubgroups(groupCode){
 // Prefereix l'arbre en memòria si el tenim
 var map=state.igeSeriesTree;
 if(!map){
  var html0=await fetchText("https://www.ige.gal/igebdt/igeapi/series.jsp?idioma=es",{cache:"no-store"});
  map=igeSeriesParentMap(html0);
  state.igeSeriesTree=map;
 }
 var out=[],seen=new Set();
 function add(item){
  if(!item||!item.code||seen.has(item.code))return;
  seen.add(item.code);
  out.push(item);
 }
 // Subcarpetes (fills a l'arbre)
 (map.children[groupCode]||[]).forEach(function(ch){
  add({id:"ige-serg-"+ch.code,label:ch.label,type:"ige-series-group",code:ch.code,url:"https://www.ige.gal/igebdt/igeapi/series.jsp?idioma=es&grupo="+encodeURIComponent(ch.code)});
 });
 // Subgrups fulla: enllaços subgrupo dins del div del grup
 var url="https://www.ige.gal/igebdt/igeapi/series.jsp?idioma=es&grupo="+encodeURIComponent(groupCode);
 var html=await fetchText(url,{cache:"no-store"});
 var inner=igeExtractDivInner(html,groupCode)||"";
 var reA=/href=["']([^"']*)["'][^>]*>([^<]*)/gi,m;
 while((m=reA.exec(inner||html))){
  var href=(m[1]||"").replace(/&amp;/g,"&");
  var label=igeCleanLabel(m[2]||"");
  var gm=href.match(/[?&]grupo=([^&]+)/i);
  var sm=href.match(/[?&]subgrupo=([^&]+)/i);
  if(!sm)continue;
  var g,sub;
  try{g=gm?decodeURIComponent(gm[1]):groupCode;sub=decodeURIComponent(sm[1])}catch(e){g=gm?gm[1]:groupCode;sub=sm[1]}
  if(g&&g!==groupCode)continue;
  // Si té serie= al mateix enllaç, és sèrie directa: la tractarem al nivell sèrie
  if(/[?&]serie=/i.test(href))continue;
  if(!label||igeIsNoiseLabel(label))label=sub;
  add({id:"ige-sersg-"+groupCode+"-"+sub,label:label,type:"ige-series-subgroup",code:sub,groupCode:groupCode,url:"https://www.ige.gal/igebdt/igeapi/series.jsp?idioma=es&grupo="+encodeURIComponent(groupCode)+"&subgrupo="+encodeURIComponent(sub)});
 }
 out.sort(function(a,b){return a.label.localeCompare(b.label,"gl",{numeric:true,sensitivity:"base"})});
 return out;
}
async function igeLoadSeriesList(groupCode,subCode){
 var url="https://www.ige.gal/igebdt/igeapi/series.jsp?idioma=es&grupo="+encodeURIComponent(groupCode);
 if(subCode)url+="&subgrupo="+encodeURIComponent(subCode);
 // Assegura formato JSON a la petició de pàgina (com fa el web de l'IGE)
 url+="&formato=JSON";
 var html=await fetchText(url,{cache:"no-store"});
 var out=[],seen=new Set();
 function add(code,label){
  code=String(code||"").trim();
  if(!code||seen.has(code))return;
  label=igeCleanLabel(label)||code;
  if(igeIsNoiseLabel(label))label=code;
  seen.add(code);
  out.push({id:"ige-ser-"+code,label:label,type:"ige-series",code:code,url:"https://www.ige.gal/igebdt/igeapi/json/datosserc/"+encodeURIComponent(code)});
 }
 // 1) Tots els href amb serie=
 var re=/href\s*=\s*["']([^"']*serie=[^"']*)["'][^>]*>([\s\S]*?)<\s*\/\s*a/gi,m;
 while((m=re.exec(String(html||"")))){
  var href=m[1].replace(/&amp;/g,"&");
  var label=igeCleanLabel(m[2].replace(/<[^>]+>/g," "));
  var sm=href.match(/[?&]serie=([^&]+)/i);
  if(!sm)continue;
  // Filtra per subgrup/grup si surten a l'URL
  if(subCode){
   var sg=href.match(/[?&]subgrupo=([^&]+)/i);
   if(sg){
    var s;try{s=decodeURIComponent(sg[1])}catch(e){s=sg[1]}
    if(s!==subCode)continue;
   }
  }
  if(groupCode){
   var gg=href.match(/[?&]grupo=([^&]+)/i);
   if(gg){
    var g;try{g=decodeURIComponent(gg[1])}catch(e){g=gg[1]}
    if(g&&g!==groupCode)continue;
   }
  }
  try{add(decodeURIComponent(sm[1]),label)}catch(e){add(sm[1],label)}
 }
 // 2) verDirec('CODE')
 var reV=/verDirec\(\s*['"]([^'"]+)['"]/g;
 while((m=reV.exec(String(html||"")))){
  var code=m[1];
  if(seen.has(code))continue;
  // Només si apareix amb serie=CODE a la pàgina
  if(new RegExp("[?&]serie="+code.replace(/[.*+?^${}()|[\\]\\\\]/g,"\\\\$&")+"\\b","i").test(html)){
   add(code,code);
  }
 }
 // 3) Fallback DEF: el subgrup és la sèrie
 if(!out.length&&subCode){
  // Comprova si l'API té dades abans d'oferir-lo
  try{
   var test=await fetchJson("https://www.ige.gal/igebdt/igeapi/json/datosserc/"+encodeURIComponent(subCode));
   var rows=Array.isArray(test&&test.datos)?test.datos:[];
   if(rows.length)add(subCode,subCode);
  }catch(e){}
 }
 out.sort(function(a,b){return a.label.localeCompare(b.label,"gl",{numeric:true,sensitivity:"base"})});
 if(!out.length)throw new Error("no s'han trobat sèries amb dades en aquest apartat.");
 return out;
}
async function igeSelectIndiOrSeries(rec){
 status("Carregant dades de l'IGE…");
 var kind=rec.type==="ige-series"?"series":"indicator";
 var urls=[rec.url];
 if(kind==="series"){
  var code=String(rec.code||"").trim();
  urls=["https://www.ige.gal/igebdt/igeapi/json/datosserc/"+encodeURIComponent(code)];
  // alguns codis antics només responen a datosindi
  urls.push("https://www.ige.gal/igebdt/igeapi/json/datosindi/"+encodeURIComponent(code));
 }
 var raw=null,usedUrl=rec.url;
 for(var ui=0;ui<urls.length;ui++){
  try{
   var cand=await fetchJson(urls[ui]);
   var rows0=Array.isArray(cand&&cand.datos)?cand.datos:[];
   if(rows0.length){raw=cand;usedUrl=urls[ui];break}
   if(!raw)raw=cand;
  }catch(eFetch){/* prova següent */}
 }
 if(!raw)throw new Error("no s'ha pogut obtenir la resposta de l'API.");
 var vars=Array.isArray(raw&&raw.variables)?raw.variables:[];
 var rows=Array.isArray(raw&&raw.datos)?raw.datos:[];
 if(!vars.length)throw new Error("resposta sense variables.");
 if(!rows.length)throw new Error("l'API de l'IGE no retorna dades per al codi "+JSON.stringify(String(rec.code||""))+". Cal triar una sèrie amb paràmetre serie=.");
 rec.url=usedUrl;

 // Construeix dimensions a partir de les columnes
 var dims=[];
 function addDim(id,label,codeIdx,labelIdx,role){
  var cats=[],seen=new Set();
  rows.forEach(function(r){
   var code=String(r[codeIdx]==null?"":r[codeIdx]).trim();
   if(!code||seen.has(code))return;
   seen.add(code);
   var lab=labelIdx>=0?String(r[labelIdx]==null?code:r[labelIdx]).trim():code;
   cats.push({code:code,label:lab||code});
  });
  if(cats.length)dims.push({id:id,label:label,role:role||"",categories:cats});
 }
 var vi=function(name){return vars.findIndex(function(v){return String(v).toLowerCase()===name})};
 var iCodT=vi("codtempo"),iTempo=vi("tempo");
 var iCodE=vi("codespazo"),iEsp=vi("espazo");
 if(iCodT>=0||iTempo>=0)addDim("tempo","Tempo",iCodT>=0?iCodT:iTempo,iTempo>=0?iTempo:-1,"time");
 if(iCodE>=0||iEsp>=0)addDim("espazo","Espazo",iCodE>=0?iCodE:iEsp,iEsp>=0?iEsp:-1,"");
 // Altres columnes (excepte valor)
 var skip=new Set(["daton","datot","dato","indicador","serie"]);
 vars.forEach(function(v,idx){
  var vn=String(v).toLowerCase();
  if(skip.has(vn)||idx===iCodT||idx===iTempo||idx===iCodE||idx===iEsp)return;
  if(/^cod/.test(vn))return; // es tracta amb la columna etiqueta
  addDim(vn,String(v),idx,-1,"");
 });
 if(!dims.length)throw new Error("no s'han pogut obtenir dimensions.");
 var meta={
  kind:kind,
  title:rec.label||rec.code,
  tableCode:rec.code,
  downloadUrl:rec.url,
  dims:dims
 };
 state.igeSelector=meta;
 state.selected.stat=rec.code;state.selected.concept=rec.code;state.selected.cross=rec.code;state.selected.node=rec.code;state.selected.table=rec.code;
 var ds={class:"dataset",version:"2.0",label:meta.title,id:dims.map(function(d){return d.id}),size:dims.map(function(d){return d.categories.length}),dimension:{}};
 dims.forEach(function(d){
  var lab={};d.categories.forEach(function(c){lab[c.code]=c.label});
  ds.dimension[d.id]={label:d.label,category:{index:d.categories.map(function(c){return c.code}),label:lab}};
  if(d.role){ds.dimension[d.id].role=d.role;ds.dimension[d.id].extension={role:d.role}}
 });
 state.metadata=ds;renderMetadata(ds);
 $("tableInfo").hidden=false;
 $("tableInfo").innerHTML="<strong>"+(kind==="series"?"Sèrie":"Indicador")+":</strong> "+esc(meta.title)+"<span class=\"path\">"+esc(rec.url)+"</span><p>Este producto emplea la API de datos del Instituto Galego de Estatística (IGE), pero no está certificado o aprobado por el IGE.</p>";
 $("query").disabled=false;
 status("");
}
async function igeSelectTable(rec){
 status("Carregant la taula de l'IGE…");
 var tableCode=String(rec.code||"").trim();
 if(!tableCode){
  // intenta COD de la URL
  try{tableCode=String(new URL(rec.url).searchParams.get("COD")||"").trim()}catch(e){}
 }
 if(!tableCode)throw new Error("IGE: no s'ha pogut determinar el codi de la taula.");
 var metaUrl="https://www.ige.gal/igebdt/igeapi/json/metadatos/"+encodeURIComponent(tableCode)+"/selector";
 var raw=await fetchJson(metaUrl);
 var meta=igeParseMetadatosSelector(raw,tableCode,rec.url);
 if(!meta||!meta.dims||!meta.dims.length)throw new Error("no s'han pogut obtenir les dimensions de la taula.");
 // Assegura categories no buides
 meta.dims=meta.dims.filter(function(d){return d&&d.id!=null&&Array.isArray(d.categories)&&d.categories.length});
 if(!meta.dims.length)throw new Error("no s'han pogut obtenir les dimensions de la taula.");
 state.igeSelector=meta;
 state.selected.stat=meta.tableCode;
 state.selected.concept=meta.tableCode;
 state.selected.cross=meta.tableCode;
 state.selected.node=meta.tableCode;
 state.selected.table=meta.tableCode;
 state.selected.geo="";
 var ds={class:"dataset",version:"2.0",label:meta.title,id:meta.dims.map(function(d){return d.id}),size:meta.dims.map(function(d){return d.categories.length}),dimension:{}};
 meta.dims.forEach(function(d){
  var idx={},lab={};
  d.categories.forEach(function(c,i){idx[c.code]=i;lab[c.code]=c.label});
  ds.dimension[d.id]={label:d.label,category:{index:d.categories.map(function(c){return c.code}),label:lab}};
  if(d.role)ds.dimension[d.id].role=d.role;
  if(d.role)ds.dimension[d.id].extension={role:d.role};
 });
 state.metadata=ds;
 renderMetadata(ds);
 $("tableInfo").hidden=false;
 $("tableInfo").innerHTML="<strong>Taula:</strong> "+esc(meta.title)+"<span class=\"path\">"+esc(metaUrl)+"</span><p>Este producto emplea la API de datos del Instituto Galego de Estatística (IGE), pero no está certificado o aprobado por el IGE.</p>";
 $("query").disabled=false;
 status("");
}
function igeParseMetadatosSelector(raw,tableCode,pageUrl){
 // Format API: [ {meta taula}, [eixos...], [valors...], [nivells...], {config} ]
 var arr=Array.isArray(raw)?raw:(raw&&Array.isArray(raw.data)?raw.data:null);
 if(!arr||!arr.length)return null;
 var head=arr[0]&&typeof arr[0]==="object"&&!Array.isArray(arr[0])?arr[0]:{};
 var title=String(head.TITESP||head.TITTABLA||("Taula "+tableCode)).trim();
 var axes=[],values=[];
 for(var i=1;i<arr.length;i++){
  var el=arr[i];
  if(!Array.isArray(el)||!el.length||typeof el[0]!=="object")continue;
  if(el[0].DIMEN!=null||(el[0].EJE!=null&&el[0].CODELEM==null&&el[0].TXTELEM==null&&el[0].n0==null)){
   // definició d'eixos
   if(el[0].DIMEN!=null)axes=el;
  }
  if(el[0].CODELEM!=null||el[0].TXTELEM!=null){
   values=values.concat(el);
  }
 }
 if(!axes.length){
  // reconstrueix eixos a partir dels valors
  var seen=new Map();
  values.forEach(function(v){
   var e=String(v.EJE);
   if(!seen.has(e))seen.set(e,{EJE:v.EJE,DIMEN:"Eix "+e});
  });
  axes=Array.from(seen.values());
 }
 var byEje=new Map();
 values.forEach(function(v){
  var e=String(v.EJE);
  if(!byEje.has(e))byEje.set(e,[]);
  byEje.get(e).push(v);
 });
 var dims=axes.map(function(ax){
  var id=String(ax.EJE);
  var label=String(ax.DIMEN||("Eix "+id)).trim();
  var cats=(byEje.get(id)||[]).slice().sort(function(a,b){
   return Number(a.ORDEN||a.ORDENDAT||0)-Number(b.ORDEN||b.ORDENDAT||0);
  }).map(function(v){
   var code=String(v.CODELEM!=null?v.CODELEM:"").trim();
   var lab=String(v.TXTELEM!=null?v.TXTELEM:code).trim();
   return{code:code,label:lab||code};
  }).filter(function(c){return c.code!==""});
  // dedup codes
  var seenC=new Set(),out=[];
  cats.forEach(function(c){if(seenC.has(c.code))return;seenC.add(c.code);out.push(c)});
  var labU=label.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase();
  var role="";
  if(labU==="TEMPO"||labU.indexOf("TEMPO ")===0||labU==="TIEMPO"||labU.indexOf("TIEMPO ")===0||labU==="TIME"||labU.indexOf("TIME ")===0||labU.indexOf("TEMPORAL")>=0||labU==="PERIODO"||labU==="PERIOD")role="time";
  return{id:id,label:label,role:role,categories:out,defaultSpec:id};
 }).filter(function(d){return d.categories.length});
 return{
  title:title,
  tableCode:String(tableCode),
  downloadUrl:"",
  dims:dims,
  unit:String(head.UNITABLA||""),
  source:String(head.FUENTE||""),
  pageUrl:pageUrl||""
 };
}
function igeRowsToJsonStat(raw,meta){
 var vars=Array.isArray(raw&&raw.variables)?raw.variables:[],rows=Array.isArray(raw&&raw.datos)?raw.datos:[];
 if(!vars.length||!rows.length)return null;
 var md=meta&&Array.isArray(meta.dims)?meta.dims:[];
 var measureIdx=vars.findIndex(function(v){return String(v||"")==="DatoN"});
 if(measureIdx<0)measureIdx=vars.length-2;
 var sourceCols=[],vi=0;
 while(vi<measureIdx){
  var vn=String(vars[vi]||"").trim();
  if(/^Cod/i.test(vn)&&vi+1<measureIdx){
   sourceCols.push({codeIdx:vi,labelIdx:vi+1});vi+=2;
  }else{
   sourceCols.push({codeIdx:vi,labelIdx:vi});vi++;
  }
 }
 var cols=md.map(function(d,j){
  var idx=vars.findIndex(function(v){return String(v||"").trim()===String(d.label||"").trim()});
  if(idx>=0)return{dim:d,codeIdx:idx,labelIdx:idx};
  var ci=vars.findIndex(function(v){return /^Cod/i.test(String(v||""))&&String(v).replace(/^Cod/i,"").trim().toLowerCase()===String(d.label||"").trim().toLowerCase()});
  if(ci>=0&&ci+1<vars.length)return{dim:d,codeIdx:ci,labelIdx:ci+1};
  return Object.assign({dim:d},sourceCols[j]||{codeIdx:-1,labelIdx:-1});
 });
 var catMaps=new Map();
 cols.forEach(function(c){
  var idx=new Map(),label={};
  if(c.codeIdx>=0){
   rows.forEach(function(r){
    var code=String(r[c.codeIdx]==null?"":r[c.codeIdx]),lab=c.labelIdx>=0?String(r[c.labelIdx]==null?"":r[c.labelIdx]):code;
    if(code&&!idx.has(code)){idx.set(code,idx.size);label[code]=lab||code}
   });
  }
  if(c.codeIdx<0&&c.labelIdx>=0){
   rows.forEach(function(r){var code=String(r[c.labelIdx]==null?"":r[c.labelIdx]);if(code&&!idx.has(code)){idx.set(code,idx.size);label[code]=code}});
  }
  catMaps.set(c.dim.id,{index:idx,label:label});
 });
 var out={class:"dataset",version:"2.0",label:meta.title,id:md.map(function(d){return d.id}),size:md.map(function(d){var m=catMaps.get(d.id);return m?m.index.size:0}),dimension:{}};
 md.forEach(function(d){var m=catMaps.get(d.id)||{index:new Map(),label:{}},codes=Array.from(m.index.keys());out.dimension[d.id]={label:d.label,category:{index:codes,label:m.label}}});
 var measureIdx=vars.findIndex(function(v){return String(v||"")==="DatoN"});if(measureIdx<0)measureIdx=vars.length-2;
 var strides=[],st=1;for(var j=out.size.length-1;j>=0;j--){strides[j]=st;st*=Number(out.size[j]||0)}
 var vals=new Array(st).fill(null);
 rows.forEach(function(r){
  var flat=0,ok=true;
  md.forEach(function(d,j){var c=cols[j],code="";if(c.codeIdx>=0)code=String(r[c.codeIdx]==null?"":r[c.codeIdx]);else if(c.labelIdx>=0)code=String(r[c.labelIdx]==null?"":r[c.labelIdx]);var m=catMaps.get(d.id),pos=m&&m.index.get(code);if(pos==null){ok=false;return}flat+=pos*strides[j]});
  if(!ok)return;var v=r[measureIdx];vals[flat]=v===""?null:v;
 });
 out.value=vals;return out;
}
async function igeQuery(filters){
 var meta=state.igeSelector;if(!meta)throw new Error("no hi ha una taula seleccionada.");
 // Indicadors / sèries de conjuntura
 if(meta.kind==="indicator"||meta.kind==="series"){
  var u=meta.downloadUrl;
  if(!u)throw new Error("no hi ha URL de dades.");
  var raw=await fetchJson(u);
  var ds=igeFlatToJsonStat(raw,meta,filters);
  if(!ds)throw new Error("la resposta de dades no s'ha pogut convertir a JSON-stat.");
  return{data:ds,url:u};
 }
 var parts=[];
 meta.dims.forEach(function(d){
  var selected=filters&&filters[d.id]&&filters[d.id].length?filters[d.id]:null;
  if(!selected||!selected.length)return;
  if(selected.length>=(d.categories||[]).length)return;
  parts.push(d.id+":"+selected.map(String).join(":"));
 });
 var path=parts.join(",");
 // JSON-stat 2.0 (UTF-8) — evita ISO-8859-1 i el parse manual de files
 var u=provider().base+"/jsonstat2/datos/"+encodeURIComponent(meta.tableCode)+(path?"/"+path:"");
 var ds=await fetchJson(u);
 if(!ds||ds.class!=="dataset"&&!ds.dimension){
  // fallback al format pla
  var u2=provider().base+"/json/datos/"+encodeURIComponent(meta.tableCode)+(path?"/"+path:"");
  var raw=await fetchJson(u2);
  ds=igeRowsToJsonStat(raw,meta);
  if(!ds)throw new Error("la resposta de dades no s'ha pogut convertir a JSON-stat.");
  return{data:ds,url:u2};
 }
 // Enrich labels from selector metadata
 if(meta&&Array.isArray(meta.dims)&&ds.dimension){
  meta.dims.forEach(function(d){
   if(ds.dimension[d.id]&&d.label)ds.dimension[d.id].label=d.label;
   if(d.role){
    ds.dimension[d.id].role=d.role;
    ds.dimension[d.id].extension=Object.assign({},ds.dimension[d.id].extension||{},{role:d.role});
   }
  });
  if(!ds.label&&meta.title)ds.label=meta.title;
 }
 return{data:ds,url:u};
}
/** Converteix la resposta plana {variables,datos} d'indicadors/sèries a JSON-stat 2.0 */
function igeFlatToJsonStat(raw,meta,filters){
 var vars=Array.isArray(raw&&raw.variables)?raw.variables:[];
 var rows=Array.isArray(raw&&raw.datos)?raw.datos:[];
 if(!vars.length||!rows.length)return null;
 // Cerca columna de valor numèric
 var measureIdx=vars.findIndex(function(v){return /^(datoN|dato|DatoN)$/i.test(String(v))});
 if(measureIdx<0)measureIdx=vars.length-1;
 var dimCols=[];
 for(var i=0;i<vars.length;i++){
  if(i===measureIdx)continue;
  var vn=String(vars[i]||"");
  // Saltem etiquetes si hi ha columna Cod* abans
  if(i>0&&/^Cod/i.test(String(vars[i-1]||""))&&!/^Cod/i.test(vn))continue;
  if(/^datoT$/i.test(vn))continue; // text formatat del valor
  dimCols.push({idx:i,id:vn,label:vn});
 }
 // Millor: si meta.dims existeix, mapeja
 if(meta&&Array.isArray(meta.dims)&&meta.dims.length){
  dimCols=meta.dims.map(function(d){
   var idL=String(d.id||"").toLowerCase(),labL=String(d.label||"").toLowerCase();
   if(idL==="tempo"||/tempo|time|period/i.test(labL)){
    var ci=vars.findIndex(function(v){return /^codtempo$/i.test(String(v))});
    var li=vars.findIndex(function(v){return /^tempo$/i.test(String(v))});
    var idx=ci>=0?ci:(li>=0?li:-1);
    return{idx:idx,labelIdx:li,id:d.id,label:d.label,role:d.role||"time"};
   }
   if(idL==="espazo"||/espazo|espacio|geo/i.test(labL)){
    var ci2=vars.findIndex(function(v){return /^codespazo$/i.test(String(v))});
    var li2=vars.findIndex(function(v){return /^espazo$/i.test(String(v))});
    return{idx:ci2>=0?ci2:li2,labelIdx:li2,id:d.id,label:d.label,role:d.role};
   }
   var idx=vars.findIndex(function(v){var x=String(v).toLowerCase();return x===idL||x===labL});
   return{idx:idx,id:d.id,label:d.label,role:d.role};
  }).filter(function(c){return c.idx>=0});
 }
 if(!dimCols.length)return null;
 // Filtre client (l'API d'indicadors/sèries retorna la sèrie completa)
 if(filters&&typeof filters==="object"){
  rows=rows.filter(function(r){
   return dimCols.every(function(c){
    var selected=filters[c.id];
    if(!selected||!selected.length)return true;
    var code=String(r[c.idx]==null?"":r[c.idx]).trim();
    return selected.indexOf(code)>=0||selected.indexOf(String(code))>=0;
   });
  });
  if(!rows.length)return null;
 }
 var catMaps=dimCols.map(function(){return{codes:[],index:new Map(),label:{}}});
 rows.forEach(function(r){
  dimCols.forEach(function(c,j){
   var code=String(r[c.idx]==null?"":r[c.idx]).trim();
   if(!code)return;
   var lab=c.labelIdx>=0?String(r[c.labelIdx]==null?code:r[c.labelIdx]).trim():code;
   if(!catMaps[j].index.has(code)){
    catMaps[j].index.set(code,catMaps[j].codes.length);
    catMaps[j].codes.push(code);
    catMaps[j].label[code]=lab||code;
   }
  });
 });
 var size=catMaps.map(function(m){return m.codes.length});
 var id=dimCols.map(function(c){return c.id});
 var dimension={};
 dimCols.forEach(function(c,j){
  dimension[c.id]={label:c.label||c.id,category:{index:catMaps[j].codes,label:catMaps[j].label}};
  if(c.role){dimension[c.id].role=c.role;dimension[c.id].extension={role:c.role}}
 });
 // values in row-major order of dimCols
 var n=size.reduce(function(a,b){return a*b},1);
 var values=new Array(n).fill(null);
 rows.forEach(function(r){
  var coords=[],ok=true;
  dimCols.forEach(function(c,j){
   var code=String(r[c.idx]==null?"":r[c.idx]).trim();
   var ix=catMaps[j].index.get(code);
   if(ix==null){ok=false;return}
   coords.push(ix);
  });
  if(!ok)return;
  var flat=0;
  for(var k=0;k<coords.length;k++){
   var stride=1;for(var s=k+1;s<size.length;s++)stride*=size[s];
   flat+=coords[k]*stride;
  }
  var num=r[measureIdx];
  var val=num==null||num===""?null:Number(String(num).replace(",","."));
  values[flat]=Number.isFinite(val)?val:null;
 });
 return{class:"dataset",version:"2.0",label:(meta&&meta.title)||"",id:id,size:size,dimension:dimension,value:values};
}
async function icaneLoadCatalog(){
 if(state.icanePackages&&state.icanePackages.length)return state.icanePackages;
 status("Carregant conjunts de dades d'ICANE…");
 var u=provider().base+"/package_search?fq="+encodeURIComponent("organization:icane")+"&rows=1000&start=0";
 var d=await fetchJson(u),root=d&&d.result?d.result:d,pkgs=root&&Array.isArray(root.results)?root.results:[];
 var out=[];
 pkgs.forEach(function(p){
  var resources=Array.isArray(p&&p.resources)?p.resources:[];
  var jsons=resources.filter(function(r){return /json-stat/i.test(String(r&&r.format||""))||/json-stat/i.test(String(r&&r.mimetype||""))});
  if(!jsons.length)return;
  var groups=Array.isArray(p&&p.groups)?p.groups:[];
  var themes=groups.map(function(g){return String(g&&g.title||g&&g.display_name||g&&g.name||"").trim()}).filter(Boolean);
  if(!themes.length)themes=["Altres"];
  var pkg={id:String(p.id||p.name||"").trim(),label:String(p.title||p.name||p.id||"").trim(),themes:Array.from(new Set(themes)),resources:jsons.map(function(r){return{id:String(r.id||"").trim(),label:String(r.name||r.description||"").trim()||String(r.id||"").trim(),url:String(r.url||"").trim(),format:String(r.format||"").trim()}}).filter(function(r){return r.id&&r.url})};
  if(pkg.id&&pkg.label&&pkg.resources.length)out.push(pkg);
 });
 state.icanePackages=out.sort(function(a,b){return a.label.localeCompare(b.label,"es",{numeric:true})});
 if(!state.icanePackages.length)throw new Error("ICANE: no s'han trobat conjunts de dades amb recursos JSON-stat.");
 return state.icanePackages;
}
function icaneDraw(){
 var box=$("eurostatLevels");if(!box)return;
 box.innerHTML="";box.hidden=false;box.style.display="grid";
 var pkgs=state.icanePackages||[],themeSet=new Set();
 pkgs.forEach(function(p){(p.themes||[]).forEach(function(t){if(t)themeSet.add(t)})});
 var themes=Array.from(themeSet).sort(function(a,b){return a.localeCompare(b,"es",{numeric:true})});
 var lab=document.createElement("label");lab.style.display="flex";lab.style.flexDirection="column";lab.style.alignItems="stretch";lab.appendChild(document.createTextNode("Grup temàtic "));
 var sel=document.createElement("select");sel.appendChild(new Option("— Selecciona —",""));themes.forEach(function(t){sel.appendChild(new Option(t,t))});lab.appendChild(sel);box.appendChild(lab);
 sel.onchange=function(){clearQueryView();if(!sel.value)return;icaneDrawDatasets(sel.value)};
 if(themes.length===1){sel.value=themes[0];sel.onchange()}
}
function icaneDrawDatasets(theme){
 var box=$("eurostatLevels");if(!box)return;
 var labels=box.querySelectorAll("label");for(var i=1;i<labels.length;i++)labels[i].remove();
 var pkgs=(state.icanePackages||[]).filter(function(p){return (p.themes||[]).indexOf(theme)>=0});
 var lab=document.createElement("label");lab.style.display="flex";lab.style.flexDirection="column";lab.style.alignItems="stretch";lab.appendChild(document.createTextNode("Conjunt de dades "));
 var sel=document.createElement("select");sel.appendChild(new Option("— Selecciona —",""));pkgs.forEach(function(p){sel.appendChild(new Option(p.label,p.id))});lab.appendChild(sel);box.appendChild(lab);
 sel.onchange=function(){clearQueryView();if(!sel.value)return;var p=pkgs.find(function(x){return x.id===sel.value});if(p)icaneDrawResources(p)};
 if(pkgs.length===1){sel.value=pkgs[0].id;sel.onchange()}
}
function icaneDrawResources(pkg){
 var box=$("eurostatLevels");if(!box)return;
 var labels=box.querySelectorAll("label");for(var i=2;i<labels.length;i++)labels[i].remove();
 var lab=document.createElement("label");lab.style.display="flex";lab.style.flexDirection="column";lab.style.alignItems="stretch";lab.appendChild(document.createTextNode("Taula "));
 var sel=document.createElement("select");sel.appendChild(new Option("— Selecciona —",""));(pkg.resources||[]).forEach(function(r){sel.appendChild(new Option(r.label,r.id))});lab.appendChild(sel);box.appendChild(lab);
 sel.onchange=async function(){clearQueryView();if(!sel.value)return;var r=(pkg.resources||[]).find(function(x){return x.id===sel.value});if(!r)return;try{await icaneSelectResource(pkg,r)}catch(e){status("ICANE: "+(e&&e.message?String(e.message):String(e)),"error")}};
 if(pkg.resources.length===1){sel.value=pkg.resources[0].id;sel.onchange()}
}
async function icaneSelectResource(pkg,rec){
 state.selected.stat=pkg.id;state.selected.concept=pkg.id;state.selected.cross=rec.id;state.selected.node=rec.id;state.selected.table=rec.id;state.selected.geo="";
 status("Carregant la taula d'ICANE…");
 var raw=await fetchJson(rec.url),ds=pxToJsonStat(raw);
 if(!ds||!Array.isArray(ds.id)||!ds.id.length)throw new Error("la resposta JSON-stat no és vàlida.");
 state.icaneRawData=ds;state.metadata=ds;state.lastQueryUrl=rec.url;renderMetadata(ds);
 $("tableInfo").hidden=false;$("tableInfo").innerHTML="<strong>Taula:</strong> "+esc(rec.label)+"<span class=\"path\">"+esc(rec.url)+"</span>";
 $("query").disabled=false;status("");
}
function icaneSubsetJsonStat(ds,filters){
 if(!ds||!Array.isArray(ds.id)||!ds.id.length)return ds;
 var ids=ds.id.map(String),sizes=Array.isArray(ds.size)?ds.size.map(Number):ids.map(function(id){return jsonstatCats(ds,id).length});
 var selected=ids.map(function(id){
  var cats=jsonstatCats(ds,id),set=filters&&filters[id]?new Set(filters[id]):new Set(cats.map(function(c){return c.code}));
  var out=cats.filter(function(c){return set.has(c.code)});
  if(!out.length)throw new Error("ICANE: cal seleccionar almenys un valor a totes les dimensions.");
  return{cats:cats,sel:out};
 });
 var out=Object.assign({},ds),newDim={},newSizes=selected.map(function(x){return x.sel.length});
 ids.forEach(function(id,j){
  var src=ds.dimension&&ds.dimension[id]||{},cat=src.category||{},idx={};
  selected[j].sel.forEach(function(c,i){idx[c.code]=i});
  newDim[id]=Object.assign({},src,{category:Object.assign({},cat,{index:idx,label:cat.label})});
 });
 var total=newSizes.reduce(function(a,b){return a*b},1),newVals=new Array(total),oldStrides=new Array(ids.length),newStrides=new Array(ids.length);
 var s=1;for(var k=ids.length-1;k>=0;k--){oldStrides[k]=s;s*=sizes[k]}s=1;for(var k2=ids.length-1;k2>=0;k2--){newStrides[k2]=s;s*=newSizes[k2]}
 function valueAt(idx){if(Array.isArray(ds.value))return ds.value[idx];if(ds.value&&typeof ds.value==="object")return ds.value[idx];if(Array.isArray(ds.values))return ds.values[idx];return null}
 for(var ni=0;ni<total;ni++){var rem=ni,oi=0;for(var j2=0;j2<ids.length;j2++){var coord=Math.floor(rem/newStrides[j2]);rem%=newStrides[j2];oi+=selected[j2].sel[coord].index*oldStrides[j2]}newVals[ni]=valueAt(oi)}
 out.size=newSizes;out.dimension=newDim;out.value=newVals;delete out.values;return out;
}
function istacList(d){if(Array.isArray(d))return d;if(d&&Array.isArray(d.dataset))return d.dataset;if(d&&Array.isArray(d.query))return d.query;if(d&&Array.isArray(d.operation))return d.operation;if(d&&Array.isArray(d.operations))return d.operations;if(d&&Array.isArray(d.data))return d.data;if(d&&Array.isArray(d.datasets))return d.datasets;if(d&&Array.isArray(d.results))return d.results;if(d&&Array.isArray(d.items))return d.items;if(d&&Array.isArray(d.category))return d.category;return[]}
function istacText(x,lang){if(x==null)return"";if(typeof x==="string"||typeof x==="number")return String(x);if(Array.isArray(x)){var exact=x.find(function(v){return v&&String(v.lang||"").toLowerCase()===String(lang||"es").toLowerCase()});if(exact)return istacText(exact.value!=null?exact.value:exact.text,lang);for(var i=0;i<x.length;i++){var t=istacText(x[i],lang);if(t)return t}return""}if(typeof x==="object"){if(x.value!=null&&typeof x.value!=="object")return String(x.value);if(x.text!=null)return istacText(x.text,lang);if(x.name!=null)return istacText(x.name,lang)}return""}
function istacDimensionArray(meta){var d=meta&&meta.dimensions&&meta.dimensions.dimension;if(Array.isArray(d))return d;if(d&&typeof d==="object")return Object.keys(d).map(function(k){return d[k]});return[]}
function istacValueArray(v){if(!v)return[];if(Array.isArray(v))return v;if(v.value&&Array.isArray(v.value))return v.value;return[]}
function istacMetadataToJsonStat(raw){var src=raw&&raw.metadata?raw.metadata:raw;if(src&&Array.isArray(src.id)&&src.dimension)return pxToJsonStat(src);if(!src||!src.dimensions)return pxToJsonStat(raw);var ds={version:"2.0",class:"dataset",label:istacText(src.name,"es")||String(raw&&raw.label||state.selected.table||""),id:[],size:[],dimension:{}};istacDimensionArray(src).forEach(function(d){var id=String(d&&d.id||"").trim();if(!id)return;var vals=istacValueArray(d.dimensionValues),index={},label={};vals.forEach(function(v,i){var code=String(v&&v.id!=null?v.id:"").trim();if(!code)return;index[code]=i;label[code]=istacText(v&&v.name,"es")||code});ds.id.push(id);ds.size.push(vals.length);ds.dimension[id]={label:istacText(d.name,"es")||id,category:{index:index,label:label}}});return ds}
function istacMetaField(x,key){var v=x&&x.metadata&&x.metadata[key]!=null?x.metadata[key]:(x&&x[key]!=null?x[key]:null);if(Array.isArray(v))return{id:"",label:istacText(v,"es")};if(v&&typeof v==="object"){var id=v.id||v.code||v.resourceId||v.operationId||"",label=istacText(v.name||v.label||v.title,"es")||String(id||"");return{id:String(id||""),label:label}}return{id:String(v||""),label:String(v||"")}}
function istacDatasetRecord(x){var id=String(f(x,"id","resourceId","resourceID","code")).trim(),label=istacText(x&&x.name,"es")||String(f(x,"label","title","text")||id).trim(),subject=istacMetaField(x,"subject"),op=istacMetaField(x,"statisticalOperation");if(!subject.label)subject=istacMetaField(x,"subjectCode");return{id:id,label:label,subject:subject.label||"Altres",operation:op.label||"Sense operació",version:String(f(x,"version")||"~latest")}}
let ISTAC_THEMES=[]; // omplert des de TEMAS_CANARIAS (nivell arrel)
state.istacThemeMap=state.istacThemeMap||new Map(); // id T010000 → nom

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

async function loadStats(){
 var loadToken=state.requestToken,loadProvider=state.provider,loadPreset=state.pxPreset;
 state.swedenPath=[];state.swedenV2Table=false;state.norwayPath=[];state.norwayCatalog=[];state.norwayRootItems=[];
 setProviderUI();state.stats=[];state.selected.stat="";fill($("stat"),[]);$("stat").disabled=true;
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
 else if(state.provider==="nomis"){await nomisEnsureSearchUI();out=await nomisLoadDatasets()}
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
function eurostatNodeByPath(path){
 if(!path||!path.length)return null;var cur=state.eurostatRoots.find(function(r){return r.code===path[0]});if(!cur)return null;
 for(var i=1;i<path.length;i++){cur=(cur.children||[]).find(function(x){return x.code===path[i]});if(!cur)return null}return cur;
}

function deriveConcept(s){s=String(s||"");var p=s.indexOf(".");return p>=0?s.slice(0,p):s}
function deriveCross(s){s=String(s||"").trim();var p=s.indexOf(". ");if(p<0)return"";var r=s.slice(p+2),q=r.indexOf(". A");return(q>=0?r.slice(0,q):r).trim()}

async function nomisLoadDatasets(search){
 var base=provider().base.replace(/\/+$/,"");
 var q=String(search||"").trim();
 // Sense cerca: combina diversos temes (el catàleg sencer fa ~5MB i és poc usable)
 var queries=q?[q]:["population","employment","earnings","claimant","labour","business","gdp","industry","housing","benefit","census","income","workforce"];
 var byId=new Map();
 for(var qi=0;qi<queries.length;qi++){
  var url=base+"/dataset/def.sdmx.json?search="+encodeURIComponent(queries[qi]);
  try{
   var raw=await fetchJson(url);
   var kf=raw&&raw.structure&&raw.structure.keyfamilies&&raw.structure.keyfamilies.keyfamily;
   if(!Array.isArray(kf))kf=kf?[kf]:[];
   kf.forEach(function(x){
    var id=String(x&&x.id||"").trim();
    if(!id||!/^NM_/i.test(id)||byId.has(id))return;
    var name=x&&x.name;
    var label=String(name&&name.value||name||id).trim();
    byId.set(id,{id:id,value:id,label:(label||id)+" ("+id+")"});
   });
  }catch(eQ){
   // Continua amb la resta de cerques
   console.warn("Nomis search failed:",queries[qi],eQ);
  }
 }
 var out=Array.from(byId.values());
 out.sort(function(a,b){return a.label.localeCompare(b.label,"en",{numeric:true,sensitivity:"base"})});
 return out;
}
async function nomisEnsureSearchUI(){
 var box=$("eurostatLevels");
 if(!box)return;
 box.hidden=false;
 var existing=$("nomisSearchWrap");
 if(existing){existing.hidden=false;return;}
 var wrap=document.createElement("div");
 wrap.id="nomisSearchWrap";
 wrap.style.display="flex";
 wrap.style.flexWrap="wrap";
 wrap.style.gap="0.5rem";
 wrap.style.alignItems="end";
 wrap.style.marginBottom="0.75rem";
 wrap.innerHTML='<label style="flex:1;min-width:12rem">Cerca datasets (Nomis)<input id="nomisSearch" type="search" placeholder="economy, earnings, claimant, housing…" autocomplete="off"></label><button type="button" id="nomisSearchBtn" class="secondary">Cerca</button>';
 box.insertBefore(wrap, box.firstChild);
 var run=async function(){
  var term=($("nomisSearch")&&$("nomisSearch").value||"").trim();
  status("Cercant a Nomis…");
  try{
   var out=await nomisLoadDatasets(term||"");
   fill($("stat"),out);
   $("stat").disabled=!out.length;
   status(out.length?"Nomis: "+out.length+" datasets.":"Nomis: cap resultat per a aquesta cerca.");
  }catch(e){status(e&&e.message?e.message:String(e),"error")}
 };
 $("nomisSearchBtn").onclick=function(){run()};
 $("nomisSearch").onkeydown=function(e){if(e.key==="Enter"){e.preventDefault();run()}};
}
function nomisHideSearchUI(){
 var existing=$("nomisSearchWrap");
 if(existing)existing.hidden=true;
}

function nomisExtractCodes(raw){
 var found=[];
 var lists=raw&&raw.structure&&raw.structure.codelists&&raw.structure.codelists.codelist;
 if(!Array.isArray(lists))lists=lists?[lists]:[];
 lists.forEach(function(cl){
  var codes=Array.isArray(cl&&cl.code)?cl.code:(cl&&cl.code?[cl.code]:[]);
  codes.forEach(function(x){
   var id=String(x&&x.value!=null?x.value:(x&&x.id!=null?x.id:"")).trim();
   var d=x&&x.description;
   var lab="";
   if(typeof d==="object"&&d)lab=String(d.value||d.text||d["#text"]||"").trim();
   else lab=String(d||x&&x.label||"").trim();
   if(id)found.push({code:id,label:lab||id});
  });
 });
 if(!found.length){
  var v=raw&&raw.data&&raw.data.codes;
  if(Array.isArray(v))v.forEach(function(x){
   var id=String(x&&x.id!=null?x.id:x&&x.value!=null?x.value:"").trim();
   var lab=String(x&&x.label||x&&x.name||id).trim();
   if(id)found.push({code:id,label:lab});
  });
 }
 var seen=new Set();
 return found.filter(function(x){if(seen.has(x.code))return false;seen.add(x.code);return true});
}
async function nomisFetchDimCodes(base,datasetId,dimId,codelist){
 var cats=[];
 dimId=String(dimId||"").trim();
 var dimLower=dimId.toLowerCase();
 // 1) Endpoint específic del dataset (funciona per GEOGRAPHY i sovint d'altres)
 var candidates=[
  base+"/dataset/"+encodeURIComponent(datasetId)+"/"+encodeURIComponent(dimLower)+".def.sdmx.json",
  base+"/dataset/"+encodeURIComponent(datasetId)+"/"+encodeURIComponent(dimId)+".def.sdmx.json"
 ];
 // 2) Codelist global (alguns dimensions 404, d'altres no)
 if(codelist){
  candidates.push(base+"/codelist/"+encodeURIComponent(codelist)+".def.sdmx.json");
 }
 var lastErr=null;
 for(var i=0;i<candidates.length;i++){
  try{
   var raw=await fetchJson(candidates[i]);
   cats=nomisExtractCodes(raw);
   if(cats.length)return cats;
  }catch(e){lastErr=e}
 }
 // 3) Geography amb context UK
 if(dimLower==="geography"){
  try{
   var u=base+"/dataset/"+encodeURIComponent(datasetId)+"/geography.def.sdmx.json";
   var raw2=await fetchJson(u);
   cats=nomisExtractCodes(raw2);
   if(cats.length)return cats;
  }catch(e2){lastErr=e2}
 }
 if(lastErr&&!cats.length){
  // No llencem: dimensió opcional
  console.warn("ONS/Nomis: sense categories per a "+dimId,lastErr);
 }
 return cats;
}
async function nomisSelectDataset(id){
 id=String(id||"").trim();
 if(!id||!/^NM_/i.test(id))throw new Error("ONS/Nomis: identificador de dataset no vàlid ("+id+"). Cal un codi tipus NM_509_1, no el títol de la taula.");
 status("Carregant dimensions ONS/Nomis…");
 var base=provider().base.replace(/\/+$/,"");
 var defUrl=base+"/dataset/"+encodeURIComponent(id)+"/def.sdmx.json";
 var def=await fetchJson(defUrl);
 var structure=def&&def.structure||{};
 var kfs=structure.keyfamilies&&structure.keyfamilies.keyfamily;
 var kf=Array.isArray(kfs)?kfs[0]:kfs;
 if(!kf)throw new Error("ONS: definició del dataset buida o no reconeguda ("+id+").");
 var dimsDef=kf&&kf.components&&kf.components.dimension||[];
 if(!Array.isArray(dimsDef))dimsDef=dimsDef?[dimsDef]:[];
 var timedim=kf&&kf.components&&kf.components.timedimension;
 if(timedim)dimsDef=dimsDef.concat([{conceptref:timedim.conceptref,codelist:timedim.codelist}]);
 var out={class:"dataset",version:"2.0",label:"",id:[],size:[],dimension:{},value:[]};
 var title=String(kf&&kf.name&&kf.name.value||kf&&kf.name||id);
 out.label=title;
 for(var i=0;i<dimsDef.length;i++){
  var dd=dimsDef[i]||{};
  var dimId=String(dd.conceptref||"").trim();
  var cl=String(dd.codelist||"").trim();
  if(!dimId)continue;
  // FREQ sovint és residual a Nomis
  if(dimId.toUpperCase()==="FREQ")continue;
  var cats=await nomisFetchDimCodes(base,id,dimId,cl);
  if(!cats.length)continue;
  // Geografia: massa valors → queda't amb el primer nivell / mostreig raonable
  if(dimId.toUpperCase()==="GEOGRAPHY"&&cats.length>400){
   // Preferix codis de país/regió si es detecten etiquetes; si no, primers 200
   var prefer=cats.filter(function(c){
    var l=String(c.label||"").toLowerCase();
    return /united kingdom|england|wales|scotland|northern ireland|great britain|uk\b/.test(l);
   });
   if(prefer.length&&prefer.length<cats.length)cats=prefer.concat(cats.slice(0,50));
   else cats=cats.slice(0,200);
  }
  // TIME: si n'hi ha molts, prioritzar els més recents (Nomis sol ordenar antic→nou)
  if(dimId.toUpperCase()==="TIME"&&cats.length>120){
   cats=cats.slice(-120);
  }
  var labels={},index=[];
  cats.forEach(function(x){labels[x.code]=x.label;index.push(x.code)});
  out.id.push(dimId);
  out.size.push(index.length);
  var dimObj={label:dimId,category:{index:index,label:labels}};
  if(dimId.toUpperCase()==="TIME"){dimObj.role="time";dimObj.extension={role:"time"}}
  if(dimId.toUpperCase()==="GEOGRAPHY"){dimObj.role="geo";dimObj.extension={role:"geo"}}
  if(dimId.toUpperCase()==="MEASURES"){dimObj.role="metric";dimObj.extension={role:"metric"}}
  out.dimension[dimId]=dimObj;
 }
 if(!out.id.length)throw new Error("ONS: no s'han pogut recuperar les dimensions del conjunt "+id+". (Algunes codelists Nomis retornen 404.)");
 state.selected.table=id;state.selected.node=id;state.metadata=out;
 renderMetadata(out);
 $("tableInfo").hidden=false;
 $("tableInfo").innerHTML="<strong>Dataset:</strong> "+esc(title)+" <code>"+esc(id)+"</code><span class=\"path\">"+esc(defUrl)+"</span><p>Data from Nomis (ONS). Contains public sector information licensed under the Open Government Licence v3.0.</p>";
 $("query").disabled=false;
 status("");
}
async function nomisQuery(filters){
 var base=provider().base.replace(/\/+$/,""),id=state.selected.table;
 if(!id)throw new Error("ONS: no s'ha seleccionat cap conjunt de dades.");
 var p=new URLSearchParams();
 // Nomis espera noms de dimensió en minúscules
 dims(state.metadata).forEach(function(d){
  var vals=[];
  if(filters&&filters[d.id])vals=Array.from(filters[d.id]||[]);
  else if(state.filters&&state.filters.has(d.id))vals=Array.from(state.filters.get(d.id)||[]);
  // selectedFilters omet dimensions amb "tots" seleccionats; per Nomis cal enviar-ne alguns
  if(!vals.length&&state.filters&&state.filters.has(d.id)){
   vals=Array.from(state.filters.get(d.id)||[]);
  }
  if(vals.length){
   // limita geografia/temps per no petar
   if(d.id.toUpperCase()==="GEOGRAPHY"&&vals.length>30)vals=vals.slice(0,30);
   if(d.id.toUpperCase()==="TIME"&&vals.length>40)vals=vals.slice(0,40);
   p.set(d.id.toLowerCase(),vals.join(","));
  }
 });
 // Si falta TIME, demana latest
 if(!p.has("time"))p.set("time","latest");
 var url=base+"/dataset/"+encodeURIComponent(id)+".jsonstat.json?"+p.toString();
 var data=await fetchJson(url);
 // Nomis jsonstat sol ser 2.0-compatible; normalitza role
 if(data&&data.dimension&&!data.version)data.version="2.0";
 return{data:data,url:url};
}

async function onStatChange(){
 state.selected.stat=$("stat").value;clearBelow(true);if(!state.selected.stat)return;busy(true);
 try{
  if(state.provider==="idescat"){var d=await fetchJson(provider().base+"/"+encodeURIComponent(state.selected.stat)+"?lang=ca");state.catalog=collection(d).map(function(x){return{node:x.id,name:x.label,concept:deriveConcept(x.label),cross:deriveCross(x.label)}});var cs=[...new Set(state.catalog.map(function(x){return x.concept}).filter(Boolean))];fill($("concept"),cs.map(function(x){return{value:x,label:x}}));$("concept").disabled=!cs.length;if(cs.length===1){$("concept").value=cs[0];await $("concept").onchange()}}
  else if(state.provider==="ine"){await ineSelectRoot();$("stat").disabled=true;$("concept").disabled=true;$("cross").disabled=true;$("node").disabled=true;$("table").disabled=true;$("geo").disabled=true}
  else if(state.provider==="eurostat"){await eurostatSelectRoot(state.selected.stat)}
  else if(state.provider==="nomis"){await nomisSelectDataset(state.selected.stat)}
  else if(state.pxPreset==="sweden"){await swedenSelectRoot(state.selected.stat)}
  else if(state.pxPreset==="finland"||state.pxPreset==="iceland"){await pxRecursiveSelectRoot(state.selected.stat)}
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
function pxRecursiveClearLevels(){
 var box=$("eurostatLevels");if(box){box.innerHTML="";box.hidden=true}
 state.pxItems.forEach(function(v,k){if(/^pxRecursiveLevel\d+$/.test(k))state.pxItems.delete(k)});
}
function pxRecursiveLevelLabel(index,list){
 var isTable=list&&list.length&&list.every(function(x){return x&&((String(x.type||"").toLowerCase()==="table")||String(x.type||"").toLowerCase()==="t"||x.tableId||/\\.px$/i.test(String(x.id||"")))});
 return isTable?"Taula":"Nivell "+(index+1);
}
function pxRecursiveTableItems(list){
 return (list||[]).filter(function(x){return x&&((String(x.type||"").toLowerCase()==="table")||String(x.type||"").toLowerCase()==="t"||x.tableId||/\\.px$/i.test(String(x.id||"")))});
}
async function pxRecursiveChildren(path){
 var raw=await fetchJson(pxUrl(path)),src=a(raw),items=[];
 src.forEach(function(x){
  if(!x||typeof x!=="object")return;
  var id=String(f(x,"id","code","dbid","path")||"").trim();
  if(!id)return;
  var type=String(f(x,"type","class")||"folder").trim().toLowerCase();
  items.push({id:id,label:String(f(x,"text","label","name","title")||id).trim(),type:type,path:(path||[]).concat([id]),tableId:type==="t"||type==="table"||/\.px$/i.test(id)?id:""});
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
 var path=(item&&item.path||[]).slice(),tableId=String(item&&item.tableId||path[path.length-1]||"").trim(),urls=[];
 if(state.pxPreset==="finland")urls=finlandTableUrls(path);
 else urls=[pxUrl(path)];
 var raw=null,url="",lastErr=null;
 for(var i=0;i<urls.length&&!raw;i++){
  try{var candidate=await fetchJson(urls[i]);if(isPxMetadata(candidate)){raw=candidate;url=urls[i]}else lastErr=new Error("La resposta no és metadades PxWeb.")}
  catch(e){lastErr=e}
 }
 if(!raw)throw new Error("La taula de "+(state.pxPreset==="finland"?"Statistics Finland":"Statistics Iceland")+" no ha retornat metadades. "+(lastErr&&lastErr.message||""));
 var ds=pxToJsonStat(raw);
 if(!ds||!Array.isArray(ds.id)||!ds.id.length)throw new Error("Les metadades de la taula no contenen variables vàlides.");
 state.selected.table=tableId;state.selected.node=tableId;state.selected.cross=tableId;state.pxPath=path.slice();state.metadata=ds;
 if(state.pxPreset==="finland")state.finlandTableUrl=url;
 renderMetadata(ds);$("tableInfo").hidden=false;
 $("tableInfo").innerHTML="<strong>Taula:</strong> "+esc(raw.title||raw.label||tableId)+"<span class=\"path\">"+esc(url)+"</span>";
 $("query").disabled=false;
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
 sel.onchange=async function(){var val=sel.value;if(!val)return;try{
  var item=(state.pxItems.get("pxRecursiveLevel"+index)||[]).find(function(x){return String(x.id)===String(val)});if(!item)return;
  Array.from(box.querySelectorAll("label")).forEach(function(l){if(Number(l.dataset.eurostatLevel)>index)l.remove()});
  if(pxRecursiveTableItems([item]).length){await pxRecursiveLoadTable(item);return}
  pxRecursiveAddLevel(await pxRecursiveChildren(item.path),index+1);
 }catch(e){var em=e&&e.message?e.message:String(e),st=e&&e.stack?String(e.stack).split("\n").find(function(x){return /app-universal\\.js/.test(x)}):"";status(em+(st?" · "+st.trim():""),"error")}};
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
 var children=await pxRecursiveChildren([rootCode]);
 if(children.length===1&&pxRecursiveTableItems(children).length===1){
  var only=children[0];
  if(!only||!only.id)throw new Error("La resposta de PxWeb conté una taula sense identificador.");
  await pxRecursiveLoadTable(only);
  return;
 }
 pxRecursiveAddLevel(children,0);
}
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
function eurostatClearLevels(){
 var box=$("eurostatLevels");
 if(box){box.innerHTML="";box.hidden=true}
}
function hideStatSelector(hidden){
 var lab=$("stat")&&$("stat").parentElement;
 if(lab)lab.style.display=hidden?"none":"";
}
function eurostatAddRootLevel(){
 var box=$("eurostatLevels");if(!box)return;
 eurostatClearLevels();
 state.eurostatRootParent="";
 var roots=(state.eurostatRoots||[]).filter(function(x){return x&&x.code&&x.label});
 var databaseRoot=roots.find(function(x){return /database\s+by\s+themes/i.test(String(x.label))});
 var list=databaseRoot?(databaseRoot.children||[]):roots;
 list=list.filter(function(x){return x&&x.code&&x.label&&!/cross[\s-]*cutting\s+topics/i.test(String(x.label))&&!/cross[\s-]*cutting/i.test(String(x.code))});
 if(!list.length)return;
 if(databaseRoot)state.eurostatRootParent=databaseRoot.code;
 eurostatAddLevel(list,"",0);
}
function eurostatLevelLabel(i,list){
 var isTable=list&&list.length&&list.every(function(x){var t=String(x&&x.type||"").toLowerCase();return t==="dataset"||t==="table"||x&&x.tableId});
 if(isTable)return "Taula";
 if(i===0)return "Grup temàtic";
 if(i===1)return "Tema";
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
 label.textContent=eurostatLevelLabel(index,list)+" ";
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
 if(index===0&&state.eurostatRootParent)path=[state.eurostatRootParent,val];
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
function isPxMetadata(d){
 var s=d&&d.dataset&&typeof d.dataset==="object"?d.dataset:d;
 return !!(s&&((Array.isArray(s.variables)&&s.variables.length)||(Array.isArray(s.id)&&s.dimension)));
}
async function eustatLoadOperationTree(){
 var remote="https://es.eustat.eus/web/comun/ExtractorArbolOperacionesBanco.ashx?id=All&idioma=c",raw="",last=null;
 // L'arbre d'Eustat no disposa d'un endpoint CORS adequat per a GitHub Pages.
 // Utilitzem primer la còpia local capturada de la resposta real de
 // ExtractorArbolOperacionesBanco.ashx i deixem els accessos remots només
 // com a actualització/fallback.
 var urls=[
   "data/eustat-tree.html",
   remote,
   "https://api.allorigins.win/raw?url="+encodeURIComponent(remote),
   "https://api.codetabs.com/v1/proxy?quest="+encodeURIComponent(remote),
   "https://corsproxy.io/?url="+encodeURIComponent(remote),
   "https://cors.isomorphic-git.org/"+remote
 ];
 for(var i=0;i<urls.length;i++){
   try{
     var rr=await fetch(urls[i],{cache:"no-store"});
     if(rr.ok){
       var txt=await rr.text();
       if(/eustNodoNoHoja|ramaArbol/i.test(txt)){raw=txt;break}
       last=new Error("La resposta no conté l'arbre HTML d'Eustat");
     }else last=new Error("HTTP "+rr.status);
   }catch(e){last=e}
 }
 if(!raw)throw new Error("Eustat: no s'ha pogut carregar l'arbre d'operacions. "+(last&&last.message||"Failed to fetch"));
 var doc=new DOMParser().parseFromString(raw,"text/html"),groups=[],operationGroups={};
 Array.from(doc.querySelectorAll("li.eustNodoNoHoja")).forEach(function(li){
   var span=li.querySelector(":scope > span.ramaArbol"),anchor=li.querySelector(":scope > a[name]");
   if(!span)return;
   var label=eustatCleanText(span.textContent||""),id=anchor?String(anchor.getAttribute("name")||"").trim():"";
   if(!label||!id)return;
   var operations=[],seen=new Set();
   Array.from(li.children).forEach(function(child){
     if(String(child.tagName).toLowerCase()!=="ul")return;
     Array.from(child.querySelectorAll(":scope > li > a[href]")).forEach(function(aEl){
       var href=eustatAbsoluteUrl(aEl.getAttribute("href")||"",remote),opLabel=eustatCleanText(aEl.textContent||"");
       if(!href||!opLabel||seen.has(href))return;
       var m=href.match(/\/banku\/id_([^/]+)\/indexlistaopera\.html/i);
       if(!m)return;
       seen.add(href);
       operations.push({id:href,label:opLabel,url:href,groupId:id,code:m[1]});
     });
   });
   operationGroups[id]=operations;
   groups.push({id:id,label:label,type:"group"});
 });
 if(!groups.length)throw new Error("Eustat: l'arbre d'operacions no conté cap grup.");
 state.eustatGroups=groups;
 state.eustatOperationGroups=operationGroups;
 return groups;
}
function eustatGroupList(){return Array.isArray(state.eustatGroups)?state.eustatGroups:[]}
function eustatCleanText(s){return String(s||"").replace(/\s+/g," ").trim()}
function eustatAbsoluteUrl(href,base){try{return new URL(String(href||"").replace(/&amp;/g,"&"),base).href}catch(e){return""}}
function eustatNorm(s){return eustatCleanText(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()}
function eustatIsOperationUrl(href){
 try{return /^\/estadisticas\/tema_\d+\/opt_1\/ti_[^/]+\/temas\.html$/i.test(new URL(href).pathname)}
 catch(e){return false}
}
async function eustatLoadOperations(groupId){
 var gid=String(groupId||""),ops=((state.eustatOperationGroups||{})[gid]||[]).slice();
 var group=(state.eustatGroups||[]).find(function(x){return String(x.id)===gid});
 if(!group)throw new Error("No s'ha trobat el grup d'Eustat seleccionat.");
 ops.sort(function(a,b){return a.label.localeCompare(b.label,"es",{numeric:true})});
 state.eustatOperations=ops;
 fill($("concept"),ops.map(function(x){return{value:x.id,label:x.label}}));
 $("concept").disabled=!ops.length;
 if(!ops.length)throw new Error("Eustat: no s'han trobat operacions per a "+group.label+".");
 return ops;
}
function eustatOperationCode(html){
 var s=String(html||"").replace(/<[^>]+>/g," ").replace(/\s+/g," "),m=s.match(/Código\s+operación\s*:?\s*(\d{6})/i);
 return m?m[1]:"";
}
function eustatBankuUrl(code){return code?"https://es.eustat.eus/banku/id_"+encodeURIComponent(code)+"/indexlistaopera.html":""}
function eustatTablesPageUrl(opUrl){
 try{var u=new URL(opUrl);if(/\/tipo_1\//i.test(u.pathname))return u.href;u.pathname=u.pathname.replace(/\/temas\.html$/i,"/tipo_1/temas.html");return u.href}catch(e){return""}
}
function eustatParseDownloadLinks(doc,baseUrl,operationId,tables,seen){
 Array.from(doc.querySelectorAll("a[href]")).forEach(function(aEl){
  var href=eustatAbsoluteUrl(aEl.getAttribute("href")||"",baseUrl),label=eustatCleanText(aEl.textContent||"");
  if(!href||!label)return;
  var u;try{u=new URL(href)}catch(e){return}
  var path=u.pathname.toLowerCase();
  if(/\.(csv|xlsx?|zip)$/i.test(path)&&!seen.has(href)){seen.add(href);tables.push({id:"DL:"+tables.length,label:label,type:"download",url:href,operationId:operationId})}
 });
}
async function eustatLoadOperationTables(operationId){
 var op=(state.eustatOperations||[]).find(function(x){return x.id===operationId});
 if(!op)throw new Error("No s'ha trobat l'operació d'Eustat seleccionada.");

 // El catàleg oficial de l'API d'Eustat és pla, però els identificadors
 // PX de les taules incorporen el codi de l'operació (PX_010152_...).
 // Això permet obtenir totes les taules de l'operació sense dependre de
 // CORS ni d'analitzar una pàgina HTML del Banco de Datos.
 var code=String(op.code||"");
 if(!code){
   var m=String(op.url||"").match(/\/banku\/id_([^/]+)\/indexlistaopera\\.html/i);
   code=m?m[1]:"";
 }
 var catalog=Array.isArray(state.eustatCatalog)?state.eustatCatalog:[];
 var prefix=code?"PX_"+code+"_":"";
 var tables=catalog.filter(function(t){
   var id=String(t&&((t.id!=null)?t.id:t.value)||"");
   return prefix && id.toUpperCase().indexOf(prefix.toUpperCase())===0;
 }).map(function(t){
   var id=String(t.id!=null?t.id:t.value||"");
   return {
     id:id,
     label:String(t.label||t.text||t.name||id),
     type:"px",
     url:eustatAbsoluteUrl("/bankupx/pxweb/es/DB/DB/"+id+".px/", "https://es.eustat.eus"),
     operationId:operationId
   };
 });

 // Fallback per a operacions/taules que no segueixin el patró PX_<codi>_.
 if(!tables.length){
   var html="";
   try{html=await fetchText(op.url,{cache:"no-store"})}catch(e){}
   if(html){
     var doc=new DOMParser().parseFromString(html,"text/html"),seen=new Set();
     Array.from(doc.querySelectorAll("a[href]")).forEach(function(aEl){
       var href=eustatAbsoluteUrl(aEl.getAttribute("href")||"",op.url),label=eustatCleanText(aEl.textContent||"");
       if(!href||!label)return;
       var mm=href.match(/[?&]ma=(PX_[^&)"'\\s]+)/i);
       if(!mm)return;
       var id=decodeURIComponent(mm[1]);
       if(seen.has(id))return;
       seen.add(id);
       tables.push({id:id,label:label,type:"px",url:eustatAbsoluteUrl("/bankupx/pxweb/es/DB/DB/"+id+".px/","https://es.eustat.eus"),operationId:operationId});
     });
   }
 }

 tables.sort(function(a,b){return a.label.localeCompare(b.label,"es",{numeric:true})});
 state.eustatTables=tables;
 fill($("cross"),tables.map(function(x){return{value:x.id,label:x.label}}));
 $("cross").disabled=!tables.length;
 if(!tables.length)throw new Error("Eustat: no s'han trobat taules per a "+(op.label||"l'operació")+".");
 return tables;
}
function eustatClassifyTable(label){
 var s=String(label||"").toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g,"");
 var theme="Sociedad",concept="Otros";
 var rules=[
  ["Población",["poblacion","demograf","nacimiento","defuncion","mortalidad","fecund","matrimonio","migracion","inmigr","hogar","familia","vivienda","residente","proyeccion de poblacion","territorio historico"],[
   ["Población",["poblacion","habitantes","residente","censo","padron","empadron"]],
   ["Familias",["familia","hogar","vivienda","vivir solo"]],
   ["Origen y procedencia",["nacionalidad","origen","procedencia","extranj"]],
   ["Movimiento de la población",["nacimiento","defuncion","mortalidad","fecund","matrimonio","divorcio","movimiento natural"]],
   ["Movilidad",["migracion","migratorio","movilidad"]],
   ["Proyecciones de población",["proyeccion"]],
   ["Indicadores demográficos",["demograf","esperanza de vida"]]
  ]],
  ["Economía",["pib","producto interior","cuentas econom","input-output","administracion publica","agric","ganader","pesca","industr","energia","construccion","edificio","vivienda","turismo","alojamiento","empresa","establecimiento","precio","ipc","consumo","comercio exterior","export","import","economia social","ventas","comercio"],[
   ["Cuentas económicas y Marco Input-Output",["pib","producto interior","cuentas econom","input-output","renta","ahorro"]],
   ["Administración Pública",["administracion publica","presupuesto","gasto publico","deuda publica"]],
   ["Sector primario",["agric","ganader","pesca","forestal"]],
   ["Industria y Energía",["industr","energia","electricidad","gas"]],
   ["Construcción",["construccion","edificio"]],
   ["Viviendas y Edificios",["vivienda","edificio","inmobili"]],
   ["Servicios y Turismo",["turismo","alojamiento","hosteler","servicios"]],
   ["Empresas y establecimientos",["empresa","establecimiento","demografia empresarial"]],
   ["Precios",["precio","ipc","coste","indice de precios"]],
   ["Consumo familiar",["consumo familiar","gasto familiar","presupuesto familiar"]],
   ["Comercio exterior",["comercio exterior","export","import"]],
   ["Economía social",["economia social","cooperativa"]]
  ]],
  ["Sociedad",["trabajo","empleo","paro","ocupacion","educacion","euskera","cultura","salud","sanidad","habitos","renta","pobreza","proteccion social","eleccion","justicia","delito"],[
   ["Mercado de trabajo",["trabajo","empleo","paro","ocupacion","salari","coste laboral","actividad economica"]],
   ["Educación",["educacion","enseñanza","alumno","estudiante","universidad","escolar"]],
   ["Euskera",["euskera","lengua vasca","vasco"]],
   ["Cultura",["cultura","lectura","museo","biblioteca","deporte","ocio"]],
   ["Salud",["salud","sanidad","hospital","mortalidad","enfermedad"]],
   ["Hábitos sociales y renta",["habitos","renta","pobreza","condiciones de vida","calidad de vida"]],
   ["Protección social",["proteccion social","dependencia","pensiones","servicios sociales"]],
   ["Elecciones",["eleccion","electoral","voto"]],
   ["Justicia y seguridad",["justicia","delito","criminal","seguridad"]]
  ]],
  ["Territorio y Medio Ambiente",["territorio","urbanismo","suelo","medio ambiente","ambient","residuo","agua","aire","cambio climatico","emision","energia renovable"],[
   ["Planificación territorial y urbanismo",["territorio","urbanismo","suelo"]],
   ["Calidad ambiental",["calidad ambiental","aire","agua","emision","contaminacion"]],
   ["Residuos",["residuo","reciclaje"]],
   ["Cambio climático",["cambio climatico","emision","gases de efecto"]],
   ["Cuentas ambientales",["cuentas ambientales","economia ambiental"]],
   ["Medio ambiente - Familias",["medio ambiente","familias","hogares"]]
  ]],
  ["Sociedad de la información, I+D+i",["sociedad de la informacion","internet","tic","tecnologia","investigacion","innovacion","i+d","patente"],[
   ["Sociedad de la información",["sociedad de la informacion","internet","tic","ordenador","comercio electronico"]],
   ["Investigación científica y desarrollo tecnológico (I+D) e Innovación",["investigacion","desarrollo tecnologico","i+d","innovacion","patente"]]
  ]]
 ];
 for(var i=0;i<rules.length;i++){
  var rr=rules[i];
  if(rr[1].some(function(k){return s.indexOf(k)>=0})){theme=rr[0];var sr=rr[2]||[];for(var j=0;j<sr.length;j++)if(sr[j][1].some(function(k){return s.indexOf(k)>=0})){concept=sr[j][0];break}break}
 }
 if(theme==="Sociedad"&&concept==="Otros"&&/poblacion|habitante|demograf/.test(s)){theme="Población";concept="Población"}
 return{theme:theme,concept:concept,cross:label};
}
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
async function pxMetadata(){
 var raw,ds;
 if(state.pxPreset==="sweden"){
  var tableId=String(state.selected.table||"");
  var mu="https://statistikdatabasen.scb.se/api/v2/tables/"+encodeURIComponent(tableId)+"/metadata?lang=en";
  raw=await fetchJson(mu);ds=swedenV2MetadataToJsonStat(raw);state.metadata=ds;renderMetadata(ds);$("tableInfo").hidden=false;$("tableInfo").innerHTML="<strong>Taula:</strong> "+esc(raw.label||state.selected.table)+"<span class=\"path\">"+esc(mu)+"</span>";$("query").disabled=false;return
 }
 raw=await fetchJson(pxUrl(state.pxPath));ds=pxToJsonStat(raw);state.metadata=ds;renderMetadata(ds);$("tableInfo").hidden=false;$("tableInfo").innerHTML="<strong>Taula:</strong> "+esc(raw.title||raw.label||state.selected.table)+"<span class=\"path\">"+esc(pxUrl(state.pxPath))+"</span>";$("query").disabled=false}
function ineJsonStatUrl(tableId){return "https://servicios.ine.es/wstempus/jsstat/ES/DATASET/"+encodeURIComponent(String(tableId))}
function ineNormalizeMetadataCodes(ds){
  if(!ds || !ds.dimension) return ds;
  var out = Object.assign({}, ds);
  var dims2 = Object.assign({}, ds.dimension);

  (ds.id || Object.keys(ds.dimension)).forEach(function(id){
    var dim = ds.dimension[id];
    if(!dim || !dim.category) return;

    var cat = Object.assign({}, dim.category);
    var index = cat.index;
    var labels = cat.label && typeof cat.label === "object"
      ? Object.assign({}, cat.label) : {};

    var codes = Array.isArray(index) ? index.slice()
      : index && typeof index === "object"
        ? Object.keys(index).sort(function(a,b){ return Number(index[a]) - Number(index[b]); })
        : Object.keys(labels);

    var newIndex = [];
    var newLabels = {};
    var used = new Set();

    codes.forEach(function(code){
      var sc = String(code);

      // Intenta codi net: treu prefix i ~sufix
      var raw = sc;
      var p = sc.indexOf("_");
      if(p >= 0) raw = sc.slice(p + 1);
      var t = raw.indexOf("~");
      if(t >= 0) raw = raw.slice(0, t);

      // Si el codi net ja està usat (08 de CCAA vs 08 de PROV),
      // manté una forma discriminada
      var finalCode = raw;
      if(used.has(finalCode)){
        // Ex: PROV_08~32 → "PROV:08", CCAA_08 → "CCAA:08"
        var prefix = p >= 0 ? sc.slice(0, p) : "X";
        finalCode = prefix + ":" + raw;
      }
      used.add(finalCode);

      newIndex.push(finalCode);
      if(labels[sc] != null) newLabels[finalCode] = labels[sc];
    });

    cat.index = newIndex;
    cat.label = newLabels;
    var nd = Object.assign({}, dim);
    nd.category = cat;
    dims2[id] = nd;
  });

  out.dimension = dims2;
  return out;
}
function ineDatosTablaUrl(tableId,query){
  var u="https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/"+encodeURIComponent(String(tableId));
  return u+(query?"?"+query:"");
}
function ineTvCandidates(d){
  var a=[String(d.id||"").trim(),String(d.label||"").trim(),String(d.id||"").trim().toUpperCase(),String(d.label||"").trim().toUpperCase(),String(d.label||"").trim().toLowerCase()];
  return a.filter(function(x,i){return x&&a.indexOf(x)===i});
}
function inePeriodCode(row,timeDim){
  if(!row) return "";
  var y = String(row.Anyo != null ? row.Anyo : "").trim();
  if(!y) return "";

  var p = "";
  if(row.T3_Periodo != null && row.T3_Periodo !== ""){
    p = String(row.T3_Periodo).trim().toUpperCase();
  } else if(row.Periodo != null){
    if(typeof row.Periodo === "object"){
      // Preferim Nombre si porta M/T/S (M08), si no Codigo
      var nom = String(row.Periodo.Nombre || "").trim().toUpperCase();
      var cod = String(row.Periodo.Codigo || "").trim().toUpperCase();
      p = /^[MTSQB]/.test(nom) ? nom : (cod || nom);
    } else {
      p = String(row.Periodo).trim().toUpperCase();
    }
  }

  // El codi del període de les dades INE pot ser més fi que el de la
  // dimensió temporal del JSON-stat. Si la metadata diu que el període
  // és anual, per exemple, M01 s'ha de representar com l'any 2016.
  var periodicity = timeDim ? temporalPeriodicity(timeDim.categories || []) : null;
  if(periodicity === "year") return y;
  if(!p || p === "A" || p === "ANUAL") return y;

  var m = p.match(/^M?(\d{1,2})$/);
  if(m) return y + "M" + String(Number(m[1])).padStart(2, "0");

  if(p === "I" || p === "T1" || p === "Q1") return y + "T1";
  if(p === "II" || p === "T2" || p === "Q2") return y + "T2";
  if(p === "III" || p === "T3" || p === "Q3") return y + "T3";
  if(p === "IV" || p === "T4" || p === "Q4") return y + "T4";
  var q = p.match(/^(?:T|Q)(\d)$/);
  if(q) return y + "T" + q[1];

  var s = p.match(/^S(\d)$/);
  if(s) return y + "S" + s[1];

  var b = p.match(/^B(\d{1,2})$/);
  if(b) return y + "B" + String(Number(b[1])).padStart(2, "0");

  return y + "-" + p.replace(/\s+/g, "_");
}
function ineDatosTablaToJsonStat(raw,metadata){
 var series=Array.isArray(raw)?raw:[];
 if(!series.length)return null;
 var baseDims=dims(metadata),timeDim=baseDims.find(function(d){return temporal(d)});
 var nonTime=baseDims.filter(function(d){return !timeDim||d.id!==timeDim.id});
 var timeMap=new Map(),rows=[];
 function norm(x){return String(x==null?"":x).normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").trim().toUpperCase()}
 function metaFor(s){return Array.isArray(s&&s.MetaData)?s.MetaData:[]}
 function categoryMatch(d,m){
  if(!m)return null;
  var name=norm(m.Nombre||""),code=String(m.Codigo==null?"":m.Codigo).trim(),id=String(m.Id==null?"":m.Id).trim();
  var tv=norm(m.T3_Variable||"");
  var dn=norm(d.label||d.id),dk=dn.replace(/[^A-Z0-9]/g,"");
  var best=null,bestScore=-1;
  (d.categories||[]).forEach(function(cat){
   var cc=String(cat.code==null?"":cat.code),suffix=cc.indexOf("_")>=0?cc.slice(cc.lastIndexOf("_")+1):cc;
   var score=0;
   if(name&&norm(cat.label)===name)score=100;
   else if(code&&cc===code)score=90;
   else if(id&&cc===id)score=80;
   else if(code&&suffix===code)score=70;
   else if(id&&suffix===id)score=60;
   if(score>0){
    var ck=norm(cat.label||"").replace(/[^A-Z0-9]/g,"");
    if(tv&&((tv===dn)||(tv===dk)))score+=10;
    if(ck===dk)score+=2;
    if(score>bestScore){bestScore=score;best=cat}
   }
  });
  return best;
 }
 series.forEach(function(s){
  var md=metaFor(s),data=Array.isArray(s.Data)?s.Data:[];
  data.forEach(function(x){
   var tc=inePeriodCode(x,timeDim);if(!tc)return;
   var key=[];
   nonTime.forEach(function(d){
    var best=null;
    md.forEach(function(m){
     var hit=categoryMatch(d,m);
     if(!hit)return;
     var name=norm(m.Nombre||""),code=String(m.Codigo==null?"":m.Codigo).trim(),id=String(m.Id==null?"":m.Id).trim();
     var score=(norm(hit.label)===name?100:0)+(String(hit.code)===code?20:0)+(String(hit.code)===id?10:0);
     if(!best||score>best.score)best={code:String(hit.code),score:score};
    });
    key.push(best?best.code:"");
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
 outDims.forEach(function(d){var m=new Map();d.categories.forEach(function(c,i){m.set(String(c.code),i)});index.set(d.id,m)});
 var total=out.size.reduce(function(a,b){return a*b},1),vals=new Array(total).fill(null),strides=[];
 var st=1;for(var j=out.size.length-1;j>=0;j--){strides[j]=st;st*=out.size[j]};
 rows.forEach(function(r){
  var coords=[];
  nonTime.forEach(function(d,j){
   var m=index.get(d.id),code=String(r.key[j]||"");
   coords.push(m&&m.has(code)?m.get(code):0);
  });
  var tm=index.get(td.id),ti=tm&&tm.get(String(r.time));if(ti==null)return;
  coords.push(ti);
  var flat=0;coords.forEach(function(v,j){flat+=v*strides[j]});
  vals[flat]=r.value;
 });
 out.value=vals;return out;
}
async function ineDatosTablaFiltered(tableId,filters){
 var allFilters=filters||{};
 var u=ineDatosTablaUrl(tableId,"det=2&tip=AM");
 var raw=await fetchJson(u);
 if(!Array.isArray(raw)||!raw.length)throw new Error("L'INE no ha retornat dades.");
 var ds=ineDatosTablaToJsonStat(raw,state.metadata);
 if(!ds)throw new Error("L'INE no ha pogut convertir les dades de la taula.");
 ds=diceJsonStat(ds,allFilters);
 if(!ds||!Array.isArray(ds.value)||!ds.value.some(function(v){return v!=null})){
  throw new Error("L'INE no ha retornat sèries per als filtres seleccionats.");
 }
 return{data:ds,url:u};
}
async function ineMetadata(tableId){
 var u=ineJsonStatUrl(tableId);
 var ds=await fetchJson(u);
 ds=ineNormalizeMetadataCodes(ds);
 state.metadata=ds;
 renderMetadata(ds);
 $("tableInfo").hidden=false;
 $("tableInfo").innerHTML="<strong>Taula:</strong> "+esc(ds.label||tableId)+"<span class=\"path\">"+esc(u)+"</span>";
 $("query").disabled=false
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
 clearQueryView();
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
function updateCells(){var n=1;state.filters.forEach(function(s){n*=s.size});var missing=Array.from(state.filters.values()).some(function(s){return !s.size});var cellLimit=state.provider==="idescat"||state.provider==="istac"?MAX_CELLS:(state.provider==="nomis"?25000:(state.provider==="pxweb"&&state.pxPreset==="finland"?100000:(state.provider==="pxweb"&&state.pxPreset==="sweden"?150000:Infinity)));var tooMany=n>cellLimit;var bad=missing||tooMany;$("cellInfo").hidden=false;var icon=bad?"✕":"✓";var limitText=Number.isFinite(cellLimit)?cellLimit.toLocaleString("ca-ES"):"—";var msg=missing?"Cal seleccionar valors a totes les dimensions.":tooMany?"Cal filtrar la taula (màxim "+limitText+" cel·les)":"Es pot continuar."; $("cellInfo").innerHTML="<span class=\"status-icon "+(bad?"bad":"ok")+"\" aria-hidden=\"true\">"+icon+"</span> <strong>Nombre de cel·les de la taula filtrada:</strong> "+n.toLocaleString("ca-ES")+" · <span class=\""+(bad?"bad":"ok")+"\">"+msg+"</span>";document.querySelectorAll(".filter").forEach(function(x){x.querySelector(".selected-count").textContent=(state.filters.get(x.dataset.dim)||new Set()).size.toLocaleString("ca-ES")+" seleccionades"});$("query").disabled=bad||!state.metadata}
function buildEurostatParams(){var p=new URLSearchParams();p.set("format","JSON");p.set("lang","EN");var q=selectedFilters();Object.keys(q).forEach(function(k){q[k].forEach(function(v){p.append(k,v)})});return p}
function ineNorm(s){
 return String(s==null?"":s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toUpperCase();
}
async function ineResolveFilters(filters){
  var tableId = String(state.selected.table || "").trim();
  if(!tableId) throw new Error("No s'ha pogut identificar la taula INE.");

  // ── 1. Grups de la taula ──────────────────────────────────────────
  var groupsKey = "GROUPS|" + tableId;
  var groups = state.ineVarCache.get(groupsKey);
  if(!groups){
    groups = a(await fetchJson(
      provider().base + "/ES/GRUPOS_TABLA/" + encodeURIComponent(tableId)
    ));
    state.ineVarCache.set(groupsKey, groups);
  }

  // ── 2. Tots els valors de tots els grups (det=1 → Variable.Id) ───
  var allValues = [];
  for(var gi = 0; gi < groups.length; gi++){
    var gid = String(f(groups[gi], "Id", "id")).trim();
    if(!gid) continue;

    var gKey = "GROUPVALS|" + tableId + "|" + gid;
    var gv = state.ineVarCache.get(gKey);
    if(!gv){
      try{
        gv = a(await fetchJson(
          provider().base + "/ES/VALORES_GRUPOSTABLA/" +
          encodeURIComponent(tableId) + "/" +
          encodeURIComponent(gid) + "?det=1"
        ));
        state.ineVarCache.set(gKey, gv);
      }catch(e){
        gv = [];
      }
    }
    if(gv && gv.length) allValues = allValues.concat(gv);
  }

  // ── helpers locals ────────────────────────────────────────────────
  function cleanCode(code){
    var sc = String(code == null ? "" : code);
    // PROV_08~32 → 08 ; CCAA_09~24 → 09 ; sexo_1 → 1
    var p = sc.indexOf("_");
    var raw = p >= 0 ? sc.slice(p + 1) : sc;
    var t = raw.indexOf("~");
    if(t >= 0) raw = raw.slice(0, t);
    return raw;
  }

  function codePrefix(code){
    // "PROV_08~32" → "PROV" ; "CCAA_08" → "CCAA" ; "08" → ""
    var sc = String(code == null ? "" : code);
    var p = sc.indexOf("_");
    return p >= 0 ? sc.slice(0, p).toUpperCase() : "";
  }

  function valueVarCode(x){
    return String(
      (x.Variable && (x.Variable.Codigo || x.Variable.codigo || x.Variable.Code)) ||
      f(x, "CodigoVariable", "codigo_variable") ||
      ""
    ).trim().toUpperCase();
  }

  function valueVarId(x){
    return String(
      (x.Variable && (x.Variable.Id || x.Variable.id)) ||
      f(x, "FK_Variable", "fk_variable") ||
      ""
    ).trim();
  }

  function valueId(x){
    return String(f(x, "Id", "id") || "").trim();
  }

  function valueCodigo(x){
    return String(f(x, "Codigo", "codigo", "Code", "code") || "").trim();
  }

  function valueNombre(x){
    return ineNorm(f(x, "Nombre", "nombre", "Name", "Descripcion", "Description") || "");
  }

  // ── 3. Construcció dels tv ────────────────────────────────────────
  var out = new URLSearchParams();
  var dsDims = dims(state.metadata);

  for(var di = 0; di < dsDims.length; di++){
    var d = dsDims[di];
    if(temporal(d)) continue; // el temps no va amb tv

    var wanted = filters[d.id];
    if(!wanted || !wanted.length) continue;

    wanted.forEach(function(code){
      var sc = String(code);
      var cleaned = cleanCode(sc);
      var prefix = codePrefix(sc); // PROV / CCAA / NAC / ""
      var cat = (d.categories || []).find(function(c){ return String(c.code) === sc; });
      var catLabel = ineNorm(cat && cat.label || "");

      // Scoring: com més alt, millor coincidència
      var best = null;
      var bestScore = -1;

      for(var vi = 0; vi < allValues.length; vi++){
        var x = allValues[vi];
        var vn = valueNombre(x);
        var vc = valueCodigo(x);
        var xid = valueId(x);
        var vcode = valueVarCode(x); // "PROV", "CCAA", ...
        var score = 0;

        // 1. Nom exacte (màxima prioritat) — resol ambigüitats 08/08
        if(catLabel && vn === catLabel){
          score = 100;
        }
        // 2. Id numèric exacte
        else if(xid && (xid === sc || xid === cleaned)){
          score = 90;
        }
        // 3. Codigo + prefix coherent (PROV_08 → Variable PROV)
        else if(vc && (vc === sc || vc === cleaned)){
          score = 70;
          if(prefix && vcode && prefix === vcode) score = 85;
          else if(prefix && vcode && prefix !== vcode) score = 40; // penalització
        }
        // 4. Nom normalitzat sense accents/espais
        else if(catLabel && vn &&
                vn.replace(/[^A-Z0-9]/g, "") === catLabel.replace(/[^A-Z0-9]/g, "")){
          score = 60;
        }

        if(score > bestScore){
          bestScore = score;
          best = x;
        }
      }

      if(!best || bestScore < 40){
        throw new Error(
          "No s'ha trobat el valor INE «" + sc + "» (" +
          (cat && cat.label || "") + ") de la dimensió «" +
          (d.label || d.id) + "»."
        );
      }

      var variableId = valueVarId(best);
      var valId = valueId(best);

      if(!variableId || !valId){
        throw new Error(
          "El valor «" + sc + "» (" + (cat && cat.label || "") +
          ") no té Variable.Id o Id vàlid."
        );
      }

      out.append("tv", variableId + ":" + valId);
    });
  }

  // Debug útil mentre es valida
  if(out.toString()){
    console.log("INE tv params:", out.toString());
  }

  return out;
}
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
  else if(state.provider==="pxweb"){
   var query={query:[],response:{format:state.pxPreset==="eustat"?"json-stat":"json-stat2"}};
   dims(state.metadata).forEach(function(d){
    var selected=Array.from(state.filters.get(d.id)||[]),all=d.categories.map(function(c){return c.code});
    if(selected.length&&(selected.length!==all.length||state.pxPreset==="finland")){
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
function exportSourceLabel(){if(state.provider==="nomis")return"Office for National Statistics (ONS)";if(state.provider==="istac")return"Instituto Canario de Estadística (ISTAC)";if(state.provider==="icane")return"Instituto Cántabro de Estadística (ICANE)";if(state.provider==="ige")return"Instituto Galego de Estatística (IGE)";if(state.provider==="pxweb"){var names={eustat:"Eustat",finland:"Statistics Finland",iceland:"Statistics Iceland",norway:"Statistics Norway",sweden:"Statistics Sweden",unece:"UNECE - United Nations Economic Comission for Europe"};return names[state.pxPreset]||provider().label}return provider().label}
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
 $("provider").onchange=async function(){var v=$("provider").value;if(v==="other"){state.requestToken++;clearBelow();state.selected.stat="";fill($("stat"),[]);$("stat").disabled=true;state.provider="pxweb";state.pxPreset="";$("otherProvider").value="";setProviderUI();updateUrl();status("");return}if(v==="istac"){state.provider="istac";state.pxPreset=""}else if(v==="nomis"){state.provider="nomis";state.pxPreset=""}else if(v==="icane"){state.provider="icane";state.pxPreset=""}else if(v==="ige"){state.provider="ige";state.pxPreset=""}else if(v.indexOf("pxweb:")===0){state.provider="pxweb";state.pxPreset=v.slice(6)}else{state.provider=v}state.requestToken++;clearBelow();state.selected.stat="";fill($("stat"),[]);$("stat").disabled=true;setProviderUI();updateUrl();status("Carregant estadístiques…");try{await loadStats();status("")}catch(e){status(e.message,"error")}};$("otherProvider").onchange=async function(){var v=$("otherProvider").value;if(!v)return;if(v==="istac"){state.provider="istac";state.pxPreset=""}else if(v==="nomis"){state.provider="nomis";state.pxPreset=""}else if(v==="icane"){state.provider="icane";state.pxPreset=""}else if(v==="ige"){state.provider="ige";state.pxPreset=""}else{state.provider="pxweb";state.pxPreset=v.slice(6);}state.requestToken++;clearBelow();state.selected.stat="";fill($("stat"),[]);$("stat").disabled=true;setProviderUI();updateUrl();status("Carregant estadístiques…");try{await loadStats();status("")}catch(e){status(e.message,"error")}};
 
  $("stat").onchange=async function(){clearQueryView();await onStatChange();updateUrl()};
 $("concept").onchange=async function(){clearQueryView();if(state.provider==="ine")return;if(state.provider==="pxweb"&&state.pxPreset!=="eustat")await pxSelect("concept");else if(state.provider==="eurostat")await eurostatSelectLevel("concept");else if(state.provider==="pxweb"&&state.pxPreset==="eustat"){state.selected.concept=$("concept").value;state.selected.cross="";state.selected.node="";state.selected.table="";resetSelect("cross");resetSelect("node");resetSelect("table");resetSelect("geo");var et=await eustatLoadOperationTables(state.selected.concept);if(et.length===1){$("cross").value=et[0].id;await $("cross").onchange()}}else{state.selected.concept=$("concept").value;state.selected.cross="";state.selected.node="";state.selected.table="";state.selected.geo="";["cross","node","table","geo"].forEach(resetSelect);state.metadata=null;state.filters.clear();$("filters").innerHTML="";$("results").innerHTML='<div class="empty">Selecciona una taula i fes la consulta.</div>';$("query").disabled=true;$("exportCsv").disabled=true;$("exportXlsx").disabled=true;$("addToCart").disabled=true;$("tableInfo").hidden=true;$("cellInfo").hidden=true;var c=state.selected.concept,rows=(state.catalog||[]).filter(function(r){return r.concept===c}),x=[...new Set(rows.map(function(r){return r.cross}).filter(Boolean))];fill($("cross"),x.map(function(v){return{value:v,label:v}}));$("cross").disabled=!x.length;if(x.length===1){$("cross").value=x[0];await $("cross").onchange()}else if(x.length===0){var ids=[...new Set(rows.map(function(r){return String(r.node)}).filter(Boolean))];fill($("node"),ids.map(function(id){var q=rows.find(function(r){return String(r.node)===id});return{value:id,label:id+" · "+q.name}}));$("node").disabled=!ids.length;if(ids.length===1){$("node").value=ids[0];await onNodeChange()}}}};
 $("cross").onchange=async function(){clearQueryView();if(state.provider==="pxweb"&&state.pxPreset!=="eustat")await pxSelect("cross");else if(state.provider==="eurostat")await eurostatSelectLevel("cross");else if(state.provider==="pxweb"&&state.pxPreset==="eustat"){var et=(state.eustatTables||[]).find(function(r){return r.id===$("cross").value});if(et){state.selected.cross=et.id;state.selected.node=et.id;state.selected.table=et.id;if(et.type==="px"){await pxFlatSelectTable(et.id)}else{state.metadata=null;$("query").disabled=true;$("exportCsv").disabled=true;$("exportXlsx").disabled=true;$("addToCart").disabled=true;$("tableInfo").hidden=false;$("cellInfo").hidden=true;$("tableInfo").innerHTML="<strong>Taula:</strong> "+esc(et.label)+"<span class=\"path\">"+esc(et.url)+"</span><p><a href=\""+esc(et.url)+"\" target=\"_blank\" rel=\"noopener\">Obre/descarrega la taula</a></p>"}}}else{var c=$("concept").value,x=$("cross").value;state.selected.cross=x;state.selected.node="";state.selected.table="";state.selected.geo="";resetSelect("node");resetSelect("table");resetSelect("geo");state.metadata=null;state.filters.clear();$("filters").innerHTML="";$("results").innerHTML='<div class="empty">Selecciona una taula i fes la consulta.</div>';$("query").disabled=true;$("exportCsv").disabled=true;$("exportXlsx").disabled=true;$("addToCart").disabled=true;$("tableInfo").hidden=true;$("cellInfo").hidden=true;var r=(state.catalog||[]).filter(function(v){return v.concept===c&&v.cross===x}),ids=[...new Set(r.map(function(v){return v.node}))];fill($("node"),ids.map(function(id){var q=r.find(function(v){return v.node===id});return{value:id,label:id+" · "+q.name}}));$("node").disabled=!ids.length;if(ids.length===1){$("node").value=ids[0];await onNodeChange()}}};
 $("node").onchange=async function(){clearQueryView();if(state.provider==="ine")return;if(state.provider==="eurostat")await eurostatSelectLevel("node");else await onNodeChange()};$("table").onchange=onTableChange;$("geo").onchange=onGeoChange;$("tabData").onclick=function(){$("tabData").classList.add("active");$("tabPivot").classList.remove("active");$("results").hidden=false;$("pivotBuilder").hidden=true};$("tabPivot").onclick=function(){$("tabPivot").classList.add("active");$("tabData").classList.remove("active");$("results").hidden=true;$("pivotBuilder").hidden=false;renderPivotBuilder()};$("results").addEventListener("click",function(e){var b=e.target.closest("button[data-page]");if(b&&!b.disabled)setResultPage(Number(b.dataset.page))});$("results").addEventListener("change",function(e){if(e.target.matches("select[data-page-select]"))setResultPage(Number(e.target.value));if(e.target.matches("select[data-page-size]"))setResultPageSize(Number(e.target.value))});$("temporalOrder").onchange=function(){setTemporalOrder(this.value)};$("query").onclick=runQuery;$("exportCsv").onclick=exportCSV;$("exportXlsx").onclick=exportXLSX;$("addToCart").onclick=addCart;$("cartExport").onclick=exportCart;$("cartClear").onclick=function(){state.cart=[];renderCart()};$("cartToggle").onclick=function(){var p=$("cartPanel");p.hidden=false;$("cartToggle").setAttribute("aria-expanded","true");p.scrollIntoView({behavior:"smooth",block:"start"})};$("clear").onclick=function(){if(state.metadata)renderMetadata(state.metadata)}
}
function updateUrl(){var q=new URLSearchParams();q.set("provider",state.provider);if(state.provider==="pxweb")q.set("px",state.pxPreset);if(state.selected.stat)q.set("stat",state.selected.stat);history.replaceState(null,"","?"+q.toString())}
(async function(){bind();renderCart();var q=new URLSearchParams(location.search);state.provider=q.get("provider")||"idescat";state.pxPreset=q.get("px")||"finland";$("provider").value=(state.provider==="pxweb"||state.provider==="istac"||state.provider==="icane"||state.provider==="ige"||state.provider==="nomis")?"other":state.provider;$("otherProvider").value=state.provider==="istac"?"istac":state.provider==="icane"?"icane":state.provider==="ige"?"ige":state.provider==="nomis"?"nomis":state.provider==="nomis"?"nomis":(state.provider==="pxweb"&&state.pxPreset?"pxweb:"+state.pxPreset:"");setProviderUI();try{await loadStats()}catch(e){status(e.message,"error")}})();
