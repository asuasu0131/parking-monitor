const container = document.getElementById("parking-lot-container");
const lot = document.getElementById("parking-lot");
const canvas = document.getElementById("path-canvas");
const ctx = canvas.getContext("2d");
const userMarker = document.getElementById("user-marker");

// ===== 駐車場設定 =====
let rods = [];
let user = {x:0, y:0};
let nodes = [];

// ===== JSONロード =====
async function loadLayout(){
    try{
        const resp = await fetch("parking_layout.json");
        const data = await resp.json();
        data.forEach(r=>{
            rods.push({...r, cx:r.x, cy:r.y});
        });
        if(rods.length>0){
            user.x = rods[0].cx;
            user.y = rods[0].cy + 50;
        }
        resizeUI();
    } catch(e){ console.log("レイアウト読み込み失敗:",e);}
}

// ===== UIリサイズ =====
function resizeUI(){
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    rods.forEach(r=>{
        r.cx = r.x;
        r.cy = r.y;
    });

    // ユーザーマーカー
    userMarker.style.left = user.x + "px";
    userMarker.style.top  = user.y + "px";
}
window.addEventListener("resize", resizeUI);

// ===== ユーザー操作 =====
const moveStep = 5;
window.addEventListener("keydown", e=>{
    switch(e.key){
        case "ArrowUp": user.y-=moveStep; break;
        case "ArrowDown": user.y+=moveStep; break;
        case "ArrowLeft": user.x-=moveStep; break;
        case "ArrowRight": user.x+=moveStep; break;
    }
});

// ===== パス描画 =====
function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);

    rods.forEach(r=>{
        ctx.fillStyle = r.status?"#f44336":"#4caf50";
        ctx.fillRect(r.cx-35,r.cy-25,70,50);
        ctx.strokeStyle="#000";
        ctx.strokeRect(r.cx-35,r.cy-25,70,50);
        ctx.fillStyle="#fff";
        ctx.font="bold 12px sans-serif";
        ctx.textAlign="center";
        ctx.textBaseline="middle";
        ctx.fillText(r.id,r.cx,r.cy);
    });

    // ユーザーマーカー
    userMarker.style.left = user.x + "px";
    userMarker.style.top  = user.y + "px";

    requestAnimationFrame(draw);
}

draw();
loadLayout();