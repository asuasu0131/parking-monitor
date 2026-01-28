const lot = document.getElementById("parking-lot");
const container = document.getElementById("parking-lot-container");
const zoomSlider = document.getElementById("zoom-slider");

let rods = [], nodes = [], links = [];
let parking = { width: 200, height: 100 };
let user = { x: parking.width - 15, y: 15 };
let selectedRod = null;

const socket = io();
let userMarker = null;
let aerialImg = null;

/* ===============================
   ズーム＆パン用状態
================================ */
let zoomScale = 1;
let panX = 0;
let panY = 0;
let isPanning = false;
let panStart = { x: 0, y: 0 };

lot.style.transformOrigin = "0 0";

/* ===============================
   transform 更新
================================ */
function updateTransform() {
  lot.style.transform =
    `translate(${panX}px, ${panY}px) scale(${zoomScale})`;
}

/* ===============================
   背景設定
================================ */
function setAerialBackground() {
  if (!parking.width || !parking.height) return;
  if (aerialImg) aerialImg.remove();

  const scale = Math.min(
    container.clientWidth / parking.width,
    container.clientHeight / parking.height
  );

  aerialImg = document.createElement("img");
  aerialImg.src =
    "https://github.com/asuasu0131/parking-monitor/blob/main/center.png?raw=true";
  aerialImg.alt = "Parking Background";

  Object.assign(aerialImg.style, {
    position: "absolute",
    left: "0",
    top: "0",
    width: parking.width * scale + "px",
    height: parking.height * scale + "px",
    pointerEvents: "none",
    zIndex: -1
  });

  lot.prepend(aerialImg);
  lot.style.position = "relative";
}

/* ===============================
   仮想ノード生成
================================ */
function generateVirtualNodes(allNodes, step = 5) {
  const virtualNodes = [];

  allNodes.forEach(n => {
    n.neighbors.forEach(id => {
      const nb = allNodes.find(x => x.id === id);
      if (!nb) return;
      const dist = Math.hypot(nb.x - n.x, nb.y - n.y);
      const steps = Math.ceil(dist / step);
      for (let i = 1; i < steps; i++) {
        virtualNodes.push({
          id: `v-${n.id}-${id}-${i}`,
          x: n.x + (nb.x - n.x) * i / steps,
          y: n.y + (nb.y - n.y) * i / steps,
          neighbors: []
        });
      }
    });
  });

  const all = allNodes.concat(virtualNodes);
  all.forEach(a => {
    all.forEach(b => {
      if (a === b) return;
      if (Math.hypot(a.x - b.x, a.y - b.y) < step + 0.1) {
        a.neighbors ||= [];
        if (!a.neighbors.includes(b.id)) a.neighbors.push(b.id);
      }
    });
  });

  return all;
}

// ===== A*探索 =====
function findPath(startPos, targetPos, allNodes) {
  if (allNodes.length === 0) return [];

  const nearestNode = pos =>
    allNodes.reduce((a,b)=>
      Math.hypot(a.x-pos.x,a.y-pos.y) <
      Math.hypot(b.x-pos.x,b.y-pos.y) ? a : b
    );

  const startNode = nearestNode(startPos);
  const endNode   = nearestNode(targetPos);

  const open=[], closed=new Set(), cameFrom={}, gScore={}, fScore={};
  allNodes.forEach(n=>{
    gScore[n.id]=Infinity;
    fScore[n.id]=Infinity;
  });

  gScore[startNode.id]=0;
  fScore[startNode.id]=Math.hypot(
    startNode.x-endNode.x,
    startNode.y-endNode.y
  );

  open.push(startNode);

  while(open.length>0){
    open.sort((a,b)=>fScore[a.id]-fScore[b.id]);
    const current = open.shift();

    if(current.id===endNode.id){
      const path=[current];
      while(cameFrom[path[0].id])
        path.unshift(cameFrom[path[0].id]);
      return path;
    }

    closed.add(current.id);

    current.neighbors.forEach(nid=>{
      if(closed.has(nid)) return;
      const neighbor = allNodes.find(x=>x.id===nid);
      if(!neighbor) return;

      const tentativeG =
        gScore[current.id] +
        Math.hypot(current.x-neighbor.x,current.y-neighbor.y);

      if(tentativeG < gScore[neighbor.id]){
        cameFrom[neighbor.id]=current;
        gScore[neighbor.id]=tentativeG;
        fScore[neighbor.id]=tentativeG +
          Math.hypot(neighbor.x-endNode.x, neighbor.y-endNode.y);

        if(!open.includes(neighbor))
          open.push(neighbor);
      }
    });
  }
  return [];
}

