(function(){
"use strict";
var D=window.APP_DATA||{sets:[],meta:{}};
var S={page:"home",quiz:null,favorites:{},wrongs:{},attempts:0,correct:0,theme:"light"};
try{var saved=localStorage.getItem("ss_v5_state");if(saved)Object.assign(S,JSON.parse(saved));}catch(e){}
S.quiz=null;
function save(){try{localStorage.setItem("ss_v5_state",JSON.stringify({page:S.page,favorites:S.favorites,wrongs:S.wrongs,attempts:S.attempts,correct:S.correct,theme:S.theme}));}catch(e){}}
function el(id){return document.getElementById(id)}
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function shuf(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t}return a}
function sample(a,n){return shuf(a).slice(0,Math.min(n,a.length))}
function toast(t){var x=el("toast");x.textContent=t;x.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(function(){x.classList.remove("show")},1600);try{AndroidBridge.toast(t)}catch(e){}}
window.onerror=function(msg,src,line){console.error("APP ERROR",msg,src,line);toast("Uygulama hatası: "+msg);return false}
function cats(){
 return [
  ["home","⌂","Ana Sayfa"],["real","✓","Gerçek Sınav Soruları"],["general","★","Genel Kültür"],
  ["cygeo","⌖","Kıbrıs Coğrafyası"],["cyhist","◷","Kıbrıs Tarihi"],["subjects","▦","Konu Testleri"],
  ["constitution","⚖","Anayasa Lab"],["afet","◈","Afet Yönetimi"],["favorites","♥","Favoriler"],["wrongs","!","Yanlışlarım"]
 ];
}
function renderRail(){
 var h='<div class="brand">Sivil Savunma<small>Galaxy Tab S10 FE • v5.0</small></div><div class="nav">';
 cats().forEach(function(n){h+='<button data-page="'+n[0]+'" class="'+(S.page===n[0]?'active':'')+'">'+n[1]+' '+n[2]+'</button>'});
 h+='</div>'; el("rail").innerHTML=h;
}
function setsFor(cat){return (D.sets||[]).filter(function(s){return s.category===cat})}
function total(cat){return setsFor(cat).reduce(function(n,s){return n+s.questions.length},0)}
function title(t){el("title").textContent=t}
function setPage(p){S.page=p;save();renderRail();if(p==="home")home();else if(p==="favorites")favorites();else if(p==="wrongs")wrongs();else listPage(p)}
function home(){
 title("Çalışma Merkezi");
 var q=(D.meta&&D.meta.questions)||0, acc=S.attempts?Math.round(S.correct*100/S.attempts):0;
 el("content").innerHTML='<div class="page"><div class="hero"><h1>S10 FE Çalışma Merkezi</h1><p>PC uygulaması arşivindeki kaynaklardan GitHub derlemesinde sıfırdan oluşturulan çevrimdışı tablet sürümü.</p><div class="stats"><div class="stat"><b>'+q+'</b><span>toplam soru</span></div><div class="stat"><b>'+S.attempts+'</b><span>cevaplanan</span></div><div class="stat"><b>'+acc+'%</b><span>başarı</span></div><div class="stat"><b>'+Object.keys(S.favorites).length+'</b><span>favori</span></div></div></div><div class="section">Hızlı erişim</div><div class="grid">'+
 card("✓","Gerçek Sınav Soruları",total("real")+" soru","real")+card("★","Genel Kültür",total("general")+" soru","general")+card("⌖","Kıbrıs Coğrafyası",total("cygeo")+" soru","cygeo")+card("◷","Kıbrıs Tarihi",total("cyhist")+" soru","cyhist")+card("▦","Konu Testleri",total("subjects")+" soru","subjects")+card("⚖","Anayasa Lab",total("constitution")+" soru","constitution")+card("♥","Favoriler",Object.keys(S.favorites).length+" soru","favorites")+card("!","Yanlışlarım",Object.keys(S.wrongs).length+" soru","wrongs")+
 '</div></div>';
}
function card(ic,t,d,p){return '<div class="card"><h3>'+ic+' '+esc(t)+'</h3><p>'+esc(d)+'</p><div class="actions"><button class="btn" data-page="'+p+'">Aç</button></div></div>'}
function catName(cat){var x=cats().find(function(a){return a[0]===cat});return x?x[2]:cat}
function listPage(cat){
 title(catName(cat));var sets=setsFor(cat),h='<div class="page"><div class="section">'+esc(catName(cat))+'</div><div class="grid">';
 if(!sets.length)h+='<div class="empty">Bu bölüm için kaynak soru bulunamadı.</div>';
 sets.forEach(function(s){
   h+='<div class="card"><h3>'+esc(s.title)+'</h3><p>'+s.questions.length+' soru • Her yeni testte cevap şıkları yeniden karışır.</p><div class="actions"><button class="btn" data-start="'+esc(s.id)+'" data-count="10">10 Soru</button><button class="btn alt" data-start="'+esc(s.id)+'" data-count="20">20 Soru</button><button class="btn alt" data-start="'+esc(s.id)+'" data-count="all">Tümü</button></div></div>';
 });
 h+='</div></div>';el("content").innerHTML=h;
}
function findSet(id){return (D.sets||[]).find(function(s){return s.id===id})}
function prepQ(q){
 var pairs=q.options.map(function(o,i){return {text:o,correct:i===q.correctIndex}});
 pairs=shuf(pairs);
 return {id:q.id,stem:q.stem,options:pairs.map(function(x){return x.text}),correctIndex:pairs.findIndex(function(x){return x.correct}),explanation:q.explanation||"",reference:q.reference||"",number:q.number};
}
function start(setId,count){
 var s=findSet(setId);if(!s)return toast("Soru seti bulunamadı.");
 var src=count==="all"?shuf(s.questions):sample(s.questions,parseInt(count,10));
 var qs=src.map(prepQ);S.quiz={set:s,title:s.title,questions:qs,i:0,answered:false,selected:-1,correct:0,wrong:0,blank:0};try{AndroidBridge.keepScreenOn(true)}catch(e){};renderQuiz();
}
function renderQuiz(){
 var z=S.quiz,q=z.questions[z.i],fav=!!S.favorites[q.id];
 title(z.title);
 var opts=q.options.map(function(o,i){return '<button class="opt" data-opt="'+i+'"><span class="l">'+String.fromCharCode(65+i)+'</span><span>'+esc(o)+'</span></button>'}).join("");
 el("content").innerHTML='<div class="quiz"><div class="quizbar"><button class="btn alt" data-quit="1">← Çık</button><div class="grow">'+esc(z.title)+'</div><div>'+(z.i+1)+' / '+z.questions.length+'</div><button class="btn alt fav" data-fav="1">'+(fav?'♥':'♡')+'</button></div><div class="quizlayout"><div class="panel"><div class="muted">Soru '+(q.number||z.i+1)+'</div><div class="stem">'+esc(q.stem)+'</div><div class="opts">'+opts+'</div><div class="quizactions"><button class="btn alt" data-blank="1">Boş Bırak</button><button class="btn" data-next="1" disabled>Sonraki</button></div></div><div class="panel fb"><div class="empty">Cevap verdikten sonra açıklama burada görünecek.</div></div></div></div>';
}
function answer(i,blank){
 var z=S.quiz;if(!z||z.answered)return;var q=z.questions[z.i];z.answered=true;z.selected=blank?-1:i;S.attempts++;
 var ok=!blank&&i===q.correctIndex;if(ok){z.correct++;S.correct++;delete S.wrongs[q.id]}else if(blank){z.blank++}else{z.wrong++;S.wrongs[q.id]=(S.wrongs[q.id]||0)+1}
 save();
 var bs=document.querySelectorAll(".opt");bs.forEach(function(b,k){b.disabled=true;if(k===q.correctIndex)b.classList.add("correct");if(!blank&&k===i&&i!==q.correctIndex)b.classList.add("wrong")});
 var fb=document.querySelector(".fb"),right=q.options[q.correctIndex];
 fb.innerHTML='<h3>'+(blank?'Boş bırakıldı':ok?'✓ Doğru':'✕ Yanlış')+'</h3><p><b>Doğru cevap:</b> '+esc(right)+'</p>'+(q.explanation?'<p>'+esc(q.explanation)+'</p>':'')+(q.reference?'<p class="muted">'+esc(q.reference)+'</p>':'');
 document.querySelector("[data-next]").disabled=false;
 try{AndroidBridge.vibrate(ok?18:35)}catch(e){}
}
function next(){
 var z=S.quiz;if(!z||!z.answered)return toast("Önce cevap ver.");
 if(z.i+1>=z.questions.length)return result();
 z.i++;z.answered=false;z.selected=-1;renderQuiz();
}
function result(){
 var z=S.quiz;try{AndroidBridge.keepScreenOn(false)}catch(e){};var a=z.questions.length?Math.round(z.correct*100/z.questions.length):0;
 el("content").innerHTML='<div class="page"><div class="hero"><h1>Test tamamlandı</h1><p>'+esc(z.title)+'</p><div class="stats"><div class="stat"><b>'+z.correct+'</b><span>doğru</span></div><div class="stat"><b>'+z.wrong+'</b><span>yanlış</span></div><div class="stat"><b>'+z.blank+'</b><span>boş</span></div><div class="stat"><b>'+a+'%</b><span>başarı</span></div></div></div><div class="section"><button class="btn" data-page="'+z.set.category+'">Bölüme Dön</button> <button class="btn alt" data-page="wrongs">Yanlışlarım</button></div></div>';S.quiz=null;
}
function allQuestions(){var m={};(D.sets||[]).forEach(function(s){s.questions.forEach(function(q){m[q.id]=q})});return m}
function favorites(){
 title("Favoriler");var map=allQuestions(),arr=Object.keys(S.favorites).map(function(id){return map[id]}).filter(Boolean);
 var h='<div class="page"><div class="section">Favoriler</div>';
 if(!arr.length)h+='<div class="empty">Henüz favori soru yok.</div>';
 else{h+='<div class="actions"><button class="btn" data-favquiz="10">10 Soruluk Sınav</button><button class="btn alt" data-favquiz="20">20 Soruluk Sınav</button><button class="btn alt" data-favquiz="all">Tüm Favoriler</button></div><div class="grid">';arr.forEach(function(q){h+='<div class="card"><h3>'+esc(q.stem)+'</h3><p>'+esc(q.answerText||"")+'</p></div>'});h+='</div>'}
 h+='</div>';el("content").innerHTML=h;
}
function wrongs(){
 title("Yanlışlarım");var map=allQuestions(),arr=Object.keys(S.wrongs).map(function(id){return map[id]}).filter(Boolean);
 var h='<div class="page"><div class="section">Yanlışlarım</div>';
 if(!arr.length)h+='<div class="empty">Aktif yanlış soru yok.</div>';
 else{h+='<div class="grid">';arr.forEach(function(q){h+='<div class="card"><h3>'+esc(q.stem)+'</h3><p>Yanlış sayısı: '+(S.wrongs[q.id]||1)+'</p></div>'});h+='</div>'}
 h+='</div>';el("content").innerHTML=h;
}
function startCustom(arr,t){
 var set={id:"custom",title:t,category:"favorites"},qs=shuf(arr).map(prepQ);S.quiz={set:set,title:t,questions:qs,i:0,answered:false,selected:-1,correct:0,wrong:0,blank:0};renderQuiz()
}
document.addEventListener("click",function(e){
 var n=e.target.closest("button");if(!n)return;
 if(n.dataset.page){setPage(n.dataset.page);return}
 if(n.dataset.start){start(n.dataset.start,n.dataset.count);return}
 if(n.dataset.opt!=null){answer(parseInt(n.dataset.opt,10),false);return}
 if(n.dataset.blank){answer(-1,true);return}
 if(n.dataset.next){next();return}
 if(n.dataset.quit){try{AndroidBridge.keepScreenOn(false)}catch(x){};var p=S.quiz?S.quiz.set.category:"home";S.quiz=null;setPage(p);return}
 if(n.dataset.fav){var q=S.quiz.questions[S.quiz.i];if(S.favorites[q.id]){delete S.favorites[q.id];n.textContent="♡";toast("Favoriden çıkarıldı")}else{S.favorites[q.id]=1;n.textContent="♥";toast("Favorilere eklendi")}save();return}
 if(n.dataset.favquiz){var map=allQuestions(),arr=Object.keys(S.favorites).map(function(id){return map[id]}).filter(Boolean);if(!arr.length)return toast("Favori soru yok.");var c=n.dataset.favquiz;if(c!=="all")arr=sample(arr,parseInt(c,10));startCustom(arr,"Favorilerimden Sınav");return}
});
el("theme").onclick=function(){S.theme=S.theme==="dark"?"light":"dark";document.documentElement.dataset.theme=S.theme;save()};
document.documentElement.dataset.theme=S.theme;
window.APP={back:function(){if(S.quiz){var p=S.quiz.set.category;S.quiz=null;setPage(p);return true}if(S.page!=="home"){setPage("home");return true}return false}};
renderRail();setPage(S.page||"home");
})();