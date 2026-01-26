const container = document.getElementById("parking-lot-container");
const lot = document.getElementById("parking-lot");
const zoomSlider = document.getElementById("zoom-slider");
const socket = io();
let zoomScale = 1;

// ===== 現実サイズ =====
const ROD_WIDTH_M  = 2.5;
const ROD_HEIGHT_M = 5.0;
const GRID_M = 5;

// ===== 駐車場管理 =====
let parkingList = [];      // 複数駐車場の配列
let currentParking = null; // 現在編集中の駐車場
let selectedRod = null;
let selectedGroupId = null;
let selectedNodeForLink = null;

// ===== 背景画像 =====
let aerialImg = null;

// ===== 駐車場オブジェクト作成 =====
function createParking(lat1, lng1, lat2, lng2, bgDataURL=null){
  const parking = {
    id: Date.now(),
    lat1, lng1, lat2, lng2,
    width:0, height:0,
    rods: [],
    nodes: [],
    links: [],
    bgDataURL
  };
  calcParkingSize(parking);
  // 初期ロッド例
  parking.rods.push({id:"R1", x:10, y:10, width:ROD_WIDTH_M, height:ROD_HEIGHT_M, status:0, angle:0, groupId:null});
  parking.rods.push({id:"R2", x:20, y:10, width:ROD_WIDTH_M, height:ROD_HEIGHT_M, status:0, angle:0, groupId:null});
  return parking;
}

// ===== 緯度経度 → m換算 =====
function calcParkingSize(p){
  const latDist = (p.lat1 - p.lat2) * 111320;
  const lngDist = (p.lng2 - p.lng1) * 111320 * Math.cos((p.lat1 + p.lat2) / 2 * Math.PI / 180);
  p.width  = Math.abs(lngDist);
  p.height = Math.abs(latDist);
}

// ===== 背景画像設定 =====
function setAerialBackground(){
  if(!currentParking) return;
  if(!currentParking.width || !currentParking.height) return;
  if(aerialImg) aerialImg.remove();

  aerialImg = document.createElement("img");
  aerialImg.src = currentParking.bgDataURL || "";
  aerialImg.alt = "Parking Background";
  Object.assign(aerialImg.style,{
    position:"absolute",
    left:"0", top:"0",
    pointerEvents:"none",
    zIndex:0,
    width:"100%",
    height:"100%"
  });

  lot.prepend(aerialImg);
  lot.style.position="relative";
}

