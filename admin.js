const container = document.getElementById("parking-lot-container");
const lot = document.getElementById("parking-lot");
const zoomSlider = document.getElementById("zoom-slider");
let zoomScale = parseFloat(zoomSlider.value);

let rods = [
{id:"A1",x:null,y:null,status:0},
{id:"A2",x:null,y:null,status:1},
{id:"A3",x:null,y:null,status:0},
{id:"B1",x:null,y:null,status:0},
{id:"B2",x:null,y:null,status:1},
{id:"B3",x:null,y:null,status:0}
];

function renderRods(){
document.querySelectorAll(".rod").forEach(e=>e.remove());
rods.forEach((r)=>{
const d = document.createElement("div");
d.className = "rod "+(r.status===0?"empty":"full");
d.innerHTML = `${r.id}<br>${r.status===0?"空き":"使用中"}`;
lot.appendChild(d);
r.element = d;

if(r.x===null) r.x = container.clientWidth/2 - d.offsetWidth/2;
if(r.y===null) r.y = container.clientHeight/2 - d.offsetHeight/2;
// renderRods 内
d.style.left = (r.xRatio ?? 0.5) * container.clientWidth + "px";
d.style.top  = (r.yRatio ?? 0.5) * container.clientHeight + "px";

d.onmousedown = (e)=>{
e.preventDefault();
const startX = e.clientX, startY = e.clientY;
const offsetX = startX - r.x, offsetY = startY - r.y;

function move(e2){
    r.xRatio = (e2.clientX - offsetX) / container.clientWidth;
    r.yRatio = (e2.clientY - offsetY) / container.clientHeight;
    d.style.left = (r.xRatio * container.clientWidth) + "px";
    d.style.top  = (r.yRatio * container.clientHeight) + "px";
}
function up(){ document.removeEventListener("mousemove",move); document.removeEventListener("mouseup",up); }
document.addEventListener("mousemove",move);
document.addEventListener("mouseup",up);
};

d.ondblclick = ()=>{
r.status = r.status===0?1:0;
d.className = "rod "+(r.status===0?"empty":"full");
d.innerHTML = `${r.id}<br>${r.status===0?"空き":"使用中"}`;
};
});
}
renderRods();

zoomSlider.addEventListener("input", ()=>{ zoomScale = parseFloat(zoomSlider.value); });

document.getElementById("add-rod").onclick = ()=>{
const id = "R"+(rods.length+1);
const newRod = {id:id,x:container.clientWidth/2-50,y:container.clientHeight/2-50,status:0};
rods.push(newRod);
renderRods();
};

document.getElementById("save-layout").onclick = async ()=>{
const saveData = rods.map(r=>({
    id: r.id,
    xRatio: r.xRatio,
    yRatio: r.yRatio,
    status: r.status
}));
try{
const res = await fetch("/save_layout", {
method:"POST",
headers:{"Content-Type":"application/json"},
body:JSON.stringify(saveData)
});
if(res.ok) alert("parking_layout.json に保存しました");
else alert("保存に失敗しました");
} catch(err){
alert("通信エラー："+err);
}
};

(function loop(){
rods.forEach(r=>{
if(r.element){
r.element.style.left = r.x + "px";
r.element.style.top  = r.y + "px";
}
});
lot.style.transform = `scale(${zoomScale})`;
requestAnimationFrame(loop);
})();

const socket = io();

document.getElementById("save-layout").onclick = async ()=>{
const saveData = rods.map(r=>({
    id: r.id,
    xRatio: r.xRatio,
    yRatio: r.yRatio,
    status: r.status
}));

  const res = await fetch("/save_layout", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify(saveData)
  });

  if(res.ok){
    alert("parking_layout.json に保存しました");
    socket.emit("layout_updated");
  }else{
    alert("保存失敗");
  }
};
