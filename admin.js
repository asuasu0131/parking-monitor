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
let parking = { lat1:38.16686, lng1:140.86395, lat2:38.16616, lng2:140.86528, width:0, height:0 };
let rods = [];
let nodes = [];     // {id, x, y, radius, neighbors: []}

// ===== リンク（線）管理 =====
let links = [];     // {from: "N1", to:"N2"}

// 選択中ノード（線を引く開始点）
let selectedNodeForLink = null;

// ===== 背景画像 =====
let aerialImg = null;

// ===== 緯度経度 → m換算 =====
function calcParkingSize() {
  const latDist = (parking.lat1 - parking.lat2) * 111320;
  const lngDist = (parking.lng2 - parking.lng1) * 111320 *
    Math.cos((parking.lat1 + parking.lat2) / 2 * Math.PI / 180);
  parking.width  = Math.abs(lngDist);
  parking.height = Math.abs(latDist);
}

// ===== 背景画像設定 =====
function setAerialBackground() {
  if (!parking.width || !parking.height) return;
  if (aerialImg) aerialImg.remove();

  aerialImg = document.createElement("img");
  aerialImg.src = "https://github.com/asuasu0131/parking-monitor/blob/main/parking_bg.png?raw=true";
  aerialImg.alt = "Parking Background";
  Object.assign(aerialImg.style, {
    position:"absolute", left:"50%", top:"50%",
    pointerEvents:"none", zIndex:0, display:"block",
    maxWidth:"none", maxHeight:"none"
  });

  const scale = Math.min(container.clientWidth / parking.width, container.clientHeight / parking.height);
  aerialImg.style.width  = parking.width * scale + "px";
  aerialImg.style.height = parking.height * scale + "px";
  aerialImg.style.transform = `translate(-50%, -50%) scale(${zoomScale})`;

  lot.prepend(aerialImg);
  lot.style.position = "relative";
}