// ===== 描画 =====
function render(){
  if(!currentParking) return;
  lot.querySelectorAll(".rod,.node,.parking-area,.link-line").forEach(e=>e.remove());
  const scale = Math.min(container.clientWidth/currentParking.width, container.clientHeight/currentParking.height);
  lot.style.width  = currentParking.width * scale + "px";
  lot.style.height = currentParking.height * scale + "px";

  // 敷地グリッド
  const area = document.createElement("div");
  area.className = "parking-area";
  Object.assign(area.style,{
    position:"absolute", left:"0", top:"0",
    width:"100%", height:"100%",
    border:"2px solid #000",
    zIndex:1,
    backgroundColor:"transparent",
    backgroundImage:`
      linear-gradient(to right, rgba(255,255,255,0.2) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255,255,255,0.2) 1px, transparent 1px)
    `,
    backgroundSize: `${GRID_M*scale}px ${GRID_M*scale}px, ${GRID_M*scale}px ${GRID_M*scale}px`,
    backgroundRepeat: "repeat, repeat"
  });
  lot.appendChild(area);

  // ロッド描画
  currentParking.rods.forEach(r=>{
    const d = document.createElement("div");
    d.className = "rod "+(r.status===0?"empty":"full");
    d.textContent = r.id;
    d.style.zIndex=2;
    lot.appendChild(d);

    const updateRod=()=>{
      Object.assign(d.style,{
        left: r.x*scale+"px",
        top: r.y*scale+"px",
        width: r.width*scale+"px",
        height: r.height*scale+"px",
        transform:`rotate(${r.angle}deg)`,
        border: (r.groupId===selectedGroupId)?"2px dashed red":""
      });
    };
    updateRod();

    // ダブルクリックで満/空切替
    d.ondblclick=e=>{
      e.stopPropagation();
      r.status = (r.status===0)?1:0;
      render();
    };

    // ドラッグ
    d.onmousedown=e=>{
      e.preventDefault();
      const sx=e.clientX, sy=e.clientY;
      let targets=[];
      if(selectedGroupId && r.groupId===selectedGroupId){
        targets = currentParking.rods.filter(x=>x.groupId===selectedGroupId);
      }else{
        targets=[r]; selectedRod=r; selectedGroupId=null;
      }
      const offsets = targets.map(t=>({x:t.x, y:t.y}));
      const move = ev=>{
        const dx=(ev.clientX-sx)/scale;
        const dy=(ev.clientY-sy)/scale;
        targets.forEach((t,i)=>{ t.x=offsets[i].x+dx; t.y=offsets[i].y+dy; });
        render();
      };
      const up=()=>{ document.removeEventListener("mousemove",move); document.removeEventListener("mouseup",up); };
      document.addEventListener("mousemove",move);
      document.addEventListener("mouseup",up);
    };

    // 右クリックで角度変更 or グループ選択
    d.oncontextmenu=e=>{
      e.preventDefault();
      if(e.shiftKey && r.groupId){ selectedGroupId=r.groupId; selectedRod=null; }
      else { r.angle=(r.angle+90)%360; }
      render();
    };
  });

  // ノード描画
  currentParking.nodes.forEach(n=>{
    const d=document.createElement("div");
    d.className="node"; d.textContent=n.id; d.style.zIndex=3;
    lot.appendChild(d);

    const updateNode=()=>{
      const size=n.radius*2*scale;
      Object.assign(d.style,{
        left:(n.x*scale - size/2)+"px",
        top:(n.y*scale - size/2)+"px",
        width:size+"px",
        height:size+"px"
      });
    };
    updateNode();

    d.onclick=e=>{
      if(e.shiftKey){
        if(!selectedNodeForLink){ selectedNodeForLink=n; d.style.border="2px dashed yellow"; }
        else if(selectedNodeForLink!==n){
          const a=selectedNodeForLink,b=n;
          if(!a.neighbors.includes(b.id)) a.neighbors.push(b.id);
          if(!b.neighbors.includes(a.id)) b.neighbors.push(a.id);
          currentParking.links.push({from:a.id,to:b.id});
          selectedNodeForLink=null;
        }
        render();
      }
    };

    d.onmousedown=e=>{
      e.preventDefault();
      const sx=e.clientX, sy=e.clientY, ox=n.x, oy=n.y;
      const move=ev=>{ n.x=ox+(ev.clientX-sx)/scale; n.y=oy+(ev.clientY-sy)/scale; updateNode(); render(); };
      const up=()=>{ document.removeEventListener("mousemove",move); document.removeEventListener("mouseup",up); };
      document.addEventListener("mousemove",move);
      document.addEventListener("mouseup",up);
    };
  });

  // 線描画
  currentParking.links.forEach((link,index)=>{
    const n1=currentParking.nodes.find(x=>x.id===link.from);
    const n2=currentParking.nodes.find(x=>x.id===link.to);
    if(!n1||!n2) return;

    const line=document.createElement("div");
    line.className="link-line";
    const x1=n1.x*scale, y1=n1.y*scale, x2=n2.x*scale, y2=n2.y*scale;
    const length=Math.hypot(x2-x1,y2-y1);
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
    line.onclick=e=>{
      if(e.ctrlKey){
        currentParking.links.splice(index,1);
        n1.neighbors=n1.neighbors.filter(id=>id!==n2.id);
        n2.neighbors=n2.neighbors.filter(id=>id!==n1.id);
        render();
      }
    };
    lot.appendChild(line);
  });
}

// ===== イベント =====
document.getElementById("set-parking").onclick=()=>{
  if(!currentParking) return;
  currentParking.lat1=+lat1.value;
  currentParking.lng1=+lng1.value;
  currentParking.lat2=+lat2.value;
  currentParking.lng2=+lng2.value;
  calcParkingSize(currentParking);
  setAerialBackground();
  render();
};

