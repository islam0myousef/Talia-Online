const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const PORT = process.env.PORT || 10000;

const maps = {
  twin_city: {name:'Azure City', width:2400, height:1600},
  phoenix: {name:'Ember Fields', width:2600, height:1800},
  desert: {name:'Golden Desert', width:2800, height:1800},
  ape: {name:'Jade Mountains', width:2800, height:1900},
  island: {name:'Moon Bird Island', width:2600, height:1800}
};

const players = new Map();
const accounts = new Map();
const drops = new Map();
let dropSeq = 1;

function safeName(v){return String(v||'Hero').replace(/[^a-zA-Z0-9_ -]/g,'').slice(0,18)||'Hero'}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function uid(){return Math.random().toString(36).slice(2,10)+Date.now().toString(36)}
function send(ws,type,data){if(ws.readyState===1)ws.send(JSON.stringify({type,...data}))}
function broadcast(obj){const s=JSON.stringify(obj);for(const p of players.values())if(p.ws.readyState===1)p.ws.send(s)}
function spawnDrops(){
  for(const [id,d] of drops) { if(Date.now()-d.createdAt>180000) drops.delete(id); }
}
setInterval(spawnDrops,30000);

wss.on('connection', ws=>{
  let pid=null;
  send(ws,'hello',{version:'2.0.0'});
  ws.on('message', raw=>{
    let m; try{m=JSON.parse(raw)}catch{return}
    if(m.type==='login'){
      const name=safeName(m.name);
      pid=uid();
      const old=accounts.get(name)||{name,level:1,exp:0,gold:100000,cp:5000,classId:'warrior',mapId:'twin_city',x:1200,y:800,inventory:[]};
      const p={...old,pid,ws,hp:old.maxHp||220, maxHp:old.maxHp||220, mapId:old.mapId||'twin_city',x:old.x||1200,y:old.y||800,dir:0};
      players.set(pid,p);
      send(ws,'state',{player:clientPlayer(p),players:otherPlayers(p),drops:[...drops.values()].filter(d=>d.mapId===p.mapId)});
      broadcast({type:'player_join',player:clientPlayer(p)});
    } else if(!pid)return;
    else if(m.type==='move'){
      const p=players.get(pid); if(!p)return;
      p.x=clamp(Number(m.x)||p.x,40,maps[p.mapId].width-40); p.y=clamp(Number(m.y)||p.y,80,maps[p.mapId].height-40); p.dir=m.dir||0;
      broadcast({type:'player_move',player:clientPlayer(p)});
    } else if(m.type==='map'){
      const p=players.get(pid); if(!p || !maps[m.mapId])return;
      p.mapId=m.mapId;p.x=maps[m.mapId].width/2;p.y=maps[m.mapId].height/2;
      send(ws,'map_changed',{player:clientPlayer(p),drops:[...drops.values()].filter(d=>d.mapId===p.mapId)});
      broadcast({type:'player_move',player:clientPlayer(p)});
    } else if(m.type==='attack'){
      const p=players.get(pid); if(!p)return;
      const dmg=35+Math.floor(Math.random()*30)+(p.level*3);
      p.exp += 25; p.gold += 5000+Math.floor(Math.random()*15000); p.cp += Math.random()<0.65?100+Math.floor(Math.random()*401):0;
      if(p.exp>=100){p.exp-=100;p.level++;p.maxHp+=30;p.hp=p.maxHp}
      const loot=[];
      if(Math.random()<0.7) loot.push({type:'meteor',label:'Meteor'});
      if(Math.random()<0.8) loot.push({type:'dragonball',label:'DragonBall'});
      if(Math.random()<0.3) loot.push({type:'weapon',label:'SUPER Weapon'});
      for(const item of loot){const id=String(dropSeq++);drops.set(id,{id,type:item.type,label:item.label,mapId:p.mapId,x:clamp(p.x+Math.random()*260-130,50,maps[p.mapId].width-50),y:clamp(p.y+Math.random()*260-130,100,maps[p.mapId].height-50),createdAt:Date.now()});}
      send(ws,'combat_result',{damage:dmg,loot,player:clientPlayer(p),drops:[...drops.values()].filter(d=>d.mapId===p.mapId)});
    } else if(m.type==='pickup'){
      const p=players.get(pid); const d=drops.get(String(m.id)); if(!p||!d||d.mapId!==p.mapId)return;
      drops.delete(d.id); p.inventory.push({id:uid(),type:d.type,label:d.label});
      send(ws,'picked',{dropId:d.id,player:clientPlayer(p)});
      broadcast({type:'drop_removed',dropId:d.id});
    } else if(m.type==='chat'){
      const p=players.get(pid); if(!p)return; const msg=String(m.message||'').slice(0,180);
      broadcast({type:'chat',name:p.name,message:msg});
    } else if(m.type==='gm'){
      const p=players.get(pid); if(!p||p.name!=='AbuTalia')return;
      if(m.action==='reward'){p.gold=100000000;p.cp=100000;p.level=Math.max(p.level,130);p.exp=0;p.maxHp=5000;p.hp=p.maxHp;send(ws,'state_patch',{player:clientPlayer(p)})}
      if(m.action==='spawn'){send(ws,'gm_notice',{message:'Boss event spawned in '+maps[p.mapId].name})}
      if(m.action==='announce'){broadcast({type:'system',message:String(m.message||'GM Announcement').slice(0,180)})}
    }
  });
  ws.on('close',()=>{if(pid){const p=players.get(pid);if(p){const save={...p};delete save.ws;delete save.pid;accounts.set(p.name,save)}players.delete(pid);broadcast({type:'player_leave',pid})}});
});

function clientPlayer(p){return {pid:p.pid,name:p.name,level:p.level,exp:p.exp,gold:p.gold,cp:p.cp,classId:p.classId,mapId:p.mapId,x:p.x,y:p.y,hp:p.hp,maxHp:p.maxHp,inventory:p.inventory}}
function otherPlayers(p){return [...players.values()].filter(q=>q.pid!==p.pid&&q.mapId===p.mapId).map(clientPlayer)}
app.get('/health',(req,res)=>res.json({ok:true,version:'2.0.0',players:players.size}));
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
server.listen(PORT,'0.0.0.0',()=>console.log('Talia Online V2 listening on '+PORT));
