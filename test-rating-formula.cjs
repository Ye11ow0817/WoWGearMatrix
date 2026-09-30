const assert=require('node:assert/strict');
const M=require('./model.js'),S=require('./search.js'),R=require('./rating.js');
const c=M.newCharacter();
c.attributeContext.level=90;
const stats={armor:100,stamina:200,main:300,crit:800,haste:1000,mastery:40,versatility:0,avoidance:0,leech:0,speed:0};
const expression='(暴击x0.8+急速x0.5)/2+力量x2';
const rule=S.validateRules([{type:'formula',expression,direction:'desc'}])[0];
assert.equal(S.ruleValue(rule,stats),(800*.8+1000*.5)/2+300*2);
for(const expression of ['暴击−精通','暴击-精通','暴击＋精通']){
 const parsed=S.validateRules([{type:'formula',expression,direction:'desc'}])[0];
 assert.equal(S.ruleValue(parsed,stats),expression.includes('＋')?840:760);
}
assert.equal(S.ruleValue(S.validateRules([{type:'formula',expression:'暴击/(急速-1000)',direction:'asc'}])[0],stats),null);
for(const expression of ['（暴击*0.8+急速*0.5）/2+力量*2','（暴击*0.8+(急速*0.5)）/2+力量*2']){
 const parsed=S.validateRules([{type:'formula',expression,direction:'desc'}])[0];
 assert.equal(S.ruleValue(parsed,stats),1170);
}
for(const bad of ['（暴击','暴击）','暴击/（）','暴击+','暴击+process.exit(1)','(暴击','1+2','暴击/()'])assert.throws(()=>S.parseFormula(bad));
for(const key of R.keys){const sample=key==='speed'?150:1000;const pct=R.toPercent(c,key,sample);assert(Number.isFinite(pct));assert(Math.abs(R.toPercent(c,key,R.toRating(c,key,pct))-pct)<1e-9);assert.equal(R.toRating(c,key,0),0);}
assert.equal(R.toPercent(c,'crit',46*40),39); // 30% at full value, then 90% efficiency.
assert.equal(R.toPercent(c,'leech',R.perPercent(c,'leech')*15),14);
const fire=M.newCharacter();M.selectProfile(fire,{class:'mage',spec:'fire',race:'human'});
assert.notEqual(R.toPercent(c,'mastery',1000),R.toPercent(fire,'mastery',1000));
const elemental=M.newCharacter();M.selectProfile(elemental,{class:'shaman',spec:'elemental',race:'human'});
assert.equal(R.masteryFactor(elemental),1.875);
elemental.baseStats={armor:0,stamina:0,main:0,crit:0,haste:0,mastery:0,versatility:0,avoidance:0,leech:0,speed:0};
elemental.basePercents={crit:5,haste:3,mastery:20.625,versatility:0,avoidance:0,leech:0,speed:0};
assert.equal(R.toSheetPercent(elemental,'crit',938).toFixed(2),'25.39');
assert.equal(R.toSheetPercent(elemental,'haste',745).toFixed(2),'20.44');
assert.equal(R.toSheetPercent(elemental,'mastery',1033).toFixed(2),'62.73');
assert.equal(R.toSheetPercent(elemental,'versatility',116).toFixed(2),'2.15');
for(const key of R.keys){const rating=key==='speed'?100:1800;const pct=R.toSheetPercent(elemental,key,rating);assert(Math.abs(R.toSheetRating(elemental,key,pct)-rating)<1e-7,key);}
assert.equal(R.toSheetRating(elemental,'crit',4),0);
assert.equal(R.toSheetRating(elemental,'haste',2),0);
assert.equal(R.toSheetRating(elemental,'crit',-1),null);
assert.equal(R.toSheetRating(elemental,'haste',3),0);
elemental.basePercents.leech=2;
assert.equal(R.toSheetPercent(elemental,'leech',0),2);
assert.equal(R.toSheetPercent(elemental,'avoidance',100),R.toPercent(elemental,'avoidance',100));
assert(Math.abs(R.toSheetPercent(elemental,'speed',100)-R.toPercent(elemental,'speed',100)*Math.exp(-.03)*.1)<1e-10);
elemental.baseStats.crit=100;
assert.equal(R.toSheetPercent(elemental,'crit',100),5);
assert.equal(R.toSheetPercent(elemental,'crit',938),5+R.toPercent(elemental,'crit',938)-R.toPercent(elemental,'crit',100));
const report=M.parseReport('Character: Example | shaman/elemental | level=90\nData: 12.1.0.69814\nContext: race=human | talents=\ncharacter_stats: crit_rating=0, haste_rating=0, mastery_rating=0, versatility_rating=0\ncharacter_percent: crit=5, haste=3, mastery=20.625, versatility=0, avoidance=0, leech=0, speed=0\n');
assert.deepEqual(report.basePercents,{crit:5,haste:3,mastery:20.625,versatility:0,avoidance:0,leech:0,speed:0});
assert.equal(R.toSheetPercent(M.newCharacter(),'crit',938),null);
assert.equal(Number((R.perPercent(elemental,'mastery')/R.masteryFactor(elemental)).toFixed(2)),24.53);
assert.equal(R.toRating(c,'crit',127),null);
assert.deepEqual(R.ratingBands('secondary').map(b=>b.penalty),[10,20,30,40,50]);
assert.deepEqual(R.ratingBands('secondary').map(b=>[b.start*R.perPercent(c,'haste'),b.end*R.perPercent(c,'haste')]),[[1320,1760],[1760,2200],[2200,2640],[2640,3520],[3520,8800]]);
assert.deepEqual(R.ratingBands('tertiary').map(b=>b.penalty),[20,40,60]);
c.ratingOverrides={haste:25,mastery:10};
assert.equal(R.displayRatio(c,'haste'),25);
assert.equal(R.perPercent(c,'haste'),25);
assert.equal(R.toPercent(c,'haste',750),30);
assert.equal(R.toRating(c,'haste',30),750);
assert.equal(R.displayRatio(c,'mastery'),10);
assert.equal(R.perPercent(c,'mastery'),10*R.masteryFactor(c));
assert.equal(R.toPercent(c,'mastery',30*R.perPercent(c,'mastery')),30*R.masteryFactor(c));
M.validateState({version:2,activeId:c.id,characters:[c]});
assert.throws(()=>M.validateState({version:2,activeId:c.id,characters:[{...c,ratingOverrides:{haste:0}}]}));
console.log('PASS: expression precedence, invalid formulas, SimC rating curves and reversible percent inputs.');
