"use strict";
(function(){
const M=window.ChevronModel;
const fmt=new Intl.NumberFormat("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2});
const money=n=>fmt.format(n)+" ₽";
const safeQty=n=>Number.isSafeInteger(n)&&n>=1&&n<=1000000;
function unique(xs){return [...new Set(xs)];}
function localParse(message,context={}){
 const s=String(message).toLowerCase().replace(/ё/g,"е").replace(/см²/g,"см2").replace(/\s+/g," ").trim();
 const areas=[];
 for(const re of [/\b(50|100|300|600)\s*(?:кв\.?\s*)?см(?:2)?(?![а-яё\d])/g,/площад(?:ь|ью|и)?\s*(?:в\s*)?(50|100|300|600)\b/g]){
  let m;while((m=re.exec(s)))areas.push(Number(m[1]));
 }
 const compare=/сравн|выгодн|разниц|различ|(?:что|какой)\s+дешевле|против|\bvs\b|\bили\b/.test(s);
 const capacity=/погонн|сколько\s+(?:шеврон|заготовок)\s+(?:получ|выйд|на\s+метр)/.test(s);
 const threshold=/как(?:ой|ом)\s+тираж|до\s+\d+\s*(?:руб|р)|ниже\s+\d+\s*(?:руб|р)|меньше\s+\d+\s*(?:руб|р)/.test(s);
 const explain=/почему|объясни|откуда|как\s+(?:считается|рассчит|формирует)|из\s+чего|структур|состав|расшифр|разложи|подробн|параметр/.test(s);
 const qtyMatches=[];
 for(const re of [/\b(\d{1,7})\s*(?:шт\.?|штук|штуки|шеврон(?:ов|а|ы)?|издели(?:й|я|е))(?![а-яё])/g,/тираж(?:ом|а)?\s*(?:в\s*)?(\d{1,7})\b/g,/на\s+(\d{1,7})\b/g]){
  let m;while((m=re.exec(s)))qtyMatches.push(Number(m[1]));
 }
 let quantity=qtyMatches.find(safeQty)??null;
 let areaList=unique(areas);
 if(compare){
  const pair=s.match(/\b(50|100|300|600)\s*(?:и|или|vs|против|\/|,|-)\s*(50|100|300|600)(?!\d)/);
  if(pair)areaList=unique([Number(pair[1]),Number(pair[2]),...areaList]);
  else if(areaList.length<2){
   const all=unique([...s.matchAll(/\b(50|100|300|600)\b/g)].map(m=>Number(m[1])));
   areaList=unique([...areaList,...all.filter(a=>a!==quantity)]);
  }
 }
 if(!compare && !areaList.length && /шеврон|площад|см2/.test(s)){
  const am=s.match(/\b(50|100|300|600)\b/);
  if(am)areaList=[Number(am[1])];
 }
 if(quantity===null&&/^\d{1,7}$/.test(s)&&safeQty(Number(s)))quantity=Number(s);
 const targetMatch=threshold?s.match(/(\d+(?:[.,]\d+)?)\s*(?:руб(?:лей|ля|ль)?|₽|р(?![а-яё]))/):null;
 const metersMatch=capacity?s.match(/(\d+(?:[.,]\d+)?)\s*(?:погонн(?:ых|ого|ые)?\s*)?(?:метр(?:ов|а)?|м\b)/):null;
 let intent="calculate";
 if(compare)intent="compare";
 else if(threshold)intent="threshold";
 else if(capacity)intent="capacity";
 else if(explain)intent="explain";
 else if(!/(?:себестоим|стоим|цена|цену|посчитай|рассчитай|сколько|калькул|тираж|шеврон|площад|см2|шт|^\d+$)/.test(s))intent="unknown";
 return {intent,area:areaList[0]??null,area2:areaList[1]??null,quantity,
         target:targetMatch?Number(targetMatch[1].replace(",",".")):null,
         meters:metersMatch?Number(metersMatch[1].replace(",",".")):null};
}
function clean(raw){
 if(!raw||typeof raw!=="object")return null;
 const intents=["calculate","compare","threshold","capacity","explain","unknown"];
 if(!intents.includes(raw.intent))return null;
 const a=n=>[50,100,300,600].includes(Number(n))?Number(n):null;
 const q=n=>n===null||n===undefined?null:Number(n);
 return {intent:raw.intent,area:a(raw.area),area2:a(raw.area2),
 quantity:safeQty(q(raw.quantity))?q(raw.quantity):null,
 target:Number.isFinite(q(raw.target))&&q(raw.target)>0?q(raw.target):null,
 meters:Number.isFinite(q(raw.meters))&&q(raw.meters)>0&&q(raw.meters)<100000?q(raw.meters):null};
}
function answer(incoming,context={}){
 const r=clean(incoming);
 if(!r)return {text:"Не получилось понять запрос. Попробуйте: «Посчитай 150 шевронов 300 см²».",context};
 const area=r.area??context.area??null;
 const qty=r.quantity??context.quantity??null;
 const next={area,quantity:qty};
 if(r.intent==="unknown")return {text:"Я помогаю с себестоимостью шевронов. Спросите про тираж, площадь, сравнение вариантов или формулы. Например: «100 штук по 300 см²».",context};
 if(r.intent==="compare"){
  const a=r.area??context.area, b=r.area2;
  if(!a||!b||a===b)return {text:"Какие две площади сравнить? Напишите, например: «Сравни 100 и 300 см² при тираже 200 шт».",context};
  if(!qty)return {text:"Для сравнения укажите тираж, например «200 штук».",context:{area:a,quantity:null}};
  const x=M.calc(a,qty),y=M.calc(b,qty),diff=Math.abs(x.unit-y.unit);
  const cheaper=x.unit<=y.unit?x:y;
  return {text:"Сравнение при тираже "+qty+" шт.:\n• "+a+" см²: "+money(x.unit)+"/шт., всего "+money(x.total)+".\n• "+b+" см²: "+money(y.unit)+"/шт., всего "+money(y.total)+".\nДешевле шевроны "+cheaper.area+" см² на "+money(diff)+" за штуку ("+money(diff*qty)+" за заказ).\n\nЭто сравнение себестоимости, не цены продажи.",context:{area:a,quantity:qty},stats:[x,y],kind:"compare"};
 }
 if(!area)return {text:"Какую площадь шеврона взять: 50, 100, 300 или 600 см²?",context:{area:null,quantity:qty}};
 if(r.intent==="capacity"){
  const x=M.calc(area,1),meters=r.meters??1;
  const total=meters*x.capacity;
  return {text:"Для площади "+area+" см² в модели получается "+x.params.B+" шевронов из заготовки, "+x.params.C+" заготовок с погонного метра.\nИтого "+x.capacity+" шевронов на 1 пог. м. На "+meters+" пог. м — "+new Intl.NumberFormat("ru-RU").format(total)+" шт. (без потерь).",context:next};
 }
 if(r.intent==="threshold"){
  if(!r.target)return {text:"Напишите целевую себестоимость, например «Какой тираж нужен для 50 ₽ за штуку при 300 см²?»",context:next};
  const x=M.calc(area,1);
  if(r.target<=x.variable)return {text:"Для площади "+area+" см² нижний предел модели — "+money(x.variable)+"/шт. Поэтому достичь "+money(r.target)+"/шт. увеличением тиража невозможно.",context:next};
  const q=Math.max(1,Math.ceil(x.setup/(r.target-x.variable)));
  if(q>1000000)return {text:"Для достижения "+money(r.target)+"/шт. потребуется тираж больше 1 000 000 шт. — вне диапазона расчёта.",context:next};
  const v=M.calc(area,q);
  return {text:"Чтобы при площади "+area+" см² получить себестоимость не выше "+money(r.target)+"/шт., нужен тираж от "+q+" шт.\nРасчётная себестоимость при таком тираже: "+money(v.unit)+"/шт.; стоимость всего тиража: "+money(v.total)+".",context:{area,quantity:q},stats:[v],kind:"calculate"};
 }
 if(r.intent==="explain"&&!qty){
  const p=M.DATA[area],fixed=p.G+p.J,base=p.D/(p.C*p.B)+(p.H+p.K)/p.B;
  return {text:"Для "+area+" см² формула такая:\nСебестоимость штуки = "+money(base)+" + "+money(fixed)+" / тираж.\n\n"+money(base)+" — переменные расходы на штуку (материал, вышивка, лазер); "+money(fixed)+" — начальные расходы на вышивку и лазер для всего заказа.\nЧем больше тираж, тем меньше начальные расходы на одну штуку. Укажите тираж для подробной расшифровки.",context:next};
 }
 if(!qty)return {text:"Для площади "+area+" см² укажите тираж. Например: «150 штук».",context:{area,quantity:null}};
 const x=M.calc(area,qty);
 if(r.intent==="explain"){
  return {text:"Расшифровка себестоимости, "+area+" см², "+qty+" шт.:\n• Материал: "+money(x.material)+"/шт.\n• Вышивка: "+money(x.embroidery)+"/шт.\n• Лазерная резка: "+money(x.laser)+"/шт.\n• ИТОГО: "+money(x.unit)+"/шт.\n• Затраты на заказ: "+money(x.total)+".\n\nНачальные расходы на заказ ("+money(x.setup)+") делятся на весь тираж, поэтому цена одной штуки снижается с ростом количества. Речь именно о себестоимости, без торговой наценки.",context:next,stats:[x],kind:"calculate"};
 }
 return {text:"Шевроны "+area+" см², тираж "+qty+" шт.\nСебестоимость 1 штуки: "+money(x.unit)+".\nВсего по заказу: "+money(x.total)+".\n\nМатериал: "+money(x.material)+"/шт. · Вышивка: "+money(x.embroidery)+"/шт. · Лазер: "+money(x.laser)+"/шт.\n\nМожете уточнить: «А на 300 штук?» или «Почему такая себестоимость?»",context:next,stats:[x],kind:"calculate"};
}
window.ChevronEngine=Object.freeze({localParse,answer,clean,money});
})();