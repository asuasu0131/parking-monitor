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

// ===== 背景画像設定（ローカル画像）=====
function setAerialBackground() {
  if (!parking.width || !parking.height) return;

  // 既存の画像を削除
  if (aerialImg) aerialImg.remove();

  aerialImg = document.createElement("img");
  // HTML からの相対パスで指定
  aerialImg.src = "./parking_bg.png"; 
  aerialImg.alt = "Parking Background";
  aerialImg.style.position = "absolute";
  aerialImg.style.left = "50%";
  aerialImg.style.top = "50%";
  aerialImg.style.transform = "translate(-50%, -50%) scale(" + zoomScale + ")";
  aerialImg.style.pointerEvents = "none";
  aerialImg.style.zIndex = 0;
  aerialImg.style.display = "block"; // ← 非表示にならないように
  aerialImg.style.maxWidth = "none";  // 自動縮小を無効化
  aerialImg.style.maxHeight = "none";

  // 駐車場のサイズに合わせる
  const scale = Math.min(
    container.clientWidth / parking.width,
    container.clientHeight / parking.height
  );
  aerialImg.style.width  = parking.width * scale + "px";
  aerialImg.style.height = parking.height * scale + "px";

  // lot 内に追加
  lot.prepend(aerialImg);

  // lot の position を relative にして、子要素の絶対配置を有効にする
  lot.style.position = "relative";
}

// ===== 描画 =====
function render() {
  lot.querySelectorAll(".rod,.node,.parking-area").forEach(e=>e.remove());

  const scale = Math.min(
    container.clientWidth / parking.width,
    container.clientHeight / parking.height
  );

  lot.style.width  = parking.width * scale + "px";
  lot.style.height = parking.height * scale + "px";

  // ===== 敷地 =====
  const area = document.createElement("div");
  area.className = "parking-area";
  area.style.position = "absolute";
  area.style.width = parking.width * scale + "px";
  area.style.height = parking.height * scale + "px";
  area.style.border = "2px solid #000";
  area.style.background = "transparent";
  area.style.zIndex = 1;

  const gridPx = GRID_M * scale;
  area.style.backgroundImage = `
    linear-gradient(to right, #aaa 1px, transparent 1px),
    linear-gradient(to bottom, #aaa 1px, transparent 1px)
  `;
  area.style.backgroundSize = `${gridPx}px ${gridPx}px`;

  lot.appendChild(area);

  // ===== ロッド =====
  rods.forEach(r=>{
    const d = document.createElement("div");
    d.className = "rod " + (r.status===0?"empty":"full");
    d.textContent = r.id;
    d.style.zIndex = 2;
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

// ===== ズーム =====
zoomSlider.oninput = ()=>{
  zoomScale = parseFloat(zoomSlider.value);
  if(aerialImg){
    aerialImg.style.transform = "translate(-50%, -50%) scale(" + zoomScale + ")";
  }
  lot.style.transform = `scale(${zoomScale})`;
};

// ===== 初期化 =====
calcParkingSize();
setAerialBackground();
render();