const lot = document.getElementById("parking-lot");
const container = document.getElementById("parking-lot-container");
const zoomSlider = document.getElementById("zoom-slider");

let rods = [], nodes = [];
let zoomScale = 1;
let parking = { width: 200, height: 100 };
let user = { x: 10, y: 10 }; // 初期位置
const userSpeed = 1; // 1m/キー押下

const socket = io();
let userMarker = null;

// 管理者レイアウト取得
async function loadLayout() {
  const res = await fetch("/parking_layout.json");
  const data = await res.json();
  if (data.parking && data.rods && data.nodes) {
    parking = data.parking;
    rods = data.rods;
    nodes = data.nodes;
  } else {
    rods = data;
    parking = { width: 200, height: 100 };
    nodes = [];
  }
  renderAll();
}

// ===== A*探索 =====
function findPath(startPos, targetPos, allNodes) {
  if (allNodes.length === 0) return [];

  function nearestNode(pos) {
    return allNodes.reduce((a, b) => {
      return Math.hypot(a.x - pos.x, a.y - pos.y) < Math.hypot(b.x - pos.x, b.y - pos.y) ? a : b;
    });
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
  // 前回描画を削除（ロッドと青線のみ。ユーザマーカーは位置更新で対応）
  document.querySelectorAll(".rod,.path-line,.parking-area").forEach(e => e.remove());

  const scale = Math.min(container.clientWidth / parking.width, container.clientHeight / parking.height);
  lot.style.width = parking.width * scale + "px";
  lot.style.height = parking.height * scale + "px";

  // container背景
  container.style.background = "#888";

  // 敷地内
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

  // 仮想ノード生成（線だけの場合でも経路探索可能）
  const virtualNodes = [];
  nodes.forEach(n => {
    if (n.neighbors.length === 0) return;
    n.neighbors.forEach(id => {
      const neighbor = nodes.find(x => x.id === id);
      if (!neighbor) return;
      const dist = Math.hypot(neighbor.x - n.x, neighbor.y - n.y);
      const steps = Math.ceil(dist / 5); // 5m間隔
      for (let i = 1; i < steps; i++) {
        const x = n.x + (neighbor.x - n.x) * i / steps;
        const y = n.y + (neighbor.y - n.y) * i / steps;
        virtualNodes.push({ id: `v-${n.id}-${neighbor.id}-${i}`, x, y, neighbors: [] });
      }
      virtualNodes.push({ ...neighbor });
    });
    virtualNodes.push({ ...n });
  });

  const allNodes = nodes.concat(virtualNodes);

  // 仮想ノード間の接続
  nodes.forEach(n => {
    n.neighbors.forEach(id => {
      const neighbor = nodes.find(x => x.id === id);
      if (!neighbor) return;
      const vn1 = allNodes.find(v => v.x === n.x && v.y === n.y);
      const vn2 = allNodes.find(v => v.x === neighbor.x && v.y === neighbor.y);
      if (vn1 && vn2 && !vn1.neighbors.includes(vn2.id)) vn1.neighbors.push(vn2.id);
      if (vn2 && !vn2.neighbors.includes(vn1.id)) vn2.neighbors.push(vn1.id);
    });
  });

  // ===== ユーザマーカー =====
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
  userMarker.style.left = user.x * scale - 7 + "px";
  userMarker.style.top = user.y * scale - 7 + "px";

  // ===== 最短経路（空きロッドまで） =====
  document.querySelectorAll(".path-line").forEach(e => e.remove());
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
      line.style.left = x1 + "px";
      line.style.top = y1 + "px";
      line.style.width = length + "px";
      line.style.height = "3px";
      line.style.background = "#2196f3"; // 青
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

// ズーム
zoomSlider.addEventListener("input", () => { zoomScale = parseFloat(zoomSlider.value); });

// 初期化
loadLayout();

// ===== ズームループ =====
(function loop() { lot.style.transform = `scale(${zoomScale})`; requestAnimationFrame(loop); })();