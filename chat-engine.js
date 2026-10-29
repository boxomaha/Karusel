"use strict";
(function(){
const M=window.ChevronModel;
const fmt=new Intl.NumberFormat("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2});
const num=new Intl.NumberFormat("ru-RU",{maximumFractionDigits:4});
const money=n=>fmt.format(n)+" ₽";
const safeQty=n=>Number.isSafeInteger(n)&&n>=1&&n<=1000000;
const unique=xs=>[...new Set(xs)];
const toNum=s=>Number(String(s).replace(",","."));
function localParse(message,context={}){
 const s=String(message).toLowerCase().replace(/ё/g,"е").replace(/см²/g,"см2").replace(/\s+/g," ").trim();
 const areas=[];
 const add=x=>{const n=toNum(x);if(Number.isFinite(n)&&!areas.includes(n))areas.push(n)};
 // Сохраняем фактическую площадь; не округляем во время распознавания.
 for(const re of [
   /(?<![\d\w])-?\d+(?:[.,]\d+)?\s*(?:кв\.?\s*см|см\s*2)(?![а-яa-z\d])/g,
   /(?:площад(?:ь|ью|и)|пл\.)\s*(?:шеврона\s*)?(?:в\s*)?-?\d+(?:[.,]\d+)?/g
 ]){
  let m;while((m=re.exec(s))){const v=m[0].match(/-?\d+(?:[.,]\d+)?/);if(v)add(v[0]);}
 }
 const compare=/сравн|выгодн|разниц|различ|(?:что|какой)\s+дешевле|против|\bvs\b|\bили\b/.test(s);
 const capacity=/погонн|сколько\s+(?:шеврон|заготовок)\s+(?:получ|выйд|на\s+метр)/.test(s);
 const threshold=/как(?:ой|ом)\s+тираж|тираж\s+для|до\s+\d+\s*(?:руб|р\b)|ниже\s+\d+\s*(?:руб|р\b)|меньше\s+\d+\s*(?:руб|р\b)/.test(s);
 const explain=/почему|объясни|откуда|как\s+(?:считается|рассчит|формирует)|из\s+чего|структур|состав|расшифр|разложи|подробн|параметр/.test(s);
 const qtyMatches=[];
 for(const re of [
   /\b(\d{1,7})\s*(?:шт\.?|штук(?:ах|ами|и|а|у)?|шеврон(?:ов|а|ы)?|издели(?:й|я|е))(?![а-яa-z])/g,
   /тираж(?:е|ем|ом|а)?\s*(?:в\s*)?(\d{1,7})\b/g,
   /на\s+(\d{1,7})\b(?!\s*(?:см2|кв\.?\s*см))/g
 ]){
  let m;while((m=re.exec(s)))qtyMatches.push(Number(m[1]));
 }
 let quantity=qtyMatches.find(safeQty)??null;
 if(compare){
  const pair=s.match(/(?<!\d)(-?\d+(?:[.,]\d+)?)\s*(?:см\s*2\s*)?(?:и|или|vs|против|\/|,|-)\s*(-?\d+(?:[.,]\d+)?)\s*(?:см\s*2)?(?!\d)/);
  if(pair)areas.unshift(toNum(pair[1]),toNum(pair[2]));
 }
 let areaList=unique(areas);
 if(compare&&areaList.length<2){
  const possible=[...s.matchAll(/(?<!\d)(\d+(?:[.,]\d+)?)(?!\d)/g)].map(m=>toNum(m[1]));
  areaList=unique([...areaList,...possible.filter(x=>x!==quantity)]);
 }
 if(!compare&&!areaList.length&&/(?:шеврон|площад|см2)/.test(s)){
  const m=s.match(/(?:площад(?:ь|ью|и)|шеврон(?:ов|а)?\s+площад(?:ь|ью)?)\s*(?:в\s*)?(-?\d+(?:[.,]\d+)?)/);
  if(m)areaList=[toNum(m[1])];
 }
 if(quantity===null&&/^\d{1,7}$/.test(s)&&safeQty(Number(s)))quantity=Number(s);
 const targetMatch=threshold?s.match(/(\d+(?:[.,]\d+)?)\s*(?:руб(?:лей|ля|ль)?|₽|р(?![а-я]))/):null;
 const metersMatch=capacity?s.match(/(\d+(?:[.,]\d+)?)\s*(?:погонн(?:ых|ого|ые)?\s*)?(?:метр(?:ов|а)?|м\b)/):null;
 let intent="calculate";
 if(compare)intent="compare";
 else if(threshold)intent="threshold";
 else if(capacity)intent="capacity";
 else if(explain)intent="explain";
 else if(!/(?:себестоим|стоим|цена|цену|посчитай|рассчитай|сколько|калькул|тираж|шеврон|площад|см2|шт|^\d+$)/.test(s))intent="unknown";
 return {intent,area:areaList[0]??null,area2:areaList[1]??null,quantity,
         target:targetMatch?toNum(targetMatch[1]):null,
         meters:metersMatch?toNum(metersMatch[1]):null};
}
function clean(raw){
 if(!raw||typeof raw!=="object")return null;
 const intents=["calculate","compare","threshold","capacity","explain","unknown"];
 if(!intents.includes(raw.intent))return null;
 const a=v=>v===null||v===undefined||v===""?null:Number(String(v).replace(",","."));
 const validArea=v=>Number.isFinite(v)?v:null;
 const qty=a(raw.quantity),target=a(raw.target),meters=a(raw.meters);
 return {intent:raw.intent,area:validArea(a(raw.area)),area2:validArea(a(raw.area2)),
  quantity:safeQty(qty)?qty:null,
  target:target!==null&&target>0?target:null,
  meters:meters!==null&&meters>0&&meters<100000?meters:null};
}
function areaLabel(area){
 const tier=M.tierFor(area);
 const value=num.format(area);
 return area===tier?value+" см²":value+" см² → расчёт по "+tier+" см²";
}
function answer(incoming,context={}){
 const r=clean(incoming);
 if(!r)return {text:"Не получилось понять запрос. Например: «Посчитай 150 шевронов по 47 см²».",context};
 if(r.intent==="unknown")return {text:"Я помогаю с себестоимостью шевронов. Назовите площадь от 0 до 600 см² и тираж, например «100 штук по 47 см²».",context};
 const area=r.area??context.area??null;
 const qty=r.quantity??context.quantity??null;
 const next={area,quantity:qty};
 // Запрет проверяется ДО расчётов, даже если в запросе не указан тираж.
 for(const a of [r.area,r.area2]){
  if(a!==null)try{M.tierFor(a)}catch(e){return {text:e.message,context,stats:[]};}
 }
 if(area!==null)try{M.tierFor(area)}catch(e){return {text:e.message,context,stats:[]};}
 if(r.intent==="compare"){
  const a=r.area??context.area??null,b=r.area2;
  if(a===null||b===null)return {text:"Какие две площади сравнить? Например: «Сравни 47 и 51 см² при тираже 200 шт».",context};
  if(!qty)return {text:"Для сравнения укажите тираж, например «200 штук».",context:{area:a,quantity:null}};
  const x=M.calc(a,qty),y=M.calc(b,qty),diff=Math.abs(x.unit-y.unit);
  let message="Сравнение при тираже "+qty+" шт.:\n• "+areaLabel(a)+": "+money(x.unit)+"/шт., всего "+money(x.total)+".\n• "+areaLabel(b)+": "+money(y.unit)+"/шт., всего "+money(y.total)+".\n";
  if(x.tier===y.tier)message+="Обе площади входят в один расчётный диапазон до "+x.tier+" см², поэтому себестоимость одинаковая.";
  else message+="Дешевле шевроны "+areaLabel(x.unit<=y.unit?a:b)+" на "+money(diff)+" за штуку ("+money(diff*qty)+" за заказ).";
  message+="\n\nЭто сравнение себестоимости, не цены продажи.";
  return {text:message,context:{area:a,quantity:qty},stats:[x,y],kind:"compare"};
 }
 if(area===null)return {text:"Укажите фактическую площадь шеврона в см² — например, 47 или 125 см². Максимум 600 см².",context:{area:null,quantity:qty}};
 const label=areaLabel(area);
 if(r.intent==="capacity"){
  const x=M.calc(area,1),meters=r.meters??1;
  const total=meters*x.capacity;
  return {text:"Для площади "+label+" получается "+x.params.B+" шевронов из заготовки, "+x.params.C+" заготовок с погонного метра.\nИтого "+x.capacity+" шевронов на 1 пог. м. На "+meters+" пог. м — "+new Intl.NumberFormat("ru-RU").format(total)+" шт. (без потерь).",context:next};
 }
 if(r.intent==="threshold"){
  if(!r.target)return {text:"Напишите целевую себестоимость, например «Какой тираж нужен для 50 ₽ за штуку при площади 47 см²?»",context:next};
  const x=M.calc(area,1);
  if(r.target<=x.variable)return {text:"Для площади "+label+" нижний предел модели — "+money(x.variable)+"/шт. Поэтому достичь "+money(r.target)+"/шт. увеличением тиража невозможно.",context:next};
  const q=Math.max(1,Math.ceil(x.setup/(r.target-x.variable)));
  if(q>1000000)return {text:"Для достижения "+money(r.target)+"/шт. потребуется тираж больше 1 000 000 шт. — вне диапазона расчёта.",context:next};
  const v=M.calc(area,q);
  return {text:"Для площади "+label+" себестоимость не выше "+money(r.target)+"/шт. достигается при тираже от "+q+" шт.\nСебестоимость: "+money(v.unit)+"/шт.; всего: "+money(v.total)+".",context:{area,quantity:q},stats:[v],kind:"calculate"};
 }
 if(r.intent==="explain"&&!qty){
  const p=M.DATA[M.tierFor(area)],fixed=p.G+p.J,base=p.D/(p.C*p.B)+(p.H+p.K)/p.B;
  return {text:"Для площади "+label+" формула:\nСебестоимость штуки = "+money(base)+" + "+money(fixed)+" / тираж.\n\n"+money(base)+" — переменные расходы на штуку; "+money(fixed)+" — начальные расходы на заказ. Укажите тираж для подробной расшифровки.",context:next};
 }
 if(!qty)return {text:"Площадь "+label+". Какой тираж рассчитать? Например: «150 штук».",context:{area,quantity:null}};
 const x=M.calc(area,qty);
 if(r.intent==="explain"){
  return {text:"Расшифровка: "+label+", "+qty+" шт.:\n• Материал: "+money(x.material)+"/шт.\n• Вышивка: "+money(x.embroidery)+"/шт.\n• Лазер: "+money(x.laser)+"/шт.\n• Итого: "+money(x.unit)+"/шт.\n• Весь заказ: "+money(x.total)+".\n\nНачальные расходы "+money(x.setup)+" делятся на весь тираж. Это себестоимость, без торговой наценки.",context:next,stats:[x],kind:"calculate"};
 }
 return {text:"Шевроны "+label+", тираж "+qty+" шт.\nСебестоимость 1 штуки: "+money(x.unit)+".\nВсего по заказу: "+money(x.total)+".\n\nМатериал: "+money(x.material)+"/шт. · Вышивка: "+money(x.embroidery)+"/шт. · Лазер: "+money(x.laser)+"/шт.\n\nМожно уточнить: «А на 300 штук?» или «Почему такая себестоимость?»",context:next,stats:[x],kind:"calculate"};
}
window.ChevronEngine=Object.freeze({localParse,answer,clean,money,areaLabel});
})();