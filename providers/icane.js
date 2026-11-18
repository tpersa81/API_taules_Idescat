/* Provider module — loaded after app-universal.js core. Depends on global state, $, fetchJson, etc. */
/* === icane (6 functions) === */

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
