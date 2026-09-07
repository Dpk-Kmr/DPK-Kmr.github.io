const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const catalog=require('../src/data/games.js');
const curriculum=require('../src/data/game-curriculum.js');
const engine=require('../src/scripts/game-engine.js');
const ai=require('../src/scripts/game-ai.js');
const game=id=>curriculum.games[id];
const level=(id,n)=>game(id).levels[n];
const round=(id,n,k=0)=>level(id,n).rounds[k];
const all=Object.values(curriculum.games).flatMap(g=>g.levels.flatMap(l=>l.rounds));
const near=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<.011,`${label}: ${actual} vs ${expected}`);
const ops=(node,name)=>{if(!node||typeof node!=='object')return 0;return Number(node.op===name)+Object.values(node).reduce((n,v)=>n+(Array.isArray(v)?v.reduce((a,b)=>a+ops(b,name),0):ops(v,name)),0)};
const rows=r=>r.model.rows||r.model.leftRows||[];
const outputCount=r=>Object.keys(r.model.outputs||{}).length;
const owns=(r,name)=>Object.hasOwn(r.model.data||{},name);

test('every baseline game has three named levels and three fresh rounds per level',()=>{
  assert.deepEqual(curriculum.levels.map(l=>[l.id,l.name,l.multiplier]),[['foundation','Foundation',1],['applied','Applied',2],['expert','Expert',3]]);
  assert.equal(Object.keys(curriculum.games).length,50);
  assert.deepEqual(new Set(Object.keys(curriculum.games)),new Set(catalog.games.map(g=>g.id)));
  assert.equal(all.length,450);
  assert.equal(new Set(all.map(r=>r.id)).size,450);
  const baselineIds=new Set(catalog.games.flatMap(g=>g.rounds.map(r=>r.id)));
  assert.ok(all.every(r=>!baselineIds.has(r.id)));
  for(const [id,g] of Object.entries(curriculum.games)){
    assert.ok(g.objective.length>35,id);
    assert.ok(g.rules.length>=3&&g.rules.length<=5,id);
    assert.ok(g.rules.every(r=>typeof r==='string'&&r.length>20));
    assert.ok(g.prerequisites.length>=1&&g.prerequisites.length<=4);
    assert.deepEqual(g.levels.map(l=>l.id),['foundation','applied','expert']);
    for(const l of g.levels){assert.equal(l.rounds.length,3);assert.ok(l.title&&l.description.length>=15);}
    assert.equal(new Set(g.levels.map(l=>l.description)).size,3);
  }
});

