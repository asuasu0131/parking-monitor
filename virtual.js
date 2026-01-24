const lot = document.getElementById("parking-lot");
const container = document.getElementById("parking-lot-container");
const zoomSlider = document.getElementById("zoom-slider");

let rods = [], nodes = [];
let zoomScale = 1;
let parking = { width: 200, height: 100 };
let user = { x: 10, y: 10 };
const userSpeed = 1;

const socket = io();
let userMarker = null;
let aerialImg = null;

// ===== 背景画像設定 =====
function setAerialBackground(container, parking) {
  // 常に背景画像を表示する
  const scale = Math.min(container.clientWidth / parking.width, container.clientHeight / parking.height);

  if (!aerialImg) {
    aerialImg = document.createElement("img");
    aerialImg.src = "https://github.com/asuasu0131/parking-monitor/blob/main/parking_bg.png?raw=true";
    aerialImg.alt = "Parking Background";
    Object.assign(aerialImg.style, {
      position: "absolute",
      left: "50%",
      top: "50%",
      pointerEvents: "none",
      zIndex: 0,
      display: "block",
      transform: `translate(-50%,-50%) scale(${zoomScale})`
    });
    lot.prepend(aerialImg);
    // lotのpositionをrelativeに
    lot.style.position = "relative";
  }

  aerialImg.style.width = parking.width * scale + "px";
  aerialImg.style.height = parking.height * scale + "px";
  aerialImg.style.transform = `translate(-50%,-50%) scale(${zoomScale})`;
}

// ===== layout 更新受信 =====
socket.on("layout_updated", async () => {
  console.log("レイアウト更新を受信");
  await loadLayout();
});

// ===== 仮想ノード生成 =====
function generateVirtualNodes(allNodes, step = 5) {
  const virtualNodes = [];
  allNodes.forEach(n => {
    if (n.neighbors.length === 0) return;
    n.neighbors.forEach(id => {
      const neighbor = allNodes.find(x => x.id === id);
      if (!neighbor) return;
      const dist = Math.hypot(neighbor.x - n.x, neighbor.y - n.y);
      const steps = Math.ceil(dist / step);
      for (let i = 1; i < steps; i++) {
        const x = n.x + (neighbor.x - n.x) * i / steps;
        const y = n.y + (neighbor.y - n.y) * i / steps;
        virtualNodes.push({ id: `v-${n.id}-${neighbor.id}-${i}`, x, y, neighbors: [] });
      }
      virtualNodes.push({ ...neighbor });
    });
    virtualNodes.push({ ...n });
  });

  virtualNodes.forEach(vn => {
    allNodes.concat(virtualNodes).forEach(n2 => {
      if (vn === n2) return;
      const d = Math.hypot(vn.x - n2.x, vn.y - n2.y);
      if (d < step + 0.1) {
        if (!vn.neighbors.includes(n2.id)) vn.neighbors.push(n2.id);
        if (!n2.neighbors.includes(vn.id)) n2.neighbors.push(vn.id);
      }
    });
  });

  return allNodes.concat(virtualNodes);
}

// ===== 管理者レイアウト取得 =====
async function loadLayout() {
  const res = await fetch("/parking_layout.json");
  const data = await res.json();
  if (data.parking && data.rods && data.nodes) {
    parking = data.parking;
    rods = data.rods;
    nodes = data.nodes;
  }

  if (!userMarker) {
    userMarker = document.createElement("div");
    userMarker.id = "user-marker";
    userMarker.style.position = "absolute";
    userMarker.style.width = "14px";
    userMarker.style.height = "14px";
    userMarker.style.background = "#2196f3";
    userMarker.style.borderRadius = "50%";
    userMarker.style.border = "2px solid white";
    userMarker.style.zIndex = 1001;
    lot.appendChild(userMarker);
  }

  setAerialBackground(container, parking);
  renderAll();
}

