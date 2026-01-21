const container = document.getElementById("parking-lot-container");
const lot = document.getElementById("parking-lot");
const userMarker = document.getElementById("user-marker");
const headingArrow = document.getElementById("heading-arrow");
const canvas = document.getElementById("path-canvas");
const ctx = canvas.getContext("2d");

// ===== 設定 =====
const rowCount = 9;
const colWidth = 70;
const rowHeight = 50;

// 列幅はすべて colWidth
const colX = [0, colWidth, colWidth*2, colWidth*3, colWidth*4, colWidth*5];

// ===== ロッド配置 =====
const rods = [];
for (let r=0; r<rowCount; r++){
  rods.push({id:`A${r+1}`, x: colX[0], y: r*rowHeight, status:0});
  rods.push({id:`B${r+1}`, x: colX[2], y: r*rowHeight, status:0});
  rods.push({id:`C${r+1}`, x: colX[3], y: r*rowHeight, status:0});
  rods.push({id:`D${r+1}`, x: colX[5], y: r*rowHeight, status:0});
}

// ===== 駐車場全体サイズ & 中央オフセット =====
const totalCols = colX.length;
const totalRows = rowCount;
const parkingWidth = colWidth * totalCols;
const parkingHeight = rowHeight * totalRows;
const offsetX = (container.clientWidth - parkingWidth) / 2;
const offsetY = (container.clientHeight - parkingHeight) / 2;

// ===== ユーザー初期位置（入口: 画面下中央） =====
let user = {x: container.clientWidth/2, y: container.clientHeight - 30};

// ===== ロッド描画 =====
function initRods() {
  rods.forEach(r => {
    const d = document.createElement("div");
    d.className = "rod " + (r.status===0 ? "empty" : "full");
    d.style.width = colWidth + "px";
    d.style.height = rowHeight + "px";
    d.style.left = (r.x + offsetX) + "px";
    d.style.top  = (r.y + offsetY) + "px";
    d.innerHTML = r.id;
    lot.appendChild(d);
    r.element = d;

    // クリックで空/満切替
    d.onclick = () => {
      r.status = r.status===0 ? 1 : 0;
      d.className = "rod " + (r.status===0 ? "empty" : "full");
    };
  });
}

// ===== 通路ノード作成 =====
const nodes = [];
for (let row=0; row<rowCount; row++){
  for (let col=0; col<totalCols; col++){
    // 通路部分は列1,3,4,5以外は通路ノード
    if ([1,4].includes(col)) continue; // 1列目+通路+2列目左右+通路+4列目 の通路除外
    nodes.push({
      row, col,
      x: colX[col] + offsetX + colWidth/2,
      y: row*rowHeight + offsetY + rowHeight/2,
      neighbors: []
    });
  }
}
// 隣接ノード設定（上下左右）
nodes.forEach(n => {
  n.neighbors = nodes.filter(o => 
    (Math.abs(o.row - n.row) + Math.abs(o.col - n.col) ===1)
  );
});

// ===== A* アルゴリズム =====
function heuristic(a,b){
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

function astar(start, goal){
  const openSet = [start];
  const cameFrom = new Map();
  const gScore = new Map();
  gScore.set(start,0);
  const fScore = new Map();
  fScore.set(start, heuristic(start, goal));

  while(openSet.length){
    openSet.sort((a,b)=> (fScore.get(a) || 1e6) - (fScore.get(b)||1e6));
    const current = openSet.shift();
    if(current===goal){
      // 経路復元
      const path = [];
      let c = current;
      while(c){
        path.unshift(c);
        c = cameFrom.get(c);
      }
      return path;
    }
    current.neighbors.forEach(n=>{
      const tentative_g = (gScore.get(current)||1e6)+1;
      if(tentative_g < (gScore.get(n)||1e6)){
        cameFrom.set(n,current);
        gScore.set(n,tentative_g);
        fScore.set(n,tentative_g + heuristic(n,goal));
        if(!openSet.includes(n)) openSet.push(n);
      }
    });
  }
  return [];
}

// ===== 最寄り空きロッドのノードを取得 =====
function nearestRodNode() {
  const emptyRods = rods.filter(r=>r.status===0);
  if(emptyRods.length===0) return null;
  let nearest = emptyRods[0];
  let minDist = Math.hypot(user.x - (nearest.x + offsetX), user.y - (nearest.y + offsetY));
  emptyRods.forEach(r=>{
    const dist = Math.hypot(user.x - (r.x + offsetX), user.y - (r.y + offsetY));
    if(dist<minDist){
      nearest = r;
      minDist = dist;
    }
  });
  // 最寄りロッドに近いノードを返す
  const node = nodes.reduce((prev,curr)=>{
    const d = Math.hypot(curr.x - (nearest.x + offsetX + colWidth/2), curr.y - (nearest.y + offsetY + rowHeight/2));
    return d < Math.hypot(prev.x - (nearest.x + offsetX + colWidth/2), prev.y - (nearest.y + offsetY + rowHeight/2)) ? curr : prev;
  }, nodes[0]);
  return node;
}

// ===== 経路描画（青線） =====
let currentPath = [];
function drawPath(path){
  ctx.clearRect(0,0,canvas.width, canvas.height);
  if(path.length<2) return;
  ctx.strokeStyle="blue";
  ctx.lineWidth=4;
  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);
  for(let i=1;i<path.length;i++){
    ctx.lineTo(path[i].x, path[i].y);
  }
  ctx.stroke();
}

// ===== 赤矢印更新 =====
function updateArrow(){
  if(currentPath.length>1){
    const next = currentPath[1]; // 次のノード
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

// ===== キーボード矢印キー =====
window.addEventListener("keydown", e=>{
  switch(e.key){
    case "ArrowUp": moveUp(); break;
    case "ArrowDown": moveDown(); break;
    case "ArrowLeft": moveLeft(); break;
    case "ArrowRight": moveRight(); break;
  }
});

// ===== メインループ =====
initRods();

function mainLoop(){
  const startNode = nodes.reduce((prev,curr)=>{
    return Math.hypot(curr.x - user.x, curr.y - user.y) < Math.hypot(prev.x - user.x, prev.y - user.y) ? curr : prev;
  }, nodes[0]);
  const goalNode = nearestRodNode();
  if(goalNode){
    currentPath = astar(startNode, goalNode);
    drawPath(currentPath);
  }
  updateArrow();
  requestAnimationFrame(mainLoop);
}
canvas.width = container.clientWidth;
canvas.height = container.clientHeight;
mainLoop();