document.getElementById("add-rod").onclick=()=>{
  if(!currentParking) return;
  currentParking.rods.push({id:"R"+(currentParking.rods.length+1), x:10, y:10, width:ROD_WIDTH_M, height:ROD_HEIGHT_M, status:0, angle:0, groupId:null});
  render();
};

document.getElementById("add-node").onclick=()=>{
  if(!currentParking) return;
  currentParking.nodes.push({id:"N"+(currentParking.nodes.length+1), x:currentParking.width/2, y:currentParking.height/2, radius:1.0, neighbors:[]});
  render();
};

document.getElementById("save-layout").onclick=async()=>{
  if(!currentParking) return;
  try{
    const res = await fetch("/save_layout",{method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(currentParking)});
    const data = await res.json();
    alert(data.status==="ok"?"保存しました":"保存失敗");
    socket.emit("layout_updated");
  }catch(e){ console.error(e); alert("保存エラー"); }
};

zoomSlider.oninput=()=>{
  zoomScale=parseFloat(zoomSlider.value);
  if(aerialImg) aerialImg.style.transform=`scale(${zoomScale})`;
  lot.style.transform=`scale(${zoomScale})`;
};

// 背景画像アップロード
document.getElementById("set-bg").onclick=()=>{
  const fileInput=document.getElementById("bg-file");
  if(fileInput.files.length===0){ alert("画像を選択してください"); return; }
  const file=fileInput.files[0];
  const reader=new FileReader();
  reader.onload=e=>{
    if(!currentParking) return;
    currentParking.bgDataURL=e.target.result;
    setAerialBackground();
    render();
  };
  reader.readAsDataURL(file);
};

// ロッド選択・サイズ変更・削除
document.getElementById("resize-selected").onclick=()=>{
  if(!selectedRod){ alert("ロッドを選択してください"); return; }
  selectedRod.width=parseFloat(document.getElementById("selected-width").value);
  selectedRod.height=parseFloat(document.getElementById("selected-height").value);
  render();
};

document.getElementById("delete-selected").onclick=()=>{
  if(!selectedRod){ alert("ロッドを選択してください"); return; }
  currentParking.rods=currentParking.rods.filter(r=>r.id!==selectedRod.id);
  selectedRod=null;
  render();
};

// グループサイズ変更・削除
document.getElementById("resize-group").onclick=()=>{
  if(!selectedGroupId){ alert("グループを選択してください"); return; }
  const w=parseFloat(document.getElementById("group-width").value);
  const h=parseFloat(document.getElementById("group-height").value);
  currentParking.rods.filter(r=>r.groupId===selectedGroupId).forEach(r=>{ r.width=w; r.height=h; });
  render();
};

document.getElementById("delete-group").onclick=()=>{
  if(!selectedGroupId){ alert("グループを選択してください"); return; }
  currentParking.rods=currentParking.rods.filter(r=>r.groupId!==selectedGroupId);
  selectedGroupId=null;
  render();
};

// 整列配置
document.getElementById("generate-grid").onclick=()=>{
  if(!currentParking) return;
  const cols=+document.getElementById("grid-cols").value;
  const rows=+document.getElementById("grid-rows").value;
  const gapX=+document.getElementById("grid-gap-x").value;
  const gapY=+document.getElementById("grid-gap-y").value;
  const angle=+document.getElementById("grid-angle").value;
  const groupId="G"+Date.now();
  let count=currentParking.rods.length+1;
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      currentParking.rods.push({
        id:"R"+count++,
        x:c*gapX, y:r*gapY,
        width:ROD_WIDTH_M, height:ROD_HEIGHT_M,
        angle, status:0, groupId
      });
    }
  }
  selectedGroupId=groupId;
  render();
};

// 初期駐車場作成＆表示
currentParking=createParking(38.16686,140.86395,38.16616,140.86528);
parkingList.push(currentParking);
setAerialBackground();
render();