// ===== 描画 =====
function renderAll() {
  // 背景以外を削除
  document.querySelectorAll(".rod,.path-line,.parking-area,#path-svg").forEach(e => e.remove());

  const scale = Math.min(container.clientWidth / parking.width, container.clientHeight / parking.height);
  lot.style.width = parking.width * scale + "px";
  lot.style.height = parking.height * scale + "px";

  // 背景更新
  setAerialBackground(container, parking);

  // 敷地
  const parkingArea = document.createElement("div");
  parkingArea.className = "parking-area";
  parkingArea.style.position = "absolute";
  parkingArea.style.left = "0px";
  parkingArea.style.top = "0px";
  parkingArea.style.width = parking.width * scale + "px";
  parkingArea.style.height = parking.height * scale + "px";
  parkingArea.style.background = "#bfbfbf";
  parkingArea.style.border = "2px solid #000";
  parkingArea.style.zIndex = 0;
  lot.appendChild(parkingArea);

  // ロッド描画
  rods.forEach(r => {
    const d = document.createElement("div");
    d.className = "rod " + (r.status === 0 ? "empty" : "full");
    d.style.left = r.x * scale + "px";
    d.style.top = r.y * scale + "px";
    d.style.width = (r.width || 2.5) * scale + "px";
    d.style.height = (r.height || 5) * scale + "px";
    d.style.transform = `rotate(${r.angle || 0}deg)`;
    d.style.zIndex = 1;
    lot.appendChild(d);
  });

  // ユーザーマーカー
  userMarker.style.left = user.x * scale + "px";
  userMarker.style.top = user.y * scale + "px";

  // 経路探索などの既存機能は変更なし
  const allNodes = generateVirtualNodes(nodes, 5);
  const emptyRods = rods.filter(r => r.status === 0);
  let targetRod = null;
  let minDist = Infinity;

  emptyRods.forEach(r => {
    const path = findPath(user, { x: r.x, y: r.y }, allNodes);
    if (path.length > 0) {
      let dist = 0;
      for (let i = 0; i < path.length - 1; i++) {
        dist += Math.hypot(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y);
      }
      if (dist < minDist) {
        minDist = dist;
        targetRod = r;
      }
    }
  });

  if (targetRod) {
    let path = findPath(user, { x: targetRod.x, y: targetRod.y }, allNodes);
    if (path.length > 0) path.push({ x: targetRod.x, y: targetRod.y });

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.id = "path-svg";
    svg.style.position = "absolute";
    svg.style.left = "0";
    svg.style.top = "0";
    svg.style.width = "100%";
    svg.style.height = "100%";
    svg.style.pointerEvents = "none";
    svg.style.zIndex = 2;
    lot.appendChild(svg);

    let d = `M ${path[0].x*scale} ${path[0].y*scale}`;
    for (let i = 1; i < path.length; i++) d += ` L ${path[i].x*scale} ${path[i].y*scale}`;

    const pathEl = document.createElementNS("http://www.w3.org/2000/svg","path");
    pathEl.setAttribute("d", d);
    pathEl.setAttribute("stroke","#2196f3");
    pathEl.setAttribute("stroke-width","6");
    pathEl.setAttribute("fill","none");
    pathEl.setAttribute("stroke-linecap","round");
    pathEl.setAttribute("stroke-linejoin","round");
    svg.appendChild(pathEl);
  }
}

// ===== ユーザ移動 =====
document.addEventListener("keydown", e => {
  switch (e.key) {
    case "ArrowUp": user.y -= userSpeed; break;
    case "ArrowDown": user.y += userSpeed; break;
    case "ArrowLeft": user.x -= userSpeed; break;
    case "ArrowRight": user.x += userSpeed; break;
  }
  renderAll();
});

// ===== ズーム =====
zoomSlider.addEventListener("input", () => {
  zoomScale = parseFloat(zoomSlider.value);
  lot.style.transform = `scale(${zoomScale})`;
  if (aerialImg) aerialImg.style.transform = `translate(-50%,-50%) scale(${zoomScale})`;
});

// 初期化
loadLayout();

// ズームループ
(function loop() { lot.style.transform = `scale(${zoomScale})`; requestAnimationFrame(loop); })();