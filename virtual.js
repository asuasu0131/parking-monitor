const container = document.getElementById("parking-lot-container");
const lot = document.getElementById("parking-lot");
const canvas = document.getElementById("path-canvas");
const ctx = canvas.getContext("2d");
const userMarker = document.getElementById("user-marker");

// ===== 駐車場設定 =====
const rowCount = 8;   // 行数
const colCount = 8;   // 列数（通路+ロッド込み）
const padRows = 1;    // 外周通路
const colW = 70;
const rowH = 50;

let user = { x:0, y:0 };

// ===== ロッド列パターン =====
// 左から: 通路-ロッド-通路-ロッド-ロッド-通路-ロッド-通路
const rodCols = [1,3,4,6];

// ===== ロッド作成 =====
const rods=[];
for(let r=0;r<rowCount;r++){
  [["A",rodCols[0]],["B",rodCols[1]],["C",rodCols[2]],["D",rodCols[3]]].forEach(([k,c])=>{
    rods.push({id:`${k}${r+1}`,row:r,col:c,status:0});
  });
}

// ロッドDOM作成
rods.forEach(r=>{
  const d=document.createElement("div");
  d.className="rod empty";
  d.style.width=colW+"px";
  d.style.height=rowH+"px";
  d.textContent=r.id;
  d.onclick=()=>{
    r.status^=1;
    d.className="rod "+(r.status?"full":"empty");
    recalcPath();
  };
  lot.appendChild(d);
  r.el=d;
});

// ===== ノード作成（特定位置のみ） =====
const nodeMap = new Map();
function key(r,c){ return `${r},${c}`; }
function getNode(r,c){
  if(!nodeMap.has(key(r,c))){
    nodeMap.set(key(r,c),{row:r,col:c,x:0,y:0,neighbors:[],rod:null,priority:false});
  }
  return nodeMap.get(key(r,c));
}

const nodePositions = [
  [8,2],[8,5],                       // 優先ノード（黄色）
  [1,2],[2,2],[3,2],[4,2],[5,2],[6,2],[7,2],  // 左ロッド前ノード（水色）
  [1,5],[2,5],[3,5],[4,5],[5,5],[6,5],[7,5],  // 右ロッド前ノード（水色）
];

nodePositions.forEach(([r,c])=>{
  const n = getNode(r,c);
  // 外周の場合は優先ノードにする
  if(r===8){
    n.priority = true;  // 黄色
  } else {
    n.priority = false; // 水色
  }
});

// ===== ロッド前ノードを割り当て =====
rods.forEach(r=>{
  // 左ロッドは左通路のノード、右ロッドは右通路のノード
  const nr = r.row;
  let nc;
  if(r.col === rodCols[0] || r.col === rodCols[1]){
    nc = r.col; // ノード列を左に合わせる
  } else if(r.col === rodCols[2] || r.col === rodCols[3]){
    nc = r.col; // ノード列を右に合わせる
  }
  const n = getNode(nr+1,nc); // ノード行番号を+1してロッド前
  n.rod = r;
  r.front = n;
});

// ===== 隣接ノード設定 =====
nodeMap.forEach(n=>{
  [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dr,dc])=>{
    const nb = nodeMap.get(key(n.row+dr,n.col+dc));
    if(nb) n.neighbors.push(nb);
  });
});
const nodes = [...nodeMap.values()];

// ===== ノード可視化キャンバス =====
const nodeCanvas = document.createElement("canvas");
nodeCanvas.style.position = "absolute";
nodeCanvas.style.inset = "0";
nodeCanvas.style.pointerEvents = "none";
nodeCanvas.style.zIndex = "20";
container.appendChild(nodeCanvas);
const nodeCtx = nodeCanvas.getContext("2d");

function drawNodes(){
  nodeCtx.clearRect(0,0,nodeCanvas.width,nodeCanvas.height);
  nodes.forEach(n=>{
    nodeCtx.beginPath();
    nodeCtx.arc(n.x,n.y,5,0,Math.PI*2);
    nodeCtx.fillStyle = n.priority ? "yellow" : "cyan";
    nodeCtx.fill();
    nodeCtx.fillStyle = "black";
    nodeCtx.font = "10px sans-serif";
    nodeCtx.textAlign = "center";
    nodeCtx.textBaseline = "middle";
    nodeCtx.fillText(`${n.row},${n.col}`, n.x, n.y - 10);
  });
}

