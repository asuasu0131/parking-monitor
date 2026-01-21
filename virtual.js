const container = document.getElementById("parking-lot-container");
const lot = document.getElementById("parking-lot");
const canvas = document.getElementById("path-canvas");
const ctx = canvas.getContext("2d");
const userMarker = document.getElementById("user-marker");
const headingArrow = document.getElementById("heading-arrow");

// ===== 設定 =====
const rowCount = 9;       
const colCount = 6;       
const colWidth = 70;
const rowHeight = 50;
const verticalPaddingRows = 1;
const moveStep = 5;

// ===== ユーザー =====
let user = { x: 0, y: 0 };

// ===== ロッド =====
const rods = [];
function initRods() {
  for (let r = 0; r < rowCount; r++) {
    rods.push({ id: `A${r+1}`, col: 0, row: r, status: 0 });
    rods.push({ id: `B${r+1}`, col: 2, row: r, status: 0 });
    rods.push({ id: `C${r+1}`, col: 3, row: r, status: 0 });
    rods.push({ id: `D${r+1}`, col: 5, row: r, status: 0 });
  }
  rods.forEach(r => {
    const d = document.createElement("div");
    d.className = "rod empty";
    d.style.width = colWidth + "px";
    d.style.height = rowHeight + "px";
    d.style.position = "absolute";
    d.style.display = "flex";
    d.style.alignItems = "center";
    d.style.justifyContent = "center";
    d.style.fontSize = "12px";
    d.style.fontWeight = "bold";
    d.style.color = "white";
    d.innerHTML = r.id;
    lot.appendChild(d);
    r.element = d;

    d.onclick = () => {
      r.status = r.status === 0 ? 1 : 0;
    };
  });
}

// ===== 通路ノード =====
const nodes = [];
function initNodes() {
  nodes.length = 0;
  const totalRows = rowCount + verticalPaddingRows*2;
  for(let r=0; r<totalRows; r++){
    for(let c=0; c<colCount; c++){
      // ロッド列以外は通路
      if([0,2,3,5].includes(c) && r>=verticalPaddingRows && r<verticalPaddingRows+rowCount) continue;
      nodes.push({ row: r, col: c, x:0, y:0, neighbors: [] });
    }
  }
  nodes.forEach(n=>{
    n.neighbors = nodes.filter(o => Math.abs(o.row-n.row)+Math.abs(o.col-n.col)===1);
  });
}

// ===== Canvasと座標 =====
let offsetX=0, offsetY=0;
function resizeCanvas(){
  const rect = container.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;

  const totalRows = rowCount + verticalPaddingRows*2;
  const totalHeight = totalRows * rowHeight;
  const totalWidth = colCount * colWidth;
  offsetX = (rect.width - totalWidth)/2;
  offsetY = (rect.height - totalHeight)/2;

  if(!user.x && !user.y){
    user.x = rect.width/2;
    user.y = rect.height - rowHeight/2;
  }

  // ロッド位置
  rods.forEach(r=>{
    r.canvasX = offsetX + r.col*colWidth + colWidth/2;
    r.canvasY = offsetY + verticalPaddingRows*rowHeight + r.row*rowHeight + rowHeight/2;
    r.element.style.left = (r.canvasX - colWidth/2)+"px";
    r.element.style.top = (r.canvasY - rowHeight/2)+"px";
  });

  // ノード位置
  nodes.forEach(n=>{
    n.x = offsetX + n.col*colWidth + colWidth/2;
    n.y = offsetY + n.row*rowHeight + rowHeight/2;
  });
}

// ===== A* =====
function heuristic(a,b){ return Math.abs(a.row-b.row)+Math.abs(a.col-b.col); }
function astar(start,goal){
  const openSet=[start], came=new Map(), g=new Map(), f=new Map();
  g.set(start,0); f.set(start,heuristic(start,goal));
  while(openSet.length){
    openSet.sort((a,b)=>(f.get(a)||1e6)-(f.get(b)||1e6));
    const current=openSet.shift();
    if(current===goal){
      const path=[];
      let c=current;
      while(c){ path.unshift(c); c=came.get(c); }
      return path;
    }
    current.neighbors.forEach(n=>{
      const tentative = (g.get(current)||1e6)+1;
      if(tentative < (g.get(n)||1e6)){
        came.set(n,current);
        g.set(n,tentative);
        f.set(n,tentative+heuristic(n,goal));
        if(!openSet.includes(n)) openSet.push(n);
      }
    });
  }
  return [];
}

// ===== 最寄り空きロッドの前ノード =====
function nearestRodNode(){
  const emptyRods = rods.filter(r=>r.status===0);
  if(!emptyRods.length) return null;

  let nearest = emptyRods[0];
  let minDist = Math.hypot(user.x - nearest.canvasX, user.y - nearest.canvasY);
  emptyRods.forEach(r=>{
    const d = Math.hypot(user.x - r.canvasX, user.y - r.canvasY);
    if(d<minDist){ nearest=r; minDist=d; }
  });

  // ロッドの手前に最も近い通路ノード
  let goalNode = null;
  let minNodeDist = 1e6;
  nodes.forEach(n=>{
    const dist = Math.hypot(n.x - nearest.canvasX, n.y - nearest.canvasY);
    if(dist<minNodeDist){ goalNode=n; minNodeDist=dist; }
  });
  return goalNode;
}

// ===== 経路描画 =====
let currentPath=[];
function drawPath(path){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(!path.length) return;
  ctx.strokeStyle="blue";
  ctx.lineWidth=4;
  ctx.beginPath();
  ctx.moveTo(user.x,user.y);
  path.forEach(n=>ctx.lineTo(n.x,n.y));
  // 最後にロッド前まで直線追加
  const goalRod = nearestRodNode();
  if(goalRod){
    const rod = rods.find(r=>Math.hypot(r.canvasX-goalRod.x,r.canvasY-goalRod.y)<100);
    if(rod) ctx.lineTo(rod.canvasX,rod.canvasY);
  }
  ctx.stroke();
}

// ===== 赤矢印 =====
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
function moveUp(){ user.y-=moveStep; }
function moveDown(){ user.y+=moveStep; }
function moveLeft(){ user.x-=moveStep; }
function moveRight(){ user.x+=moveStep; }
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
  const startNode=nodes.reduce((prev,curr)=>
    Math.hypot(curr.x-user.x,curr.y-user.y)<Math.hypot(prev.x-user.x,prev.y-user.y)?curr:prev
  ,nodes[0]);
  const goalNode = nearestRodNode();
  if(goalNode) currentPath=astar(startNode,goalNode);

  drawPath(currentPath);
  updateArrow();
  requestAnimationFrame(mainLoop);
}

// ===== 初期化 =====
initRods();
initNodes();
resizeCanvas();
mainLoop();
window.addEventListener("resize", resizeCanvas);