// ===== admin.js =====
const container = document.getElementById("parking-lot-container");
const lot = document.getElementById("parking-lot");
const zoomSlider = document.getElementById("zoom-slider");
const parkingSelect = document.getElementById("parking-select");
const bgFileInput = document.getElementById("bg-file");

const socket = io();
let zoomScale = 1;

// ===== 定数 =====
const ROD_WIDTH_M = 2.5;
const ROD_HEIGHT_M = 5.0;
const GRID_M = 5;

// ===== 状態管理 =====
let parkings = {};   // 駐車場ID -> {name, parking, rods, nodes, links, bgSrc}
let currentParkingId = null;

// ===== 選択状態 =====
let selectedNodeForLink = null;
let selectedRod = null;
let selectedGroupId = null;

// ===== 背景画像 =====
let aerialImg = null;

// ===== 緯度経度 → m換算 =====
function calcParkingSize(parking) {
  const latDist = (parking.lat1 - parking.lat2) * 111320;
  const lngDist = (parking.lng2 - parking.lng1) * 111320 *
    Math.cos((parking.lat1 + parking.lat2) / 2 * Math.PI / 180);
  parking.width = Math.abs(lngDist);
  parking.height = Math.abs(latDist);
}

// ===== 背景描画 =====
function setAerialBackground() {
  if (!currentParkingId) return;
  const pData = parkings[currentParkingId];
  if (!pData.parking.width || !pData.parking.height) return;
  if (aerialImg) aerialImg.remove();

  aerialImg = document.createElement("img");
  aerialImg.src = pData.bgSrc || "";
  aerialImg.alt = "Parking Background";
  Object.assign(aerialImg.style, {
    position: "absolute",
    left: "0", top: "0",
    pointerEvents: "none",
    zIndex: 0,
    width: "100%",
    height: "100%"
  });

  lot.prepend(aerialImg);
  lot.style.position = "relative";
}

// ===== 駐車場切替 =====
function switchParking(parkingId) {
  if (!parkings[parkingId]) return;
  currentParkingId = parkingId;
  const p = parkings[parkingId].parking;
  document.getElementById("lat1").value = p.lat1;
  document.getElementById("lng1").value = p.lng1;
  document.getElementById("lat2").value = p.lat2;
  document.getElementById("lng2").value = p.lng2;
  setAerialBackground();
  render();
}

// ===== 駐車場一覧更新 =====
function updateParkingSelect() {
  parkingSelect.innerHTML = "";
  Object.keys(parkings).forEach(id => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = parkings[id].name || id;
    if (id === currentParkingId) opt.selected = true;
    parkingSelect.appendChild(opt);
  });
}

// ===== サーバから初期ロード =====
async function loadServerLayout() {
  try {
    const res = await fetch("/parking_layout.json");
    const data = await res.json();
    parkings = data || {};
    currentParkingId = Object.keys(parkings)[0] || null;
    updateParkingSelect();
    render();
  } catch (e) {
    console.error("サーバからの読み込み失敗", e);
  }
}
window.onload = loadServerLayout;

// ===== SocketIO 同期 =====
socket.on("layout_updated", async () => {
  console.log("サーバのレイアウト更新を受信");
  await loadServerLayout();
});

