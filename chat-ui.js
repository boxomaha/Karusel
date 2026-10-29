"use strict";
(function(){
const M=window.ChevronModel,E=window.ChevronEngine;
if(!M||!E)throw new Error("Не загрузилась расчётная модель.");
const $=id=>document.getElementById(id);
const messages=$("messages"),form=$("chat-form"),input=$("chat-input"),send=$("send-button"),
      mode=$("ai-mode"),footnote=$("mode-description"),resultPanel=$("result-panel");
let context={area:null,quantity:null},busy=false;
let ai=window.CHEVRON_AI||{endpoint:"",token:""};
function append(text,who){
 const wrap=document.createElement("div");wrap.className="chat-line "+(who==="user"?"from-user":"from-assistant");
 const avatar=document.createElement("span");avatar.className="message-avatar";avatar.textContent=who==="user"?"Вы":"Σ";
 const bubble=document.createElement("div");bubble.className="message-bubble";bubble.textContent=text;
 wrap.append(avatar,bubble);messages.append(wrap);messages.scrollTop=messages.scrollHeight;
 return wrap;
}
function showModel(){
 const rows=[];
 for(const area of M.areas){
  const p=M.DATA[area];
  rows.push(area+" см² — шевронов в заготовке: "+p.B+", заготовок/пог. м: "+p.C+", материал: "+E.money(p.D)+"/пог. м, начальные расходы: "+E.money(p.G+p.J)+".");
 }
 $("model-data").textContent=rows.join("\n\n");
}
function stat(label,value){
 const el=document.createElement("div");el.className="result-stat";
 const l=document.createElement("span");l.textContent=label;
 const v=document.createElement("strong");v.textContent=value;
 el.append(l,v);return el;
}
function showResults(a){
 resultPanel.replaceChildren();
 if(!a.stats||!a.stats.length){resultPanel.hidden=true;return;}
 resultPanel.hidden=false;
 const headline=document.createElement("div");headline.className="result-title";headline.textContent=a.kind==="compare"?"Сравнение вариантов":"Проверенный расчёт";resultPanel.append(headline);
 for(const s of a.stats){
  const card=document.createElement("div");card.className="result-card";
  const h=document.createElement("h3");h.textContent=s.area+" см² · "+s.qty+" шт.";
  const grid=document.createElement("div");grid.className="result-grid";
  grid.append(stat("Себестоимость / шт.",E.money(s.unit)),
              stat("Весь тираж",E.money(s.total)),
              stat("Материал / шт.",E.money(s.material)),
              stat("Вышивка / шт.",E.money(s.embroidery)),
              stat("Лазер / шт.",E.money(s.laser)));
  card.append(h,grid);resultPanel.append(card);
 }
}
function updateMode(){
 const online=!!(ai.endpoint&&ai.token);
 mode.textContent=online?"ИИ подключён":"Локальные команды · без ИИ";
 mode.className="mode-chip "+(online?"mode-online":"mode-local");
 footnote.textContent=online?
  "ИИ понимает запрос; итоговые числа всегда рассчитываются по формулам, а не генерируются моделью.":
  "Работает локальный помощник с ограниченным набором формулировок. Для настоящей ИИ-модели нужен защищённый сервер и ключ API.";
}
async function getIntent(text){
 if(!ai.endpoint||!ai.token)return E.localParse(text,context);
 try{
  const response=await fetch(ai.endpoint.replace(/\/$/,"")+"/chat",{
   method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+ai.token},
   body:JSON.stringify({message:text,context}),signal:AbortSignal.timeout(12000)
  });
  if(!response.ok)throw new Error("ИИ временно недоступен ("+response.status+").");
  const data=await response.json();
  const valid=E.clean(data.intent);
  if(!valid)throw new Error("Ответ сервера не распознан.");
  return valid;
 }catch(err){
  console.warn("AI endpoint unavailable; falling back to deterministic parser:",err);
  mode.textContent="ИИ недоступен · локальный режим";
  footnote.textContent="Не удалось связаться с ИИ. Обычные расчёты продолжают работать локально.";
  return E.localParse(text,context);
 }
}
async function ask(text){
 const question=String(text||"").trim();
 if(!question||busy)return;
 busy=true;send.disabled=true;input.disabled=true;
 append(question,"user");input.value="";
 const pending=append("Считаю…","assistant");
 try{
  const intent=await getIntent(question);
  const result=E.answer(intent,context);
  context=result.context||context;
  pending.querySelector(".message-bubble").textContent=result.text;
  showResults(result);
 }catch(err){
  pending.querySelector(".message-bubble").textContent="Не удалось рассчитать ответ: "+(err.message||"ошибка.");
  resultPanel.hidden=true;
 }finally{busy=false;send.disabled=false;input.disabled=false;input.focus();messages.scrollTop=messages.scrollHeight;}
}
form.addEventListener("submit",e=>{e.preventDefault();ask(input.value)});
input.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.isComposing){e.preventDefault();if(form.reportValidity())ask(input.value);}});
document.querySelectorAll("[data-prompt]").forEach(b=>b.addEventListener("click",()=>ask(b.dataset.prompt)));
append("Привет! Я помогу разобраться с себестоимостью шевронов. Напишите, например: «Посчитай 150 штук площадью 300 см²». Можно сравнивать площади, спрашивать о составе расходов или уточнять тираж следующим сообщением.","assistant");
showModel();updateMode();input.focus();
})();