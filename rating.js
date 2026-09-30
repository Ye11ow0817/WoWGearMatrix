// Rating contribution from the bundled SimulationCraft 12.1.0.69814 tables.
(function(root){
'use strict';
const data=typeof module!=='undefined'?require('./rating-data.js'):root.RatingData;
const mastery=typeof module!=='undefined'?require('./mastery-data.js'):root.MasteryData;
const curves={secondary:[[0,0],[30,30],[40,39],[50,47],[60,54],[80,66],[100,76],[200,126]],tertiary:[[0,0],[.5,.5],[10,10],[15,14],[20,17],[25,19],[100,49]]};
const secondary=new Set(['crit','haste','mastery','versatility']);
const keys=[...secondary,'avoidance','leech','speed'];
function curve(key){return secondary.has(key)?curves.secondary:curves.tertiary;}
function apply(points,value){if(value<=0)return 0;for(let i=1;i<points.length;i++){const [x,y]=points[i],prev=points[i-1];if(value<=x)return prev[1]+(value-prev[0])*(y-prev[1])/(x-prev[0]);}return points.at(-1)[1];}
function perPercent(c,key){const level=Math.max(1,Math.min(90,c.attributeContext?.level||90)),custom=c.ratingOverrides?.[key];return Number.isFinite(custom)&&custom>0?custom*(key==='mastery'?masteryFactor(c):1):data[key]?.[level-1]||null;}
function displayRatio(c,key){const level=Math.max(1,Math.min(90,c.attributeContext?.level||90));return c.ratingOverrides?.[key]??(data[key]?.[level-1]||null)/(key==='mastery'?masteryFactor(c):1);}
function masteryFactor(c){const context=c.attributeContext||{};return mastery[`${context.class}_${context.spec}`]?.[2]||1;}
function toPercent(c,key,rating){const per=perPercent(c,key);return per===null?null:apply(curve(key),Math.max(0,Number(rating)||0)/per)*(key==='mastery'?masteryFactor(c):1);}
function toSheetPercent(c,key,rating){
 const base=c.basePercents?.[key],baseRating=c.baseStats?.[key];
 if(!Number.isFinite(base)||!Number.isFinite(baseRating))return null;
 const contribution=value=>{const percent=toPercent(c,key,value);return percent===null?null:key==='speed'?percent*Math.exp(-.0003*Math.max(0,value))*.1:percent;};
 const total=contribution(rating),naked=contribution(baseRating);
 if(total===null||naked===null)return null;
 return key==='haste'?100*((1+base/100)*(1+total/100)/(1+naked/100)-1):base+total-naked;
}
function toRating(c,key,percent){const per=perPercent(c,key),points=curve(key),target=Number(percent);if(per===null||!Number.isFinite(target)||target<0||target>points.at(-1)[1]*(key==='mastery'?masteryFactor(c):1))return null;if(target===0)return 0;let hi=points.at(-1)[0]*per,lo=0;for(let i=0;i<55;i++){const mid=(lo+hi)/2;if(toPercent(c,key,mid)<target)lo=mid;else hi=mid;}return hi;}
function toSheetRating(c,key,percent){
 const target=Number(percent),per=perPercent(c,key);if(per===null||!Number.isFinite(target))return null;
 let lo=0,hi=curve(key).at(-1)[0]*per;
 const minimum=toSheetPercent(c,key,lo),maximum=toSheetPercent(c,key,hi);
 if(minimum===null||maximum===null||target<0||target>maximum+1e-9)return null;
 if(target<=minimum+1e-9)return 0;
 for(let i=0;i<55;i++){const mid=(lo+hi)/2;if(toSheetPercent(c,key,mid)<target)lo=mid;else hi=mid;}
 return hi;
}
function ruleText(c,key){const per=perPercent(c,key),points=curve(key);return `${per?.toFixed(2)??'—'} 等级 / 递减前 ${key==='mastery'?'1 精通点':'1%'}；${points.slice(1,-1).map(([x,y])=>`${x}${key==='mastery'?' 点':'%'} 起 ${Math.round((points[points.findIndex(p=>p[0]===x)+1][1]-y)/(points[points.findIndex(p=>p[0]===x)+1][0]-x)*100)}% 效率`).join('，')}${key==='mastery'?`；每精通点对应 ${masteryFactor(c)}% 专精效果`:''}`;}
function ratingBands(kind){const points=curves[kind],bands=[];for(let i=1;i<points.length;i++){const [startX,startY]=points[i-1],[endX,endY]=points[i],penalty=Math.round((1-(endY-startY)/(endX-startX))*100);if(!penalty)continue;if(bands.at(-1)?.penalty===penalty)bands.at(-1).end=endX;else bands.push({start:startX,end:endX,penalty});}return bands;}
const api={keys,toPercent,toSheetPercent,toRating,toSheetRating,perPercent,displayRatio,masteryFactor,ruleText,ratingBands,curves};if(typeof module!=='undefined')module.exports=api;else root.RatingConversion=api;
})(globalThis);
