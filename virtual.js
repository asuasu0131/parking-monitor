const lot = document.getElementById("parking-lot");
const container = document.getElementById("parking-lot-container");
const zoomSlider = document.getElementById("zoom-slider");
let zoomScale = parseFloat(zoomSlider.value);

let rods = [];
let roads = [];
let nodes = [];
let path = [];
let currentStep = 0;

// ===== Socket.IO =====
const socket = io();

// ===== JSONロード =====
async function loadLayout() {
  const res = await fetch("/parking_layout.json");
  const data = await res.json();
  rods = data.rods || [];
  roads = data.roads || [];

  document.querySelectorAll(".road").forEach(e => e.remove());
  roads.forEach(r => {
    lot.appendChild(r.element = document.createElement("div"));
    r.element.className = "road";
    r.element.style.left = r.x + "px";
    r.element.style.top = r.y + "px";
    r.element.style.width = r.w + "px";
    r.element.style.height = r.h + "px";
    r.element.style.background = "rgba(200,200,200,0.5)";
    r.element.style.border = "1px dashed #888";
    r.element.style.position = "absolute";
  });

  renderRods();
  buildGraph();    // 通路ノード作成
  findPath();      // 初期最短経路探索
}

// ===== 描画 =====
function renderRods() {
  document.querySelectorAll(".rod").forEach(e => e.remove());
  rods.forEach(r => {
    const d = document.createElement("div");
    d.className = "rod " + (r.status === 0 ? "empty" : "full");
    d.innerHTML = `${r.id}<br>${r.status === 0 ? "空き" : "使用中"}`;
    d.style.left = r.x + "px";
    d.style.top = r.y + "px";
    lot.appendChild(d);
    r.element = d;
  });
}

// ===== ユーザー座標 =====
function userX() { return container.clientWidth / 2; }
function userY() { return container.clientHeight / 2; }

// ===== グラフノード作成 =====
class Node {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.neighbors = [];
  }
}

function buildGraph() {
  nodes = [];
  const step = 20; // ノード間隔
  roads.forEach(r => {
    for (let i = r.x; i <= r.x + r.w; i += step) {
      for (let j = r.y; j <= r.y + r.h; j += step) {
        nodes.push(new Node(i, j));
      }
    }
  });

  // 隣接ノードを接続（上下左右）
  nodes.forEach(n => {
    nodes.forEach(m => {
      if (n === m) return;
      const dx = Math.abs(n.x - m.x);
      const dy = Math.abs(n.y - m.y);
      if ((dx === step && dy === 0) || (dx === 0 && dy === step)) {
        n.neighbors.push(m);
      }
    });
  });
}

// ===== A* 最短経路 =====
function astar(start, goals, allNodes) {
  const openSet = [start];
  const cameFrom = new Map();
  const gScore = new Map();
  gScore.set(start, 0);

  function h(n) {
    return Math.min(...goals.map(g => Math.hypot(n.x - g.x, n.y - g.y)));
  }

  while (openSet.length) {
    openSet.sort((a, b) => (gScore.get(a) + h(a)) - (gScore.get(b) + h(b)));
    const current = openSet.shift();
    if (goals.some(g => g.x === current.x && g.y === current.y)) {
      const path = [current];
      let c = current;
      while (cameFrom.has(c)) {
        c = cameFrom.get(c);
        path.push(c);
      }
      return path.reverse();
    }

    current.neighbors.forEach(n => {
      const tentative = gScore.get(current) + Math.hypot(n.x - current.x, n.y - current.y);
      if (tentative < (gScore.get(n) || Infinity)) {
        cameFrom.set(n, current);
        gScore.set(n, tentative);
        if (!openSet.includes(n)) openSet.push(n);
      }
    });
  }
  return null; // 見つからない
}

// ===== 最短経路計算 =====
function findPath() {
  const startNode = new Node(userX(), userY());
  const goalNodes = rods.filter(r => r.status === 0).map(r => new Node(r.x, r.y));
  if (goalNodes.length === 0) return;

  // 既存ノードに接続
  nodes.push(startNode);
  nodes.forEach(n => {
    if (Math.hypot(n.x - startNode.x, n.y - startNode.y) <= 20) {
      startNode.neighbors.push(n);
      n.neighbors.push(startNode);
    }
  });

  path = astar(startNode, goalNodes, nodes) || [];
  currentStep = 0;
}

// ===== 矢印更新 =====
function updateArrow() {
  if (!path || path.length < 2) return;
  const next = path[1];
  const dx = next.x - userX();
  const dy = next.y - userY();
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  document.getElementById("heading-arrow").style.transform = `translate(-50%,-50%) rotate(${angle}deg)`;
}

// ===== ループ =====
(function loop() {
  renderRods();
  updateArrow();
  lot.style.transform = `scale(${zoomScale})`;
  requestAnimationFrame(loop);
})();

// ===== ズーム =====
zoomSlider.addEventListener("input", () => { zoomScale = parseFloat(zoomSlider.value); });

// ===== Socket.IO 更新 =====
socket.on("layout_updated", loadLayout);

// ===== 初期ロード =====
loadLayout();