// ===== 描画 =====
function render() {
  lot.querySelectorAll(".rod,.node,.parking-area,.link-line").forEach(e=>e.remove());

  const scale = Math.min(container.clientWidth / parking.width, container.clientHeight / parking.height);
  lot.style.width  = parking.width * scale + "px";
  lot.style.height = parking.height * scale + "px";

// ---- 敷地グリッド（背景画像付き） ----
  const area = document.createElement("div");
  area.className = "parking-area";
  Object.assign(area.style, {
    position:"absolute",
    width: parking.width * scale + "px",
    height: parking.height * scale + "px",
    border: "2px solid #000",
    zIndex:1,
    backgroundImage: `
      url(${aerialImg.src}),
      linear-gradient(to right, rgba(255,255,255,0.2) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255,255,255,0.2) 1px, transparent 1px)
    `,
    backgroundSize: `${GRID_M*scale}px ${GRID_M*scale}px, ${GRID_M*scale}px ${GRID_M*scale}px, ${GRID_M*scale}px ${GRID_M*scale}px`,
    backgroundRepeat: "no-repeat, repeat, repeat",
    backgroundPosition: "top left, top left, top left",
    backgroundColor: "transparent"
  });
+lot.appendChild(area);

  // ---- ロッド ----
  rods.forEach(r => {
    const d = document.createElement("div");
    d.className = "rod " + (r.status===0 ? "empty" : "full");
    d.textContent = r.id;
    d.style.zIndex = 2;
    lot.appendChild(d);

    const updateRod = ()=>{
      Object.assign(d.style, {
        left: r.x * scale + "px",
        top:  r.y * scale + "px",
        width: r.width * scale + "px",
        height:r.height* scale + "px",
        transform:`rotate(${r.angle}deg)`
      });
    };
    updateRod();

    // 移動
    d.onmousedown = e => {
      e.preventDefault();
      const sx=e.clientX, sy=e.clientY, ox=r.x, oy=r.y;
      const move = ev=>{
        r.x = ox + (ev.clientX - sx)/scale;
        r.y = oy + (ev.clientY - sy)/scale;
        updateRod();
      };
      const up = ()=>{
        document.removeEventListener("mousemove",move);
        document.removeEventListener("mouseup",up);
      };
      document.addEventListener("mousemove",move);
      document.addEventListener("mouseup",up);
    };

    // 右クリック回転
    d.oncontextmenu = e => {
      e.preventDefault();
      r.angle = (r.angle+90)%360;
      updateRod();
    };
  });

  // ---- ノード ----
  nodes.forEach(n => {
    const d = document.createElement("div");
    d.className = "node";
    d.textContent = n.id;
    d.style.zIndex = 3;
    lot.appendChild(d);

    const updateNode = ()=>{
      const size = n.radius * 2 * scale;
      Object.assign(d.style, {
        left: (n.x*scale - size/2) + "px",
        top:  (n.y*scale - size/2) + "px",
        width: size + "px",
        height:size + "px"
      });
    };
    updateNode();

    // クリックで線を引くモード
    d.onclick = e => {
      if (e.shiftKey) {
        if (!selectedNodeForLink) {
          selectedNodeForLink = n;
          d.style.border="2px dashed yellow";
        } else if (selectedNodeForLink!==n) {
          const a = selectedNodeForLink, b = n;
          if (!a.neighbors.includes(b.id)) a.neighbors.push(b.id);
          if (!b.neighbors.includes(a.id)) b.neighbors.push(a.id);
          links.push({ from:a.id, to:b.id });
          selectedNodeForLink = null;
        }
        render();  // 線を更新
        return;
      }
    };

    // ドラッグ移動
    d.onmousedown = e => {
      e.preventDefault();
      const sx=e.clientX, sy=e.clientY, ox=n.x, oy=n.y;
      const move = ev=>{
        n.x = ox + (ev.clientX - sx)/scale;
        n.y = oy + (ev.clientY - sy)/scale;
        updateNode();
        render(); // 線を更新
      };
      const up = ()=>{
        document.removeEventListener("mousemove",move);
        document.removeEventListener("mouseup",up);
      };
      document.addEventListener("mousemove",move);
      document.addEventListener("mouseup",up);
    };

  });

// ---- 線（リンク） ----
links.forEach((link, index) => {
  const n1 = nodes.find(x => x.id === link.from);
  const n2 = nodes.find(x => x.id === link.to);
  if (!n1 || !n2) return;

  const line = document.createElement("div");
  line.className = "link-line";

  const x1 = n1.x * scale, y1 = n1.y * scale;
  const x2 = n2.x * scale, y2 = n2.y * scale;
  const length = Math.hypot(x2 - x1, y2 - y1);

  Object.assign(line.style, {
    position: "absolute",
    left: x1 + "px",
    top: y1 + "px",
    width: length + "px",
    height: "3px",
    background: "#0000ff",
    transform: `rotate(${Math.atan2(y2 - y1, x2 - x1)}rad)`,
    transformOrigin: "0 0",
    zIndex: 2,
    cursor: "pointer"
  });

  // ---- 線削除イベント ----
  line.onclick = e => {
    if (e.ctrlKey) { // Ctrlキーを押しながらクリックで削除
      links.splice(index, 1);
      // 双方向 neighbors も削除
      n1.neighbors = n1.neighbors.filter(id => id !== n2.id);
      n2.neighbors = n2.neighbors.filter(id => id !== n1.id);
      render();
    }
  };

  lot.appendChild(line);
});
}

// ===== イベント =====
document.getElementById("set-parking").onclick = ()=>{
  parking.lat1 = +lat1.value;
  parking.lng1 = +lng1.value;
  parking.lat2 = +lat2.value;
  parking.lng2 = +lng2.value;
  calcParkingSize();
  setAerialBackground();
  render();
};

document.getElementById("add-rod").onclick = ()=>{
  rods.push({
    id:"R"+(rods.length+1),
    x:parking.width/4,
    y:parking.height/4,
    width:ROD_WIDTH_M,
    height:ROD_HEIGHT_M,
    status:0, angle:0
  });
  render();
};

document.getElementById("add-node").onclick = ()=>{
  nodes.push({ id:"N"+(nodes.length+1), x:parking.width/2, y:parking.height/2, radius:1.0, neighbors:[] });
  render();
};

document.getElementById("save-layout").onclick = async ()=>{
  try {
    const layout = { parking, rods, nodes, links };
    const res = await fetch("/save_layout", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(layout)
    });
    const data = await res.json();
    alert(data.status==="ok"? "保存しました":"保存失敗");
    socket.emit("layout_updated");
  } catch(e){ console.error(e); alert("保存エラー"); }
};

zoomSlider.oninput = ()=>{
  zoomScale = parseFloat(zoomSlider.value);
  if (aerialImg) aerialImg.style.transform = `translate(-50%,-50%) scale(${zoomScale})`;
  lot.style.transform = `scale(${zoomScale})`;
};

// 初期表示
calcParkingSize();
setAerialBackground();
render();