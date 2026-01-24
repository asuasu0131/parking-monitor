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
let parking = { lat1:35.0, lng1:135.0, lat2:34.999, lng2:135.002, width:0, height:0 };
let rods = [];
let nodes = []; // 通路ノード

// ===== 選択中ノード（接続用） =====
let selectedNode = null;

// ===== 緯度経度 → m換算 =====
function calcParkingSize() {
  const latDist = (parking.lat1 - parking.lat2) * 111320;
  const lngDist = (parking.lng2 - parking.lng1) * 111320 * Math.cos((parking.lat1 + parking.lat2)/2 * Math.PI/180);
  parking.width  = Math.abs(lngDist);
  parking.height = Math.abs(latDist);
}

// ===== 描画 =====
function render() {
  // 前回描画を削除
  document.querySelectorAll(".rod,.node,.node-line,.parking-area").forEach(e=>e.remove());
  const scale = Math.min(container.clientWidth/parking.width, container.clientHeight/parking.height);

  // lot は敷地内サイズに合わせる
  lot.style.width  = parking.width  * scale + "px";
  lot.style.height = parking.height * scale + "px";
  lot.style.background = "transparent";

  // ===== 敷地内（薄い灰色 + グリッド） =====
  const parkingArea = document.createElement("div");
  parkingArea.className = "parking-area";
  parkingArea.style.position = "absolute";
  parkingArea.style.left = "0px";
  parkingArea.style.top  = "0px";
  parkingArea.style.width  = parking.width * scale + "px";
  parkingArea.style.height = parking.height * scale + "px";
  parkingArea.style.backgroundColor = "#bfbfbf"; // 薄い灰色
  parkingArea.style.border = "2px solid #000";
  parkingArea.style.zIndex = 0;

  // グリッド
  const gridPx = GRID_M * scale;
  parkingArea.style.backgroundImage = `
    linear-gradient(to right, #aaa 1px, transparent 1px),
    linear-gradient(to bottom, #aaa 1px, transparent 1px)
  `;
  parkingArea.style.backgroundSize = `${gridPx}px ${gridPx}px`;

  lot.appendChild(parkingArea);

  // ===== ロッド描画 =====
  rods.forEach(r=>{
    const d = document.createElement("div");
    d.className = "rod " + (r.status===0?"empty":"full");
    d.textContent = r.id;
    lot.appendChild(d);

    const updatePos = ()=>{
      d.style.left   = r.x * scale + "px";
      d.style.top    = r.y * scale + "px";
      d.style.width  = r.width  * scale + "px";
      d.style.height = r.height * scale + "px";
      d.style.transform = `rotate(${r.angle}deg)`;
    };
    updatePos();

    // ドラッグ移動
    d.onmousedown = e=>{
      if(e.button!==0) return;
      e.preventDefault();
      const sx=e.clientX,sy=e.clientY,ox=r.x,oy=r.y;
      function move(ev){ r.x=ox+(ev.clientX-sx)/scale; r.y=oy+(ev.clientY-sy)/scale; updatePos(); }
      function up(){ document.removeEventListener("mousemove",move); document.removeEventListener("mouseup",up); }
      document.addEventListener("mousemove",move);
      document.addEventListener("mouseup",up);
    };

    // 右クリックで回転
    d.oncontextmenu = e=>{
      e.preventDefault();
      r.angle=(r.angle+90)%360;
      updatePos();
    };
  });

  // ===== 通路ノード線描画 =====
  nodes.forEach(n=>{
    n.neighbors.forEach(id=>{
      const neighbor = nodes.find(x=>x.id===id);
      if(!neighbor) return;
      const line = document.createElement("div");
      line.className = "node-line";
      const x1 = n.x*scale, y1 = n.y*scale;
      const x2 = neighbor.x*scale, y2 = neighbor.y*scale;
      const length = Math.hypot(x2-x1,y2-y1);
      line.style.position = "absolute";
      line.style.left = x1+"px";
      line.style.top  = y1+"px";
      line.style.width = length+"px";
      line.style.height = "2px";
      line.style.background = "#555";
      line.style.transform = `rotate(${Math.atan2(y2-y1,x2-x1)}rad)`;
      line.style.transformOrigin = "0 0";
      line.style.zIndex = 0;
      lot.appendChild(line);
    });
  });

  // ===== ノード描画 =====
  nodes.forEach(n=>{
    const d = document.createElement("div");
    d.className = "node";
    d.style.left = n.x*scale -4 + "px";
    d.style.top  = n.y*scale -4 + "px";
    d.style.zIndex = 1;
    lot.appendChild(d);

    if(selectedNode && selectedNode.id === n.id){
      d.style.border = "2px dashed blue";
    }
  });
}

// ===== イベント =====

// 駐車場サイズ設定
document.getElementById("set-parking").onclick = ()=>{
  parking.lat1=parseFloat(lat1.value);
  parking.lng1=parseFloat(lng1.value);
  parking.lat2=parseFloat(lat2.value);
  parking.lng2=parseFloat(lng2.value);
  calcParkingSize();
  render();
};

// ロッド追加
document.getElementById("add-rod").onclick = ()=>{
  rods.push({id:"R"+(rods.length+1),x:parking.width/4,y:parking.height/4,width:ROD_WIDTH_M,height:ROD_HEIGHT_M,status:0,angle:0});
  render();
};

// ノード追加・接続
lot.onclick = e=>{
  const scale = Math.min(container.clientWidth/parking.width, container.clientHeight/parking.height);
  const rect = lot.getBoundingClientRect();
  const x = (e.clientX-rect.left)/scale;
  const y = (e.clientY-rect.top)/scale;

  // ロッドクリックは無視
  const rodClicked = rods.some(r=>{
    const rx=r.x, ry=r.y, rw=r.width, rh=r.height;
    return x>=rx && x<=rx+rw && y>=ry && y<=ry+rh;
  });
  if(rodClicked) return;

  // 既存ノードをクリックした場合 → 接続モード
  const clickedNode = nodes.find(n=>Math.hypot(n.x-x,n.y-y)<10);
  if(clickedNode){
    if(selectedNode && selectedNode!==clickedNode){
      // 接続
      if(!selectedNode.neighbors.includes(clickedNode.id)) selectedNode.neighbors.push(clickedNode.id);
      if(!clickedNode.neighbors.includes(selectedNode.id)) clickedNode.neighbors.push(selectedNode.id);
      selectedNode = null;
      render();
    } else {
      selectedNode = clickedNode;
      render();
    }
    return;
  }

  // 新規ノード追加
  const newNode = { id:"N"+(nodes.length+1), x, y, neighbors:[] };
  nodes.push(newNode);
  selectedNode = newNode; // 追加したノードを選択状態に
  render();
};

// レイアウト保存
document.getElementById("save-layout").onclick = async ()=>{
  const data = { parking, rods, nodes };
  await fetch("/save_layout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
  alert("保存しました");
};

// ズーム
zoomSlider.oninput = ()=>{ zoomScale = parseFloat(zoomSlider.value); };

// ===== ズームループ =====
(function loop(){ lot.style.transform=`scale(${zoomScale})`; requestAnimationFrame(loop); })();

// 初期化
calcParkingSize();
render();