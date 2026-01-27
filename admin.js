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
let nodes = [];
let links = [];
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

if(rods.length === 0){
  rods.push({id:"R1", x:parking.width/4, y:parking.height/4, width:ROD_WIDTH_M, height:ROD_HEIGHT_M, status:0, angle:0});
  rods.push({id:"R2", x:parking.width/2, y:parking.height/4, width:ROD_WIDTH_M, height:ROD_HEIGHT_M, status:0, angle:0});
}

// ===== 描画 =====
function render() {
  lot.querySelectorAll(".rod,.node,.parking-area,.link-line").forEach(e=>e.remove());

  const scale = Math.min(container.clientWidth / parking.width, container.clientHeight / parking.height);

  lot.style.width  = parking.width * scale + "px";
  lot.style.height = parking.height * scale + "px";

  // ---- 敷地グリッド ----
  const area = document.createElement("div");
  area.className = "parking-area";
  Object.assign(area.style, {
    position:"absolute",
    left:"0", top:"0",
    width: "100%",
    height:"100%",
    border: "2px solid #000",
    zIndex:1,
    backgroundColor: "transparent",
    backgroundImage: `
      linear-gradient(to right, rgba(255,255,255,0.2) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255,255,255,0.2) 1px, transparent 1px)
    `,
    backgroundSize: `${GRID_M*scale}px ${GRID_M*scale}px, ${GRID_M*scale}px ${GRID_M*scale}px`,
    backgroundRepeat: "repeat, repeat",
    backgroundPosition: "top left, top left"
  });
  lot.appendChild(area);

// ---- ロッド ----
rods.forEach(r => {
  const d = document.createElement("div");
  d.className = "rod " + (r.status===0 ? "empty" : "full");
  d.textContent = r.id;
  d.style.zIndex = 2;

  // 選択中なら黄色枠を追加
  if(r.selected){
    d.style.outline = "3px solid yellow";
  }

  lot.appendChild(d);

  const updateRod = ()=>{
    Object.assign(d.style, {
      left: r.x * scale + "px",
      top:  r.y * scale + "px",
      width: r.width * scale + "px",
      height:r.height* scale + "px",
      transform:`rotate(${r.angle}deg)`
    });

    // 選択中の枠は常に反映
    d.style.outline = r.selected ? "3px solid yellow" : "";
  };
  updateRod();

  // 以下、既存のダブルクリック、ドラッグ、右クリック処理は変更なし

// ===== ダブルクリックで満／空を切り替え =====
   d.ondblclick = e => {
     e.stopPropagation();
     r.status = (r.status === 0) ? 1 : 0; // 0:空 ⇄ 1:満
     render();
   };

   d.onclick = e=>{
  e.stopPropagation();
  if(e.shiftKey && r.groupId){  // Shift押しながらクリック
    rods.forEach(x => x.selected = x.groupId === r.groupId);
  }else{
    rods.forEach(x => x.selected = false); // 全て非選択
    r.selected = true; // このロッドだけ選択
  }
  render(); // 選択状態を描画に反映
};

    d.onmousedown = e=>{
      e.preventDefault();
      const sx=e.clientX, sy=e.clientY, ox=r.x, oy=r.y;
      const move = ev=>{
        r.x = ox + (ev.clientX - sx)/scale;
        r.y = oy + (ev.clientY - sy)/scale;
        updateRod();
      };
      const up = ()=>{ document.removeEventListener("mousemove",move); document.removeEventListener("mouseup",up); };
      document.addEventListener("mousemove",move);
      document.addEventListener("mouseup",up);
    };

    d.oncontextmenu = e=>{
      e.preventDefault();
      r.angle = (r.angle+90)%360;
      updateRod();
    };
  });

  // ---- ノード ----
  nodes.forEach(n=>{
    const d = document.createElement("div");
    d.className = "node";
    d.textContent = n.id;
    d.style.zIndex = 3;
    lot.appendChild(d);

    const updateNode = ()=>{
      const size = n.radius*2*scale;
      Object.assign(d.style,{
        left: (n.x*scale - size/2)+"px",
        top:  (n.y*scale - size/2)+"px",
        width:size+"px",
        height:size+"px"
      });
    };
    updateNode();

    d.onclick = e=>{
      if(e.shiftKey){
        if(!selectedNodeForLink){
          selectedNodeForLink = n;
          d.style.border="2px dashed yellow";
        }else if(selectedNodeForLink!==n){
          const a = selectedNodeForLink, b = n;
          if(!a.neighbors.includes(b.id)) a.neighbors.push(b.id);
          if(!b.neighbors.includes(a.id)) b.neighbors.push(a.id);
          links.push({from:a.id,to:b.id});
          selectedNodeForLink = null;
        }
        render();
      }
    };

    d.onmousedown = e=>{
      e.preventDefault();
      const sx=e.clientX, sy=e.clientY, ox=n.x, oy=n.y;
      const move = ev=>{
        n.x = ox + (ev.clientX - sx)/scale;
        n.y = oy + (ev.clientY - sy)/scale;
        updateNode();
        render();
      };
      const up = ()=>{
        document.removeEventListener("mousemove",move);
        document.removeEventListener("mouseup",up);
      };
      document.addEventListener("mousemove",move);
      document.addEventListener("mouseup",up);
    };
  });

  // ---- 線 ----
  links.forEach((link,index)=>{
    const n1 = nodes.find(x=>x.id===link.from);
    const n2 = nodes.find(x=>x.id===link.to);
    if(!n1||!n2) return;

    const line = document.createElement("div");
    line.className="link-line";

    const x1=n1.x*scale, y1=n1.y*scale, x2=n2.x*scale, y2=n2.y*scale;
    const length = Math.hypot(x2-x1,y2-y1);

    Object.assign(line.style,{
      position:"absolute",
      left:x1+"px",
      top:y1+"px",
      width:length+"px",
      height:"3px",
      background:"#0000ff",
      transform:`rotate(${Math.atan2(y2-y1,x2-x1)}rad)`,
      transformOrigin:"0 0",
      zIndex:2,
      cursor:"pointer"
    });

    line.onclick = e=>{
      if(e.ctrlKey){
        links.splice(index,1);
        n1.neighbors = n1.neighbors.filter(id=>id!==n2.id);
        n2.neighbors = n2.neighbors.filter(id=>id!==n1.id);
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
  rods.push({id:"R"+(rods.length+1), x:parking.width/4, y:parking.height/4, width:ROD_WIDTH_M, height:ROD_HEIGHT_M, status:0, angle:0});
  render();
};

document.getElementById("add-node").onclick = ()=>{
  nodes.push({id:"N"+(nodes.length+1), x:parking.width/2, y:parking.height/2, radius:1.0, neighbors:[]});
  render();
};

document.getElementById("save-layout").onclick = async ()=>{
  try{
    const layout = {parking, rods, nodes, links};
    const res = await fetch("/save_layout", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(layout)});
    const data = await res.json();
    alert(data.status==="ok"?"保存しました":"保存失敗");
    socket.emit("layout_updated");
  }catch(e){ console.error(e); alert("保存エラー"); }
};

zoomSlider.oninput = ()=>{
  zoomScale = parseFloat(zoomSlider.value);
  if(aerialImg) aerialImg.style.transform = `scale(${zoomScale})`;
  lot.style.transform = `scale(${zoomScale})`;
};

socket.on("sensor_update", data => {
  rods.forEach(r => {
    if (r.id === "R1") r.status = data.R1;
    if (r.id === "R2") r.status = data.R2;
  });
  render();
});

// 初期表示
calcParkingSize();
setAerialBackground();
render();

// ===== グリッド生成 =====
document.getElementById("generate-grid").onclick = () => {
  const startX = +document.getElementById("grid-start-x").value;
  const startY = +document.getElementById("grid-start-y").value;
  const cols   = +document.getElementById("grid-cols").value;
  const rows   = +document.getElementById("grid-rows").value;
  const gapX   = +document.getElementById("grid-gap-x").value;
  const gapY   = +document.getElementById("grid-gap-y").value;
  const angle  = +document.getElementById("grid-angle").value;

  const groupId = "G" + Date.now(); // 新規グループID
  let count = rods.length + 1;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      rods.push({
        id: "R" + count++,
        x: startX + c * gapX,
        y: startY + r * gapY,
        width: ROD_WIDTH_M,
        height: ROD_HEIGHT_M,
        angle: angle,
        status: 0,
        groupId: groupId,
        selected: false
      });
    }
  }

  render();
};

// ===== グループ中心計算（回転の支点用） =====
function getGroupCenter(groupId){
  const g = rods.filter(r => r.groupId === groupId);
  if(g.length === 0) return {cx:0, cy:0};
  const cx = g.reduce((sum,r)=>sum+r.x,0)/g.length;
  const cy = g.reduce((sum,r)=>sum+r.y,0)/g.length;
  return {cx, cy};
}

// ===== グループ回転 =====
function rotateGroup(groupId, deltaDeg){
  const {cx, cy} = getGroupCenter(groupId);
  const rad = deltaDeg * Math.PI / 180;
  rods.forEach(r=>{
    if(r.groupId !== groupId) return;
    const dx = r.x - cx;
    const dy = r.y - cy;
    r.x = cx + dx*Math.cos(rad) - dy*Math.sin(rad);
    r.y = cy + dx*Math.sin(rad) + dy*Math.cos(rad);
    r.angle = (r.angle || 0) + deltaDeg;
  });
  render();
}

// ===== ロッド描画時にドラッグでグループ移動 =====
rods.forEach(r => {
  const d = document.createElement("div");
  // ...既存描画処理...

  d.onmousedown = e => {
    e.preventDefault();
    // 選択済みのグループを対象に移動
    const targets = r.selected ? rods.filter(x=>x.selected && x.groupId===r.groupId) : [r];
    const sx = e.clientX, sy = e.clientY;
    const orig = targets.map(t=>({x:t.x, y:t.y}));

    const move = ev => {
      const dx = (ev.clientX - sx) / scale;
      const dy = (ev.clientY - sy) / scale;
      targets.forEach((t,i)=>{
        t.x = orig[i].x + dx;
        t.y = orig[i].y + dy;
      });
      render();
    };
    const up = ()=>{
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };
});

// ===== Alt+ホイールで選択グループ回転 =====
lot.addEventListener("wheel", e=>{
  if(!e.altKey) return;
  const target = rods.find(r=>r.selected && r.groupId);
  if(!target) return;
  e.preventDefault();
  const delta = e.deltaY > 0 ? 5 : -5;
  rotateGroup(target.groupId, delta);
},{ passive:false });
