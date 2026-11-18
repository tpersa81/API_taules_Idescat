/* Provider module — loaded after app-universal.js core. Depends on global state, $, fetchJson, etc. */
/* === eurostat (8 functions) === */

function eurostatNodeByPath(path){
 if(!path||!path.length)return null;var cur=state.eurostatRoots.find(function(r){return r.code===path[0]});if(!cur)return null;
 for(var i=1;i<path.length;i++){cur=(cur.children||[]).find(function(x){return x.code===path[i]});if(!cur)return null}return cur;
}

function eurostatClearLevels(){
 var box=$("eurostatLevels");
 if(box){box.innerHTML="";box.hidden=true}
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
