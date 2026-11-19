// 关卡逻辑校验 v5：与 index.html 相同的连通规则。
// 视错觉相邻随世界视角变化（0°/90°）；升降台为机械结构，不参与视错觉连接。
// 2 号升降台即门前石板：底端嵌入回廊缺口（y=7），顶端与门槛齐平（y=8）。
// 穷举 2 视角 × 4×4 机关 × 2×2 升降台 = 128 组合。

const TILES = [
  [6,0,9,'col'],[5,0,9,'col'],[4,0,9,'col'],[3,0,9,'col'],
  [-1,0,9,'col'],[-2,0,9,'col'],[-2,0,8,'col'],[-2,0,7,'col'],[-2,0,6,'col'],
  [-2,4,4,'col'],[-2,4,3,'col'],[-1,4,3,'col'],[0,4,3,'col'],
  [6,7,3,'slab'],[5,7,3,'slab'],
  [5,7,1,'slab'],[5,7,-1,'slab'],
  [7,8,1,'slab'],[7,8,0,'slab'],
  [4,8,3,'slab'],
];
const ROT = {
  rot1: { pivot:[1,0,9], locals:[[-1,0,0],[0,0,0],[1,0,0]] },
  rot2: { pivot:[3,4,3], locals:[[0,0,0],[1,0,0],[2,0,0]] },
};
const ELEVS = [
  { x:-2, z:5, yLo:0, yHi:4 },
  { x:6,  z:1, yLo:7, yHi:8 },
];
const DOOR = [6,8,0], DOOR_FRONT = [6,8,1];
const START = [6,0,9];
const BASE = -2;
const DVIEW = [[1,1,1],[-1,1,1],[-1,1,-1],[1,1,-1]];
const VIEWS = [0,1];

function rotW(g,l,deg){
  const a=((deg%360)+360)%360;
  const c=[1,0,-1,0][a/90], s=[0,1,0,-1][a/90];
  return [g.pivot[0]+l[0]*c+l[2]*s, g.pivot[1]+l[1], g.pivot[2]-l[0]*s+l[2]*c];
}
function nodesFor(r1,r2,tops){
  const ns = TILES.map(t=>({p:t.slice(0,3), tag:'static'}));
  for(const l of ROT.rot1.locals) ns.push({p:rotW(ROT.rot1,l,r1), tag:'rot1'});
  for(const l of ROT.rot2.locals) ns.push({p:rotW(ROT.rot2,l,r2), tag:'rot2'});
  tops.forEach((top,i)=>{
    const e=ELEVS[i];
    ns.push({p:[e.x, top?e.yHi:e.yLo, e.z], tag:'elev'});
  });
  ns.push({p:DOOR, tag:'door'});
  return ns;
}
function edges(ns, view){
  const real=[], magic=[];
  for(let i=0;i<ns.length;i++) for(let j=i+1;j<ns.length;j++){
    if(ns[i].tag==='door'||ns[j].tag==='door'){
      const other = ns[i].tag==='door' ? ns[j].p : ns[i].p;
      if(other.join()!==DOOR_FRONT.join()) continue;
    }
    const a=ns[i].p, b=ns[j].p;
    const d=[b[0]-a[0],b[1]-a[1],b[2]-a[2]];
    if(d[1]===0 && Math.abs(d[0])+Math.abs(d[2])===1) real.push([i,j]);
    else if(d[1]!==0 && ns[i].tag!=='elev' && ns[j].tag!=='elev'){
      const dv=DVIEW[view], m=d[1];
      const sx=d[0]-m*dv[0], sz=d[2]-m*dv[2];
      if(Math.abs(sx)+Math.abs(sz)===1) magic.push([i,j]);
    }
  }
  return {real, magic};
}
function reach(ns,{real,magic},fromP){
  const adj=ns.map(()=>[]);
  for(const [i,j] of [...real,...magic]){ adj[i].push(j); adj[j].push(i); }
  const s=ns.findIndex(n=>n.p.join()===fromP.join());
  if(s<0) return ()=>false;
  const seen=new Set([s]); const q=[s];
  while(q.length){ const u=q.shift(); for(const v of adj[u]) if(!seen.has(v)){seen.add(v);q.push(v);} }
  return p=>{ const k=ns.findIndex(n=>n.p.join()===p.join()); return k>=0 && seen.has(k); };
}

let fail=0;
const assert=(ok,msg)=>{ console.log((ok?'  ✓ ':'  ✗ ')+msg); if(!ok) fail++; };
const pairKey=(a,b)=>[a.join(),b.join()].sort().join('|');
const COMBOS=[];
for(const a of [false,true]) for(const b of [false,true]) COMBOS.push([a,b]);

