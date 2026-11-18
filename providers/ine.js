/* Provider module — loaded after app-universal.js core. Depends on global state, $, fetchJson, etc. */
/* === ine (31 functions) === */

function ineClearNavigation(){
 state.inePath=[];state.ineItems.clear();
 var box=$("eurostatLevels");
 if(box){box.innerHTML="";box.hidden=true}
 ["concept","cross","node","table","geo"].forEach(resetSelect);
 state.selected.concept="";state.selected.cross="";state.selected.node="";state.selected.table="";state.selected.geo="";
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
