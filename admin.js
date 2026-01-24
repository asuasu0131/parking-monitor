const container = document.getElementById("parking-lot-container");
const lot = document.getElementById("parking-lot");
const zoomSlider = document.getElementById("zoom-slider");

const socket = io();

let zoomScale = 1;

// ===== 現実サイズ =====
const ROD_WIDTH_M  = 2.5;
const ROD_HEIGHT_M = 5.0;
const GRID_M = 5;

// ===== 駐車場情報 =====
let parking = {
  lat1:35.0, lng1:135.0,
  lat2:34.999, lng2:135.002,
  width:0,
  height:0
};

let rods = [];

// ===== 緯度経度 → m換算 =====
function calcParkingSize() {
  const latDist = (parking.lat1 - parking.lat2) * 111320;
  const lngDist =
    (parking.lng2 - parking.lng1) *
    111320 *
    Math.cos((parking.lat1 + parking.lat2) / 2 * Math.PI / 180);

  parking.width  = Math.abs(lngDist);
  parking.height = Math.abs(latDist);
}

// ===== グリッド描画 =====
function updateGrid(scale) {
  const gridPx = GRID_M * scale;
  lot.style.backgroundImage = `
    linear-gradient(to right, #aaa 1px, transparent 1px),
    linear-gradient(to bottom, #aaa 1px, transparent 1px)
  `;
  lot.style.backgroundSize = `${gridPx}px ${gridPx}px`;
}

// ===== 描画 =====
function render() {
  document.querySelectorAll(".rod").forEach(e=>e.remove());

  const scale = Math.min(
    container.clientWidth  / parking.width,
    container.clientHeight / parking.height
  );

  lot.style.width  = parking.width  * scale + "px";
  lot.style.height = parking.height * scale + "px";

  updateGrid(scale);

  rods.forEach(r=>{
    const d = document.createElement("div");
    d.className = "rod " + (r.status===0?"empty":"full");
    d.textContent = r.id;
    lot.appendChild(d);

    function updatePos(){
      d.style.left   = r.x * scale + "px";
      d.style.top    = r.y * scale + "px";
      d.style.width  = r.width  * scale + "px";
      d.style.height = r.height * scale + "px";
      d.style.transform = `rotate(${r.angle}deg)`;
    }

    updatePos();

    // 左ドラッグ移動
    d.onmousedown = e=>{
      if(e.button!==0) return;
      e.preventDefault();

      const sx = e.clientX, sy = e.clientY;
      const ox = r.x, oy = r.y;

      function move(ev){
        r.x = ox + (ev.clientX - sx) / scale;
        r.y = oy + (ev.clientY - sy) / scale;
        updatePos();
      }
      function up(){
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
      }
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    };

    // 右クリック回転
    d.oncontextmenu = e=>{
      e.preventDefault();
      r.angle = (r.angle + 90) % 360;
      updatePos();
    };
  });
}

// ===== イベント =====
document.getElementById("set-parking").onclick = ()=>{
  parking.lat1 = parseFloat(lat1.value);
  parking.lng1 = parseFloat(lng1.value);
  parking.lat2 = parseFloat(lat2.value);
  parking.lng2 = parseFloat(lng2.value);

  calcParkingSize();
  render();
};

document.getElementById("add-rod").onclick = ()=>{
  rods.push({
    id:"R"+(rods.length+1),
    x:parking.width/4,
    y:parking.height/4,
    width:ROD_WIDTH_M,
    height:ROD_HEIGHT_M,
    status:0,
    angle:0
  });
  render();
};

document.getElementById("save-layout").onclick = async () => {
  const data = {
    parking: {
      width: parking.width,
      height: parking.height
    },
    rods: rods
  };

  const res = await fetch("/save_layout", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(data)
  });

  if(res.ok) alert("保存しました");
};

zoomSlider.oninput = ()=>{
  zoomScale = parseFloat(zoomSlider.value);
};

// ===== ズームループ =====
(function loop(){
  lot.style.transform = `scale(${zoomScale})`;
  requestAnimationFrame(loop);
})();

// 初期化
calcParkingSize();
render();