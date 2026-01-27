// ===== admin.js 完全版 =====
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
  Object.assign(aerialImg.style, {
    position: "absolute",
    inset: "0",
    pointerEvents: "none",
    zIndex: 0,
    width: "100%",
    height: "100%"
  });

  lot.prepend(aerialImg);
  lot.style.position = "relative";
}

// ===== グループ中心計算 =====
function getGroupCenter(groupId){
  const g = rods.filter(r => r.groupId === groupId);
  const cx = g.reduce((s,r)=>s+r.x,0)/g.length;
  const cy = g.reduce((s,r)=>s+r.y,0)/g.length;
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

// ===== 描画 =====
function render() {
  lot.querySelectorAll(".rod,.node,.parking-area,.link-line").forEach(e=>e.remove());

  const scale = Math.min(
    container.clientWidth / parking.width,
    container.clientHeight / parking.height
  );

  lot.style.width  = parking.width * scale + "px";
  lot.style.height = parking.height * scale + "px";

  // ---- グリッド ----
  const area = document.createElement("div");
  area.className = "parking-area";
  Object.assign(area.style,{
    position:"absolute",
    inset:"0",
    border:"2px solid #000",
    zIndex:1,
    backgroundImage:`
      linear-gradient(to right, rgba(255,255,255,0.2) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255,255,255,0.2) 1px, transparent 1px)
    `,
    backgroundSize:`${GRID_M*scale}px ${GRID_M*scale}px`
  });
  lot.appendChild(area);

  // ---- ロッド ----
  rods.forEach(r=>{
    const d = document.createElement("div");
    d.className = "rod " + (r.status===0?"empty":"full");
    d.textContent = r.id;
    d.style.zIndex = 2;
    if (r.selected) d.style.outline = "3px solid yellow";
    lot.appendChild(d);

    Object.assign(d.style,{
      left:r.x*scale+"px",
      top:r.y*scale+"px",
      width:r.width*scale+"px",
      height:r.height*scale+"px",
      transform:`rotate(${r.angle||0}deg)`
    });

    // ダブルクリック：満空切替
    d.ondblclick = e=>{
      e.stopPropagation();
      r.status = r.status?0:1;
      render();
    };

    // クリック：選択（Shiftでグループ）
    d.onclick = e=>{
      e.stopPropagation();
      if(e.shiftKey && r.groupId){
        rods.forEach(x=>x.selected = x.groupId===r.groupId);
      }else{
        rods.forEach(x=>x.selected=false);
        r.selected=true;
      }
      render();
    };

    // ドラッグ移動（複数対応）
    d.onmousedown = e=>{
      e.preventDefault();
      const targets = r.selected ? rods.filter(x=>x.selected) : [r];
      const sx=e.clientX, sy=e.clientY;
      const orig=targets.map(t=>({x:t.x,y:t.y}));

      const move=ev=>{
        const dx=(ev.clientX-sx)/scale;
        const dy=(ev.clientY-sy)/scale;
        targets.forEach((t,i)=>{
          t.x=orig[i].x+dx;
          t.y=orig[i].y+dy;
        });
        render();
      };
      const up=()=>{
        document.removeEventListener("mousemove",move);
        document.removeEventListener("mouseup",up);
      };
      document.addEventListener("mousemove",move);
      document.addEventListener("mouseup",up);
    };
  });

  // ---- ノード & 線 ----
  nodes.forEach(n=>{
    const d=document.createElement("div");
    d.className="node";
    d.textContent=n.id;
    d.style.zIndex=3;
    lot.appendChild(d);

    const size=n.radius*2*scale;
    Object.assign(d.style,{
      left:(n.x*scale-size/2)+"px",
      top:(n.y*scale-size/2)+"px",
      width:size+"px",
      height:size+"px"
    });
  });

  links.forEach((l,i)=>{
    const a=nodes.find(x=>x.id===l.from);
    const b=nodes.find(x=>x.id===l.to);
    if(!a||!b) return;
    const line=document.createElement("div");
    const x1=a.x*scale, y1=a.y*scale;
    const x2=b.x*scale, y2=b.y*scale;
    const len=Math.hypot(x2-x1,y2-y1);
    Object.assign(line.style,{
      position:"absolute",
      left:x1+"px",
      top:y1+"px",
      width:len+"px",
      height:"3px",
      background:"#00f",
      transform:`rotate(${Math.atan2(y2-y1,x2-x1)}rad)`,
      transformOrigin:"0 0"
    });
    line.onclick=e=>{
      if(e.ctrlKey){
        links.splice(i,1);
        render();
      }
    };
    lot.appendChild(line);
  });
}

// ===== グループ削除 =====
document.getElementById("delete-group").onclick = ()=>{
  const target = rods.find(r=>r.selected && r.groupId);
  if(!target) return alert("グループが選択されていません");
  if(!confirm(`グループ ${target.groupId} を削除しますか？`)) return;
  rods = rods.filter(r=>r.groupId!==target.groupId);
  render();
};

// ===== グリッド生成 =====
document.getElementById("generate-grid").onclick = ()=>{
  const startX = +document.getElementById("grid-start-x").value;
  const startY = +document.getElementById("grid-start-y").value;
  const cols   = +document.getElementById("grid-cols").value;
  const rows   = +document.getElementById("grid-rows").value;
  const gapX   = +document.getElementById("grid-gap-x").value;
  const gapY   = +document.getElementById("grid-gap-y").value;
  const angle  = +document.getElementById("grid-angle").value;

  const groupId="G"+Date.now();
  let count=rods.length+1;

  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      rods.push({
        id:"R"+count++,
        x:startX+c*gapX,
        y:startY+r*gapY,
        width:ROD_WIDTH_M,
        height:ROD_HEIGHT_M,
        angle,
        status:0,
        groupId,
        selected:false
      });
    }
  }
  render();
};

