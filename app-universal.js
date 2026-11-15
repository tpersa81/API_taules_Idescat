/* Loader: reconstitueix app-universal.js des de parts */
(async function(){
  var parts=["app-universal.part1.js","app-universal.part2.js","app-universal.part3.js"];
  var code="";
  for(var i=0;i<parts.length;i++){
    var r=await fetch(parts[i]+"?v=20261115b",{cache:"no-store"});
    if(!r.ok)throw new Error("No s'ha pogut carregar "+parts[i]+" (HTTP "+r.status+")");
    code+=await r.text();
  }
  var blob=new Blob([code],{type:"text/javascript"});
  var url=URL.createObjectURL(blob);
  await new Promise(function(res,rej){
    var s=document.createElement("script");
    s.src=url;s.onload=res;s.onerror=function(){rej(new Error("Error avaluant app-universal"))};
    document.head.appendChild(s);
  });
})().catch(function(e){
  console.error(e);
  var el=document.getElementById("status");
  if(el){el.textContent=String(e&&e.message||e);el.className="error"}
});
