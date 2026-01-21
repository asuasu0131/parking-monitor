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
    rods.push({ id:`A${r+1}`, col:0, row:r, status:0 });
    rods.push({ id:`B${r+1}`, col:2, row:r, status:0 });
    rods.push({ id:`C${r+1}`, col:3, row:r, status:0 });
    rods.push({ id:`D${r+1}`, col:5, row:r, status:0 });
  }

  rods.forEach(r => {
    const d = document.createElement("div");
    d.className = "rod empty";
    d.style.width = colWidth+"px";
    d.style.height = rowHeight+"px";
    d.style.position = "absolute";
    d.style.display = "flex";
    d.style.alignItems = "center";
    d.style.justifyContent = "center";
    d.style.fontSize = "12px";
    d.style.fontWeight = "bold";
    d.style.color = "white";
    d.innerHTML = r.id;

    d.onclick = () => {
      r.status = r.status === 0 ? 1 : 0;
      d.className = "rod " + (r.status === 0 ? "empty" : "full");
    };

    lot.appendChild(d);
    r.element = d;
  });
}

// ===== ノード =====
const nodes = [];
function initNodes() {
  nodes.length = 0;
  const totalRows = rowCount + verticalPaddingRows * 2;

  // 通路ノード
  for (let r = 0; r < totalRows; r++) {
    for (let c = 0; c < colCount; c++) {
      if (![0,2,3,5].includes(c)) {
        nodes.push({ row:r, col:c, x:0, y:0, neighbors:[], targetRod:null });
      }
    }
  }

  // ロッド前ノード（1ロッド=1ノード）
  rods.forEach(r => {
    const nodeCol = (r.col === 0 || r.col === 2) ? 1 : 4;
    const nodeRow = r.row + verticalPaddingRows;

    const n = {
      row: nodeRow,
      col: nodeCol,
      x:0,
      y:0,
      neighbors:[],
      targetRod: r
    };
    nodes.push(n);
    r.frontNode = n;
  });

  // 隣接
  nodes.forEach(n => {
    n.neighbors = nodes.filter(o =>
      Math.abs(o.row-n.row)+Math.abs(o.col-n.col) === 1
    );
  });
}

// ===== 座標 =====
let offsetX=0, offsetY=0;
function resizeCanvas() {
  const rect = container.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;

  const totalRows = rowCount + verticalPaddingRows*2;
  offsetX = (rect.width - colCount*colWidth)/2;
  offsetY = (rect.height - totalRows*rowHeight)/2;

  if (!user.x && !user.y) {
    user.x = rect.width/2;
    user.y = rect.height - rowHeight/2;
  }

  rods.forEach(r => {
    r.canvasX = offsetX + r.col*colWidth + colWidth/2;
    r.canvasY = offsetY + verticalPaddingRows*rowHeight + r.row*rowHeight + rowHeight/2;
    r.element.style.left = (r.canvasX-colWidth/2)+"px";
    r.element.style.top  = (r.canvasY-rowHeight/2)+"px";
  });

  nodes.forEach(n => {
    n.x = offsetX + n.col*colWidth + colWidth/2;
    n.y = offsetY + n.row*rowHeight + rowHeight/2;
  });
}

// ===== A* =====
function heuristic(a,b){ return Math.abs(a.row-b.row)+Math.abs(a.col-b.col); }
function astar(start,goal){
  const open=[start], came=new Map(), g=new Map(), f=new Map();
  g.set(start,0); f.set(start,heuristic(start,goal));

  while(open.length){
    open.sort((a,b)=>(f.get(a)||1e9)-(f.get(b)||1e9));
    const cur=open.shift();
    if(cur===goal){
      const path=[];
      let c=cur;
      while(c){ path.unshift(c); c=came.get(c); }
      return path;
    }
    cur.neighbors.forEach(n=>{
      const t=(g.get(cur)||1e9)+1;
      if(t<(g.get(n)||1e9)){
        came.set(n,cur);
        g.set(n,t);
        f.set(n,t+heuristic(n,goal));
        if(!open.includes(n)) open.push(n);
      }
    });
  }
  return [];
}

// ===== ゴール =====
function nearestRodNode(){
  const empties = rods.filter(r=>r.status===0);
  if(!empties.length) return null;

  let best=empties[0];
  let dmin=Math.hypot(user.x-best.canvasX,user.y-best.canvasY);
  empties.forEach(r=>{
    const d=Math.hypot(user.x-r.canvasX,user.y-r.canvasY);
    if(d<dmin){ best=r; dmin=d; }
  });
  return best.frontNode;
}

// ===== 描画 =====
let currentPath=[];
function drawPath(path){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(!path.length) return;
  ctx.strokeStyle="blue";
  ctx.lineWidth=4;
  ctx.beginPath();
  ctx.moveTo(user.x,user.y);
  path.forEach(n=>ctx.lineTo(n.x,n.y));
  ctx.stroke();
}

// ===== 矢印 =====
function updateArrow(){
  if(currentPath.length){
    const n=currentPath[0];
    const a=Math.atan2(n.y-user.y,n.x-user.x)*180/Math.PI;
    headingArrow.style.left=user.x+"px";
    headingArrow.style.top=user.y+"px";
    headingArrow.style.transform=`translate(-50%,-100%) rotate(${a}deg)`;
  }
  userMarker.style.left=user.x+"px";
  userMarker.style.top=user.y+"px";
}

// ===== 操作 =====
const mv={ArrowUp:()=>user.y-=moveStep,ArrowDown:()=>user.y+=moveStep,
          ArrowLeft:()=>user.x-=moveStep,ArrowRight:()=>user.x+=moveStep};
Object.keys(mv).forEach(k=>{
  document.getElementById(k.replace("Arrow","").toLowerCase()).onclick=mv[k];
});
window.addEventListener("keydown",e=>mv[e.key]?.());

// ===== ループ =====
function loop(){
  const start=nodes.reduce((p,c)=>
    Math.hypot(c.x-user.x,c.y-user.y)<Math.hypot(p.x-user.x,p.y-user.y)?c:p,nodes[0]);
  const goal=nearestRodNode();
  if(goal) currentPath=astar(start,goal);
  drawPath(currentPath);
  updateArrow();
  requestAnimationFrame(loop);
}

// ===== 初期化 =====
initRods();
initNodes();
resizeCanvas();
loop();
window.addEventListener("resize",resizeCanvas);