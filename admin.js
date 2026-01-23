const container = document.getElementById("parking-lot-container");
const lot = document.getElementById("parking-lot");
const zoomSlider = document.getElementById("zoom-slider");

let zoomScale = 1;

let rods = [
  { id: "A1", xRatio: 0.15, yRatio: 0.15, status: 0 },
  { id: "A2", xRatio: 0.15, yRatio: 0.45, status: 1 },
  { id: "A3", xRatio: 0.15, yRatio: 0.75, status: 0 },
  { id: "B1", xRatio: 0.55, yRatio: 0.15, status: 0 },
  { id: "B2", xRatio: 0.55, yRatio: 0.45, status: 1 },
  { id: "B3", xRatio: 0.55, yRatio: 0.75, status: 0 }
];

function renderRods() {
  document.querySelectorAll(".rod").forEach(e => e.remove());

  rods.forEach(r => {
    const d = document.createElement("div");
    d.className = "rod " + (r.status === 0 ? "empty" : "full");
    d.innerHTML = `${r.id}<br>${r.status === 0 ? "空き" : "使用中"}`;
    lot.appendChild(d);

    function updatePosition() {
      d.style.left = (r.xRatio * container.clientWidth) + "px";
      d.style.top  = (r.yRatio * container.clientHeight) + "px";
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);

    d.onmousedown = (e) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();

      function move(ev) {
        r.xRatio = (ev.clientX - rect.left) / rect.width;
        r.yRatio = (ev.clientY - rect.top) / rect.height;

        r.xRatio = Math.min(Math.max(r.xRatio, 0), 1);
        r.yRatio = Math.min(Math.max(r.yRatio, 0), 1);

        updatePosition();
      }

      function up() {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
      }

      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    };

    d.ondblclick = () => {
      r.status = r.status === 0 ? 1 : 0;
      d.className = "rod " + (r.status === 0 ? "empty" : "full");
      d.innerHTML = `${r.id}<br>${r.status === 0 ? "空き" : "使用中"}`;
    };
  });
}

renderRods();

zoomSlider.addEventListener("input", () => {
  zoomScale = parseFloat(zoomSlider.value);
});

document.getElementById("add-rod").onclick = () => {
  rods.push({
    id: "R" + (rods.length + 1),
    xRatio: 0.5,
    yRatio: 0.5,
    status: 0
  });
  renderRods();
};

document.getElementById("save-layout").onclick = async () => {
  const res = await fetch("/save_layout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rods)
  });

  if (res.ok) alert("parking_layout.json に保存しました");
  else alert("保存失敗");
};

(function loop() {
  lot.style.transform = `scale(${zoomScale})`;
  requestAnimationFrame(loop);
})();