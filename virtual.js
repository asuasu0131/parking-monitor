const lot = document.getElementById("parking-lot");
const container = document.getElementById("parking-lot-container");
const zoomSlider = document.getElementById("zoom-slider");
let zoomScale = parseFloat(zoomSlider.value);

let rods = [];
let roads = [];

const socket = io();

// ===== JSONロード =====
async function loadLayout(){
  const res = await fetch("/parking_layout.json");
  const data = await res.json();
  rods = data.rods || [];
  roads = data.roads || [];

  document.querySelectorAll(".road").forEach(e=>e.remove());
  roads.forEach(r=>{
    lot.appendChild(r.element = document.createElement("div"));
    r.element.className = "road";
    r.element.style.left = r.x+"px";
    r.element.style.top  = r.y+"px";
    r.element.style.width = r.w+"px";
    r.element.style.height= r.h+"px";
  });

  renderRods();
}

function renderRods(){
  document.querySelectorAll(".rod").forEach(e=>e.remove());
  rods.forEach(r=>{
    const d = document.createElement("div");
    d.className = "rod " + (r.status===0?"empty":"full");
    d.innerHTML = `${r.id}<br>${r.status===0?"空き":"使用中"}`;
    d.style.left = r.x + "px";
    d.style.top  = r.y + "px";
    lot.appendChild(d);
    r.element = d;
  });
}

// ===== ユーザー中心座標 =====
function userX(){ return container.clientWidth/2; }
function userY(){ return container.clientHeight/2; }

// ===== 最寄り空きロッド =====
function getNearestRod(){
  let minDist = Infinity, nearest=null;
  rods.forEach(r=>{
    if(r.status===1) return;
    const dx = r.x - userX();
    const dy = r.y - userY();
    const dist = Math.sqrt(dx*dx + dy*dy);
    if(dist<minDist){ minDist=dist; nearest=r; }
  });
  return nearest;
}

// ===== 矢印更新 =====
function updateArrow(){
  const nearest = getNearestRod();
  if(!nearest) return;
  const dx = nearest.x - userX();
  const dy = nearest.y - userY();
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  document.getElementById("heading-arrow").style.transform = `translate(-50%,-50%) rotate(${angle}deg)`;
}

// ===== 初期化 =====
loadLayout();

zoomSlider.addEventListener("input", ()=>{ zoomScale = parseFloat(zoomSlider.value); });

// ===== ループ =====
(function loop(){
  renderRods();
  updateArrow();
  lot.style.transform = `scale(${zoomScale})`;
  requestAnimationFrame(loop);
})();

// ===== socket 更新通知 =====
socket.on("layout_updated", loadLayout);