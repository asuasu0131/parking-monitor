const container = document.getElementById("parking-lot-container");
const lot = document.getElementById("parking-lot");
const canvas = document.getElementById("path-canvas");
const ctx = canvas.getContext("2d");
const userMarker = document.getElementById("user-marker");

const rowCount = 9;
const colCount = 6;
const colW = 70;
const rowH = 50;
const padRows = 1;

let user = { x:0, y:0 };
let needsUpdate = true;

// ===== ロッド =====
const rods=[];
for(let r=0;r<rowCount;r++){
  [["A",0],["B",2],["C",3],["D",5]].forEach(([k,c])=>{
    rods.push({id:`${k}${r+1}`,row:r,col:c,status:0});
  });
}
rods.forEach(r=>{
  const d=document.createElement("div");
  d.className="rod empty";
  d.style.width=colW+"px";
  d.style.height=rowH+"px";
  d.textContent=r.id;
  d.onclick=()=>{
    r.status^=1;
    d.className="rod "+(r.status?"full":"empty");
    needsUpdate = true; // 状態変化で経路再計算
  };
  lot.appendChild(d);
  r.el=d;
});

// ===== ノード =====
const nodeMap=new Map();
function key(r,c){return `${r},${c}`;}
function getNode(r,c){
  const k=key(r,c);
  if(!nodeMap.has(k)){
    nodeMap.set(k,{row:r,col:c,x:0,y:0,neighbors:[],rod:null});
  }
  return nodeMap.get(k);
}
for(let r=0;r<rowCount+padRows*2;r++){
  for(let c=0;c<colCount;c++){
    if(![0,2,3,5].includes(c)) getNode(r,c);
  }
}
rods.forEach(r=>{
  const nr=r.row+padRows;
  const nc=(r.col<=2)?1:4;
  const n=getNode(nr,nc);
  n.rod=r;
  r.front=n;
});

const entryNodes=[getNode(0,1), getNode(0,4)];

nodeMap.forEach(n=>{
  [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dr,dc])=>{
    const nb=nodeMap.get(key(n.row+dr,n.col+dc));
    if(nb) n.neighbors.push(nb);
  });
});
const nodes=[...nodeMap.values()];

// ===== 座標 =====
function resize(){
  canvas.width=container.clientWidth;
  canvas.height=container.clientHeight;
  const offX=(canvas.width-colCount*colW)/2;
  const offY=(canvas.height-(rowCount+padRows*2)*rowH)/2;

  nodes.forEach(n=>{
    n.x=offX+n.col*colW+colW/2;
    n.y=offY+n.row*rowH+rowH/2;
  });

  rods.forEach(r=>{
    r.cx=offX+r.col*colW+colW/2;
    r.cy=offY+(r.row+padRows)*rowH+rowH/2;
    r.el.style.left=r.cx-colW/2+"px";
    r.el.style.top=r.cy-rowH/2+"px";
  });

  if(!user.x){
    user.x=canvas.width/2;
    user.y=canvas.height-rowH;
  }
}
resize();
window.addEventListener("resize",resize);

// ===== A* =====
function h(a,b){return Math.abs(a.row-b.row)+Math.abs(a.col-b.col);}
function astar(s,g){
  const open=[s],came=new Map(),gScore=new Map([[s,0]]);
  const visited=new Set();
  while(open.length){
    // 軽量化: openから最小コストを線形探索
    let minIdx=0, minScore=gScore.get(open[0])+h(open[0],g);
    for(let i=1;i<open.length;i++){
      const score=gScore.get(open[i])+h(open[i],g);
      if(score<minScore){ minScore=score; minIdx=i; }
    }
    const cur=open.splice(minIdx,1)[0];
    if(cur===g){
      const path=[]; let c=cur;
      while(c){ path.unshift(c); c=came.get(c); }
      return path;
    }
    visited.add(cur);
    for(const n of cur.neighbors){
      if(visited.has(n)) continue;
      const t=(gScore.get(cur)||0)+1;
      if(t<(gScore.get(n)||1e9)){
        came.set(n,cur);
        gScore.set(n,t);
        if(!open.includes(n)) open.push(n);
      }
    }
  }
  return [];
}

// ===== 経路 =====
let path=[];
function updatePath(){
  const s = nearestNode();
  const g = goalNode();
  if(g) path = astar(s,g);
  else path=[];
}

function nearestNode(){
  return nodes.reduce((a,b)=>
    Math.hypot(b.x-user.x,b.y-user.y)<
    Math.hypot(a.x-user.x,a.y-user.y)?b:a);
}
function goalNode(){
  const e=rods.filter(r=>!r.status);
  if(!e.length) return null;
  return e.reduce((a,b)=>
    Math.hypot(b.cx-user.x,b.cy-user.y)<
    Math.hypot(a.cx-user.x,a.cy-user.y)?b:a).front;
}

// ===== 描画 =====
function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(!path.length) return;
  ctx.strokeStyle="blue";
  ctx.lineWidth=4;
  ctx.beginPath();
  ctx.moveTo(user.x,user.y);
  path.forEach(n=>ctx.lineTo(n.x,n.y));
  ctx.stroke();
}

// ===== ユーザー操作 =====
window.addEventListener("keydown",e=>{
  let moved=false;
  if(e.key==="ArrowUp"){ user.y-=5; moved=true; }
  if(e.key==="ArrowDown"){ user.y+=5; moved=true; }
  if(e.key==="ArrowLeft"){ user.x-=5; moved=true; }
  if(e.key==="ArrowRight"){ user.x+=5; moved=true; }
  if(moved) updatePath(); // 移動時だけ再計算
});

// 初期経路計算
updatePath();

// ===== メインループ =====
(function loop(){
  draw();
  userMarker.style.left=(user.x-6)+"px";
  userMarker.style.top=(user.y-6)+"px";
  requestAnimationFrame(loop);
})();