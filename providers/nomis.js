/* Provider module — loaded after app-universal.js core. Depends on global state, $, fetchJson, etc. */
/* === nomis (11 functions) === */

async function nomisLoadDatasets(search){
 var catalog=await nomisLoadCatalog(search);
 return catalog.map(function(x){return{id:x.id,value:x.id,label:x.label}});
}

function nomisAnnotationMap(item){
 var map={};
 var ann=item&&item.annotations&&item.annotations.annotation;
 if(!Array.isArray(ann))ann=ann?[ann]:[];
 ann.forEach(function(a){
  var title=String(a&&a.annotationtitle||"").trim();
  var text=String(a&&a.annotationtext||"").trim();
  if(title)map[title]=text;
 });
 return map;
}

function nomisAssignThemes(item){
 var map=nomisAnnotationMap(item);
 var keywords=String(map["Keywords"]||"").toLowerCase();
 var source=String(map["contenttype/sources"]||map["Mnemonic"]||"").toLowerCase();
 var name=String(item&&item.name&&item.name.value||item&&item.name||"").toLowerCase();
 var desc=String(item&&item.description&&item.description.value||item&&item.description||"").toLowerCase();
 var blob=keywords+" "+source+" "+name+" "+desc;
 var themes=[];
 function add(th){if(themes.indexOf(th)<0)themes.push(th)}
 if(/census|ks0|qs0|uv0|lc0|dc0/.test(blob))add("Census");
 if(/population|resident|demograph|age band|ethnicity/.test(blob))add("Population & demography");
 if(/employment|unemployment|labour|labor|workforce|jobseeker|claimant|economically active|occupation|hours worked|self-employed/.test(blob))add("Employment & labour market");
 if(/earning|wage|pay|income|salary|hourly|weekly pay/.test(blob))add("Earnings & income");
 if(/benefit|pension|universal credit|housing benefit|tax credit|dwp|disability living/.test(blob))add("Benefits & welfare");
 if(/business|enterprise|vat|paye|industry|manufactur|turnover|company/.test(blob))add("Business & industry");
 if(/housing|dwelling|household|tenur|landlord|rent/.test(blob))add("Housing & households");
 if(/gdp|gva|output|productivity|export|import|trade|retail/.test(blob))add("Economy & output");
 if(/health|disability|life expectancy|birth|death|mortality/.test(blob))add("Health & vital statistics");
 if(/education|qualification|pupil|school|student|skill/.test(blob))add("Education & skills");
 if(/migrat|nationality|passport|country of birth/.test(blob))add("Migration & identity");
 if(!themes.length)add("Other");
 return themes;
}

async function nomisLoadCatalog(search){
 var base=provider().base.replace(/\/+$/,"");
 var q=String(search||"").trim();
 var queries=q?[q]:["population","employment","earnings","claimant","labour","business","gdp","industry","housing","benefit","census","income","workforce","health","education"];
 var byId=new Map();
 status(q?"Cercant a ONS…":"Carregant catàleg ONS…");
 for(var qi=0;qi<queries.length;qi++){
  var url=base+"/dataset/def.sdmx.json?search="+encodeURIComponent(queries[qi]);
  try{
   var raw=await fetchJson(url);
   var kf=raw&&raw.structure&&raw.structure.keyfamilies&&raw.structure.keyfamilies.keyfamily;
   if(!Array.isArray(kf))kf=kf?[kf]:[];
   kf.forEach(function(x){
    var id=String(x&&x.id||"").trim();
    if(!id||!/^NM_/i.test(id))return;
    var name=x&&x.name;
    var label=String(name&&name.value||name||id).trim()||id;
    var themes=nomisAssignThemes(x);
    var map=nomisAnnotationMap(x);
    if(byId.has(id)){
     var prev=byId.get(id);
     themes.forEach(function(th){if(prev.themes.indexOf(th)<0)prev.themes.push(th)});
    }else{
     byId.set(id,{
      id:id,value:id,label:label+" ("+id+")",title:label,
      themes:themes,keywords:map["Keywords"]||"",source:map["contenttype/sources"]||""
     });
    }
   });
  }catch(eQ){console.warn("ONS search failed:",queries[qi],eQ)}
 }
 var out=Array.from(byId.values());
 out.sort(function(a,b){return a.label.localeCompare(b.label,"en",{numeric:true,sensitivity:"base"})});
 state.nomisCatalog=out;
 return out;
}