// ===== 描画 =====
function render() {
  if (!currentParkingId) return;
  const { parking, rods, nodes, links } = parkings[currentParkingId];

  lot.querySelectorAll(".rod,.node,.parking-area,.link-line").forEach(e => e.remove());

  const scale = Math.min(container.clientWidth / parking.width, container.clientHeight / parking.height);
  lot.style.width = parking.width * scale + "px";
  lot.style.height = parking.height * scale + "px";

  // 敷地グリッド
  const area = document.createElement("div");
  area.className = "parking-area";
  Object.assign(area.style, {
    position: "absolute",
    left: "0", top: "0",
    width: "100%", height: "100%",
    border: "2px solid #000",
    zIndex: 1,
    backgroundColor: "transparent",
    backgroundImage: `
      linear-gradient(to right, rgba(255,255,255,0.2) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255,255,255,0.2) 1px, transparent 1px)
    `,
    backgroundSize: `${GRID_M * scale}px ${GRID_M * scale}px, ${GRID_M * scale}px ${GRID_M * scale}px`,
    backgroundRepeat: "repeat, repeat"
  });
  lot.appendChild(area);

  // ロッド描画
  rods.forEach(r => {
    const d = document.createElement("div");
    d.className = "rod " + (r.status === 0 ? "empty" : "full");
    d.textContent = r.id;
    d.style.zIndex = 2;
    lot.appendChild(d);

    const updateRod = () => {
      Object.assign(d.style, {
        left: r.x * scale + "px",
        top: r.y * scale + "px",
        width: r.width * scale + "px",
        height: r.height * scale + "px",
        transform: `rotate(${r.angle}deg)`,
        border: (r.groupId === selectedGroupId) ? "2px dashed red" : ""
      });
    };
    updateRod();

    d.ondblclick = e => { e.stopPropagation(); r.status ^= 1; render(); triggerSync(); };

    d.onmousedown = e => {
      e.preventDefault();
      const sx = e.clientX, sy = e.clientY;
      let targets = [];
      if (selectedGroupId && r.groupId === selectedGroupId) targets = rods.filter(x => x.groupId === selectedGroupId);
      else { targets = [r]; selectedRod = r; selectedGroupId = null; }
      const offsets = targets.map(t => ({ x: t.x, y: t.y }));
      const move = ev => {
        const dx = (ev.clientX - sx) / scale, dy = (ev.clientY - sy) / scale;
        targets.forEach((t, i) => { t.x = offsets[i].x + dx; t.y = offsets[i].y + dy; });
        render();
      };
      const up = () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); triggerSync(); };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    };

    d.oncontextmenu = e => {
      e.preventDefault();
      if (e.shiftKey && r.groupId) { selectedGroupId = r.groupId; selectedRod = null; }
      else { r.angle = (r.angle + 90) % 360; }
      render();
      triggerSync();
    };
  });

  // ノード描画
  nodes.forEach(n => {
    const d = document.createElement("div");
    d.className = "node"; d.textContent = n.id; d.style.zIndex = 3;
    lot.appendChild(d);
    const updateNode = () => { const size = n.radius * 2 * scale; Object.assign(d.style, { left: n.x*scale - size/2 + "px", top: n.y*scale - size/2 + "px", width: size + "px", height: size + "px" }); };
    updateNode();

    d.onclick = e => {
      if (e.shiftKey) {
        if (!selectedNodeForLink) { selectedNodeForLink = n; d.style.border = "2px dashed yellow"; }
        else if (selectedNodeForLink !== n) {
          const a = selectedNodeForLink, b = n;
          if (!a.neighbors.includes(b.id)) a.neighbors.push(b.id);
          if (!b.neighbors.includes(a.id)) b.neighbors.push(a.id);
          links.push({from:a.id,to:b.id});
          selectedNodeForLink = null;
          render();
          triggerSync();
        }
      }
    };

    d.onmousedown = e => {
      e.preventDefault();
      const sx=e.clientX, sy=e.clientY, ox=n.x, oy=n.y;
      const move = ev => { n.x = ox + (ev.clientX-sx)/scale; n.y = oy + (ev.clientY-sy)/scale; updateNode(); render(); };
      const up = () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); triggerSync(); };
      document.addEventListener("mousemove", move); document.addEventListener("mouseup", up);
    };
  });

  // リンク描画
  links.forEach((link,index)=>{
    const n1=nodes.find(x=>x.id===link.from), n2=nodes.find(x=>x.id===link.to);
    if(!n1||!n2)return;
    const line=document.createElement("div"); line.className="link-line";
    const x1=n1.x*scale,y1=n1.y*scale,x2=n2.x*scale,y2=n2.y*scale;
    const length=Math.hypot(x2-x1,y2-y1);
    Object.assign(line.style,{position:"absolute",left:x1+"px",top:y1+"px",width:length+"px",height:"3px",background:"#0000ff",transform:`rotate(${Math.atan2(y2-y1,x2-x1)}rad)`,transformOrigin:"0 0",zIndex:2,cursor:"pointer"});
    line.onclick = e => { if(e.ctrlKey){ links.splice(index,1); n1.neighbors=n1.neighbors.filter(id=>id!==n2.id); n2.neighbors=n2.neighbors.filter(id=>id!==n1.id); render(); triggerSync(); } };
    lot.appendChild(line);
  });
}

