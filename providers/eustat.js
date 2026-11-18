/* Provider module — loaded after app-universal.js core. Depends on global state, $, fetchJson, etc. */
/* === eustat (13 functions) === */

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
 fill($("cross"),tables.map(function(x){return{value:x.id,label:x.label}}));updateIdescatLevelVisibility();
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
