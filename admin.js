const container = document.getElementById("parking-lot-container");
const lot = document.getElementById("parking-lot");
const userMarker = document.getElementById("user-marker");
const headingArrow = document.getElementById("heading-arrow");

let rods = [];
let roads = [];
let nodes = [];
let path = [];
let currentStep = 0;

// ===== 仮ロッド配置（4列×9行） =====
const rowCount = 9;
const colWidth = 70;
const rowHeight = 50;
const colGap = 40; // 通路幅

// 列配置：1列 / 通路 / 2列 / 通路 / 1列
const colX = [0, 0, 70+colGap, 70+colGap+70, 70+colGap+70+70+colGap, 70+colGap+70+70+colGap+70];

for (let r = 0; r < rowCount; r++) {
  rods.push({id:`A${r+1}`, x: colX[0], y: r*rowHeight, status:0});
  rods.push({id:`B${r+1}`, x: colX[2], y: r*rowHeight, status:0});
  rods.push({id:`C${r+1}`, x: colX[3], y: r*rowHeight, status:0});
  rods.push({id:`D${r+1}`, x: colX[5], y: r*rowHeight, status:0});
}

// ===== 通路は左右列の間 =====
roads.push({x: colX[1], y:0, w: colGap, h: rowCount*rowHeight}); // 左通路
roads.push({x: colX[4], y:0, w: colGap, h: rowCount*rowHeight}); // 右通路

// ===== ノード生成 =====
class Node {
  constructor(x,y){
    this.x=x;
    this.y=y;
    this.neighbors=[];
  }
}

function buildGraph() {
  nodes = [];
  const step = 20;
  roads.forEach(r=>{
    for(let i=r.x;i<=r.x+r.w;i+=step){
      for(let j=r.y;j<=r.y+r.h;j+=step){
        nodes.push(new Node(i,j));
      }
    }
  });
  // 隣接
  nodes.forEach(n=>{
    nodes.forEach(m=>{
      if(n===m) return;
      const dx=Math.abs(n.x-m.x);
      const dy=Math.abs(n.y-m.y);
      if((dx===step && dy===0) || (dx===0 && dy===step)){
        n.neighbors.push(m);
      }
    });
  });
}

// ===== A* =====
function astar(start, goals){
  const openSet = [start];
  const cameFrom = new Map();
  const gScore = new Map();
  gScore.set(start,0);
  function h(n){ return Math.min(...goals.map(g=>Math.hypot(n.x-g.x,n.y-g.y))); }
  while(openSet.length){
    openSet.sort((a,b)=>gScore.get(a)+h(a)- (gScore.get(b)+h(b)));
    const current = openSet.shift();
    if(goals.some(g=>g.x===current.x && g.y===current.y)){
      const path=[current];
      let c=current;
      while(cameFrom.has(c)){
        c=cameFrom.get(c);
        path.push(c);
      }
      return path.reverse();
    }
    current.neighbors.forEach(n=>{
      const tentative = gScore.get(current)+Math.hypot(n.x-current.x,n.y-current.y);
      if(tentative< (gScore.get(n)||Infinity)){
        cameFrom.set(n,current);
        gScore.set(n,tentative);
        if(!openSet.includes(n)) openSet.push(n);
      }
    });
  }
  return null;
}

// ===== ユーザー =====
let user = {x: container.clientWidth/2, y: container.clientHeight};

// ===== ロッド描画 =====
function renderRods(){
  document.querySelectorAll(".rod").forEach(e=>e.remove());
  rods.forEach(r=>{
    const d = document.createElement("div");
    d.className="rod "+(r.status===0?"empty":"full");
    d.style.left = r.x + "px";
    d.style.top = r.y + "px";
    d.innerHTML = r.id;
    lot.appendChild(d);
    r.element=d;
    d.onclick=()=>{
      r.status = r.status===0?1:0;
      d.className="rod "+(r.status===0?"empty":"full");
      findPath();
    };
  });
}

// ===== 矢印操作 =====
const moveStep = 5;
window.addEventListener("keydown", e=>{
  switch(e.key){
    case "ArrowUp": user.y-=moveStep; break;
    case "ArrowDown": user.y+=moveStep; break;
    case "ArrowLeft": user.x-=moveStep; break;
    case "ArrowRight": user.x+=moveStep; break;
  }
  findPath();
});

// ===== パス計算 =====
function findPath(){
  buildGraph();
  const start = new Node(user.x,user.y);
  nodes.push(start);
  // 近接ノード接続
  nodes.forEach(n=>{
    if(Math.hypot(n.x-start.x,n.y-start.y)<=20){
      start.neighbors.push(n);
      n.neighbors.push(start);
    }
  });
  const goalNodes = rods.filter(r=>r.status===0).map(r=>new Node(r.x,r.y));
  path = astar(start,goalNodes) || [];
  currentStep=0;
}

// ===== 矢印更新 =====
function updateArrow(){
  if(!path||path.length<2) return;
  const next = path[1];
  const dx = next.x - user.x;
  const dy = next.y - user.y;
  const angle = Math.atan2(dy,dx)*180/Math.PI;
  headingArrow.style.left = user.x+"px";
  headingArrow.style.top = user.y+"px";
  headingArrow.style.transform = `translate(-50%,-100%) rotate(${angle}deg)`;

  userMarker.style.left = user.x+"px";
  userMarker.style.top = user.y+"px";
}

// ===== ループ =====
(function loop(){
  renderRods();
  updateArrow();
  requestAnimationFrame(loop);
})();

// ===== 初期パス =====
findPath();
