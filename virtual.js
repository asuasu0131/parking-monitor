const container = document.getElementById("parking-lot-container");
const lot = document.getElementById("parking-lot");
const zoomSlider = document.getElementById("zoom-slider");

let rods = [];
let zoomScale = 1;
const socket = io();

async function loadLayout() {
  const res = await fetch("/parking_layout.json");
  rods = await res.json();
  renderRods();
}

function renderRods() {
  document.querySelectorAll(".rod").forEach(e=>e.remove());

  // 駐車場の最大幅・高さを計算
  let maxX = Math.max(...rods.map(r=>r.x + r.width), 200); // 最低200m幅
  let maxY = Math.max(...rods.map(r=>r.y + r.height), 100); // 最低100m高さ

  // スケール
  let scale = Math.min(container.clientWidth/maxX, container.clientHeight/maxY);

  // lotのサイズ
  lot.style.width  = maxX*scale + "px";
  lot.style.height = maxY*scale + "px";

  // 背景色処理
  // 敷地部分 (#bfbfbf)、敷地外 (#888)
  lot.style.background = `linear-gradient(#888 0 0)`;
  lot.style.position = "relative";

  // 敷地用要素を追加
  let parkingArea = document.createElement("div");
  parkingArea.style.position = "absolute";
  parkingArea.style.left = "0px";
  parkingArea.style.top  = "0px";
  parkingArea.style.width  = "200m"; // scale適用
  parkingArea.style.height = "100m"; // scale適用
  parkingArea.style.width  = 200*scale + "px";
  parkingArea.style.height = 100*scale + "px";
  parkingArea.style.background = "#bfbfbf";
  parkingArea.style.zIndex = 0;
  lot.appendChild(parkingArea);

  // ロッド描画
  rods.forEach(r=>{
    const d = document.createElement("div");
    d.className = "rod " + (r.status===0?"empty":"full");
    d.style.left = r.x*scale + "px";
    d.style.top  = r.y*scale + "px";
    d.style.width = r.width*scale + "px";
    d.style.height = r.height*scale + "px";
    d.style.transform = `rotate(${r.angle}deg)`;
    d.style.zIndex = 1;
    lot.appendChild(d);
  });
}

socket.on("layout_updated", loadLayout);
zoomSlider.addEventListener("input", ()=>{ zoomScale = parseFloat(zoomSlider.value); });
loadLayout();

(function loop(){
  lot.style.transform = `scale(${zoomScale})`;
  requestAnimationFrame(loop);
})();