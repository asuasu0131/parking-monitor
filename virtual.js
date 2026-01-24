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
  document.querySelectorAll(".rod, .parking-area").forEach(e => e.remove());

  // scale計算
  let scale = Math.min(container.clientWidth / parking.width, container.clientHeight / parking.height);

  // lotサイズを敷地内サイズにする（敷地外は container 背景で表現）
  lot.style.width = parking.width * scale + "px";
  lot.style.height = parking.height * scale + "px";

  // container背景を敷地外色に設定
  container.style.background = "#888";

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