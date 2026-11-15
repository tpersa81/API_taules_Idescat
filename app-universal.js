/* Loader base64 parts -> app-universal.js */
(async function(){
  var parts=["app.b64.1.txt","app.b64.2.txt","app.b64.3.txt","app.b64.4.txt"];
  var b64="";
  for(var i=0;i<parts.length;i++){
    var r=await fetch(parts[i]+"?v=20261115c",{cache:"no-store"});
    if(!r.ok)throw new Error("HTTP "+r.status+" a "+parts[i]);
    b64+= (await r.text()).replace(/\s+/g,"");
  }
  var bin=atob(b64);
  var bytes=new Uint8Array(bin.length);
  for(var j=0;j<bin.length;j++)bytes[j]=bin.charCodeAt(j);
  var code=new TextDecoder("utf-8").decode(bytes);
  var blob=new Blob([code],{type:"text/javascript"});
  var url=URL.createObjectURL(blob);
  await new Promise(function(res,rej){
    var s=document.createElement("script");
    s.src=url;s.onload=res;s.onerror=function(){rej(new Error("eval failed"))};
    document.head.appendChild(s);
  });
})().catch(function(e){
  console.error(e);
  var el=document.getElementById("status");
  if(el){el.textContent=String(e&&e.message||e);el.className="error"}
});