// ===== 座標設定 =====
function resize(){
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  nodeCanvas.width = canvas.width;
  nodeCanvas.height = canvas.height;

  const totalCols = colCount + padRows*2;
  const totalRows = rowCount + padRows*2;
  const offX = (canvas.width - totalCols*colW)/2;
  const offY = (canvas.height - totalRows*rowH)/2;

  nodes.forEach(n=>{
    n.x = offX + n.col*colW + colW/2;
    n.y = offY + n.row*rowH + rowH/2;
  });

  rods.forEach(r=>{
    r.cx = offX + r.col*colW + colW/2;
    r.cy = offY + r.row*rowH + rowH/2;
    r.el.style.left = (r.cx-colW/2) + "px";
    r.el.style.top = (r.cy-rowH/2) + "px";
  });

  if(!user.x){
    user.x = canvas.width/2;
    user.y = canvas.height - rowH;
  }

  drawNodes();
}
resize();
window.addEventListener("resize",resize);

// ===== BFS 経路計算 =====
function calcPathBFS(start,goal){
  if(!start || !goal) return [];
  const queue = [start];
  const came = new Map([[start,null]]);
  while(queue.length){
    const cur = queue.shift();
    if(cur===goal) break;
    for(const n of cur.neighbors){
      if(!came.has(n)){
        came.set(n,cur);
        queue.push(n);
      }
    }
  }
  const path=[];
  let cur = goal;
  while(cur){
    path.unshift(cur);
    cur = came.get(cur);
  }
  return path;
}

// ===== 近接ノード取得 =====
function nearestNode(){
  return nodes.reduce((a,b)=>
    Math.hypot(b.x-user.x,b.y-user.y) < Math.hypot(a.x-user.x,a.y-user.y) ? b : a
  );
}

// ===== 最寄り空きロッド前ノード =====
function nearestGoalNode(){
  const emptyRods = rods.filter(r=>!r.status);
  if(emptyRods.length===0) return null;
  let nearestRod = emptyRods.reduce((a,b)=>
    Math.hypot(b.front.x-user.x,b.front.y-user.y) < Math.hypot(a.front.x-user.x,a.front.y-user.y) ? b : a
  );
  return nearestRod.front;
}

// ===== 外周優先経路 =====
function calcPathViaPriority(start,goal){
  if(!start || !goal) return [];
  const priorityNodes = nodes.filter(n=>n.priority);
  if(priorityNodes.length===0) return calcPathBFS(start,goal);
  let nearestPriority = priorityNodes.reduce((a,b)=>
    Math.hypot(a.x-user.x,a.y-user.y) < Math.hypot(b.x-user.x,b.y-user.y) ? a : b
  );
  const path1 = calcPathBFS(start,nearestPriority);
  const path2 = calcPathBFS(nearestPriority,goal);
  return [...path1,...path2.slice(1)];
}

// ===== 描画 =====
function draw(p){
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // ロッド描画
  rods.forEach(r=>{
    ctx.fillStyle = r.status ? "#f44336" : "#4caf50";
    ctx.fillRect(r.cx-colW/2, r.cy-rowH/2, colW, rowH);
    ctx.strokeStyle="#000";
    ctx.strokeRect(r.cx-colW/2, r.cy-rowH/2, colW, rowH);
    ctx.fillStyle="#fff";
    ctx.font="bold 12px sans-serif";
    ctx.textAlign="center";
    ctx.textBaseline="middle";
    ctx.fillText(r.id,r.cx,r.cy);
  });

  // 経路描画
  if(p && p.length){
    ctx.strokeStyle="blue";
    ctx.lineWidth=4;
    ctx.beginPath();
    ctx.moveTo(user.x,user.y);
    p.forEach(n=>ctx.lineTo(n.x,n.y));
    ctx.stroke();
  }
}

// ===== ユーザー操作 =====
const moveStep = 5;
window.addEventListener("keydown",e=>{
  if(e.key==="ArrowUp") user.y-=moveStep;
  if(e.key==="ArrowDown") user.y+=moveStep;
  if(e.key==="ArrowLeft") user.x-=moveStep;
  if(e.key==="ArrowRight") user.x+=moveStep;
  recalcPath();
});

// ===== 経路再計算 =====
let path=[];
let lastGoal = null;
function recalcPath(){
  const s = nearestNode();
  const g = nearestGoalNode();
  if(!g || g===lastGoal) return;
  lastGoal = g;
  path = calcPathViaPriority(s,g);
}
setInterval(recalcPath,300);

// ===== メインループ =====
(function loop(){
  draw(path);
  drawNodes();
  userMarker.style.left = (user.x-6) + "px";
  userMarker.style.top = (user.y-6) + "px";
  requestAnimationFrame(loop);
})();