function nomisThemesFromCatalog(catalog){
 var map=new Map();
 (catalog||[]).forEach(function(ds){
  (ds.themes||["Other"]).forEach(function(th){
   if(!map.has(th))map.set(th,[]);
   map.get(th).push(ds);
  });
 });
 var themes=[];
 map.forEach(function(list,th){
  list=list.slice().sort(function(a,b){return a.label.localeCompare(b.label,"en",{numeric:true})});
  themes.push({
   id:"nomis-th-"+th.replace(/[^a-z0-9]+/gi,"-").toLowerCase(),
   label:th+" ("+list.length+")",
   type:"nomis-theme",
   theme:th,
   _children:list
  });
 });
 themes.sort(function(a,b){return a.label.localeCompare(b.label,"en",{numeric:true})});
 return themes;
}

async function nomisSelectRoot(){
 // Navegació per desplegables (com IGE), sense cerca
 state.pxPreset=""; // evita residus de Statistics Finland
 var box=$("eurostatLevels");
 if(box){box.innerHTML="";box.hidden=false;box.style.display="grid"}
 if(typeof igeClearLevels==="function")igeClearLevels();
 else if(state.igeItems&&state.igeItems.clear)state.igeItems.clear();
 hideStatSelector(true);
 setProviderUI();
 var catalog=await nomisLoadCatalog("");
 var themes=nomisThemesFromCatalog(catalog);
 if(!themes.length)throw new Error("ONS: no s'han trobat datasets.");
 igeAddLevel(themes,0,"Grup temàtic");
 if(box){box.hidden=false;box.style.display="grid"}
 status("ONS: "+catalog.length+" datasets · "+themes.length+" temes.");
}

async function nomisSelectFromLevel(index,val){
 var items=state.igeItems.get("igeLevel"+index)||[];
 var item=items.find(function(x){return String(x.id)===String(val)});
 if(!item)throw new Error("ONS: element no trobat.");
 if(item.type==="nomis-theme"){
  var kids=(item._children||[]).map(function(ds){
   return{id:"nomis-ds-"+ds.id,label:ds.label,type:"nomis-dataset",code:ds.id,datasetId:ds.id};
  });
  if(!kids.length)throw new Error("ONS: aquest tema no té datasets.");
  igeAddLevel(kids,index+1,"Dataset");
  return;
 }
 if(item.type==="nomis-dataset"){
  await nomisSelectDataset(item.datasetId||item.code);
  return;
 }
 throw new Error("ONS: tipus desconegut ("+(item.type||"?")+").");
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
 var candidates=[
  base+"/dataset/"+encodeURIComponent(datasetId)+"/"+encodeURIComponent(dimLower)+".def.sdmx.json",
  base+"/dataset/"+encodeURIComponent(datasetId)+"/"+encodeURIComponent(dimId)+".def.sdmx.json"
 ];
 if(codelist)candidates.push(base+"/codelist/"+encodeURIComponent(codelist)+".def.sdmx.json");
 var lastErr=null;
 for(var i=0;i<candidates.length;i++){
  try{
   var raw=await fetchJson(candidates[i]);
   cats=nomisExtractCodes(raw);
   if(cats.length)return cats;
  }catch(e){lastErr=e}
 }
 if(dimLower==="geography"){
  try{
   var raw2=await fetchJson(base+"/dataset/"+encodeURIComponent(datasetId)+"/geography.def.sdmx.json");
   cats=nomisExtractCodes(raw2);
   if(cats.length)return cats;
  }catch(e2){lastErr=e2}
 }
 if(lastErr&&!cats.length)console.warn("ONS: sense categories per a "+dimId,lastErr);
 return cats;
}

