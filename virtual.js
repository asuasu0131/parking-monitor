const container = document.getElementById("parking-lot-container");
const lot = document.getElementById("parking-lot");
const canvas = document.getElementById("path-canvas");
const ctx = canvas.getContext("2d");
const userMarker = document.getElementById("user-marker");

const rowCount = 5;
const colCount = 6;
const colW = 70;
const rowH = 50;
const padRows = 1;
let user = { x:0, y:0 };

// ===== ロッド =====
const rods=[];
for(let r=0;r<rowCount;r++){
  [["A",0],["B",2],["C",3],["D",5]].forEach(([k,c])=>{
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

// ===== ノード =====
const nodeMap = new Map();
function key(r,c){ return `${r},${c}`; }
function getNode(r,c){
  if(!nodeMap.has(key(r,c))){
    nodeMap.set(key(r,c),{row:r,col:c,x:0,y:0,neighbors:[],rod:null,priority:false});
  }
  return nodeMap.get(key(r,c));
}

// 通路ノード作成（ロッドを避ける）
for(let r=0;r<rowCount+padRows*2;r++){
  for(let c=0;c<colCount;c++){
    if(![0,2,3,5].includes(c)){
      const n = getNode(r,c);
      // 外周黄色セルを優先ノードとしてマーク
      if(r===0 || r===rowCount+padRows*2-1 || c===0 || c===colCount-1){
        n.priority = true;
      }
    }
  }
}

// ロッド前ノード
rods.forEach(r=>{
  const nr = r.row+padRows;
  const nc = (r.col<=2)?1:4; // ロッド左 or 右の通路に接続
  const n = getNode(nr,nc);
  n.rod = r;
  r.front = n;
});

// 隣接設定
nodeMap.forEach(n=>{
  [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dr,dc])=>{
    const nb = nodeMap.get(key(n.row+dr,n.col+dc));
    if(nb) n.neighbors.push(nb);
  });
});
const nodes=[...nodeMap.values()];

// ===== 座標設定 =====
function resize(){
  canvas.width=container.clientWidth;
  canvas.height=container.clientHeight;
  const offX = (canvas.width - colCount*colW)/2;
  const offY = (canvas.height - (rowCount+padRows*2)*rowH)/2;

  nodes.forEach(n=>{
    n.x = offX + n.col*colW + colW/2;
    n.y = offY + n.row*rowH + rowH/2;
  });

  rods.forEach(r=>{
    r.cx = offX + r.col*colW + colW/2;
    r.cy = offY + (r.row+padRows)*rowH + rowH/2;
    r.el.style.left = (r.cx-colW/2) + "px";
    r.el.style.top = (r.cy-rowH/2) + "px";
  });

  if(!user.x){
    user.x = canvas.width/2;
    user.y = canvas.height - rowH;
  }
}
resize();
window.addEventListener("resize",resize);

// ===== BFS経路計算 =====
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

// ===== 近接ノード取得（通路ノードのみ） =====
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

// ===== 外周優先経路計算 =====
function calcPathViaPriority(start,goal){
  if(!start || !goal) return [];
  // 優先ノード（黄色セル）を一番近いものを取得
  const priorityNodes = nodes.filter(n=>n.priority);
  if(priorityNodes.length===0) return calcPathBFS(start,goal);

  let nearestPriority = priorityNodes.reduce((a,b)=>
    Math.hypot(a.x-user.x,a.y-user.y) < Math.hypot(b.x-user.x,b.y-user.y) ? a : b
  );

  const path1 = calcPathBFS(start,nearestPriority);
  const path2 = calcPathBFS(nearestPriority,goal);

  return [...path1,...path2.slice(1)]; // 2つ目のpathは重複ノードを削除
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
  userMarker.style.left = (user.x-6) + "px";
  userMarker.style.top = (user.y-6) + "px";
  requestAnimationFrame(loop);
})();