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

  const scale = Math.min(
    container.clientWidth / parking.width,
    container.clientHeight / parking.height
  );

  lot.style.width  = parking.width * scale + "px";
  lot.style.height = parking.height * scale + "px";

  // 🔽 ここを追加
  updateGrid(scale);

  rods.forEach(r => {
    const d = document.createElement("div");
    d.className = "rod " + (r.status===0?"empty":"full");
    d.innerHTML = `${r.id}<br>${r.status===0?"空き":"使用中"}`;
    lot.appendChild(d);

    function updatePosition() {
      d.style.left = r.x * scale + "px";
      d.style.top  = r.y * scale + "px";
      d.style.width = r.width * scale + "px";
      d.style.height = r.height * scale + "px";
      d.style.transform = `rotate(${r.angle}deg)`;
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);

    // 左ドラッグ移動
    d.onmousedown = (e) => {
      if(e.button!==0) return;
      e.preventDefault();

      const startX = e.clientX, startY = e.clientY;
      const startLeft = r.x, startTop = r.y;

      function move(ev){
        r.x = startLeft + (ev.clientX - startX)/scale;
        r.y = startTop  + (ev.clientY - startY)/scale;
        updatePosition();
      }
      function up(){
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
      }
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    };

    // 右クリック回転
    d.oncontextmenu = (e)=>{
      e.preventDefault();
      r.angle = (r.angle + 90) % 360;
      updatePosition();
    };
  });
}

function updateGrid(scale) {
  const GRID_M = 5; // 5m間隔
  const gridPx = GRID_M * scale;

  lot.style.backgroundImage = `
    linear-gradient(to right, #aaa 1px, transparent 1px),
    linear-gradient(to bottom, #aaa 1px, transparent 1px)
  `;
  lot.style.backgroundSize = `${gridPx}px ${gridPx}px`;
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