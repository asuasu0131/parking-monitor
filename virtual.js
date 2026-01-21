const container = document.getElementById("parking-lot-container");
const lot = document.getElementById("parking-lot");
const userMarker = document.getElementById("user-marker");
const headingArrow = document.getElementById("heading-arrow");
const canvas = document.getElementById("path-canvas");
const ctx = canvas.getContext("2d");

// ===== 設定 =====
const rowCount = 9;
const colCount = 6;  // 列幅すべて同じ
const colWidth = 70;
const rowHeight = 50;

// ===== ロッド配置 =====
const rods = [];
for (let r = 0; r < rowCount; r++){
  rods.push({id:`A${r+1}`, x:0, y:r*rowHeight, status:0});
  rods.push({id:`B${r+1}`, x:colWidth*2, y:r*rowHeight, status:0});
  rods.push({id:`C${r+1}`, x:colWidth*3, y:r*rowHeight, status:0});
  rods.push({id:`D${r+1}`, x:colWidth*5, y:r*rowHeight, status:0});
}

// ===== ユーザー初期位置（入口: 下中央） =====
let user = {x:0, y:0};

// ===== Canvas を div と同期 =====
function resizeCanvas(){
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  user.x = canvas.width / 2;
  user.y = canvas.height - 30;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// ===== ロッド描画 =====
function initRods() {
  const offsetX = (canvas.width - colWidth*colCount)/2;
  const offsetY = (canvas.height - rowHeight*rowCount)/2;
  rods.forEach(r=>{
    const d = document.createElement("div");
    d.className = "rod "+(r.status===0?"empty":"full");
    d.style.width = colWidth + "px";
    d.style.height = rowHeight + "px";
    d.style.left = (r.x + offsetX) + "px";
    d.style.top  = (r.y + offsetY) + "px";
    d.innerHTML = r.id;
    lot.appendChild(d);
    r.element = d;
    r.canvasX = r.x + offsetX + colWidth/2;
    r.canvasY = r.y + offsetY + rowHeight/2;

    d.onclick = ()=>{
      r.status = r.status===0 ? 1 : 0;
      d.className = "rod "+(r.status===0?"empty":"full");
    };
  });
}
initRods();

// ===== 通路ノード作成 =====
const nodes = [];
const offsetX = (canvas.width - colWidth*colCount)/2;
const offsetY = (canvas.height - rowHeight*rowCount)/2;
for(let r=0;r<rowCount;r++){
  for(let c=0;c<colCount;c++){
    // 通路は列1,4除外
    if([1,4].includes(c)) continue;
    nodes.push({row:r, col:c, x:c*colWidth + offsetX + colWidth/2, y:r*rowHeight + offsetY + rowHeight/2, neighbors:[]});
  }
}
// 隣接ノード設定
nodes.forEach(n=>{
  n.neighbors = nodes.filter(o => Math.abs(o.row - n.row)+Math.abs(o.col - n.col)===1);
});

// ===== A* アルゴリズム =====
function heuristic(a,b){ return Math.abs(a.row-b.row)+Math.abs(a.col-b.col); }
function astar(start, goal){
  const openSet = [start], cameFrom = new Map(), gScore=new Map(), fScore=new Map();
  gScore.set(start,0); fScore.set(start,heuristic(start,goal));
  while(openSet.length){
    openSet.sort((a,b)=> (fScore.get(a)||1e6)-(fScore.get(b)||1e6));
    const current = openSet.shift();
    if(current===goal){
      const path=[]; let c=current;
      while(c){ path.unshift(c); c=cameFrom.get(c); }
      return path;
    }
    current.neighbors.forEach(n=>{
      const tentative = (gScore.get(current)||1e6)+1;
      if(tentative < (gScore.get(n)||1e6)){
        cameFrom.set(n,current);
        gScore.set(n,tentative);
        fScore.set(n,tentative+heuristic(n,goal));
        if(!openSet.includes(n)) openSet.push(n);
      }
    });
  }
  return [];
}

// ===== 最寄り空きロッドノード =====
function nearestRodNode(){
  const emptyRods = rods.filter(r=>r.status===0);
  if(emptyRods.length===0) return null;
  let nearest = emptyRods[0];
  let minDist = Math.hypot(user.x-nearest.canvasX,user.y-nearest.canvasY);
  emptyRods.forEach(r=>{
    const d = Math.hypot(user.x - r.canvasX, user.y - r.canvasY);
    if(d<minDist){ nearest=r; minDist=d; }
  });
  const node = nodes.reduce((prev,curr)=>{
    return Math.hypot(curr.x - nearest.canvasX, curr.y - nearest.canvasY) < Math.hypot(prev.x - nearest.canvasX, prev.y - nearest.canvasY) ? curr : prev;
  }, nodes[0]);
  return node;
}

// ===== 経路描画 =====
let currentPath = [];
function drawPath(path){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(path.length<2) return;
  ctx.strokeStyle="blue";
  ctx.lineWidth=4;
  ctx.beginPath();
  ctx.moveTo(user.x, user.y);
  path.forEach(n=> ctx.lineTo(n.x, n.y));
  ctx.stroke();
}

// ===== 赤矢印更新 =====
function updateArrow(){
  if(currentPath.length>0){
    const next = currentPath[0];
    const dx = next.x - user.x;
    const dy = next.y - user.y;
    const angle = Math.atan2(dy,dx)*180/Math.PI;
    headingArrow.style.left = user.x + "px";
    headingArrow.style.top  = user.y + "px";
    headingArrow.style.transform = `translate(-50%,-100%) rotate(${angle}deg)`;
  }
  userMarker.style.left = user.x + "px";
  userMarker.style.top  = user.y + "px";
}

// ===== 移動 =====
const moveStep = 5;
function moveUp(){ user.y -= moveStep; }
function moveDown(){ user.y += moveStep; }
function moveLeft(){ user.x -= moveStep; }
function moveRight(){ user.x += moveStep; }

// ===== ボタンイベント =====
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
  const startNode = nodes.reduce((prev,curr)=> Math.hypot(curr.x-user.x,curr.y-user.y) < Math.hypot(prev.x-user.x,prev.y-user.y) ? curr : prev , nodes[0]);
  const goalNode = nearestRodNode();
  if(goalNode) currentPath = astar(startNode,goalNode);
  drawPath(currentPath);
  updateArrow();
  requestAnimationFrame(mainLoop);
}
mainLoop();