const lot = document.getElementById("parking-lot");
const container = document.getElementById("parking-lot-container");
const zoomSlider = document.getElementById("zoom-slider");

let rods = [], nodes = [], links = [];
let zoomScale = 1;
let parking = { width: 200, height: 100 };
let user = { x: parking.width - 15, y: 15 };
let selectedRod = null;

const socket = io();
let userMarker = null;
let aerialImg = null;

// ===== 背景設定 =====
function setAerialBackground() {
  if (!parking.width || !parking.height) return;
  if (aerialImg) aerialImg.remove();

  const scale = Math.min(container.clientWidth / parking.width, container.clientHeight / parking.height);
  aerialImg = document.createElement("img");
  //aerialImg.src = "https://github.com/asuasu0131/parking-monitor/blob/main/parking_bg.png?raw=true";
  aerialImg.alt = "Parking Background";
  Object.assign(aerialImg.style, {
    position: "absolute",
    left: "0",
    top: "0",
    width: parking.width * scale + "px",
    height: parking.height * scale + "px",
    pointerEvents: "none",
    zIndex: -1,
    objectFit: "cover"
  });
  lot.insertBefore(aerialImg, lot.firstChild);
  lot.style.position = "relative";
}

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

// ===== 管理者レイアウト取得・同期 =====
async function loadLayout() {
  const res = await fetch("/parking_layout.json");
  const data = await res.json();
  if (data.parking && data.rods && data.nodes && data.links) {
    parking = data.parking;
    rods = data.rods;
    nodes = data.nodes;
    links = data.links;
  }

  if (!userMarker) {
    userMarker = document.createElement("div");
    userMarker.id = "user-marker";
    Object.assign(userMarker.style,{
      position:"absolute", width:"14px", height:"14px",
      background:"#2196f3", borderRadius:"50%",
      border:"2px solid white", zIndex:1001
    });
    lot.appendChild(userMarker);
  }

  setAerialBackground();

  user.x = parking.width - 15;
  user.y = 15;

  renderAll();
}

socket.on("sensor_update", data => {
  rods.forEach(r => {
    if (r.id === "R1") r.status = data.R1;
    if (r.id === "R2") r.status = data.R2;
  });
  renderAll();
});

// ===== layout_updated イベント受信 =====
socket.on("layout_updated", async () => {
  console.log("管理者レイアウト更新を受信");
  await loadLayout();
});

// ===== A*探索 =====
function findPath(startPos, targetPos, allNodes) {
  if (allNodes.length === 0) return [];

  const nearestNode = pos => allNodes.reduce((a,b)=>Math.hypot(a.x-pos.x,a.y-pos.y)<Math.hypot(b.x-pos.x,b.y-pos.y)?a:b);

  const startNode = nearestNode(startPos);
  const endNode = nearestNode(targetPos);

  const open=[], closed=new Set(), cameFrom={}, gScore={}, fScore={};
  allNodes.forEach(n=>{ gScore[n.id]=Infinity; fScore[n.id]=Infinity; });
  gScore[startNode.id]=0;
  fScore[startNode.id]=Math.hypot(startNode.x-endNode.x,startNode.y-endNode.y);
  open.push(startNode);

  while(open.length>0){
    open.sort((a,b)=>fScore[a.id]-fScore[b.id]);
    const current = open.shift();
    if(current.id===endNode.id){
      const path = [current];
      while(cameFrom[path[0].id]) path.unshift(cameFrom[path[0].id]);
      return path;
    }
    closed.add(current.id);
    current.neighbors.forEach(nid=>{
      if(closed.has(nid)) return;
      const neighbor = allNodes.find(x=>x.id===nid);
      if(!neighbor) return;
      const tentativeG = gScore[current.id] + Math.hypot(current.x-neighbor.x,current.y-neighbor.y);
      if(tentativeG < gScore[neighbor.id]){
        cameFrom[neighbor.id]=current;
        gScore[neighbor.id]=tentativeG;
        fScore[neighbor.id]=tentativeG + Math.hypot(neighbor.x-endNode.x, neighbor.y-endNode.y);
        if(!open.includes(neighbor)) open.push(neighbor);
      }
    });
  }
  return [];
}

