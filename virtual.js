const lot = document.getElementById("parking-lot");
const container = document.getElementById("parking-lot-container");
const zoomSlider = document.getElementById("zoom-slider");

let rods = [];
let zoomScale = 1;
let parking = { width:200, height:100 }; // 仮初期値

const socket = io();

// 管理者からのレイアウト取得
async function loadLayout() {
  const res = await fetch("/parking_layout.json");
  const data = await res.json();

  if(data.parking && data.rods){
    parking = data.parking;
    rods = data.rods;
  } else {
    rods = data;
    parking = { width:200, height:100 };
  }

  renderRods();
}

function renderRods() {
  // 既存の描画を削除
  document.querySelectorAll(".rod, .parking-area, .parking-outside").forEach(e => e.remove());

  // scale計算
  let scale = Math.min(container.clientWidth / parking.width, container.clientHeight / parking.height);

  // lotサイズ（敷地外まで描画）
  const outerWidth = container.clientWidth;
  const outerHeight = container.clientHeight;
  lot.style.width = outerWidth + "px";
  lot.style.height = outerHeight + "px";

  // 敷地外
  const outside = document.createElement("div");
  outside.className = "parking-outside";
  outside.style.position = "absolute";
  outside.style.left = "0px";
  outside.style.top  = "0px";
  outside.style.width  = outerWidth + "px";
  outside.style.height = outerHeight + "px";
  outside.style.background = "#888";  // 敷地外色
  outside.style.zIndex = 0;
  lot.appendChild(outside);

  // 敷地内
  const parkingArea = document.createElement("div");
  parkingArea.className = "parking-area";
  parkingArea.style.position = "absolute";
  parkingArea.style.left = "0px";
  parkingArea.style.top  = "0px";
  parkingArea.style.width  = parking.width * scale + "px";
  parkingArea.style.height = parking.height * scale + "px";
  parkingArea.style.background = "#bfbfbf"; // 敷地内色
  parkingArea.style.border = "2px solid #000"; // 枠線
  parkingArea.style.zIndex = 1;
  lot.appendChild(parkingArea);

  // ロッド描画
  rods.forEach(r => {
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
}

socket.on("layout_updated", loadLayout);
zoomSlider.addEventListener("input", ()=>{ zoomScale = parseFloat(zoomSlider.value); });
loadLayout();

// ズームループ
(function loop(){
  lot.style.transform = `scale(${zoomScale})`;
  requestAnimationFrame(loop);
})();