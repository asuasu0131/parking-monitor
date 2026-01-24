const container = document.getElementById("parking-lot-container");
const lot = document.getElementById("parking-lot");
const zoomSlider = document.getElementById("zoom-slider");

const socket = io();
let zoomScale = 1;

// ===== 現実サイズ =====
const ROD_WIDTH_M  = 2.5;
const ROD_HEIGHT_M = 5.0;
const GRID_M = 5;

// ===== 駐車場情報 =====
let parking = { lat1:35.0, lng1:135.0, lat2:34.999, lng2:135.002, width:0, height:0 };
let rods = [];
let nodes = [];
let selectedNode = null;

// ===== 背景画像 =====
let aerialImg = null;

// ===== 緯度経度 → m換算 =====
function calcParkingSize() {
  const latDist = (parking.lat1 - parking.lat2) * 111320;
  const lngDist = (parking.lng2 - parking.lng1) * 111320 *
    Math.cos((parking.lat1 + parking.lat2) / 2 * Math.PI / 180);
  parking.width  = Math.abs(lngDist);
  parking.height = Math.abs(latDist);
}

// ===== 緯度経度 → Web Mercator =====
function latLngToPixel(lat, lng, zoom) {
  const sinLat = Math.sin(lat * Math.PI / 180);
  return {
    x: ((lng + 180) / 360) * 256 * Math.pow(2, zoom),
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI))
        * 256 * Math.pow(2, zoom)
  };
}

// ===== タイルURL =====
function getTileUrl(x, y, z) {
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
}

// ===== 背景（1枚だけ取得）=====
function setAerialBackground() {
  if (!parking.lat1 || !parking.lat2) return;

  const zoom = 19; // 固定
  const centerLat = (parking.lat1 + parking.lat2) / 2;
  const centerLng = (parking.lng1 + parking.lng2) / 2;

  const center = latLngToPixel(centerLat, centerLng, zoom);
  const tileX = Math.floor(center.x / 256);
  const tileY = Math.floor(center.y / 256);

  if (aerialImg) aerialImg.remove();

  aerialImg = document.createElement("img");
  aerialImg.src = getTileUrl(tileX, tileY, zoom);
  aerialImg.style.position = "absolute";
  aerialImg.style.width = "512px";
  aerialImg.style.height = "512px";
  aerialImg.style.left = "50%";
  aerialImg.style.top = "50%";
  aerialImg.style.transformOrigin = "center center";
  aerialImg.style.pointerEvents = "none";
  aerialImg.style.zIndex = 0;

  container.prepend(aerialImg);
}

// ===== 描画 =====
function render() {
  document.querySelectorAll(".rod,.node,.node-line,.parking-area").forEach(e=>e.remove());

  const scale = Math.min(
    container.clientWidth / parking.width,
    container.clientHeight / parking.height
  );

  lot.style.width  = parking.width * scale + "px";
  lot.style.height = parking.height * scale + "px";
  lot.style.background = "transparent";

  // 敷地
  const area = document.createElement("div");
  area.className = "parking-area";
  area.style.position = "absolute";
  area.style.width = parking.width * scale + "px";
  area.style.height = parking.height * scale + "px";
  area.style.border = "2px solid #000";
  area.style.backgroundColor = "#bfbfbf";
  area.style.zIndex = 0;

  const gridPx = GRID_M * scale;
  area.style.backgroundImage = `
    linear-gradient(to right, #aaa 1px, transparent 1px),
    linear-gradient(to bottom, #aaa 1px, transparent 1px)
  `;
  area.style.backgroundSize = `${gridPx}px ${gridPx}px`;

  lot.appendChild(area);

  // ロッド
  rods.forEach(r=>{
    const d = document.createElement("div");
    d.className = "rod " + (r.status===0?"empty":"full");
    d.textContent = r.id;
    lot.appendChild(d);

    const update = ()=>{
      d.style.left = r.x * scale + "px";
      d.style.top  = r.y * scale + "px";
      d.style.width = r.width * scale + "px";
      d.style.height = r.height * scale + "px";
      d.style.transform = `rotate(${r.angle}deg)`;
    };
    update();

    d.onmousedown = e=>{
      e.preventDefault();
      const sx=e.clientX, sy=e.clientY, ox=r.x, oy=r.y;
      const move = ev=>{
        r.x = ox + (ev.clientX - sx) / scale;
        r.y = oy + (ev.clientY - sy) / scale;
        update();
      };
      const up = ()=>{
        document.removeEventListener("mousemove",move);
        document.removeEventListener("mouseup",up);
      };
      document.addEventListener("mousemove",move);
      document.addEventListener("mouseup",up);
    };

    d.oncontextmenu = e=>{
      e.preventDefault();
      r.angle = (r.angle + 90) % 360;
      update();
    };
  });

  // ノード
  nodes.forEach(n=>{
    const d = document.createElement("div");
    d.className = "node";
    d.style.width = d.style.height = "6px";
    d.style.borderRadius = "50%";
    d.style.background = "#2196f3";
    d.style.position = "absolute";
    d.style.left = n.x * scale - 3 + "px";
    d.style.top  = n.y * scale - 3 + "px";
    d.style.zIndex = 1;
    lot.appendChild(d);
  });
}

// ===== イベント =====
document.getElementById("set-parking").onclick = ()=>{
  parking.lat1 = +lat1.value;
  parking.lng1 = +lng1.value;
  parking.lat2 = +lat2.value;
  parking.lng2 = +lng2.value;
  calcParkingSize();
  setAerialBackground();
  render();
};

document.getElementById("add-rod").onclick = ()=>{
  rods.push({
    id:"R"+(rods.length+1),
    x:parking.width/4,
    y:parking.height/4,
    width:ROD_WIDTH_M,
    height:ROD_HEIGHT_M,
    status:0,
    angle:0
  });
  render();
};

zoomSlider.oninput = ()=>{
  zoomScale = parseFloat(zoomSlider.value);
};

// ===== ズーム同期（背景＋lot）=====
(function loop(){
  lot.style.transform = `scale(${zoomScale})`;
  if (aerialImg) {
    aerialImg.style.transform =
      `translate(-50%, -50%) scale(${zoomScale})`;
  }
  requestAnimationFrame(loop);
})();

// 初期化
calcParkingSize();
setAerialBackground();
render();