// ===== 描画 =====
function renderAll() {
  document.querySelectorAll(".rod,.path-line,.parking-area,#path-svg").forEach(e=>e.remove());

  const scale = Math.min(container.clientWidth / parking.width, container.clientHeight / parking.height);
  lot.style.width = parking.width*scale + "px";
  lot.style.height = parking.height*scale + "px";

  // 敷地
  const parkingArea = document.createElement("div");
  parkingArea.className="parking-area";
  Object.assign(parkingArea.style,{
    position:"absolute", left:"0px", top:"0px",
    width:parking.width*scale+"px", height:parking.height*scale+"px",
    background:"transparent", border:"2px solid #000", zIndex:1
  });
  lot.appendChild(parkingArea);

  // ロッド描画
  rods.forEach(r=>{
    const d = document.createElement("div");
    d.className="rod " + (r.status===0?"empty":"full");

    if(selectedRod && selectedRod.id === r.id){
      Object.assign(d.style,{ border: "3px solid #f57c00" });
    } else {
      Object.assign(d.style,{ border: r.status===0 ? "1px solid #555" : "1px solid #999" });
    }

    Object.assign(d.style,{
      left: r.x*scale+"px",
      top: r.y*scale+"px",
      width: (r.width||2.5)*scale+"px",
      height: (r.height||5)*scale+"px",
      transform:`rotate(${r.angle||0}deg)`,
      background: r.status===0 ? "#88ff00ff" : "#ff0404ff",
      zIndex:1,
      cursor:"pointer"
    });

    lot.appendChild(d);

    d.onclick = ()=>{
      if(r.status===0){
        selectedRod = r;
        renderAll();
      }
    };
  });

  // ユーザマーカー
  userMarker.style.left = user.x*scale+"px";
  userMarker.style.top = user.y*scale+"px";

  // 経路描画
  const allNodes = generateVirtualNodes(nodes,2);
  let targetRod = null;
  let targetNode = null;

  if(selectedRod){
    targetRod = selectedRod;
    targetNode = allNodes.reduce((a,b)=>{
      const da = Math.hypot(a.x-(targetRod.x+(targetRod.width||2.5)/2), a.y-(targetRod.y+(targetRod.height||5)/2));
      const db = Math.hypot(b.x-(targetRod.x+(targetRod.width||2.5)/2), b.y-(targetRod.y+(targetRod.height||5)/2));
      return da<db?a:b;
    });
  } else {
    let minDist = Infinity;
    const emptyRods = rods.filter(r=>r.status===0);
    emptyRods.forEach(r=>{
      const nearestNode = allNodes.reduce((a,b)=>{
        const da = Math.hypot(a.x-r.x,a.y-r.y);
        const db = Math.hypot(b.x-r.x,b.y-r.y);
        return da<db?a:b;
      });
      const distToUser = Math.hypot(nearestNode.x-user.x, nearestNode.y-user.y);
      if(distToUser<minDist){
        minDist = distToUser;
        targetRod = r;
        targetNode = nearestNode;
      }
    });
  }

  if(targetNode){
    const centerX = targetRod.x + (targetRod.width || 2.5)/2;
    const centerY = targetRod.y + (targetRod.height || 5)/2;
    const path = findPath(user, {x:centerX, y:centerY}, allNodes);

    if(path.length>0){
      const svg = document.createElementNS("http://www.w3.org/2000/svg","svg");
      svg.id="path-svg";
      Object.assign(svg.style,{
        position:"absolute", left:"0", top:"0", width:"100%", height:"100%", pointerEvents:"none", zIndex:2
      });
      lot.appendChild(svg);

      let d=`M ${path[0].x*scale} ${path[0].y*scale}`;
      for(let i=1;i<path.length;i++) d+=` L ${path[i].x*scale} ${path[i].y*scale}`;
      const pathEl = document.createElementNS("http://www.w3.org/2000/svg","path");
      pathEl.setAttribute("d",d);
      pathEl.setAttribute("stroke","#ffe600ff");
      pathEl.setAttribute("stroke-width","9");
      pathEl.setAttribute("fill","none");
      pathEl.setAttribute("stroke-linecap","round");
      pathEl.setAttribute("stroke-linejoin","round");
      svg.appendChild(pathEl);
    }
  }
}

// ===== ズーム =====
zoomSlider.addEventListener("input",()=>{ zoomScale=parseFloat(zoomSlider.value); });

// ===== GPSでユーザ位置を更新 =====
function startGPS() {
  if (!navigator.geolocation) {
    alert("GPSがサポートされていません");
    return;
  }

  const options = {
    enableHighAccuracy: true,
    maximumAge: 1000,
    timeout: 5000
  };

  navigator.geolocation.watchPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      // 緯度経度 → 駐車場内座標に変換
      user.x = (lng - parking.lng1) / (parking.lng2 - parking.lng1) * parking.width;
      user.y = (lat - parking.lat1) / (parking.lat2 - parking.lat1) * parking.height;

      renderAll();
    },
    (err) => { console.error("GPS取得エラー", err); },
    options
  );
}

// 初期化
loadLayout().then(() => {
  startGPS();
});

// ズームループ
(function loop(){ lot.style.transform=`scale(${zoomScale})`; requestAnimationFrame(loop); })();

// 選択ロッド解除
document.getElementById("deselect-btn").addEventListener("click", ()=>{
  selectedRod = null;
  renderAll();
});