// ---- 1. 全状态扫描 ----
console.log('— 全状态扫描（2 视角 × 4×4 机关 × 2×2 升降台 = 128 组合）—');
const WHITELIST = {
  0: new Set([ pairKey([3,4,1],[6,7,3]),      // 旋臂@90° → 中层平台（错觉步，悬空衔接）
               pairKey([5,7,-1],[7,8,0]) ]),  // 回廊暗面 → 上层（塔后接缝，隐藏环路）
  1: new Set([ pairKey([5,7,3],[4,8,3]),      // 中层 → 幻影石（仅 90° 视角）
               pairKey([4,8,3],[5,7,1]) ]),   // 幻影石 → 回廊
};
let overlapBad=0, buriedBad=0, doorBad=0, extra=[];
const seenMagic = {0:new Set(),1:new Set()};
for(const view of VIEWS)
for(const r1 of [0,90,180,270]) for(const r2 of [0,90,180,270])
for(const tops of COMBOS){
  const ns=nodesFor(r1,r2,tops);
  const keys=ns.filter(n=>n.tag!=='door').map(n=>n.p.join());
  if(new Set(keys).size!==keys.length) overlapBad++;
  const solid=new Set();
  for(const t of TILES){
    if(t[3]==='col'){ for(let y=BASE+1;y<=t[1];y++) solid.add([t[0],y,t[2]].join()); }
    else solid.add([t[0],t[1],t[2]].join());
  }
  for(let y=BASE+1;y<=11;y++) solid.add([6,y,0].join());   // 尖塔
  for(const n of ns) if(n.tag!=='static'&&n.tag!=='door') solid.add(n.p.join());
  for(const n of ns){ if(n.tag==='door') continue;
    const [x,y,z]=n.p; if(solid.has([x,y+1,z].join())) buriedBad++; }
  const {real,magic}=edges(ns,view);
  for(const [i,j] of magic){
    const k=pairKey(ns[i].p,ns[j].p);
    seenMagic[view].add(k);
    if(!WHITELIST[view].has(k)) extra.push(`view=${view} r1=${r1} r2=${r2} ${k}`);
  }
  for(const [i,j] of [...real,...magic]){
    if(ns[i].tag==='door'&&ns[j].p.join()!==DOOR_FRONT.join()) doorBad++;
    if(ns[j].tag==='door'&&ns[i].p.join()!==DOOR_FRONT.join()) doorBad++;
  }
}
assert(overlapBad===0, `无方块重叠（违例 ${overlapBad}）`);
assert(buriedBad===0, `无节点被砖体掩埋（违例 ${buriedBad}）`);
assert(doorBad===0, `门只连接门前石板位置（违例 ${doorBad}）`);
assert(extra.length===0, `无白名单之外的魔法边（多余 ${extra.length}）`);
extra.slice(0,12).forEach(e=>console.log('    多余: '+e));
for(const v of VIEWS){
  const missing=[...WHITELIST[v]].filter(k=>!seenMagic[v].has(k));
  assert(missing.length===0, `视角 ${v}：预期魔法边全部出现（缺 ${missing.join(' ; ')||'无'}）`);
}

// ---- 2. 流程校验 ----
console.log('— 流程校验 —');
const E=(v,r1,r2,tops)=>{ const ns=nodesFor(r1,r2,tops); return {ns, e:edges(ns,v)}; };
{ const {ns,e}=E(0,90,0,[0,0]), r=reach(ns,e,START);
  assert(!r([-1,0,9]) && !r(DOOR), '初始：转桥未对齐，西侧与门均不可达'); }
{ const {ns,e}=E(0,0,0,[0,0]), r=reach(ns,e,START);
  assert(r([-2,0,5]), '转桥@0°：可走到 1 号升降台'); }
{ const {ns,e}=E(0,0,0,[1,0]), r=reach(ns,e,[-2,4,5]);
  assert(r([0,4,3]) && !r([3,4,3]), '升至西塔上层；旋臂@0° 无法登臂'); }
{ const {ns,e}=E(0,0,180,[1,0]), r=reach(ns,e,[-2,4,5]);
  assert(r([3,4,3]) && !r([5,7,3]), '旋臂@180°：可登轴心；中层平台仍不可达'); }
{ const {ns,e}=E(0,0,90,[1,0]), r=reach(ns,e,[3,4,3]);
  assert(r([3,4,1]) && r([6,7,3]) && r([5,7,3]), '乘臂转到 90°：错觉步可达中层平台');
  assert(!r([5,7,1]) && !r(DOOR), '默认视角：回廊与门不可达（中层是死路）'); }
{ const {ns,e}=E(1,0,90,[1,0]), r=reach(ns,e,[5,7,3]);
  assert(r([4,8,3]) && r([5,7,1]), '世界→90°：幻影石接通，可进入回廊');
  assert(r([6,7,1]) && !r(DOOR), '可踏上 2 号升降台（底端嵌于回廊缺口）；门仍不可达'); }
{ const {ns,e}=E(0,0,90,[1,1]), r=reach(ns,e,[6,8,1]);
  assert(r(DOOR), '2 号升降台拖到顶：与门槛齐平 → 终点门');
  assert(r([7,8,1]) && r([5,7,-1]), '顶端亦接通回廊上层与塔后暗面（隐藏环路）'); }
// 强不变量：任何固定状态下，从起点都无法直达门
{ let bad=0;
  for(const v of VIEWS) for(const r1 of [0,90,180,270]) for(const r2 of [0,90,180,270])
  for(const tops of COMBOS){
    const {ns,e}=E(v,r1,r2,tops);
    if(reach(ns,e,START)(DOOR)) bad++;
  }
  assert(bad===0, `强不变量：128 种固定状态下起点均无法直达门（违例 ${bad}）`); }
// 防卡死：回廊一侧总能返回（90° 视角幻影石双向通行）
{ const {ns,e}=E(1,0,90,[1,0]), r=reach(ns,e,[5,7,1]);
  assert(r([5,7,3]), '回廊可经幻影石原路返回，不会卡死'); }
// 升降台不参与视错觉：门前石板（2号台）与回廊砖之间不得有魔法边
{ const {ns,e}=E(0,0,90,[1,1]);
  const i=ns.findIndex(n=>n.p.join()==='5,7,1'), j=ns.findIndex(n=>n.p.join()==='6,8,1');
  const linked=e.magic.some(([a,b])=>(a===i&&b===j)||(a===j&&b===i));
  assert(!linked, '回廊砖与 2 号升降台顶部之间无视错觉连接（纯机械衔接）'); }

console.log(fail===0 ? '\n全部通过 ✓' : `\n${fail} 项失败 ✗`);
process.exit(fail?1:0);
