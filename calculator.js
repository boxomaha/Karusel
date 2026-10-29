"use strict";
(function(){
const DATA=Object.freeze({
 50:Object.freeze({B:12,C:10,D:160,G:1366.1,H:186.75,J:216.9575,K:31.46}),
 100:Object.freeze({B:4,C:10,D:160,G:1366.1,H:186.75,J:216.9575,K:31.46}),
 300:Object.freeze({B:2,C:10,D:160,G:1366.1,H:235.42,J:216.9575,K:31.46}),
 600:Object.freeze({B:1,C:10,D:160,G:1366.1,H:201.47,J:216.9575,K:31.46})
});
const TIERS=Object.freeze([50,100,300,600]);
function tierFor(area){
 const value=Number(area);
 if(!Number.isFinite(value)||value<=0)throw new RangeError("Площадь шеврона должна быть больше 0 см².");
 if(value>600)throw new RangeError("Площадь "+value+" см² превышает максимальные 600 см². Расчёт не выполняется.");
 return TIERS.find(tier=>value<=tier);
}
function calc(area,qty){
 const tier=tierFor(area);
 if(!Number.isSafeInteger(qty)||qty<1||qty>1000000)throw new RangeError("Тираж должен быть от 1 до 1 000 000 шт.");
 const p=DATA[tier];
 const material=p.D/(p.C*p.B);
 const embroidery=p.G/qty+p.H/p.B;
 const laser=p.J/qty+p.K/p.B;
 const unit=material+embroidery+laser;
 return {area:Number(area),tier,qty,material,embroidery,laser,unit,total:unit*qty,setup:p.G+p.J,
         variable:material+(p.H+p.K)/p.B,capacity:p.B*p.C,params:p};
}
window.ChevronModel=Object.freeze({DATA,calc,tierFor,areas:TIERS});
})();