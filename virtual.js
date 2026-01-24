const lot = document.getElementById("parking-lot");
const container = document.getElementById("parking-lot-container");
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

  let maxX = Math.max(...rods.map(r=>r.x + r.width));
  let maxY = Math.max(...rods.map(r=>r.y + r.height));

  const scale = Math.min(
    container.clientWidth / maxX,
    container.clientHeight / maxY
  );

  lot.style.width  = maxX * scale + "px";
  lot.style.height = maxY * scale + "px";

  rods.forEach(r=>{
    const d = document.createElement("div");
    d.className = "rod " + (r.status===0?"empty":"full");
    d.style.left = r.x * scale + "px";
    d.style.top  = r.y * scale + "px";
    d.style.width  = r.width  * scale + "px";
    d.style.height = r.height * scale + "px";
    d.style.transform = `rotate(${r.angle}deg)`;
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