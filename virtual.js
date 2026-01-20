const MIN_LAT=38.16742, MAX_LAT=38.16752;
const MIN_LNG=140.86561, MAX_LNG=140.86591;

const rods=[
{id:"A1",lat:38.16748,lng:140.86561,status:0,row:1,col:1},
{id:"A2",lat:38.16746,lng:140.86561,status:1,row:2,col:1},
{id:"A3",lat:38.16744,lng:140.86561,status:0,row:3,col:1},
{id:"B1",lat:38.16748,lng:140.86591,status:0,row:1,col:3},
{id:"B2",lat:38.16746,lng:140.86591,status:1,row:2,col:3},
{id:"B3",lat:38.16744,lng:140.86591,status:0,row:3,col:3}
];

let userLat = (MIN_LAT+MAX_LAT)/2;
let userLng = (MIN_LNG+MAX_LNG)/2;
let deviceHeading=null;
let zoomScale = 1;

const lot=document.getElementById("parking-lot");
const container=document.getElementById("parking-lot-container");
const zoomSlider = document.getElementById("zoom-slider");

const SOCKET_URL = location.origin;
const socket = io(SOCKET_URL, { transports: ["websocket","polling"] });
const others = {};

function gpsToRelative(lat,lng){
const dx = (lng - userLng) / (MAX_LNG-MIN_LNG) * lot.clientWidth;
const dy = (userLat - lat) / (MAX_LAT-MIN_LAT) * lot.clientHeight;
return {x: dx, y: dy};
}

function renderRods(){
document.querySelectorAll(".rod").forEach(e=>e.remove());
rods.forEach(r=>{
const d=document.createElement("div");
d.className="rod "+(r.status===0?"empty":"full");
d.innerHTML=`${r.id}<br>${r.status===0?"空き":"使用中"}`;
lot.appendChild(d);
});
}
renderRods();

container.addEventListener("click", e=>{
const rect=container.getBoundingClientRect();
const x=e.clientX-rect.left, y=e.clientY-rect.top;
userLat=MAX_LAT-(y/lot.clientHeight)*(MAX_LAT-MIN_LAT);
userLng=MIN_LNG+(x/lot.clientWidth)*(MAX_LNG-MIN_LNG);
});

const moveStepLat=(MAX_LAT-MIN_LAT)/50;
const moveStepLng=(MAX_LNG-MIN_LNG)/50;
function moveUp(){ userLat+=moveStepLat; }
function moveDown(){ userLat-=moveStepLat; }
function moveLeft(){ userLng-=moveStepLng; }
function moveRight(){ userLng+=moveStepLng; }

document.getElementById("up").onclick=moveUp;
document.getElementById("down").onclick=moveDown;
document.getElementById("left").onclick=moveLeft;
document.getElementById("right").onclick=moveRight;

window.addEventListener("keydown", e=>{
switch(e.key){
case "ArrowUp": moveUp(); break;
case "ArrowDown": moveDown(); break;
case "ArrowLeft": moveLeft(); break;
case "ArrowRight": moveRight(); break;
}
});

document.getElementById("enable-orientation").onclick=async()=>{
if(typeof DeviceOrientationEvent?.requestPermission==="function"){
const res=await DeviceOrientationEvent.requestPermission();
if(res!=="granted") return alert("方位センサが許可されていません");
}
window.addEventListener("deviceorientation", e=>{
if(e.webkitCompassHeading!=null) deviceHeading=e.webkitCompassHeading;
else if(e.alpha!=null) deviceHeading=360-e.alpha;
document.getElementById("orientation").textContent=`向き：${deviceHeading?.toFixed(0)}°`;
});
};

socket.on("positions", data=>{
for(const id in data){
if(id === socket.id) continue;
if(!others[id]){
const m = document.createElement("div");
m.className = "user-marker-other";
lot.appendChild(m);
others[id] = { marker: m, lat:data[id].lat, lng:data[id].lng };
} else { others[id].lat=data[id].lat; others[id].lng=data[id].lng; }
}
for(const id in others){
if(!data[id]){
lot.removeChild(others[id].marker);
delete others[id];
}
}
});

function sendMyPosition(){ if(userLat!==null) socket.emit("update_position",{lat:userLat,lng:userLng}); }

zoomSlider.addEventListener("input", ()=>{ zoomScale = parseFloat(zoomSlider.value); });

(function loop(){
if(userLat!==null && userLng!==null){
document.getElementById("location").textContent=
`現在地（開発）：${userLat.toFixed(5)}, ${userLng.toFixed(5)}`;

document.querySelectorAll(".rod").forEach((d,i)=>{
const r = rods[i];
const rel = gpsToRelative(r.lat,r.lng);
const w = d.offsetWidth;
const h = d.offsetHeight;
d.style.left = (lot.clientWidth/2 + rel.x - w/2) + "px";
d.style.top  = (lot.clientHeight/2 + rel.y - h/2) + "px";
});

for(const id in others){
const o = others[id];
const rel = gpsToRelative(o.lat,o.lng);
o.marker.style.left = (lot.clientWidth/2 + rel.x -6) + "px";
o.marker.style.top  = (lot.clientHeight/2 + rel.y -6) + "px";
}

lot.style.transform = `scale(${zoomScale}) rotate(${deviceHeading!=null?-deviceHeading:0}deg)`;
sendMyPosition();
}
requestAnimationFrame(loop);
})();
