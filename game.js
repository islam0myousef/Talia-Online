const canvas = document.getElementById("world");
const ctx = canvas.getContext("2d");
const ws = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host);

let me = null;
let state = {world:{width:2400,height:1400},players:[],monsters:[],config:{}};
let keys = {};
let camera = {x:0,y:0};

function fit() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  canvas.style.width = innerWidth + "px";
  canvas.style.height = innerHeight + "px";
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
addEventListener("resize", fit); fit();

function send(x){ if(ws.readyState===1) ws.send(JSON.stringify(x)); }

document.getElementById("play").onclick = () => {
  send({type:"login", name:document.getElementById("name").value, password:document.getElementById("password").value});
};

ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if(m.type === "state") {
    state = m;
    if(me) {
      const p = state.players.find(x=>x.id===me.id);
      if(p) me = {...me,...p};
      updateHUD();
    }
  }
  if(m.type === "login_ok") {
    me = m.player;
    document.getElementById("login").classList.add("hidden");
    document.getElementById("game").classList.remove("hidden");
    if(me.role === "GM") document.getElementById("gmBtn").classList.remove("hidden");
    updateHUD();
  }
  if(m.type === "drops") showDrops(m.drops);
  if(m.type === "gm_saved") state.config = m.config;
  if(m.type === "notice") showDrops([m.text]);
};

function updateHUD(){
  if(!me) return;
  heroName.textContent = me.name;
  level.textContent = me.level;
  gold.textContent = Number(me.gold).toLocaleString();
  cps.textContent = Number(me.cps).toLocaleString();
}

function showDrops(arr){
  const box = document.getElementById("drops");
  arr.forEach(t=>{
    const d=document.createElement("div");
    d.className="drop";
    d.textContent=t;
    box.appendChild(d);
    setTimeout(()=>d.remove(),2500);
  });
}

function move(dx,dy){
  if(!me) return;
  const p=state.players.find(x=>x.id===me.id);
  if(!p)return;
  send({type:"move",x:p.x+dx,y:p.y+dy});
}

document.querySelectorAll("#controls button").forEach(b=>{
  b.addEventListener("click",()=>{
    const d=b.dataset.dir;
    if(d==="up")move(0,-70);
    if(d==="down")move(0,70);
    if(d==="left")move(-70,0);
    if(d==="right")move(70,0);
  });
});

canvas.addEventListener("click", e=>{
  if(!me)return;
  const p=state.players.find(x=>x.id===me.id);
  if(!p)return;
  const mx=e.clientX+camera.x, my=e.clientY+camera.y;
  let nearest=null, dist=999999;
  for(const m of state.monsters){
    const dd=Math.hypot(m.x-mx,m.y-my);
    if(dd<dist){dist=dd;nearest=m;}
  }
  if(nearest && dist<90) send({type:"attack",monsterId:nearest.id});
});

function draw(){
  requestAnimationFrame(draw);
  if(!me)return;
  const p=state.players.find(x=>x.id===me.id);
  if(!p)return;

  camera.x = Math.max(0, Math.min(state.world.width-innerWidth, p.x-innerWidth/2));
  camera.y = Math.max(0, Math.min(state.world.height-innerHeight, p.y-innerHeight/2));

  ctx.clearRect(0,0,innerWidth,innerHeight);
  ctx.save(); ctx.translate(-camera.x,-camera.y);

  // Ground
  ctx.fillStyle="#1d3525"; ctx.fillRect(0,0,state.world.width,state.world.height);
  ctx.strokeStyle="#274733";
  for(let x=0;x<state.world.width;x+=80){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,state.world.height);ctx.stroke()}
  for(let y=0;y<state.world.height;y+=80){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(state.world.width,y);ctx.stroke()}

  // Monsters
  for(const m of state.monsters){
    ctx.fillStyle="#b83b3b"; ctx.beginPath();ctx.arc(m.x,m.y,24,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#fff";ctx.font="12px Arial";ctx.textAlign="center";ctx.fillText(m.name,m.x,m.y-32);
    ctx.fillStyle="#111";ctx.fillRect(m.x-25,m.y+30,50,5);
    ctx.fillStyle="#42d16d";ctx.fillRect(m.x-25,m.y+30,50*(m.hp/m.maxHp),5);
  }

  // Players
  for(const q of state.players){
    ctx.fillStyle=q.id===me.id?"#4db3ff":"#f0c04a";
    ctx.beginPath();ctx.arc(q.x,q.y,20,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#fff";ctx.font="13px Arial";ctx.textAlign="center";ctx.fillText(q.name,q.x,q.y-30);
  }
  ctx.restore();
}
draw();

document.getElementById("gmBtn").onclick=()=>{
  gmPanel.classList.remove("hidden");
  const c=state.config;
  for(const k of ["goldMin","goldMax","cpsMin","cpsMax","meteorRate","dragonBallRate","rareItemRate"])
    document.getElementById(k).value=c[k];
};
document.getElementById("closeGM").onclick=()=>gmPanel.classList.add("hidden");
document.getElementById("saveConfig").onclick=()=>{
  const c={};
  for(const k of ["goldMin","goldMax","cpsMin","cpsMax","meteorRate","dragonBallRate","rareItemRate"])
    c[k]=Number(document.getElementById(k).value);
  send({type:"gm_config",config:c});
};
