const container = document.getElementById("parking-lot-container");
const lot = document.getElementById("parking-lot");
const zoomSlider = document.getElementById("zoom-slider");

let zoomScale = 1;
let scale = 1;

const ROD_WIDTH_M = 2.0;   // 現実 2m
const ROD_HEIGHT_M = 5.0;  // 現実 5m

let parking = {
  lat1: 35.0, lng1: 135.0,
  lat2: 34.999, lng2: 135.002,
  widthM: 0,
  heightM: 0
};

let rods = [];

function calcParkingSize() {
  const latDist = (parking.lat1 - parking.lat2) * 111320;
  const lngDist =
    (parking.lng2 - parking.lng1) *
    111320 *
    Math.cos(((parking.lat1 + parking.lat2) / 2) * Math.PI / 180);

  parking.widthM = Math.abs(lngDist);
  parking.heightM = Math.abs(latDist);
}

function updateScale() {
  scale = Math.min(
    container.clientWidth / parking.widthM,
    container.clientHeight / parking.heightM
  );

  lot.style.width = parking.widthM * scale + "px";
  lot.style.height = parking.heightM * scale + "px";
}

function renderRods() {
  document.querySelectorAll(".rod").forEach(e => e.remove());
  updateScale();

  rods.forEach(r => {
    const d = document.createElement("div");
    d.className = "rod " + (r.status === 0 ? "empty" : "full");
    d.textContent = r.id;

    lot.appendChild(d);

    function update() {
      d.style.left = r.xM * scale + "px";
      d.style.top = r.yM * scale + "px";
      d.style.width = ROD_WIDTH_M * scale + "px";
      d.style.height = ROD_HEIGHT_M * scale + "px";
      d.style.transform = `rotate(${r.angle}deg)`;
    }

    update();
    window.addEventListener("resize", update);

    // ドラッグ（m単位で移動）
    d.onmousedown = e => {
      if (e.button !== 0) return;
      e.preventDefault();

      const sx = e.clientX;
      const sy = e.clientY;
      const ox = r.xM;
      const oy = r.yM;

      function move(ev) {
        r.xM = ox + (ev.clientX - sx) / scale;
        r.yM = oy + (ev.clientY - sy) / scale;
        update();
      }
      function up() {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
      }

      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    };

    // 右クリック回転
    d.oncontextmenu = e => {
      e.preventDefault();
      r.angle = (r.angle + 90) % 360;
      update();
    };
  });
}

/* ===== UI ===== */

document.getElementById("set-parking").onclick = () => {
  parking.lat1 = parseFloat(lat1.value);
  parking.lng1 = parseFloat(lng1.value);
  parking.lat2 = parseFloat(lat2.value);
  parking.lng2 = parseFloat(lng2.value);

  calcParkingSize();
  renderRods(); // ← 即時反映
};

document.getElementById("add-rod").onclick = () => {
  rods.push({
    id: "R" + (rods.length + 1),
    xM: parking.widthM / 4,
    yM: parking.heightM / 4,
    status: 0,
    angle: 0
  });
  renderRods();
};

document.getElementById("save-layout").onclick = async () => {
  const res = await fetch("/save_layout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parking, rods })
  });
  alert(res.ok ? "保存しました" : "保存失敗");
};

zoomSlider.addEventListener("input", () => {
  zoomScale = parseFloat(zoomSlider.value);
  lot.style.transform = `scale(${zoomScale})`;
});