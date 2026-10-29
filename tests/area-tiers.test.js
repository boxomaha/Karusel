"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const ctx=vm.createContext({window:{},Intl,console});
for(const file of ["calculator.js","chat-engine.js"]){
 vm.runInContext(fs.readFileSync(path.join(root,file),"utf8"),ctx,{filename:file});
}
const M=ctx.window.ChevronModel,E=ctx.window.ChevronEngine;
function same(actual,expected,title){assert.equal(actual,expected,title);}
function answer(q,context){return E.answer(E.localParse(q,context),context);}
const tiers=[
 [0.01,50],[47,50],[50,50],[50.01,100],[51,100],[100,100],
 [100.01,300],[125,300],[300,300],[300.01,600],[301,600],[600,600]
];
for(const [a,tier] of tiers){
 same(M.tierFor(a),tier,"tier for "+a);
 same(M.calc(a,100).tier,tier,"cost tier for "+a);
}
for(const bad of [-1,0,600.00001,601,Infinity,NaN,"несуществующая"]){
 assert.throws(()=>M.tierFor(bad),{name:"RangeError"},"reject "+bad);
}
const sameCost=M.calc(47,100).unit;
same(sameCost,M.calc(50,100).unit,"47 & 50 same cost");
same(M.calc(51,100).unit,M.calc(100,100).unit,"51 & 100 same cost");
same(M.calc(125,100).unit,M.calc(300,100).unit,"125 & 300 same cost");
same(M.calc(301,100).unit,M.calc(600,100).unit,"301 & 600 same cost");
assert.notEqual(M.calc(50,100).unit,M.calc(51,100).unit,"boundary between tiers changes cost");
const cases=[
 ["47см2 100 штук",47,100],
 ["51 см² 200 шт",51,200],
 ["шеврон 47,5 см² на 130 штук",47.5,130],
 ["100 шт площадью 47 см²",47,100],
 ["стоит 40 шт 125 см2",125,40],
 ["площадь 601 и 40 шт",601,40],
 ["площадь 600,1 см² и 40 шт",600.1,40],
 ["Сравни 47 и 51 см² при тираже 200 шт",47,200],
 ["Сравни 100 и 600 см² при 100 штуках",100,100]
];
for(const [text,area,qty] of cases){
 const parsed=E.localParse(text);
 same(parsed.area,area,"area parsed in "+text);
 same(parsed.quantity,qty,"qty parsed in "+text);
}
const a=answer("47 см2 100 шт");
assert.match(a.text,/47 см² → расчёт по 50 см²/);
same(a.stats[0].tier,50,"priced 47 as 50");
const b=answer("А на 200 штук?",a.context);
same(b.stats[0].tier,50,"follow-up retains original area");
same(b.stats[0].area,47,"follow-up retains actual area");
same(b.stats[0].qty,200,"follow-up updates quantity");
const c=answer("51 см2 100 шт");
assert.match(c.text,/51 см² → расчёт по 100 см²/);
same(c.stats[0].tier,100,"priced 51 as 100");
const invalid=answer("601см2 100шт",a.context);
assert.match(invalid.text,/Расчёт не выполняется/);
same(invalid.stats.length,0,"do not display numbers for invalid area");
same(invalid.context.area,47,"invalid request should not replace valid context");
const cmp=answer("Сравни 47 и 49 см² при тираже 100 шт");
assert.match(cmp.text,/один расчётный диапазон/);
same(cmp.stats[0].unit,cmp.stats[1].unit,"same tier comparison");
const cmpBad=answer("Сравни 47 и 601 см² при тираже 100 шт");
assert.match(cmpBad.text,/Расчёт не выполняется/);
same(cmpBad.stats.length,0,"comparison blocks all calculations if area too large");
const ai=E.answer({intent:"calculate",area:601,quantity:50});
assert.match(ai.text,/Расчёт не выполняется/);
const aiOK=E.answer({intent:"calculate",area:51,quantity:50});
same(aiOK.stats[0].tier,100,"AI parameters still use deterministic tier");
console.log("All area tiers, language parsing, conversational context and rejection tests passed.");
