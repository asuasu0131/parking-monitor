const container = document.getElementById("parking-lot-container");
const lot = document.getElementById("parking-lot");
const canvas = document.getElementById("path-canvas");
const ctx = canvas.getContext("2d");
const userMarker = document.getElementById("user-marker");

// ===== 駐車場設定 =====
const rowCount = 7;   // ロッドの行数
const colCount = 8;   // 列数（通路＋ロッド）
const padRows = 1;    // 外周通路
const colW = 70;
const rowH = 50;

let user = { x:0, y:0 };

// ===== ロッド列パターン =====
// 0:通路,1:ロッドA,2:通路,3:ロッドB,4:ロッドC,5:通路,6:ロッドD,7:通路
const rodCols = [1,3,4,6];

// ===== ロッド作成 =====
const rods=[];
for(let r=1;r<=rowCount;r++){
  [["A",rodCols[0]],["B",rodCols[1]],["C",rodCols[2]],["D",rodCols[3]]].forEach(([k,c])=>{
    rods.push({id:`${k}${r}`,row:r,col:c,status:0});
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

// ノードの座標指定（ロッド前と優先ノード）
const nodePositions = [];

// 左ロッド前ノード（列2）
for(let r=1; r<=rowCount; r++) nodePositions.push([r,2]);

// 右ロッド前ノード（列5）
for(let r=1; r<=rowCount; r++) nodePositions.push([r,5]);

// 優先ノード（黄色、8行目）
nodePositions.push([8,2]);
nodePositions.push([8,5]);

// ノード生成と優先設定
nodePositions.forEach(([r,c])=>{
  const n = getNode(r,c);
  // 8行目は優先ノード（黄色）、それ以外は水色
  n.priority = (r === 8);
});

// ===== ロッド前ノード割り当て =====
rods.forEach(r=>{
  let frontNode;
  if(r.col === rodCols[0] || r.col === rodCols[1]){
    frontNode = getNode(r.row, 2); // 左通路
  } else if(r.col === rodCols[2] || r.col === rodCols[3]){
    frontNode = getNode(r.row, 5); // 右通路
  }
  r.front = frontNode;
  frontNode.rod = r;
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
  const totalRows = rowCount + padRows*2 + 1; // 優先ノード行含む
  const offX = (canvas.width - totalCols*colW)/2;
  const offY = (canvas.height - totalRows*rowH)/2;

  nodes.forEach(n=>{
    n.x = offX + (n.col+padRows)*colW + colW/2;
    n.y = offY + (n.row+padRows)*rowH + rowH/2;
  });

  rods.forEach(r=>{
    r.cx = offX + (r.col+padRows)*colW + colW/2;
    r.cy = offY + (r.row+padRows)*rowH + rowH/2;
    r.el.style.left = (r.cx-colW/2) + "px";
    r.el.style.top = (r.cy-rowH/2) + "px";
  });

  // ===== ユーザー初期位置（D7の下あたり） =====
  if(!user.x && !user.y){
    const d7 = rods.find(r=>r.id==="D7");
    if(d7){
      user.x = d7.cx;
      user.y = d7.cy + rowH; // 下に少しずらす
    } else {
      user.x = canvas.width/2;
      user.y = canvas.height - rowH;
    }
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

// ===== 最寄り空きロッド前ノードまたは優先ノード =====
function nearestGoalNode(){
  const emptyRods = rods.filter(r=>!r.status);
  const priorityNodes = nodes.filter(n=>n.priority);

  if(emptyRods.length === 0){
    // 空きロッドがない場合は優先ノードに向かう
    return priorityNodes.reduce((a,b)=>
      Math.hypot(b.x-user.x,b.y-user.y) < Math.hypot(a.x-user.x,a.y-user.y) ? b : a
    );
  }

  // 空きロッドがある場合は最寄り空きロッド前ノードを返す
  let nearestRod = emptyRods.reduce((a,b)=>
    Math.hypot(b.front.x-user.x,b.front.y-user.y) < Math.hypot(a.front.x-user.x,a.front.y-user.y) ? b : a
  );
  return nearestRod.front;
}

// ===== 外周優先経路（優先ノード経由） =====
function calcPathViaPriority(start,goal){
  if(!start || !goal) return [];

  // 優先ノード（黄色）を通すかどうか
  const priorityNodes = nodes.filter(n=>n.priority);
  if(priorityNodes.length === 0) return calcPathBFS(start,goal);

  // 現在位置に最も近い優先ノードを取得
  const nearestPriority = priorityNodes.reduce((a,b)=>
    Math.hypot(a.x-user.x,a.y-user.y) < Math.hypot(b.x-user.x,b.y-user.y) ? a : b
  );

  // 経路計算
  let pathToPriority = calcPathBFS(start, nearestPriority);
  let pathToGoal = calcPathBFS(nearestPriority, goal);

  // 優先ノードが経路にすでに含まれている場合は重複を避ける
  return [...pathToPriority, ...pathToGoal.slice(1)];
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
  if(!g) {
    path = [];
    return;
  }
  // lastGoalによる早期リターンは削除
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