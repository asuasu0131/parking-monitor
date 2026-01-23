const container = document.getElementById("parking-lot-container");
const lot = document.getElementById("parking-lot");
const zoomSlider = document.getElementById("zoom-slider");

let zoomScale = 1;

// 🔽 ロッド共通サイズ（比率）
let rodWidthRatio  = 0.08;
let rodHeightRatio = 0.12;

let rods = [];

async function loadLayout() {
  try {
    const res = await fetch("/parking_layout.json");
    rods = await res.json();
  } catch {
    rods = [];
  }
  renderRods();
}

function renderRods() {
  document.querySelectorAll(".rod").forEach(e => e.remove());

  rods.forEach(r => {
    r.wRatio ??= rodWidthRatio;
    r.hRatio ??= rodHeightRatio;

    const d = document.createElement("div");
    d.className = "rod " + (r.status === 0 ? "empty" : "full");
    d.innerHTML = `${r.id}<br>${r.status === 0 ? "空き" : "使用中"}`;

    lot.appendChild(d);

    function update() {
      d.style.left   = (r.xRatio * container.clientWidth) + "px";
      d.style.top    = (r.yRatio * container.clientHeight) + "px";
      d.style.width  = (r.wRatio * container.clientWidth) + "px";
      d.style.height = (r.hRatio * container.clientHeight) + "px";
    }

    update();
    window.addEventListener("resize", update);

    // ===== ドラッグ移動 =====
    d.onmousedown = e => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();

      function move(ev) {
        r.xRatio = (ev.clientX - rect.left) / rect.width;
        r.yRatio = (ev.clientY - rect.top) / rect.height;
        r.xRatio = Math.min(Math.max(r.xRatio, 0), 1);
        r.yRatio = Math.min(Math.max(r.yRatio, 0), 1);
        update();
      }
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", () => {
        document.removeEventListener("mousemove", move);
      }, { once:true });
    };

    // ダブルクリックで状態切替
    d.ondblclick = () => {
      r.status = r.status === 0 ? 1 : 0;
      d.className = "rod " + (r.status === 0 ? "empty" : "full");
      d.innerHTML = `${r.id}<br>${r.status === 0 ? "空き" : "使用中"}`;
    };
  });
}

document.getElementById("add-rod").onclick = () => {
  rods.push({
    id: "R" + (rods.length + 1),
    xRatio: 0.5,
    yRatio: 0.5,
    wRatio: rodWidthRatio,
    hRatio: rodHeightRatio,
    status: 0
  });
  renderRods();
};

document.getElementById("save-layout").onclick = async () => {
  await fetch("/save_layout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rods)
  });
  alert("保存しました");
};

zoomSlider.addEventListener("input", () => {
  zoomScale = parseFloat(zoomSlider.value);
  lot.style.transform = `scale(${zoomScale})`;
});

loadLayout();