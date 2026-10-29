
"use strict";
// Значения из листов «50см2», «100см2», «300см2», «600см2» файла ШЕВРОНЫ.xlsx.
// B — число шевронов в заготовке; C — заготовок/пог.м; D — стоимость пог.м;
// G/H — начальная и переменная стоимость вышивки; J/K — начальная и переменная стоимость лазера.
const DATA={
"50": {B:12,C:10,D:160,G:1366.1,H:186.75,J:216.9575,K:31.46},
"100":{B:4,C:10,D:160,G:1366.1,H:186.75,J:216.9575,K:31.46},
"300":{B:2,C:10,D:160,G:1366.1,H:235.42,J:216.9575,K:31.46},
"600":{B:1,C:10,D:160,G:1366.1,H:201.47,J:216.9575,K:31.46}
};
const $=id=>document.getElementById(id),money=n=>new Intl.NumberFormat("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n)+" ₽",integer=n=>new Intl.NumberFormat("ru-RU").format(n);
function calc(p,q){const mat=p.D/p.C/p.B,emb=p.G/q+p.H/p.B,laser=p.J/q+p.K/p.B;return {mat,emb,laser,unit:mat+emb+laser};}
function render(){const p=DATA[$("area").value],q=Math.max(1,Math.round(Number($("qty").value)||1)),c=calc(p,q);$("unit").textContent=money(c.unit);$("total").textContent=money(c.unit*q);$("mat").textContent=money(c.mat);$("work").textContent=money(c.emb+c.laser);
const body=$("rows");body.replaceChildren();for(let qty=10;qty<=300;qty+=10){let x=calc(p,qty),tr=document.createElement("tr");if(qty===q)tr.className="selected";for(const val of [integer(qty),integer(p.B),integer(p.C),money(x.mat),money(x.emb),money(x.laser),money(x.unit),money(x.unit*qty)]){let td=document.createElement("td");td.textContent=val;tr.append(td)}tr.onclick=()=>{$("qty").value=qty;render()};body.append(tr)}
const params=[["Стоимость погонного метра",money(p.D)],["Шевронов в заготовке",integer(p.B)],["Заготовок с погонного метра",integer(p.C)],["Начальные расходы на вышивку",money(p.G)],["Расходы на вышивку на заготовку",money(p.H)],["Начальные расходы на лазер",money(p.J)],["Расходы на лазер на заготовку",money(p.K)]];$("params").replaceChildren(...params.map(pair=>{let tr=document.createElement("tr");for(const v of pair){let td=document.createElement("td");td.textContent=v;tr.append(td)}return tr}));}
$("area").onchange=render;$("qty").oninput=render;render();