test('UMD curriculum loads with the browser catalog and no runtime dependency',()=>{
  const context=vm.createContext({Math,Array,Object,Map,Set,Boolean,String,Number});
  vm.runInContext(fs.readFileSync(require.resolve('../src/data/games.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(require.resolve('../src/data/game-curriculum.js'),'utf8'),context);
  assert.equal(Object.keys(context.ATRIKSHA_CURRICULUM.games).length,50);
  assert.equal(context.ATRIKSHA_CURRICULUM.levels[2].multiplier,3);
});

test('all450 problems validate and independently solved answers earn full credit',()=>{
  for(const r of all){
    const valid=engine.validateRound(r);
    assert.equal(valid.valid,true,`${r.id}: ${valid.errors}`);
    assert.ok(r.solver&&r.model,r.id);
    const snapshot=JSON.stringify(r);
    const protectedRound={...r};
    for(const key of ['answer','targets','pairs','answers'])Object.defineProperty(protectedRound,key,{get(){throw Error(`Solver accessed grading key ${key}`)}});
    const solved=ai.solve(protectedRound),result=engine.evaluateRound(r,solved.response);
    assert.equal(result.score,200,`${r.id}: ${JSON.stringify(solved.response)}`);
    assert.equal(result.correct,true,r.id);
    assert.equal(result.complete,true,r.id);
    assert.equal(JSON.stringify(r),snapshot,`${r.id}: solver mutated source`);
  }
});

test('models contain original problem fields rather than serialized grading keys',()=>{
  function inspect(value,location){
    if(!value||typeof value!=='object')return;
    for(const [key,item] of Object.entries(value)){
      assert.ok(!['answer','answers','targets','pairs','expectedResponse','correctResponse'].includes(key),`${location}.${key}`);
      inspect(item,`${location}.${key}`);
    }
  }
  all.forEach(r=>inspect(r.model,r.id));
});

test('sliders start unsolved, have attainable targets and never overflow their bounds',()=>{
  for(const r of all.filter(r=>r.type==='tune')){
    assert.ok(r.controls.some(c=>Math.abs(c.initial-r.targets[c.id])>.001),r.id);
    for(const c of r.controls){
      assert.ok(Number.isFinite(r.targets[c.id]));
      assert.ok(r.targets[c.id]>=c.min&&r.targets[c.id]<=c.max,r.id);
      assert.ok(c.initial>=c.min&&c.initial<=c.max,r.id);
      const steps=(r.targets[c.id]-c.min)/c.step;
      assert.ok(Math.abs(steps-Math.round(steps))<1e-7,r.id);
    }
  }
  for(const r of all.filter(r=>r.type==='sort'))assert.notDeepEqual(r.items.map(i=>i.id),r.answer,r.id);
});

// Explicit curriculum audits: each check names the NEW reasoning required by the expert level.
const progressions={
  'mean-mixer':(f,a,e)=>outputCount(f)===1&&owns(a,'known')&&owns(e,'n1')&&owns(e,'n2')&&e.model.data.n1!==e.model.data.n2,
  'median-shield':(f,a,e)=>outputCount(a)===2&&ops(e.model,'slice')>0&&ops(e.model,'sort')>0,
  'spread-lab':(f,a,e)=>Object.hasOwn(a.model.outputs,'sd')&&owns(e,'v1')&&owns(e,'v2')&&owns(e,'n2'),
  'feature-scaler':(f,a,e)=>owns(a,'sd')&&outputCount(e)===3&&ops(e.model,'min')>0&&ops(e.model,'max')>0,
  'chart-chooser':(f,a,e)=>rows(f).length===3&&rows(a).length===4&&rows(e).length===6,
  'data-detective':(f,a,e)=>rows(f).length===3&&rows(a).length===5&&rows(e).length===8,
  'sampling-scout':(f,a,e)=>f.type==='classify'&&outputCount(a)===2&&outputCount(e)===3&&owns(e,'r'),
  'outlier-radar':(f,a,e)=>ops(f.model,'if')===0&&ops(a.model,'abs')>0&&ops(e.model,'if')>0&&ops(e.model,'and')>0,
  'missing-pieces':(f,a,e)=>f.type==='grid'&&a.type==='tune'&&ops(e.model,'count')===2&&ops(e.model,'if')===2,
  'correlation-compass':(f,a,e)=>f.buckets.length===3&&e.buckets.length===4&&rows(e).some(r=>r.randomized),
  'threshold-tuner':(f,a,e)=>f.type==='tune'&&a.type==='sort'&&e.type==='grid'&&ops(e.model,'div')===2&&ops(e.model,'and')>0,
  'gradient-step':(f,a,e)=>ops(a.model,'sub')>ops(f.model,'sub')&&owns(e,'mu')&&owns(e,'lambda')&&outputCount(e)===2,
  'pipeline-pilot':(f,a,e)=>rows(f).length===5&&rows(a).length===7&&rows(e).length===9,
  'metric-match':(f,a,e)=>rows(f).length===3&&rows(a).some(r=>r.metric==='specificity')&&rows(e).some(r=>r.metric==='f1')&&rows(e).some(r=>r.metric==='balanced'),
  'model-mission':(f,a,e)=>rows(f).length===3&&rows(a).length===4&&rows(e).some(r=>r.goal==='actions'),
  'leakage-guard':(f,a,e)=>rows(f).length===3&&rows(a).length===5&&rows(e).length===8,
  'learning-modes':(f,a,e)=>f.buckets.length===3&&a.buckets.length===5&&rows(e).some(r=>r.reward&&r.labels)&&ops(e.model,'and')>0,
  'confusion-matrix':(f,a,e)=>/prediction/.test(f.cells[0].value)&&/score/.test(a.cells[0].value)&&ops(e.model,'if')===2,
  'cluster-pilot':(f,a,e)=>rows(f)[0].sy===1&&rows(a)[0].ay===10&&rows(e)[0].sx===2&&rows(e)[0].sy===5,
  'overfit-detective':(f,a,e)=>f.type==='grid'&&a.type==='grid'&&e.type==='sort'&&ops(e.model,'if')>0,
  'signal-sampler':(f,a,e)=>outputCount(a)===2&&e.type==='grid'&&ops(e.model,'and')>0&&rows(e).every(r=>r.channels===4),
  'sensor-calibration':(f,a,e)=>outputCount(f)===1&&outputCount(a)===2&&outputCount(e)===3&&e.model.data.x.length===3,
  'message-journey':(f,a,e)=>f.solver==='toposort'&&a.solver==='sort'&&rows(a).every(r=>r.offset===0)&&rows(e).some(r=>r.offset<0),
  'protocol-match':(f,a,e)=>f.type==='match'&&a.type==='classify'&&ops(e.model,'gte')>0&&rows(e).some(r=>r.dedup&&r.ttl<r.delay),
  'plc-logic':(f,a,e)=>rows(a).every(r=>'enabled'in r)&&ops(e.model,'or')>0&&rows(e).some(r=>r.reset&&r.previous),
  'packet-parity':(f,a,e)=>ops(f.model,'bitcount')>0&&ops(a.model,'add')>0&&ops(e.model,'and')>0&&ops(e.model,'gt')>0,
  'sampling-windows':(f,a,e)=>rows(f).every(r=>r.offset===0)&&ops(a.model,'lte')>0&&rows(e).some(r=>r.offset!==0),
  'packet-router':(f,a,e)=>f.required.length===0&&a.required.length===1&&e.required.length===2,
  'sensor-relay':(f,a,e)=>f.required.length===0&&a.required.length===1&&e.required.length===2,
  'sensor-units':(f,a,e)=>owns(f,'ms')&&owns(a,'channels')&&owns(e,'code')&&outputCount(e)===2,
  'tolerance-fit':(f,a,e)=>outputCount(f)===1&&outputCount(a)===2&&owns(e,'dt')&&outputCount(e)===3,
  'oee-workshop':(f,a,e)=>owns(f,'a')&&owns(a,'downtime')&&e.model.data.breaks===30&&outputCount(e)===4,
  'lean-line':(f,a,e)=>ops(f.model,'div')===0&&ops(a.model,'div')===1&&ops(e.model,'mul')>0,
  'print-sequence':(f,a,e)=>rows(f).length===5&&rows(a).length===8&&e.solver==='sort'&&ops(e.model,'ceil')>0,
  'process-picker':(f,a,e)=>rows(f).length===3&&rows(a).length===5&&e.type==='grid'&&ops(e.model,'and')>0&&rows(e).some(r=>!r.feature),
  'defect-detective':(f,a,e)=>a.model.rules.some(r=>r.bucket==='crack')&&e.buckets.some(b=>b.id==='review')&&ops(e.model,'add')>0,
  'stock-sort':(f,a,e)=>ops(f.model,'sub')===0&&ops(a.model,'sub')>0&&ops(e.model,'ceil')>0,
  'quality-gate':(f,a,e)=>ops(a.model,'gte')===2&&rows(e).every(r=>'n'in r&&'bad'in r)&&ops(e.model,'div')>0,
  'workshop-route':(f,a,e)=>f.required.length===0&&a.required.length===1&&e.required.length===2,
  'inspection-route':(f,a,e)=>f.required.length===0&&a.required.length===1&&e.required.length===2,
  'bayes-booth':(f,a,e)=>owns(f,'tp')&&owns(a,'prior')&&outputCount(e)===2&&ops(e.model,'pow')>0,
  'mixture-balance':(f,a,e)=>f.type==='tune'&&a.type==='grid'&&owns(e,'loss')&&outputCount(e)===2,
  'operation-order':(f,a,e)=>ops(f.model,'ceil')===0&&ops(a.model,'pow')>0&&ops(e.model,'ceil')>0&&ops(e.model,'abs')>0,
  'critical-path':(f,a,e)=>rows(f).length===3&&rows(a).length===5&&rows(e).length===7&&ops(e.model,'max')>ops(a.model,'max'),
  'function-family':(f,a,e)=>rows(f).length===3&&rows(a).length===4&&rows(e).some(r=>r.form==='piecewise')&&ops(e.model,'abs')>0,
  'constraint-keeper':(f,a,e)=>ops(f.model,'floor')===0&&ops(a.model,'mul')>0&&ops(e.model,'floor')===2&&ops(e.model,'or')>0,
  'knapsack-grid':(f,a,e)=>rows(f).length===3&&rows(a).length===4&&rows(e).length===6&&e.model.maxItems===3&&e.model.incompatible.length===1,
  'probability-deck':(f,a,e)=>outputCount(f)===1&&outputCount(a)===2&&outputCount(e)===2&&ops(e.model,'sub')>ops(a.model,'sub'),
  'vector-voyager':(f,a,e)=>ops(f.model,'pow')===0&&ops(a.model,'sqrt')>0&&outputCount(e)===3&&ops(e.model,'div')>0,
  'optimization-sense':(f,a,e)=>f.type==='grid'&&a.type==='sort'&&ops(e.model,'and')>0&&ops(e.model,'mul')>=3,
};
test('all50 expert progressions add the independently specified reasoning requirement',()=>{
  assert.equal(Object.keys(progressions).length,50);
  for(const [id,check]of Object.entries(progressions))assert.ok(check(round(id,0),round(id,1),round(id,2)),`${id}: required progression missing`);
});

test('weighted means, robust centers and pooled variance match independent calculations',()=>{
  for(let k=0;k<3;k++){
    let r=round('mean-mixer',2,k),d=r.model.data;near(r.targets.pooled,(d.n1*d.m1+d.n2*d.m2)/(d.n1+d.n2),r.id);
    r=round('median-shield',2,k);const v=[...r.model.data.values].sort((a,b)=>a-b),trim=v.slice(1,-1);near(r.targets.trimmed,trim.reduce((a,b)=>a+b,0)/trim.length,r.id);near(r.targets.median,(v[3]+v[4])/2,r.id);
    r=round('spread-lab',2,k);d=r.model.data;const m=(d.n1*d.m1+d.n2*d.m2)/(d.n1+d.n2),variance=(d.n1*(d.v1+(d.m1-m)**2)+d.n2*(d.v2+(d.m2-m)**2))/(d.n1+d.n2);near(r.targets.mean,m,r.id);near(r.targets.variance,variance,r.id);
  }
});

test('regularized momentum, noisy calibration and posterior updates compute from raw observations',()=>{
  for(let k=0;k<3;k++){
    let r=round('gradient-step',2,k),d=r.model.data,w=d.w0,v=0;for(let i=0;i<2;i++){v=d.mu*v+2*(w-d.target)+2*d.lambda*w;w-=d.rate*v;}near(r.targets.weight,w,r.id);near(r.targets.velocity,v,r.id);
    r=round('sensor-calibration',2,k);d=r.model.data;const xm=d.x.reduce((a,b)=>a+b,0)/3,ym=d.y.reduce((a,b)=>a+b,0)/3,m=d.x.reduce((s,x,i)=>s+(x-xm)*(d.y[i]-ym),0)/d.x.reduce((s,x)=>s+(x-xm)**2,0),b=ym-m*xm;near(r.targets.slope,m,r.id);near(r.targets.offset,b,r.id);near(r.targets.prediction,m*25+b,r.id);
    r=round('bayes-booth',2,k);d=r.model.data;const trueBoth=d.prior*d.sens*d.sens,falseBoth=(1-d.prior)*d.fpr*d.fpr;near(r.targets.two,100*trueBoth/(trueBoth+falseBoth),r.id);assert.ok(r.targets.two>r.targets.one);
  }
});

test('manufacturing expert answers use dimensional bounds, OEE time accounting and pack rounding',()=>{
  for(let k=0;k<3;k++){
    let r=round('tolerance-fit',2,k),d=r.model.data,cold=(d.h-.1)-(d.s+.05),hot=(d.h-.1)*(1+12e-6*d.dt)-(d.s+.05)*(1+23e-6*d.dt);near(r.targets.cold,cold,r.id);near(r.targets.hot,hot,r.id);near(r.targets.worst,Math.min(cold,hot),r.id);
    r=round('oee-workshop',2,k);d=r.model.data;const planned=d.scheduled-d.breaks,run=planned-d.downtime;near(r.targets.availability,100*run/planned,r.id);near(r.targets.performance,100*d.cycle*d.count/run,r.id);near(r.targets.quality,100*d.good/d.count,r.id);near(r.targets.oee,100*d.cycle*d.good/planned,r.id);
    r=round('stock-sort',2,k);d=r.model.data;const position=d.hand+d.order-d.back,need=Math.max(0,d.daily*d.lead+d.safety-position);near(r.targets.position,position,r.id);near(r.targets.order,Math.ceil(need/d.pack)*d.pack,r.id);
  }
});

test('expert routes satisfy every waypoint and use the same editable source graph as the scored board',()=>{
  for(const id of ['packet-router','sensor-relay','workshop-route','inspection-route'])for(const r of level(id,2).rounds){
    assert.equal(r.required.length,2);
    for(const key of ['nodes','edges','start','end','blocked','required'])assert.deepEqual(r.model[key],r[key]);
    const path=engine.shortestPath(r);
    assert.ok(r.required.every(id=>path.includes(id)),r.id);
    assert.ok(path.every(id=>!r.blocked.includes(id)),r.id);
    assert.equal(path[0],r.start);assert.equal(path.at(-1),r.end);
  }
});

test('expert knapsack answers are globally optimal under BOTH added constraints and tie rules',()=>{
  for(const r of level('knapsack-grid',2).rounds){
    const {rows,capacity,maxItems,incompatible}=r.model,candidates=[];
    for(let mask=0;mask<2**rows.length;mask++){
      const chosen=rows.filter((_,i)=>mask&(1<<i)),ids=chosen.map(r=>r.id).sort(),weight=chosen.reduce((s,r)=>s+r.weight,0),value=chosen.reduce((s,r)=>s+r.value,0);
      if(ids.length>maxItems||weight>capacity||incompatible.some(pair=>pair.every(id=>ids.includes(id))))continue;
      candidates.push({ids,weight,value});
    }
    candidates.sort((a,b)=>b.value-a.value||a.weight-b.weight||a.ids.join(',').localeCompare(b.ids.join(',')));
    assert.ok(candidates[0].ids.length>0);assert.deepEqual([...r.answer].sort(),candidates[0].ids,r.id);
  }
});

test('lexicographic optimization ranking honors real priorities independently of numeric encoding',()=>{
  for(const r of level('optimization-sense',2).rounds){
    const feasible=x=>x.output>=10&&x.time<=7;
    const expected=[...r.model.rows].sort((a,b)=>Number(feasible(b))-Number(feasible(a))||a.cost-b.cost||a.emissions-b.emissions||a.time-b.time).map(r=>r.id);
    assert.deepEqual(r.answer,expected,r.id);
  }
});

test('zero-MAD fallback and calibration clipping handle edge cases explicitly',()=>{
  const r=round('outlier-radar',2,2);assert.ok(r.model.rows.every(row=>row.mad===0));
  const expected=r.model.rows.filter(row=>row.n>=10&&row.x!==row.median).map(row=>row.id);assert.deepEqual(new Set(r.answer),new Set(expected));
  const low=round('feature-scaler',2,0),high=round('feature-scaler',2,1);
  assert.ok(low.targets.unclipped<0);assert.equal(low.targets.clipped,0);
  assert.ok(high.targets.unclipped>1);assert.equal(high.targets.clipped,1);
});
