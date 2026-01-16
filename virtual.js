const container = document.getElementById("parking-lot-container");
const lot = document.getElementById("parking-lot");
const zoomSlider = document.getElementById("zoom-slider");

let zoomScale = parseFloat(zoomSlider.value);
let userLat=null, userLng=null, deviceHeading=null;

const MIN_LAT=38.16742, MAX_LAT=38.16752;
const MIN_LNG=140.86561, MAX_LNG=140.86591;

const socket = io({ transports:["websocket","polling"] });
const others = {};
let rods = [];

// ===== レイアウト取得 =====
async function fetchLayout(){
  const res = await fetch("/parking_layout.json");
  rods = await res.json();
  renderRods();
}

// ===== ロッド描画 =====
function renderRods(){
  document.querySelectorAll(".rod").forEach(e=>e.remove());
  rods.forEach(r=>{
    const d=document.createElement("div");
    d.className="rod "+(r.status===0?"empty":"full");
    d.innerHTML=`${r.id}<br>${r.status===0?"空き":"使用中"}`;
    lot.appendChild(d);
    r.element=d;
  });
}

// ===== ズーム（containerのみ）=====
zoomSlider.addEventListener("input", ()=>{
  zoomScale = parseFloat(zoomSlider.value);
  container.style.transform = `scale(${zoomScale})`;
  container.style.transformOrigin = "center center";
});

// ===== GPS → 相対座標 =====
function gpsToRelative(lat,lng){
  return {
    x:(lng-userLng)/(MAX_LNG-MIN_LNG)*lot.clientWidth,
    y:(userLat-lat)/(MAX_LAT-MIN_LAT)*lot.clientHeight
  };
}

// ===== メインループ =====
(function loop(){
  if(userLat!==null && userLng!==null){
    document.getElementById("location").textContent =
      `現在地（開発）：${userLat.toFixed(5)}, ${userLng.toFixed(5)}`;

    rods.forEach(r=>{
      if(!r.element) return;
      const rel=gpsToRelative(r.lat,r.lng);
      const w=r.element.offsetWidth;
      const h=r.element.offsetHeight;
      r.element.style.left=(lot.clientWidth/2+rel.x-w/2)+"px";
      r.element.style.top =(lot.clientHeight/2+rel.y-h/2)+"px";
    });

    sendMyPosition();
  }
  requestAnimationFrame(loop);
})();

function sendMyPosition(){
  socket.emit("update_position",{lat:userLat,lng:userLng});
}

fetchLayout();