async function nomisSelectDataset(id){
 id=String(id||"").trim();
 if(!id||!/^NM_/i.test(id))throw new Error("ONS: identificador de dataset no vàlid ("+id+"). Cal un codi tipus NM_509_1, no el títol de la taula.");
 status("Carregant dimensions ONS…");
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
  // FREQ sovint és residual a ONS
  if(dimId.toUpperCase()==="FREQ")continue;
  var cats=await nomisFetchDimCodes(base,id,dimId,cl);
  if(!cats.length)continue;
  // Es carreguen TOTES les categories a la UI; la selecció per defecte i el límit de consulta eviten >25k cel·les.
  
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
 if(!out.id.length)throw new Error("ONS: no s'han pogut recuperar les dimensions del conjunt "+id+". (Algunes codelists retornen 404.)");
  state.selected.table=id;state.selected.node=id;state.metadata=out;
 renderMetadata(out);
 $("tableInfo").hidden=false;
 $("tableInfo").innerHTML="<strong>Dataset:</strong> "+esc(title)+" <code>"+esc(id)+"</code><span class=\"path\">"+esc(defUrl)+"</span><p>Data from the Office for National Statistics (ONS). Contains public sector information licensed under the Open Government Licence v3.0.</p><p class=\"hint\">Es mostren totes les categories, totes seleccionades per defecte. Desmarca les que no vulguis (màx. 25.000 cel·les; la URL no pot ser excessivament llarga).</p>";
 $("query").disabled=false;
 status("");
}

async function nomisQuery(filters){
 var base=provider().base.replace(/\/+$/,""),id=state.selected.table;
 if(!id)throw new Error("ONS: no s'ha seleccionat cap conjunt de dades.");
 var p=new URLSearchParams();
 // A ONS la UI sovint té NOMÉS UN SUBCONJUNT de categories (p.ex. 7 geografies).
 // Si ometem el paràmetre quan "tot està seleccionat" a la UI, ONS interpreta
 // "totes les categories del dataset" (milers) i retorna desenes de milers de files.
 // Per tant: sempre enviem explícitament els codis de state.filters.
 dims(state.metadata).forEach(function(d){
  var dimKey=String(d.id||"");
  var up=dimKey.toUpperCase();
  var vals=[];
  if(state.filters&&state.filters.has(dimKey)){
   vals=Array.from(state.filters.get(dimKey)||[]);
  }else if(filters){
   if(filters[dimKey])vals=Array.from(filters[dimKey]||[]);
   else if(filters[dimKey.toUpperCase()])vals=Array.from(filters[dimKey.toUpperCase()]||[]);
   else if(filters[dimKey.toLowerCase()])vals=Array.from(filters[dimKey.toLowerCase()]||[]);
  }
  if(!vals.length)return;
  var maxCodes=40;
  if(up==="GEOGRAPHY")maxCodes=50;
  else if(up==="TIME")maxCodes=40;
  else if(up==="CELL"||up==="VARIABLE"||up==="ITEM")maxCodes=60;
  else if(up==="MEASURES")maxCodes=30;
  else maxCodes=80;
  if(vals.length>maxCodes){
   throw new Error("ONS: masses valors a \""+dimKey+"\" ("+vals.length+"). Màxim "+maxCodes+". Redueix la selecció.");
  }
  p.set(dimKey.toLowerCase(),vals.join(","));
 });
 if(!p.has("time"))p.set("time","latest");
 // Sense geography ONS pot expandir a tot el territori
 if(!p.has("geography")){
  throw new Error("ONS: cal seleccionar com a mínim una geografia.");
 }
 var url=base+"/dataset/"+encodeURIComponent(id)+".jsonstat.json?"+p.toString();
 if(url.length>8000){
  throw new Error("ONS: URL massa llarga ("+url.length+" caràcters). Redueix CELL, VARIABLE o GEOGRAPHY.");
 }
 var data=await fetchJson(url);
 if(data&&data.dimension&&!data.version)data.version="2.0";
 return{data:data,url:url};
}
