const container = document.getElementById("parking-lot-container");
const lot = document.getElementById("parking-lot");
const canvas = document.getElementById("path-canvas");
const ctx = canvas.getContext("2d");
const userMarker = document.getElementById("user-marker");

// ===== 設定 =====
const rowCount = 7;
const colCount = 8;
const padRows = 1;
const colW = 70;
const rowH = 50;

let user = { x:0, y:0 };
const rodCols = [1,3,4,6];

// ===== ロッド =====
const rods=[];
for(let r=1;r<=rowCount;r++){
  [["A",1],["B",3],["C",4],["D",6]].forEach(([k,c])=>{
    rods.push({id:`${k}${r}`,row:r,col:c,status:0});
  });
}

rods.forEach(r=>{
  const d=document.createElement("div");
  d.className="rod empty";
  d.textContent=r.id;
  d.onclick=()=>{
    r.status^=1;
    d.className="rod "+(r.status?"full":"empty");
    recalcPath();
  };
  lot.appendChild(d);
  r.el=d;
});

// ===== ノード =====
const nodeMap=new Map();
const key=(r,c)=>`${r},${c}`;
const getNode=(r,c)=>{
  if(!nodeMap.has(key(r,c))){
    nodeMap.set(key(r,c),{row:r,col:c,x:0,y:0,neighbors:[],priority:false});
  }
  return nodeMap.get(key(r,c));
};

// 通路ノード
for(let r=1;r<=7;r++){ getNode(r,2); getNode(r,5); }
getNode(8,2).priority=true;
getNode(8,5).priority=true;

// ロッド前
rods.forEach(r=>{
  r.front = (r.col<=3)?getNode(r.row,2):getNode(r.row,5);
});

// 隣接
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
  const offX=(canvas.width-(colCount+2)*colW)/2;
  const offY=(canvas.height-(rowCount+3)*rowH)/2;

  nodes.forEach(n=>{
    n.x=offX+(n.col+1)*colW+colW/2;
    n.y=offY+(n.row+1)*rowH+rowH/2;
  });

  rods.forEach(r=>{
    r.cx=offX+(r.col+1)*colW+colW/2;
    r.cy=offY+(r.row+1)*rowH+rowH/2;
    r.el.style.left=(r.cx-colW/2)+"px";
    r.el.style.top =(r.cy-rowH/2)+"px";
  });

  if(!user.x&&!user.y){
    const d7=rods.find(r=>r.id==="D7");
    user.x=d7.cx; user.y=d7.cy+rowH;
  }
}
resize();
window.addEventListener("resize",resize);

// ===== BFS =====
const bfs=(s,g)=>{
  const q=[s],came=new Map([[s,null]]);
  while(q.length){
    const c=q.shift(); if(c===g) break;
    c.neighbors.forEach(n=>!came.has(n)&&(came.set(n,c),q.push(n)));
  }
  const p=[]; let cur=g;
  while(cur){ p.unshift(cur); cur=came.get(cur); }
  return p;
};

const nearestNode=()=>nodes.reduce((a,b)=>
  Math.hypot(b.x-user.x,b.y-user.y)<Math.hypot(a.x-user.x,a.y-user.y)?b:a);

// ===== ポリシー =====
let selectionPolicy="nearest";
const entrance={x:rods[0].cx,y:rods[0].cy-rowH};

// ===== 経路 =====
function calcPath(){
  const s=nearestNode();
  const left=rods.filter(r=>!r.status&&r.col<=3);
  const right=rods.filter(r=>!r.status&&r.col>=4);

  const center=(getNode(1,2).x+getNode(1,5).x)/2;
  let targets=(user.x>center)?right:left;
  if(!targets.length) targets=(targets===left)?right:left;
  if(!targets.length) return [];

  const best=targets.reduce((a,b)=>{
    const ref=selectionPolicy==="nearest"?user:entrance;
    return Math.hypot(b.front.x-ref.x,b.front.y-ref.y)<
           Math.hypot(a.front.x-ref.x,a.front.y-ref.y)?b:a;
  });

  const pri=nodes.find(n=>n.priority&&n.col===best.front.col);
  return [...bfs(s,pri),...bfs(pri,best.front).slice(1)];
}

// ===== 描画 =====
function draw(p){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(p.length){
    ctx.strokeStyle="blue"; ctx.lineWidth=4;
    ctx.beginPath(); ctx.moveTo(user.x,user.y);
    p.forEach(n=>ctx.lineTo(n.x,n.y)); ctx.stroke();
  }
}

// ===== 操作 =====
window.addEventListener("keydown",e=>{
  if(e.key==="ArrowUp")user.y-=5;
  if(e.key==="ArrowDown")user.y+=5;
  if(e.key==="ArrowLeft")user.x-=5;
  if(e.key==="ArrowRight")user.x+=5;
});

document.getElementById("policyBtn").onclick=()=>{
  selectionPolicy=selectionPolicy==="nearest"?"entrance":"nearest";
  document.getElementById("policyBtn").textContent=
    "案内方式："+selectionPolicy;
};

(function loop(){
  draw(calcPath());
  userMarker.style.left=(user.x-6)+"px";
  userMarker.style.top =(user.y-6)+"px";
  requestAnimationFrame(loop);
})();