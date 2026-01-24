const lot = document.getElementById("parking-lot");
const container = document.getElementById("parking-lot-container");
const zoomSlider = document.getElementById("zoom-slider");

let rods = [];
let zoomScale = 1;
let parking = { width:200, height:100 }; // 仮初期値
let grid = []; // 通路情報

const GRID_CELL_M = 5;

const socket = io();

// 管理者からのレイアウト取得
async function loadLayout() {
  const res = await fetch("/parking_layout.json");
  const data = await res.json();

  if(data.parking && data.rods){
    parking = data.parking;
    rods = data.rods;
    grid = data.grid || [];
  } else {
    rods = data;
    parking = { width:200, height:100 };
  }

  renderRods();
}

// ===== ユーザマーカー =====
let user = {x: GRID_CELL_M, y: GRID_CELL_M};
const userMarker = document.createElement("div");
userMarker.id = "user-marker";
lot.appendChild(userMarker);

function renderUser() {
  const scale = Math.min(container.clientWidth / parking.width, container.clientHeight / parking.height);
  userMarker.style.left = user.x*scale + "px";
  userMarker.style.top  = user.y*scale + "px";
}

// キーボードで移動
document.addEventListener("keydown", e=>{
  const step = 1;
  if(e.key==="ArrowUp") user.y = Math.max(0,user.y-step);
  if(e.key==="ArrowDown") user.y = Math.min(parking.height,user.y+step);
  if(e.key==="ArrowLeft") user.x = Math.max(0,user.x-step);
  if(e.key==="ArrowRight") user.x = Math.min(parking.width,user.x+step);
  renderUser();
  renderPath();
});

// ===== A* アルゴリズム =====
function findPath(start,goal){
  if(!grid || grid.length===0) return [];
  const cols = grid[0].length;
  const rows = grid.length;
  let open=[], closed=new Set(), cameFrom={};
  function key(p){return p.x+","+p.y;}
  function heuristic(a,b){return Math.abs(a.x-b.x)+Math.abs(a.y-b.y);}
  open.push({...start, g:0, f:heuristic(start,goal)});
  while(open.length>0){
    open.sort((a,b)=>a.f-b.f);
    const current = open.shift();
    if(current.x===goal.x && current.y===goal.y){
      let path=[goal];
      let ckey=key(goal);
      while(cameFrom[ckey]){
        path.unshift(cameFrom[ckey]);
        ckey=key(cameFrom[ckey]);
      }
      return path;
    }
    closed.add(key(current));
    [[0,1],[1,0],[0,-1],[-1,0]].forEach(([dx,dy])=>{
      const nx=current.x+dx, ny=current.y+dy;
      if(nx<0||ny<0||nx>=cols||ny>=rows) return;
      if(grid[ny][nx]!==1) return;
      const neighbor={x:nx,y:ny};
      if(closed.has(key(neighbor))) return;
      const g=current.g+1, f=g+heuristic(neighbor,goal);
      const exist=open.find(o=>o.x===nx&&o.y===ny);
      if(exist && g>=exist.g) return;
      neighbor.g=g; neighbor.f=f;
      open.push(neighbor);
      cameFrom[key(neighbor)]=current;
    });
  }
  return [];
}

// ===== 経路描画 =====
function renderPath(){
  document.querySelectorAll(".path-segment").forEach(e=>e.remove());
  if(rods.length===0) return;
  const scale = Math.min(container.clientWidth / parking.width, container.clientHeight / parking.height);
  const target = rods.find(r=>r.status===0);
  if(!target) return;

  const start={x:Math.floor(user.x/GRID_CELL_M), y:Math.floor(user.y/GRID_CELL_M)};
  const goal={x:Math.floor(target.x/GRID_CELL_M), y:Math.floor(target.y/GRID_CELL_M)};
  const path = findPath(start,goal);
  path.forEach((p,i)=>{
    if(i===0) return;
    const prev = path[i-1];
    const seg = document.createElement("div");
    seg.className="path-segment";
    seg.style.position="absolute";
    seg.style.left = Math.min(prev.x,p.x)*GRID_CELL_M*scale + "px";
    seg.style.top  = Math.min(prev.y,p.y)*GRID_CELL_M*scale + "px";
    seg.style.width  = Math.abs(prev.x-p.x+1)*GRID_CELL_M*scale + "px";
    seg.style.height = Math.abs(prev.y-p.y+1)*GRID_CELL_M*scale + "px";
    seg.style.background = "rgba(255,0,0,0.6)";
    seg.style.zIndex = 2;
    lot.appendChild(seg);
  });
}

// ===== 描画 =====
function renderRods() {
  document.querySelectorAll(".rod, .parking-area, .path-segment").forEach(e => e.remove());

  const scale = Math.min(container.clientWidth / parking.width, container.clientHeight / parking.height);
  lot.style.width = parking.width * scale + "px";
  lot.style.height = parking.height * scale + "px";
  container.style.background = "#888";

  // 敷地
  const parkingArea = document.createElement("div");
  parkingArea.className = "parking-area";
  parkingArea.style.position = "absolute";
  parkingArea.style.left = "0px";
  parkingArea.style.top  = "0px";
  parkingArea.style.width  = parking.width * scale + "px";
  parkingArea.style.height = parking.height * scale + "px";
  parkingArea.style.background = "#bfbfbf";
  parkingArea.style.border = "2px solid #000";
  parkingArea.style.zIndex = 1;
  lot.appendChild(parkingArea);

  // ロッド描画
  rods.forEach(r=>{
    const d = document.createElement("div");
    d.className = "rod " + (r.status===0?"empty":"full");
    d.style.left = r.x * scale + "px";
    d.style.top  = r.y * scale + "px";
    d.style.width = (r.width || 2.5) * scale + "px";
    d.style.height = (r.height || 5) * scale + "px";
    d.style.transform = `rotate(${r.angle || 0}deg)`;
    d.style.zIndex = 2;
    lot.appendChild(d);
  });

  renderUser();
  renderPath();
}

socket.on("layout_updated", loadLayout);
zoomSlider.addEventListener("input", ()=>{ zoomScale = parseFloat(zoomSlider.value); });
loadLayout();

// ===== ズームループ =====
(function loop(){
  lot.style.transform = `scale(${zoomScale})`;
  requestAnimationFrame(loop);
})();