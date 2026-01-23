const lot = document.getElementById("parking-lot");
const container = document.getElementById("parking-lot-container");
const zoomSlider = document.getElementById("zoom-slider");

let rods = [];
let zoomScale = 1;

const socket = io();

/* ===== JSON 読み込み ===== */
async function loadLayout(){
  const res = await fetch("/parking_layout.json");
  rods = await res.json();
  renderRods();
}

/* ===== 描画 ===== */
function renderRods(){
  document.querySelectorAll(".rod").forEach(e=>e.remove());

  rods.forEach(r=>{
    const d = document.createElement("div");
    d.className = "rod " + (r.status===0?"empty":"full");
    d.innerHTML = `${r.id}<br>${r.status===0?"空き":"使用中"}`;

    // renderRods 内
    d.style.left = r.xRatio * container.clientWidth + "px";
    d.style.top  = r.yRatio * container.clientHeight + "px";

    lot.appendChild(d);
  });
}

/* ===== socket 更新通知 ===== */
socket.on("layout_updated", loadLayout);

/* ===== zoom ===== */
zoomSlider.addEventListener("input", ()=>{
  zoomScale = parseFloat(zoomSlider.value);
});

/* ===== 初期化 ===== */
loadLayout();

/* ===== 描画ループ ===== */
(function loop(){
  lot.style.transform = `scale(${zoomScale})`;
  requestAnimationFrame(loop);
})();