/* ===============================
   レイアウト取得
================================ */
async function loadLayout() {
  const res = await fetch("/parking_layout.json");
  const data = await res.json();

  parking = data.parking;
  rods = data.rods;
  nodes = data.nodes;
  links = data.links;

  if (!userMarker) {
    userMarker = document.createElement("div");
    userMarker.id = "user-marker";
    Object.assign(userMarker.style, {
      position: "absolute",
      width: "14px",
      height: "14px",
      background: "#2196f3",
      borderRadius: "50%",
      border: "2px solid white",
      zIndex: 1001
    });
    lot.appendChild(userMarker);
  }

  setAerialBackground();
  renderAll();
}

socket.on("layout_updated", loadLayout);

/* ===============================
   描画
================================ */
function renderAll() {
  lot.querySelectorAll(".rod,.parking-area,#path-svg").forEach(e => e.remove());

  const scale = Math.min(
    container.clientWidth / parking.width,
    container.clientHeight / parking.height
  );

  lot.style.width = parking.width * scale + "px";
  lot.style.height = parking.height * scale + "px";

  // 敷地
  const area = document.createElement("div");
  Object.assign(area.style, {
    position: "absolute",
    left: 0,
    top: 0,
    width: parking.width * scale + "px",
    height: parking.height * scale + "px",
    border: "2px solid black",
    zIndex: 1
  });
  lot.appendChild(area);

  // ロッド
  rods.forEach(r => {
    const d = document.createElement("div");
    d.className = "rod";
    Object.assign(d.style, {
      position: "absolute",
      left: r.x * scale + "px",
      top: r.y * scale + "px",
      width: (r.width || 2.5) * scale + "px",
      height: (r.height || 5) * scale + "px",
      background: r.status === 0 ? "#88ff00" : "#ff4040",
      transform: `rotate(${r.angle || 0}deg)`,
      border: selectedRod?.id === r.id ? "3px solid orange" : "1px solid #555",
      cursor: "pointer",
      zIndex: 2
    });
    d.onclick = () => {
      if (r.status !== 0) return;

      selectedRod = r;

      // ★ 仮想ノード生成
      const all = generateVirtualNodes(nodes);

      // ★ 経路探索
      const path = findPath(
        user,
        { x: r.x + r.width/2, y: r.y + r.height/2 },
        all
      );

      drawPath(path); // ← 次で説明
      renderAll();
    };
    lot.appendChild(d);
  });

  // ユーザ
  userMarker.style.left = user.x * scale + "px";
  userMarker.style.top = user.y * scale + "px";
}

function drawPath(path) {
  lot.querySelector("#path-svg")?.remove();
  if (!path || path.length === 0) return;

  const scale = Math.min(
    container.clientWidth / parking.width,
    container.clientHeight / parking.height
  );

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.id = "path-svg";
  svg.setAttribute("width", parking.width * scale);
  svg.setAttribute("height", parking.height * scale);
  svg.style.position = "absolute";
  svg.style.left = 0;
  svg.style.top = 0;
  svg.style.zIndex = 1000;
  svg.style.pointerEvents = "none";

  const poly = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  poly.setAttribute(
    "points",
    path.map(p => `${p.x*scale},${p.y*scale}`).join(" ")
  );
  poly.setAttribute("fill", "none");
  poly.setAttribute("stroke", "yellow");   // ★ 指定通り黄色
  poly.setAttribute("stroke-width", 4);

  svg.appendChild(poly);
  lot.appendChild(svg);
}

/* ===============================
   ズーム
================================ */
zoomSlider.addEventListener("input", () => {
  zoomScale = parseFloat(zoomSlider.value);
  updateTransform();
});

/* ===============================
   パン（ドラッグ移動）
================================ */
container.addEventListener("mousedown", e => {
  isPanning = true;
  panStart.x = e.clientX - panX;
  panStart.y = e.clientY - panY;
  container.style.cursor = "grabbing";
});

document.addEventListener("mousemove", e => {
  if (!isPanning) return;
  panX = e.clientX - panStart.x;
  panY = e.clientY - panStart.y;
  updateTransform();
});

document.addEventListener("mouseup", () => {
  isPanning = false;
  container.style.cursor = "default";
});

/* ===============================
   タッチ対応（スマホ）
================================ */
container.addEventListener("touchstart", e => {
  if (e.touches.length !== 1) return;
  isPanning = true;
  panStart.x = e.touches[0].clientX - panX;
  panStart.y = e.touches[0].clientY - panY;
});

container.addEventListener("touchmove", e => {
  if (!isPanning) return;
  panX = e.touches[0].clientX - panStart.x;
  panY = e.touches[0].clientY - panStart.y;
  updateTransform();
});

container.addEventListener("touchend", () => {
  isPanning = false;
});

/* ===============================
   初期化
================================ */
loadLayout();
updateTransform();