// ===== 同期関数 =====
async function triggerSync() {
  try {
    await fetch("/save_layout", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(parkings)
    });
    socket.emit("layout_updated");
  } catch(e) {
    console.error("同期失敗", e);
  }
}

// ===== イベント =====
parkingSelect.onchange = ()=>{ switchParking(parkingSelect.value); };

// 新規駐車場
document.getElementById("add-parking").onclick = () => {
  const id = "P"+Date.now();
  parkings[id]={name:"駐車場"+Object.keys(parkings).length,parking:{lat1:38.16686,lng1:140.86395,lat2:38.16616,lng2:140.86528,width:0,height:0},rods:[],nodes:[],links:[],bgSrc:""};
  currentParkingId=id;
  calcParkingSize(parkings[id].parking);
  updateParkingSelect();
  render();
  triggerSync();
};

// 名前変更
document.getElementById("rename-parking").onclick = () => {
  if(!currentParkingId)return;
  const newName=prompt("駐車場名を入力",parkings[currentParkingId].name);
  if(newName){ parkings[currentParkingId].name=newName; updateParkingSelect(); triggerSync(); }
};

// 削除
document.getElementById("delete-parking").onclick = () => {
  if(!currentParkingId)return;
  if(!confirm("本当に削除しますか？")) return;
  delete parkings[currentParkingId];
  currentParkingId=Object.keys(parkings)[0]||null;
  updateParkingSelect();
  render();
  triggerSync();
};

// 駐車場座標設定
document.getElementById("set-parking").onclick = () => {
  if(!currentParkingId)return;
  const p = parkings[currentParkingId].parking;
  p.lat1=+document.getElementById("lat1").value;
  p.lng1=+document.getElementById("lng1").value;
  p.lat2=+document.getElementById("lat2").value;
  p.lng2=+document.getElementById("lng2").value;
  calcParkingSize(p);
  setAerialBackground();
  render();
  triggerSync();
};

// 背景画像設定
document.getElementById("set-bg").onclick = () => {
  if(!currentParkingId)return;
  const file=bgFileInput.files[0];
  if(!file)return alert("画像を選択してください");
  const reader=new FileReader();
  reader.onload=e=>{
    parkings[currentParkingId].bgSrc=e.target.result;
    setAerialBackground();
    triggerSync();
  };
  reader.readAsDataURL(file);
};

// ロッド/ノード追加
document.getElementById("add-rod").onclick = () => {
  if(!currentParkingId)return;
  const {parking,rods}=parkings[currentParkingId];
  rods.push({id:"R"+(rods.length+1),x:parking.width/4,y:parking.height/4,width:ROD_WIDTH_M,height:ROD_HEIGHT_M,status:0,angle:0,groupId:null});
  render();
  triggerSync();
};
document.getElementById("add-node").onclick = () => {
  if(!currentParkingId)return;
  const {parking,nodes}=parkings[currentParkingId];
  nodes.push({id:"N"+(nodes.length+1),x:parking.width/2,y:parking.height/2,radius:1,neighbors:[]});
  render();
  triggerSync();
};

// 保存ボタン（明示的保存）
document.getElementById("save-layout").onclick = () => { triggerSync(); };

// ズーム
zoomSlider.oninput=()=>{ zoomScale=parseFloat(zoomSlider.value); if(aerialImg)aerialImg.style.transform=`scale(${zoomScale})`; lot.style.transform=`scale(${zoomScale})`; };

// 初期化
function init(){
  if(Object.keys(parkings).length===0) document.getElementById("add-parking").click();
  updateParkingSelect();
  render();
}
init();