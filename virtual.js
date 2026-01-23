const lot = document.getElementById("parking-lot");
const container = document.getElementById("parking-lot-container");
const zoomSlider = document.getElementById("zoom-slider");

let rods = [];
let lotWidth = 2000;
let lotHeight = 1000;
let zoomScale = 1;

const socket = io();

async function loadLayout(){
  const res = await fetch("/parking_layout.json");
  const data = await res.json();
  lotWidth = data.lotWidth || 2000;
  lotHeight = data.lotHeight || 1000;
  rods = data.rods || [];

  lot.style.width = lotWidth + "px";
  lot.style.height = lotHeight + "px";

  renderRods();
}

function renderRods(){
  document.querySelectorAll(".rod").forEach(e=>e.remove());
  rods.forEach(r=>{
    const d = document.createElement("div");
    d.className = "rod "+(r.status===0?"empty":"full");
    d.innerHTML = `${r.id}<br>${r.status===0?"空き":"使用中"}`;
    d.style.width = r.w + "px";
    d.style.height = r.h + "px";
    d.style.left = r.x + "px";
    d.style.top  = r.y + "px";
    d.style.transform = `rotate(${r.rotation}deg)`;
    d.style.transformOrigin = "center center";
    lot.appendChild(d);
  });
}

socket.on("layout_updated", loadLayout);

zoomSlider.addEventListener("input", ()=>{
  zoomScale = parseFloat(zoomSlider.value);
});

loadLayout();

(function loop(){
  lot.style.transform = `scale(${zoomScale})`;
  requestAnimationFrame(loop);
})();