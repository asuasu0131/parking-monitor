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
  document.querySelectorAll(".rod").forEach(e => e.remove());

  rods.forEach(r => {
    const d = document.createElement("div");
    d.className = "rod " + (r.status === 0 ? "empty" : "full");
    d.innerHTML = `${r.id}<br>${r.status === 0 ? "空き" : "使用中"}`;

    function updatePosition() {
      d.style.left = (r.xRatio * container.clientWidth) + "px";
      d.style.top  = (r.yRatio * container.clientHeight) + "px";
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);

    lot.appendChild(d);
  });
}

socket.on("layout_updated", loadLayout);

zoomSlider.addEventListener("input", () => {
  zoomScale = parseFloat(zoomSlider.value);
});

loadLayout();

(function loop() {
  lot.style.transform = `scale(${zoomScale})`;
  requestAnimationFrame(loop);
})();