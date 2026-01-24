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

// ===== 座標変換・背景設定 =====
function latLngToPixel(lat, lng, zoom) {
  const sinLat = Math.sin(lat * Math.PI / 180);
  const x = ((lng + 180) / 360) * 256 * Math.pow(2, zoom);
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * 256 * Math.pow(2, zoom);
  return { x, y };
}

function getTileUrl(x, y, z) {
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
}

function setAerialBackground(container, parking) {
  if (!parking.lat1 || !parking.lat2 || !parking.lng1 || !parking.lng2) return;
  const zoom = 19;
  const topLeft = latLngToPixel(parking.lat1, parking.lng1, zoom);
  const bottomRight = latLngToPixel(parking.lat2, parking.lng2, zoom);
  const widthPx = Math.abs(bottomRight.x - topLeft.x);
  const heightPx = Math.abs(bottomRight.y - topLeft.y);
  container.style.backgroundImage = `url(${getTileUrl(Math.floor(topLeft.x / 256), Math.floor(topLeft.y / 256), zoom)})`;
  container.style.backgroundSize = `${widthPx}px ${heightPx}px`;
  container.style.backgroundPosition = `0px 0px`;
  container.style.backgroundRepeat = "no-repeat";
}

// layout_updated イベント受信で再ロード
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

  setAerialBackground(container, parking); // 背景設定
  renderAll();
}

// ===== A*探索 =====
function findPath(startPos, targetPos, allNodes) {
  if (allNodes.length === 0) return [];

  function nearestNode(pos) {
    return allNodes.reduce((a, b) =>
      Math.hypot(a.x - pos.x, a.y - pos.y) < Math.hypot(b.x - pos.x, b.y - pos.y) ? a : b
    );
  }

  const startNode = nearestNode(startPos);
  const endNode = nearestNode(targetPos);

  const open = [], closed = new Set(), cameFrom = {};
  const gScore = {}, fScore = {};
  allNodes.forEach(n => { gScore[n.id] = Infinity; fScore[n.id] = Infinity; });
  gScore[startNode.id] = 0;
  fScore[startNode.id] = Math.hypot(startNode.x - endNode.x, startNode.y - endNode.y);
  open.push(startNode);

  while (open.length > 0) {
    open.sort((a, b) => fScore[a.id] - fScore[b.id]);
    const current = open.shift();
    if (current.id === endNode.id) {
      const path = [current];
      while (cameFrom[path[0].id]) path.unshift(cameFrom[path[0].id]);
      return path;
    }
    closed.add(current.id);
    current.neighbors.forEach(nid => {
      if (closed.has(nid)) return;
      const neighbor = allNodes.find(x => x.id === nid);
      if (!neighbor) return;
      const tentativeG = gScore[current.id] + Math.hypot(current.x - neighbor.x, current.y - neighbor.y);
      if (tentativeG < gScore[neighbor.id]) {
        cameFrom[neighbor.id] = current;
        gScore[neighbor.id] = tentativeG;
        fScore[neighbor.id] = tentativeG + Math.hypot(neighbor.x - endNode.x, neighbor.y - endNode.y);
        if (!open.includes(neighbor)) open.push(neighbor);
      }
    });
  }

  return [];
}

// ===== 描画 =====
function renderAll() {
  document.querySelectorAll(".rod,.path-line,.parking-area").forEach(e => e.remove());

  const scale = Math.min(container.clientWidth / parking.width, container.clientHeight / parking.height);
  lot.style.width = parking.width * scale + "px";
  lot.style.height = parking.height * scale + "px";

  container.style.background = "#888";

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

  // 仮想ノード生成
  const allNodes = generateVirtualNodes(nodes, 5);

  // 最短経路計算
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
    const path = findPath(user, { x: targetRod.x, y: targetRod.y }, allNodes);
    for (let i = 0; i < path.length - 1; i++) {
      const line = document.createElement("div");
      line.className = "path-line";
      const x1 = path[i].x * scale, y1 = path[i].y * scale;
      const x2 = path[i + 1].x * scale, y2 = path[i + 1].y * scale;
      const length = Math.hypot(x2 - x1, y2 - y1);
      line.style.position = "absolute";
      line.style.left = x1 + "px"; line.style.top = y1 + "px";
      line.style.width = length + "px"; line.style.height = "3px";
      line.style.background = "#2196f3";
      line.style.transform = `rotate(${Math.atan2(y2 - y1, x2 - x1)}rad)`;
      line.style.transformOrigin = "0 0";
      line.style.zIndex = 2;
      lot.appendChild(line);
    }
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
zoomSlider.addEventListener("input", () => { zoomScale = parseFloat(zoomSlider.value); });

// 初期化
loadLayout();

// ズームループ
(function loop() { lot.style.transform = `scale(${zoomScale})`; requestAnimationFrame(loop); })();