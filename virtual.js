const lot = document.getElementById("parking-lot");
const container = document.getElementById("parking-lot-container");
const zoomSlider = document.getElementById("zoom-slider");

let zoomScale = 1;
let parking = {};
let rods = [];

async function loadLayout() {
  const res = await fetch("/parking_layout.json");
  const data = await res.json();

  parking = data.parking;
  rods = data.rods;

  render();
}

function render() {
  document.querySelectorAll(".rod").forEach(e=>e.remove());

  const scale = Math.min(
    container.clientWidth / parking.width,
    container.clientHeight / parking.height
  );

  // 駐車場（黒）
  lot.style.width  = parking.width * scale + "px";
  lot.style.height = parking.height * scale + "px";

  rods.forEach(r=>{
    const d = document.createElement("div");
    d.className = "rod " + (r.status===0?"empty":"full");

    d.style.left = r.x * scale + "px";
    d.style.top  = r.y * scale + "px";
    d.style.width  = r.width * scale + "px";
    d.style.height = r.height * scale + "px";
    d.style.transform = `rotate(${r.angle}deg)`;

    lot.appendChild(d);
  });
}

zoomSlider.addEventListener("input", ()=>{
  zoomScale = parseFloat(zoomSlider.value);
});

(function loop(){
  lot.style.transform = `scale(${zoomScale})`;
  requestAnimationFrame(loop);
})();

loadLayout();