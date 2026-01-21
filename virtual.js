const container = document.getElementById("parking-lot-container");
const lot = document.getElementById("parking-lot");
const canvas = document.getElementById("path-canvas");
const ctx = canvas.getContext("2d");

const userMarker = document.getElementById("user-marker");
const headingArrow = document.getElementById("heading-arrow");

const rowCount = 9;
const colCount = 6;
const colWidth = 70;
const rowHeight = 50;
let offsetX = 0, offsetY = 0;
const moveStep = 5;

let user = { x: 0, y: 0 };

const rods = [];
function initRods() {
  for (let r = 0; r < rowCount; r++) {
    rods.push({ id: `A${r + 1}`, col: 0, row: r, status: 0 });
    rods.push({ id: `B${r + 1}`, col: 2, row: r, status: 0 });
    rods.push({ id: `C${r + 1}`, col: 3, row: r, status: 0 });
    rods.push({ id: `D${r + 1}`, col: 5, row: r, status: 0 });
  }
  rods.forEach(r => {
    const d = document.createElement("div");
    d.className = "rod empty";
    d.style.width = colWidth + "px";
    d.style.height = rowHeight + "px";
    d.style.position = "absolute";
    lot.appendChild(d);
    r.element = d;
    d.onclick = () => {
      r.status = r.status === 0 ? 1 : 0;
      d.className = r.status === 0 ? "rod empty" : "rod full";
      currentPath = [];
    };
  });
}

// ===== Canvas + nodes の座標更新 =====
let nodes = [];
function resizeCanvas() {
  const rect = container.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  offsetX = (rect.width - colWidth * colCount) / 2;
  offsetY = (rect.height - rowHeight * rowCount) / 2;

  // ユーザー初期位置
  if (!user.x && !user.y) {
    user.x = rect.width / 2;
    user.y = rect.height - 30;
  }

  // ロッド位置更新
  rods.forEach(r => {
    r.canvasX = offsetX + r.col * colWidth + colWidth / 2;
    r.canvasY = offsetY + r.row * rowHeight + rowHeight / 2;
    r.element.style.left = (r.canvasX - colWidth / 2) + "px";
    r.element.style.top = (r.canvasY - rowHeight / 2) + "px";
    r.element.innerText = r.id;
  });

  // 通路ノード生成（ロッド列を避ける）
  nodes = [];
  for (let r = 0; r < rowCount; r++) {
    for (let c = 0; c < colCount; c++) {
      if ([0, 2, 3, 5].includes(c)) continue; // ロッド列は避ける
      nodes.push({
        row: r,
        col: c,
        x: offsetX + c * colWidth + colWidth / 2,
        y: offsetY + r * rowHeight + rowHeight / 2,
        neighbors: []
      });
    }
  }
  nodes.forEach(n => {
    n.neighbors = nodes.filter(o => Math.abs(o.row - n.row) + Math.abs(o.col - n.col) === 1);
  });
}
window.addEventListener("resize", resizeCanvas);

// ===== A* =====
function heuristic(a, b) { return Math.abs(a.row - b.row) + Math.abs(a.col - b.col); }
function astar(start, goal) {
  const openSet = [start], came = new Map(), g = new Map(), f = new Map();
  g.set(start, 0); f.set(start, heuristic(start, goal));
  while (openSet.length) {
    openSet.sort((a, b) => (f.get(a)||1e6) - (f.get(b)||1e6));
    const current = openSet.shift();
    if (current === goal) {
      const path = [];
      let c = current;
      while(c) { path.unshift(c); c = came.get(c); }
      return path;
    }
    current.neighbors.forEach(n => {
      const tentative = (g.get(current)||1e6) + 1;
      if(tentative < (g.get(n)||1e6)) {
        came.set(n,current);
        g.set(n,tentative);
        f.set(n,tentative+heuristic(n,goal));
        if(!openSet.includes(n)) openSet.push(n);
      }
    });
  }
  return [];
}

// ===== 最寄り空きロッド =====
function nearestRodNode() {
  const emptyRods = rods.filter(r=>r.status===0);
  if(!emptyRods.length) return null;
  let nearest = emptyRods[0], minDist = Math.hypot(user.x - nearest.canvasX, user.y - nearest.canvasY);
  emptyRods.forEach(r=>{
    const d = Math.hypot(user.x - r.canvasX, user.y - r.canvasY);
    if(d<minDist){ nearest=r; minDist=d; }
  });
  const goalNode = nodes.reduce((prev,curr)=>
    Math.hypot(curr.x-nearest.canvasX, curr.y-nearest.canvasY) <
    Math.hypot(prev.x-nearest.canvasX, prev.y-nearest.canvasY)?curr:prev
  ,nodes[0]);
  return goalNode;
}

// ===== 描画 =====
let currentPath = [];
function drawPath(path){
  if(!path.length) return;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle="blue";
  ctx.lineWidth=4;
  ctx.beginPath();
  ctx.moveTo(user.x,user.y);
  path.forEach(n=>ctx.lineTo(n.x,n.y));
  ctx.stroke();
}

function updateArrow(){
  if(currentPath.length>0){
    const next=currentPath[0];
    const dx=next.x-user.x;
    const dy=next.y-user.y;
    const angle=Math.atan2(dy,dx)*180/Math.PI;
    headingArrow.style.left=user.x+"px";
    headingArrow.style.top=user.y+"px";
    headingArrow.style.transform=`translate(-50%,-100%) rotate(${angle}deg)`;
  }
  userMarker.style.left=user.x+"px";
  userMarker.style.top=user.y+"px";
}

// ===== 移動 =====
function moveUp(){ user.y-=moveStep; currentPath=[]; }
function moveDown(){ user.y+=moveStep; currentPath=[]; }
function moveLeft(){ user.x-=moveStep; currentPath=[]; }
function moveRight(){ user.x+=moveStep; currentPath=[]; }

document.getElementById("up").onclick=moveUp;
document.getElementById("down").onclick=moveDown;
document.getElementById("left").onclick=moveLeft;
document.getElementById("right").onclick=moveRight;
window.addEventListener("keydown",e=>{
  switch(e.key){
    case "ArrowUp": moveUp(); break;
    case "ArrowDown": moveDown(); break;
    case "ArrowLeft": moveLeft(); break;
    case "ArrowRight": moveRight(); break;
  }
});

// ===== メインループ =====
function mainLoop(){
  const startNode=nodes.reduce((prev,curr)=>Math.hypot(curr.x-user.x,curr.y-user.y)<Math.hypot(prev.x-user.x,prev.y-user.y)?curr:prev,nodes[0]);
  const goalNode=nearestRodNode();
  if(goalNode) currentPath=astar(startNode,goalNode);

  drawPath(currentPath);
  updateArrow();
  requestAnimationFrame(mainLoop);
}

// ===== 初期化 =====
initRods();
resizeCanvas();
mainLoop();