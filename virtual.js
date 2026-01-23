const container = document.getElementById("parking-lot-container");
const lot = document.getElementById("parking-lot");
const canvas = document.getElementById("path-canvas");
const ctx = canvas.getContext("2d");
const userMarker = document.getElementById("user-marker");

let rods = [];
let nodes = [];
let path = [];
let user = {x:0, y:0};
const moveStep = 5;

// ================= JSONロード =================
async function loadLayout(){
  try{
    const resp = await fetch("/parking_layout.json");
    const data = await resp.json();
    rods = data.map(r => ({...r, el:null, front:null}));
    createRodDOMs();
    generateNodes();
    resize();
    recalcPath();
  }catch(e){ console.error("JSONロード失敗", e); }
}

// ================= ロッドDOM作成 =================
function createRodDOMs(){
  rods.forEach(r=>{
    const d = document.createElement("div");
    d.className = r.status ? "rod full" : "rod empty";
    d.style.left = r.x + "px";
    d.style.top = r.y + "px";
    d.textContent = r.id;
    lot.appendChild(d);
    r.el = d;

    d.onclick = ()=>{
      r.status ^=1;
      d.className = r.status ? "rod full":"rod empty";
      recalcPath();
    };
  });
}

// ================= ノード生成 =================
function generateNodes(){
  nodes = [];
  const step = 20;

  // ロッド前ノード
  rods.forEach(r=>{
    const n = {x: r.x + 35, y: r.y - 20, neighbors: [], priority: false};
    nodes.push(n);
    r.front = n;
  });

  // 通路ノード（簡易生成）
  const cols = 20, rows = 15;
  const cw = container.clientWidth/cols, ch = container.clientHeight/rows;
  for(let i=0;i<=cols;i++){
    for(let j=0;j<=rows;j++){
      const x = i*cw, y = j*ch;
      if(!nodes.some(n=>Math.hypot(n.x-x,n.y-y)<step/2)){
        nodes.push({x,y,neighbors:[],priority:false});
      }
    }
  }

  // 隣接ノード設定
  nodes.forEach(n=>{
    nodes.forEach(m=>{
      if(n===m) return;
      const dx=Math.abs(n.x-m.x);
      const dy=Math.abs(n.y-m.y);
      if((dx===step && dy===0)||(dx===0 && dy===step)){
        n.neighbors.push(m);
      }
    });
  });
}

// ================= ユーザー操作 =================
window.addEventListener("keydown",e=>{
  switch(e.key){
    case "ArrowUp": user.y-=moveStep; break;
    case "ArrowDown": user.y+=moveStep; break;
    case "ArrowLeft": user.x-=moveStep; break;
    case "ArrowRight": user.x+=moveStep; break;
  }
  recalcPath();
});

// ================= 近接ノード検索 =================
function nearestNode(){
  return nodes.reduce((a,b)=>Math.hypot(b.x-user.x,b.y-user.y) < Math.hypot(a.x-user.x,a.y-user.y)?b:a);
}

// ================= A* =================
function astar(start, goals){
  const openSet = [start];
  const cameFrom = new Map();
  const gScore = new Map();
  gScore.set(start,0);

  const h = (n)=>Math.min(...goals.map(g=>Math.hypot(n.x-g.x,n.y-g.y)));

  while(openSet.length){
    openSet.sort((a,b)=> (gScore.get(a)+h(a))-(gScore.get(b)+h(b)));
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
      if(tentative < (gScore.get(n)||Infinity)){
        cameFrom.set(n,current);
        gScore.set(n,tentative);
        if(!openSet.includes(n)) openSet.push(n);
      }
    });
  }
  return [];
}

// ================= 経路計算 =================
function getBestRod(emptyRods){
  if(emptyRods.length===0) return null;
  return emptyRods.reduce((a,b)=> Math.hypot(b.front.x-user.x,b.front.y-user.y) < Math.hypot(a.front.x-user.x,a.front.y-user.y)?b:a);
}

function recalcPath(){
  const start = nearestNode();
  const emptyRods = rods.filter(r=>!r.status);
  if(emptyRods.length>0){
    const bestRod = getBestRod(emptyRods);
    path = astar(start,[bestRod.front]);
  } else {
    path = [];
  }
}

// ================= 描画 =================
function draw(){
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // ロッド描画
  rods.forEach(r=>{
    ctx.fillStyle = r.status ? "#f44336" : "#4caf50";
    ctx.fillRect(r.x, r.y, r.el.offsetWidth, r.el.offsetHeight);
    ctx.strokeStyle="#000";
    ctx.strokeRect(r.x, r.y, r.el.offsetWidth, r.el.offsetHeight);
    ctx.fillStyle="#fff";
    ctx.font="bold 12px sans-serif";
    ctx.textAlign="center";
    ctx.textBaseline="middle";
    ctx.fillText(r.id,r.x + r.el.offsetWidth/2, r.y + r.el.offsetHeight/2);
  });

  // 経路描画
  if(path.length>0){
    ctx.strokeStyle="blue";
    ctx.lineWidth=3;
    ctx.beginPath();
    ctx.moveTo(user.x,user.y);
    path.forEach(n=>ctx.lineTo(n.x,n.y));
    ctx.stroke();
  }

  // ユーザーマーカー
  userMarker.style.left = user.x + "px";
  userMarker.style.top = user.y + "px";

  requestAnimationFrame(draw);
}

// ================= サイズ調整 =================
function resize(){
  if(!user.x&&!user.y){
    user.x=container.clientWidth/2;
    user.y=container.clientHeight-30;
  }
}
window.addEventListener("resize",resize);

// ================= センサ反映 =================
const sensorRods = [
  rods.find(r=>r.id==="A1"),
  rods.find(r=>r.id==="B1")
];
setInterval(async ()=>{
  try{
    const resp = await fetch("/get_sensor");
    const data = await resp.json();
    sensorRods.forEach((r,i)=>{
      if(r){
        r.status = data[`CH${i}`];
        r.el.className = r.status ? "rod full":"rod empty";
      }
    });
    recalcPath();
  }catch(e){console.log("センサ取得エラー",e);}
},500);

// ================= メイン =================
loadLayout();
draw();