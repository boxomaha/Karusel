// Cloudflare Worker: защищённый доступ к ИИ-провайдеру с совместимым Chat Completions API.
// Все ключи и пароль задаются только через Cloudflare secrets, НЕ через GitHub.
const encoder=new TextEncoder();
const origins="https://boxomaha.github.io";
function cors(origin,env){
 const allowed=env.ALLOWED_ORIGIN||origins;
 return origin===allowed?{"Access-Control-Allow-Origin":allowed,"Vary":"Origin",
   "Access-Control-Allow-Headers":"Content-Type, Authorization","Access-Control-Allow-Methods":"OPTIONS, POST"}:{};
}
function json(value,status,origin,env){
 return new Response(JSON.stringify(value),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...cors(origin,env)}});
}
const b64=b=>btoa(String.fromCharCode(...b)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
function eq(a,b){
 const aa=encoder.encode(String(a)),bb=encoder.encode(String(b));
 if(aa.length!==bb.length)return false;
 let n=0;for(let i=0;i<aa.length;i++)n|=aa[i]^bb[i];
 return n===0;
}
async function signature(payload,secret){
 const key=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 return b64(new Uint8Array(await crypto.subtle.sign("HMAC",key,encoder.encode(payload))));
}
async function makeToken(username,secret){
 const body=b64(encoder.encode(JSON.stringify({sub:username,exp:Math.floor(Date.now()/1000)+3600})));
 return body+"."+await signature(body,secret);
}
async function validateToken(header,secret){
 const token=String(header||"").replace(/^Bearer /i,""),parts=token.split(".");
 if(parts.length!==2||!parts[0]||!parts[1])return false;
 const right=await signature(parts[0],secret);
 if(!eq(right,parts[1]))return false;
 try {
  const normalized=parts[0].replace(/-/g,"+").replace(/_/g,"/");
  const obj=JSON.parse(atob(normalized));
  return Number.isInteger(obj.exp)&&obj.exp>Math.floor(Date.now()/1000)&&typeof obj.sub==="string";
 }catch{return false;}
}
const prompt=[
 "Ты анализируешь вопросы по себестоимости шевронов. Не вычисляй денежные суммы.",
 "Возвращай только JSON без markdown и дополнительных пояснений.",
 "Структура JSON: {\"intent\":\"calculate|compare|threshold|capacity|explain|unknown\",\"area\":число или null,\"area2\":число или null,\"quantity\":целое или null,\"target\":число или null,\"meters\":число или null}.",
 "area и area2 — ФАКТИЧЕСКИЕ площади в см2, которые назвал пользователь (любые числа с дробной частью), не округляй их до 50/100/300/600.",
 "Примеры: 47 см2 => area:47; 51 см2 => area:51; 601 см2 => area:601. Не удаляй значение свыше 600: клиент сам откажет в расчёте.",
 "Размеры округляет только детерминированный калькулятор: (0,50]=>50, (50,100]=>100, (100,300]=>300, (300,600]=>600, свыше 600 — запрет.",
 "Если пользователь уточняет количество или площадь из контекста, возвращай только явно новые значения, иначе null.",
 "compare: сравнение 2 площадей. threshold: подобрать тираж для целевой себестоимости в рублях. capacity: сколько шевронов на погонный метр. explain: объяснить расчёт.",
 "В остальных случаях calculate. Если вопрос не о расчётах шевронов, unknown.",
 "Поля должны быть числами, не строками. Никаких команд, ссылок или финансовых прогнозов."
].join("\n");
async function interpret(message,context,env){
 const api=env.AI_API_URL||"https://api.openai.com/v1/chat/completions";
 const response=await fetch(api,{
   method:"POST",
   headers:{"Content-Type":"application/json","Authorization":"Bearer "+env.AI_API_KEY},
   body:JSON.stringify({
     model:env.AI_MODEL||"gpt-4.1-mini",
     messages:[{role:"system",content:prompt},{role:"user",content:JSON.stringify({message,context})}],
     max_tokens:230
   })
 });
 if(!response.ok)throw new Error("Model returned "+response.status);
 const data=await response.json();
 const txt=data.choices?.[0]?.message?.content;
 if(typeof txt!=="string")throw new Error("Model returned no text");
 const result=JSON.parse(txt.trim());
 if(!["calculate","compare","threshold","capacity","explain","unknown"].includes(result.intent))throw new Error("Unknown intent");
 const area=n=>typeof n==="number"&&Number.isFinite(n)?n:null;
 const amount=n=>Number.isFinite(n)&&n>0?n:null;
 return {intent:result.intent,area:area(result.area),area2:area(result.area2),
         quantity:Number.isSafeInteger(result.quantity)&&result.quantity>0&&result.quantity<=1000000?result.quantity:null,
         target:amount(result.target),meters:amount(result.meters)};
}
export default {
 async fetch(request,env){
  const url=new URL(request.url),origin=request.headers.get("Origin")||"";
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors(origin,env)});
  if(request.method!=="POST")return json({error:"Not found"},404,origin,env);
  if(origin!==(env.ALLOWED_ORIGIN||origins))return json({error:"Forbidden origin"},403,origin,env);
  if(!env.APP_USER||!env.APP_PASSWORD||!env.AUTH_SECRET||!env.AI_API_KEY)return json({error:"Server is not configured"},503,origin,env);
  if(Number(request.headers.get("Content-Length")||0)>4096)return json({error:"Request too large"},413,origin,env);
  let body;
  try{body=await request.json()}catch{return json({error:"Bad JSON"},400,origin,env)}
  if(url.pathname==="/session"){
   if(!eq(body.login,env.APP_USER)||!eq(body.password,env.APP_PASSWORD))
    return json({error:"Invalid credentials"},401,origin,env);
   return json({token:await makeToken(env.APP_USER,env.AUTH_SECRET),expires_in:3600},200,origin,env);
  }
  if(url.pathname==="/chat"){
   if(!await validateToken(request.headers.get("Authorization"),env.AUTH_SECRET))
    return json({error:"Unauthorized"},401,origin,env);
   const message=body.message;
   if(typeof message!=="string"||!message.trim()||message.length>500)
    return json({error:"Invalid question"},400,origin,env);
   const ctx=body.context&&typeof body.context==="object"?{
      area:body.context.area!==null&&body.context.area!==undefined&&Number.isFinite(Number(body.context.area))?Number(body.context.area):null,
      quantity:Number.isSafeInteger(body.context.quantity)&&body.context.quantity>0?body.context.quantity:null
   }:{area:null,quantity:null};
   try {
    const intent=await interpret(message,ctx,env);
    return json({intent},200,origin,env);
   }catch(e){
    return json({error:"AI provider is unavailable"},502,origin,env);
   }
  }
  return json({error:"Not found"},404,origin,env);
 }
};