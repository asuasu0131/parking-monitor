const container = document.getElementById("parking-lot-container");
const lot = document.getElementById("parking-lot");
const zoomSlider = document.getElementById("zoom-slider");
let zoomScale = 1;

const socket = io();

let parking = {
  lat1: 35.0, lng1: 135.0,
  lat2: 34.999, lng2: 135.002,
  width: 0, height: 0
};

let rods = [];

// 緯度経度から駐車場のメートル寸法を計算
function calcParkingSize() {
  const latDist = (parking.lat1 - parking.lat2) * 111320;
  const lngDist = (parking.lng2 - parking.lng1) * 111320 * Math.cos((parking.lat1 + parking.lat2)/2*Math.PI/180);
  parking.width = Math.abs(lngDist);
  parking.height = Math.abs(latDist);
}

// 駐車場設定ボタン
document.getElementById("set-parking").onclick = () => {
  parking.lat1 = parseFloat(document.getElementById("lat1").value);
  parking.lng1 = parseFloat(document.getElementById("lng1").value);
  parking.lat2 = parseFloat(document.getElementById("lat2").value);
  parking.lng2 = parseFloat(document.getElementById("lng2").value);

  calcParkingSize();
  renderRods();
};

// ロッド描画
function renderRods() {
  document.querySelectorAll(".rod").forEach(e => e.remove());

  // 駐車場表示サイズ
  const scale = Math.min(container.clientWidth / parking.width, container.clientHeight / parking.height);
  lot.style.width  = parking.width * scale + "px";
  lot.style.height = parking.height * scale + "px";

  rods.forEach(r => {
    const d = document.createElement("div");
    d.className = "rod " + (r.status === 0 ? "empty" : "full");
    d.innerHTML = `${r.id}<br>${r.status === 0 ? "空き" : "使用中"}`;
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

    // ドラッグ
    d.onmousedown = (e) => {
      if (e.button !== 0) return; // 左ボタンのみ
      e.preventDefault();
      const startX = e.clientX, startY = e.clientY;
      const startLeft = r.x, startTop = r.y;

      function move(ev) {
        r.x = startLeft + (ev.clientX - startX)/scale;
        r.y = startTop  + (ev.clientY - startY)/scale;
        updatePosition();
      }
      function up() {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
      }
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    };

    // 回転: 右クリックで45°回転
    d.oncontextmenu = (e) => {
      e.preventDefault();
      r.angle = (r.angle + 45) % 360;
      updatePosition();
    };
  });
}

// ロッド追加
document.getElementById("add-rod").onclick = () => {
  rods.push({
    id: "R" + (rods.length+1),
    x: parking.width/4,
    y: parking.height/4,
    width: parking.width/20,
    height: parking.height/20,
    status: 0,
    angle: 0
  });
  renderRods();
};

// 保存
document.getElementById("save-layout").onclick = async () => {
  const res = await fetch("/save_layout", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(rods)
  });
  if(res.ok) alert("保存しました");
  else alert("保存失敗");
};

// ズーム
zoomSlider.addEventListener("input", ()=>{ zoomScale = parseFloat(zoomSlider.value); });

(function loop() {
  lot.style.transform = `scale(${zoomScale})`;
  requestAnimationFrame(loop);
})();