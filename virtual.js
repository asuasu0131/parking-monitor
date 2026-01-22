const container = document.getElementById("parking-lot-container");
const lot = document.getElementById("parking-lot");
const canvas = document.getElementById("path-canvas");
const ctx = canvas.getContext("2d");
const userMarker = document.getElementById("user-marker");

// ===== 駐車場設定 =====
const rowCount = 7;
const colCount = 8;
const padRows = 1;
const colW = 70;
const rowH = 50;

let user = { x:0, y:0 };

// ===== ロッド列 =====
const rodCols = [1,3,4,6];

// ===== センサ対応ロッド =====
const sensorRodMap = {
  sensor1: "A1",
  sensor2: "D7"
};

// ===== ロッド作成 =====
const rods=[];
for(let r=1;r<=rowCount;r++){
  [["A",rodCols[0]],["B",rodCols[1]],["C",rodCols[2]],["D",rodCols[3]]].forEach(([k,c])=>{
    rods.push({id:`${k}${r}`,row:r,col:c,status:0});
  });
}

// ===== ロッドDOM =====
rods.forEach(r=>{
  const d=document.createElement("div");
  d.className="rod empty";
  d.style.width=colW+"px";
  d.style.height=rowH+"px";
  d.textContent=r.id;

  // センサ対象ロッドはクリック禁止
  if(!Object.values(sensorRodMap).includes(r.id)){
    d.onclick=()=>{
      r.status^=1;
      d.className="rod "+(r.status?"full":"empty");
      recalcPath();
    };
  } else {
    d.style.opacity = 0.8;
  }

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

// ===== ノード配置（固定・変更禁止） =====
const nodePositions = [];
for(let r=1; r<=rowCount; r++) nodePositions.push([r,2]);
for(let r=1; r<=rowCount; r++) nodePositions.push([r,5]);
nodePositions.push([8,2],[8,5]);

nodePositions.forEach(([r,c])=>{
  const n = getNode(r,c);
  n.priority = (r===8);
});

// ===== ロッド前ノード =====
rods.forEach(r=>{
  let frontNode = null;
  if(r.col <= 3) frontNode = getNode(r.row,2);
  else frontNode = getNode(r.row,5);
  r.front = frontNode;
  frontNode.rod = r;
});

// ===== 隣接 =====
nodeMap.forEach(n=>{
  [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dr,dc])=>{
    const nb = nodeMap.get(key(n.row+dr,n.col+dc));
    if(nb) n.neighbors.push(nb);
  });
});
const nodes = [...nodeMap.values()];

// ===== 座標 =====
function resize(){
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;

  const offX = (canvas.width - colCount*colW)/2;
  const offY = (canvas.height - (rowCount+2)*rowH)/2;

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

  if(!user.x && !user.y){
    const d7 = rods.find(r=>r.id==="D7");
    user.x = d7.cx;
    user.y = d7.cy + rowH;
  }
}
resize();
window.addEventListener("resize",resize);

// ===== BFS =====
function calcPathBFS(start,goal){
  const q=[start], came=new Map([[start,null]]);
  while(q.length){
    const c=q.shift();
    if(c===goal) break;
    c.neighbors.forEach(n=>{
      if(!came.has(n)){
        came.set(n,c);
        q.push(n);
      }
    });
  }
  const p=[];
  let c=goal;
  while(c){ p.unshift(c); c=came.get(c); }
  return p;
}

// ===== 近接ノード =====
function nearestNode(){
  return nodes.reduce((a,b)=>
    Math.hypot(b.x-user.x,b.y-user.y) < Math.hypot(a.x-user.x,a.y-user.y) ? b : a
  );
}

// ===== 経路 =====
function calcPath(start){
  const empty = rods.filter(r=>!r.status);
  if(!empty.length) return [];
  const best = empty.reduce((a,b)=>
    Math.hypot(b.front.x-user.x,b.front.y-user.y) <
    Math.hypot(a.front.x-user.x,a.front.y-user.y) ? b : a
  );
  return calcPathBFS(start,best.front);
}

// ===== センサポーリング =====
async function updateFromSensor(){
  const res = await fetch("/api/sensor");
  const data = await res.json();

  Object.entries(sensorRodMap).forEach(([sensor,rodId])=>{
    const r = rods.find(r=>r.id===rodId);
    if(r){
      r.status = data[sensor];
      r.el.className = "rod " + (r.status?"full":"empty");
    }
  });
}
setInterval(updateFromSensor,1000);

// ===== 再計算 =====
let path=[];
function recalcPath(){
  path = calcPath(nearestNode());
}
setInterval(recalcPath,300);

// ===== 描画 =====
(function loop(){
  ctx.clearRect(0,0,canvas.width,canvas.height);

  rods.forEach(r=>{
    ctx.fillStyle = r.status ? "#f44336" : "#4caf50";
    ctx.fillRect(r.cx-colW/2, r.cy-rowH/2, colW, rowH);
    ctx.strokeRect(r.cx-colW/2, r.cy-rowH/2, colW, rowH);
  });

  if(path.length){
    ctx.strokeStyle="blue";
    ctx.lineWidth=4;
    ctx.beginPath();
    ctx.moveTo(user.x,user.y);
    path.forEach(n=>ctx.lineTo(n.x,n.y));
    ctx.stroke();
  }

  userMarker.style.left = (user.x-6)+"px";
  userMarker.style.top = (user.y-6)+"px";

  requestAnimationFrame(loop);
})();