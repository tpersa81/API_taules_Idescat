/* Provider module — loaded after app-universal.js core. Depends on global state, $, fetchJson, etc. */
/* === ige (21 functions) === */

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