// ===== グループ回転 (Alt+ホイール) =====
lot.addEventListener("wheel", e=>{
  if(!e.altKey) return;
  const target = rods.find(r=>r.selected && r.groupId);
  if(!target) return;
  e.preventDefault();
  const delta = e.deltaY > 0 ? 5 : -5;
  rotateGroup(target.groupId, delta);
},{ passive:false });

// ===== UIボタン回転 =====
document.getElementById("rotate-left")?.addEventListener("click", ()=>{
  const t = rods.find(r=>r.selected && r.groupId);
  if(t) rotateGroup(t.groupId,-10);
});
document.getElementById("rotate-right")?.addEventListener("click", ()=>{
  const t = rods.find(r=>r.selected && r.groupId);
  if(t) rotateGroup(t.groupId,10);
});

// ===== ズーム =====
zoomSlider.oninput = ()=>{
  zoomScale = parseFloat(zoomSlider.value);
  if(aerialImg) aerialImg.style.transform = `scale(${zoomScale})`;
  lot.style.transform = `scale(${zoomScale})`;
};

// ===== 保存 =====
document.getElementById("save-layout").onclick = async ()=>{
  try {
    const layout = { parking, rods, nodes, links };
    const res = await fetch("/save_layout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(layout)
    });
    const data = await res.json();
    if(data.status==="ok") alert("保存しました: ID="+data.parking_id);
    else alert("保存失敗: "+data.message);
  } catch(e){
    alert("保存エラー: "+e.message);
  }
};

// ===== 駐車場設定ボタン =====
document.getElementById("set-parking").onclick = ()=>{
  parking.lat1 = parseFloat(document.getElementById("lat1").value);
  parking.lng1 = parseFloat(document.getElementById("lng1").value);
  parking.lat2 = parseFloat(document.getElementById("lat2").value);
  parking.lng2 = parseFloat(document.getElementById("lng2").value);
  calcParkingSize();
  setAerialBackground();
  render();
};

// ===== 初期ロード =====
async function loadLayout(){
  try {
    const res = await fetch("/get_layouts");
    const data = await res.json();
    const firstId = Object.keys(data)[0];
    if(firstId){
      const layout = data[firstId];
      if(layout.parking) parking = layout.parking;
      if(layout.rods) rods = layout.rods;
      if(layout.nodes) nodes = layout.nodes;
      if(layout.links) links = layout.links;
    }
  } catch(e){
    console.warn("初期レイアウト読み込み失敗:", e);
  }
  calcParkingSize();
  setAerialBackground();
  render();
}

loadLayout();