const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const PORT = Number(process.env.PORT || 10000);
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'players.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const MAPS = {
  twin_city: { id:'twin_city', name:'Twin City', w:64, h:48, color:'#274a35', spawn:{x:32,y:24}, level:1, exits:[{x:63,y:24,to:'phoenix',tx:2,ty:24}] },
  phoenix: { id:'phoenix', name:'Phoenix Castle', w:72, h:52, color:'#5b3b2e', spawn:{x:8,y:26}, level:20, exits:[{x:0,y:26,to:'twin_city',tx:61,ty:24},{x:71,y:26,to:'desert',tx:2,ty:25}] },
  desert: { id:'desert', name:'Desert City', w:76, h:54, color:'#806b3d', spawn:{x:8,y:27}, level:40, exits:[{x:0,y:27,to:'phoenix',tx:69,ty:26},{x:75,y:27,to:'bird_island',tx:2,ty:25}] },
  bird_island: { id:'bird_island', name:'Bird Island', w:70, h:50, color:'#315c61', spawn:{x:8,y:25}, level:60, exits:[{x:0,y:25,to:'desert',tx:73,ty:27},{x:69,y:25,to:'ape_mountain',tx:2,ty:25}] },
  ape_mountain: { id:'ape_mountain', name:'Ape Mountain', w:72, h:52, color:'#3d5a38', spawn:{x:8,y:26}, level:80, exits:[{x:0,y:26,to:'bird_island',tx:67,ty:25}] }
};

const CLASSES = {
  warrior: { name:'Warrior', hp:180, mana:80, atk:24, def:12, range:1.6 },
  trojan: { name:'Trojan', hp:210, mana:70, atk:30, def:8, range:1.7 },
  archer: { name:'Archer', hp:150, mana:100, atk:22, def:6, range:7.5 },
  taoist: { name:'Taoist', hp:125, mana:180, atk:18, def:5, range:6.5 }
};

const ITEMS = {
  1001:{name:'Iron Sword',type:'weapon',slot:'weapon',atk:8,quality:'normal'},
  1002:{name:'Azure Blade',type:'weapon',slot:'weapon',atk:18,quality:'refined'},
  1003:{name:'Jade Bow',type:'weapon',slot:'weapon',atk:15,quality:'refined'},
  1004:{name:'Mystic Wand',type:'weapon',slot:'weapon',atk:14,quality:'refined'},
  1101:{name:'Bronze Armor',type:'armor',slot:'armor',def:8,quality:'normal'},
  1102:{name:'Phoenix Armor',type:'armor',slot:'armor',def:18,quality:'refined'},
  1201:{name:'DragonBall',type:'material',quality:'rare'},
  1202:{name:'Meteor',type:'material',quality:'rare'},
  1203:{name:'Gold Pack',type:'material',quality:'rare'},
  1301:{name:'Health Potion',type:'consumable',heal:120,quality:'normal'},
  1302:{name:'Mana Potion',type:'consumable',mana:100,quality:'normal'}
};

const SKILLS = {
  warrior:[{id:'whirlwind',name:'Whirlwind',cost:20,range:2.2,damage:1.7,aoe:true}],
  trojan:[{id:'speedhack',name:'Cyclone Strike',cost:18,range:2.4,damage:2.0,aoe:false}],
  archer:[{id:'scatter',name:'Scatter Arrow',cost:25,range:8,damage:1.45,aoe:true}],
  taoist:[{id:'thunder',name:'Thunder',cost:30,range:7,damage:2.2,aoe:true}]
};

const NPCS = [
  {id:'trainer',name:'Trainer',map:'twin_city',x:29,y:20,kind:'trainer',text:'Welcome, hero. Choose your class and learn your first skill.'},
  {id:'shop',name:'General Store',map:'twin_city',x:36,y:28,kind:'shop',text:'Potions and supplies for your journey.'},
  {id:'teleporter',name:'Teleporter',map:'twin_city',x:32,y:30,kind:'teleport',text:'I can take you to the major cities.'},
  {id:'phoenix_shop',name:'Phoenix Merchant',map:'phoenix',x:18,y:26,kind:'shop',text:'Refined equipment for experienced heroes.'},
  {id:'desert_gate',name:'Desert Guide',map:'desert',x:18,y:27,kind:'teleport',text:'The desert is dangerous. Prepare well.'},
  {id:'bird_keeper',name:'Island Keeper',map:'bird_island',x:18,y:25,kind:'teleport',text:'Beyond here lie the mountains.'},
  {id:'mountain_master',name:'Mountain Master',map:'ape_mountain',x:18,y:26,kind:'quest',text:'Defeat the strongest beasts and return to me.'}
];

const QUESTS = {
  first_hunt:{id:'first_hunt',name:'First Hunt',desc:'Defeat 5 monsters.',target:5,reward:{exp:250,gold:50000,cp:100},minLevel:1},
  desert_trial:{id:'desert_trial',name:'Desert Trial',desc:'Defeat 10 monsters in Desert City.',target:10,reward:{exp:2500,gold:500000,cp:500},minLevel:40},
  mountain_hunt:{id:'mountain_hunt',name:'Mountain Hunt',desc:'Defeat 15 monsters in Ape Mountain.',target:15,reward:{exp:10000,gold:2000000,cp:1500},minLevel:80}
};

const MONSTER_TEMPLATES = [
  {id:'birdman',name:'Birdman',level:8,hp:120,atk:15,def:4,exp:25,gold:[800,1800],drops:[{item:1202,chance:.70},{item:1301,chance:.20}]},
  {id:'bandit',name:'Bandit',level:15,hp:220,atk:24,def:7,exp:55,gold:[1500,3500],drops:[{item:1202,chance:.70},{item:1001,chance:.12}]},
  {id:'fire_spirit',name:'Fire Spirit',level:30,hp:420,atk:40,def:11,exp:120,gold:[3000,8000],drops:[{item:1201,chance:.10},{item:1002,chance:.08}]},
  {id:'sand_monster',name:'Sand Monster',level:48,hp:700,atk:62,def:16,exp:240,gold:[7000,16000],drops:[{item:1201,chance:.12},{item:1102,chance:.06}]},
  {id:'hawk',name:'Hawk',level:65,hp:1050,atk:90,def:22,exp:420,gold:[12000,28000],drops:[{item:1201,chance:.18},{item:1003,chance:.08}]},
  {id:'ape',name:'Ape',level:85,hp:1500,atk:125,def:30,exp:700,gold:[20000,50000],drops:[{item:1201,chance:.25},{item:1002,chance:.10}]},
  {id:'ape_king',name:'Ape King',level:100,hp:6500,atk:210,def:45,exp:3500,gold:[100000,300000],boss:true,drops:[{item:1201,chance:.70},{item:1002,chance:.35},{item:1102,chance:.20}]}
];

const SPAWN_TYPES = {
  twin_city:['bandit','birdman'], phoenix:['bandit','fire_spirit'], desert:['fire_spirit','sand_monster'], bird_island:['sand_monster','hawk'], ape_mountain:['hawk','ape','ape_king']
};

function loadDB(){ try{return JSON.parse(fs.readFileSync(DB_FILE,'utf8'));}catch{return {accounts:{}};} }
let DB = loadDB();
function saveDB(){ fs.writeFileSync(DB_FILE, JSON.stringify(DB,null,2)); }
function id(){ return Math.random().toString(36).slice(2,10)+Date.now().toString(36); }
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function cleanName(v){return String(v||'Hero').replace(/[^a-zA-Z0-9_ -]/g,'').trim().slice(0,18)||'Hero';}
function send(ws,type,data={}){if(ws.readyState===1) ws.send(JSON.stringify({type,...data}));}
function broadcastMap(mapId,obj){const raw=JSON.stringify(obj); for(const p of players.values()) if(p.mapId===mapId&&p.ws.readyState===1)p.ws.send(raw);}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function xpForLevel(level){return Math.floor(100*Math.pow(1.22,Math.max(0,level-1)));}
function classStats(p){const c=CLASSES[p.classId]||CLASSES.warrior; let atk=c.atk+Math.floor(p.level*1.7), def=c.def+Math.floor(p.level*.8), hp=c.hp+p.level*14, mana=c.mana+p.level*8; const w=p.equipment.weapon&&ITEMS[p.equipment.weapon.itemId]; const a=p.equipment.armor&&ITEMS[p.equipment.armor.itemId]; if(w)atk+=w.atk||0;if(a)def+=a.def||0;return {atk,def,maxHp:hp,maxMana:mana};}
function makePlayer(name,classId){const p={id:id(),name,classId,level:1,exp:0,gold:1000000,cp:50000,mapId:'twin_city',x:32,y:24,hp:0,mana:0,inventory:[],equipment:{weapon:null,armor:null},quests:{},kills:{},createdAt:Date.now()}; const s=classStats(p);p.hp=s.maxHp;p.mana=s.maxMana;return p;}
function hydrate(saved){const p={...saved};p.equipment=p.equipment||{weapon:null,armor:null};p.inventory=p.inventory||[];p.quests=p.quests||{};p.kills=p.kills||{};const s=classStats(p);p.hp=clamp(Number(p.hp)||s.maxHp,0,s.maxHp);p.mana=clamp(Number(p.mana)||s.maxMana,0,s.maxMana);return p;}
function publicPlayer(p){const s=classStats(p);return {id:p.id,name:p.name,classId:p.classId,level:p.level,exp:p.exp,xpNext:xpForLevel(p.level),gold:p.gold,cp:p.cp,mapId:p.mapId,x:p.x,y:p.y,hp:p.hp,maxHp:s.maxHp,mana:p.mana,maxMana:s.maxMana,equipment:p.equipment,inventory:p.inventory,quests:p.quests,kills:p.kills};}

const players=new Map();
const monsters=new Map();
const groundItems=new Map();
let seq=1;

function spawnMonster(mapId,type,x,y){const t=MONSTER_TEMPLATES.find(v=>v.id===type); if(!t)return; const m={id:'m'+(seq++),template:t.id,name:t.name,mapId,x,y,hp:t.hp,maxHp:t.hp,level:t.level,atk:t.atk,def:t.def,exp:t.exp,gold:t.gold,boss:!!t.boss,target:null};monsters.set(m.id,m);return m;}
function seedMonsters(){for(const mapId of Object.keys(MAPS)){const types=SPAWN_TYPES[mapId];for(let i=0;i<30;i++){const type=types[i%types.length];const x=5+Math.floor(Math.random()*(MAPS[mapId].w-10));const y=5+Math.floor(Math.random()*(MAPS[mapId].h-10));spawnMonster(mapId,type,x,y);}}}
seedMonsters();
function mapState(mapId,pid){return {map:MAPS[mapId],npcs:NPCS.filter(n=>n.map===mapId),players:[...players.values()].filter(p=>p.mapId===mapId).map(publicPlayer),monsters:[...monsters.values()].filter(m=>m.mapId===mapId).map(m=>({id:m.id,name:m.name,x:m.x,y:m.y,hp:m.hp,maxHp:m.maxHp,level:m.level,boss:m.boss})),ground:[...groundItems.values()].filter(d=>d.mapId===mapId)};}
function savePlayer(p){const safe={...p};delete safe.ws;DB.accounts[p.name]=safe;saveDB();}
function levelUp(p){let count=0;while(p.exp>=xpForLevel(p.level)){p.exp-=xpForLevel(p.level);p.level++;count++;}const s=classStats(p);p.hp=s.maxHp;p.mana=s.maxMana;return count;}
function addItem(p,itemId,extra={}){const def=ITEMS[itemId];if(!def)return;const item={uid:id(),itemId,name:def.name,type:def.type,slot:def.slot||null,quality:def.quality||'normal',plus:extra.plus||0,blessed:!!extra.blessed};p.inventory.push(item);return item;}
function dropForMonster(p,m){const t=MONSTER_TEMPLATES.find(v=>v.id===m.template);const loot=[];for(const d of (t.drops||[])){if(Math.random()<d.chance){const item=addItem(p,d.item);loot.push(item);}}if(Math.random()<.75){const amount=50+Math.floor(Math.random()*200);p.gold+=amount;loot.push({gold:amount});}if(Math.random()<.5){const cp=25+Math.floor(Math.random()*150);p.cp+=cp;loot.push({cp});}return loot;}
function updateQuest(p,mapId){for(const qid of Object.keys(QUESTS)){const q=QUESTS[qid];const st=p.quests[qid];if(!st||st.done)continue; if(qid==='desert_trial'&&mapId!=='desert')continue;if(qid==='mountain_hunt'&&mapId!=='ape_mountain')continue;st.progress++;if(st.progress>=q.target){st.done=true;p.exp+=q.reward.exp;p.gold+=q.reward.gold;p.cp+=q.reward.cp;}}}
function canUseQuest(p,qid){const q=QUESTS[qid];return q&&p.level>=q.minLevel;}

wss.on('connection',ws=>{
  let pid=null;
  send(ws,'hello',{version:'3.0.0',architecture:'classic-mmorpg',maps:Object.values(MAPS).map(({id,name,level})=>({id,name,level}))});
  ws.on('message',raw=>{
    let m;try{m=JSON.parse(raw)}catch{return;}
    if(m.type==='login'){
      const name=cleanName(m.name);let p=DB.accounts[name]?hydrate(DB.accounts[name]):makePlayer(name,m.classId&&CLASSES[m.classId]?m.classId:'warrior');
      if(DB.accounts[name]&&m.classId&&CLASSES[m.classId]&&!DB.accounts[name].classId)p.classId=m.classId;
      p.ws=ws;pid=p.id;players.set(pid,p);send(ws,'login_ok',{player:publicPlayer(p),state:mapState(p.mapId,pid),skills:SKILLS[p.classId]});broadcastMap(p.mapId,{type:'player_join',player:publicPlayer(p)});return;
    }
    if(!pid)return; const p=players.get(pid);if(!p)return;
    if(m.type==='move'){
      const map=MAPS[p.mapId];p.x=clamp(Number(m.x)||p.x,2,map.w-2);p.y=clamp(Number(m.y)||p.y,2,map.h-2);
      for(const e of map.exits||[]){if(Math.hypot(p.x-e.x,p.y-e.y)<1.6){p.mapId=e.to;p.x=e.tx;p.y=e.ty;send(ws,'map_changed',{player:publicPlayer(p),state:mapState(p.mapId,pid),skills:SKILLS[p.classId]});break;}}
      broadcastMap(p.mapId,{type:'player_move',player:publicPlayer(p)});return;
    }
    if(m.type==='attack'){
      const target=monsters.get(String(m.target));if(!target||target.mapId!==p.mapId)return;
      const s=classStats(p);const range=(SKILLS[p.classId]||[])[0]?.range||s.range||2; if(dist(p,target)>range+1)return;
      const skillId=m.skillId;const skill=(SKILLS[p.classId]||[]).find(v=>v.id===skillId);let damage=Math.max(1,s.atk-target.def+Math.floor(Math.random()*12));
      if(skill){if(p.mana<skill.cost)return send(ws,'error',{message:'Not enough mana'});p.mana-=skill.cost;damage=Math.floor(damage*skill.damage);}
      target.hp-=damage;target.target=p.id;const defeated=target.hp<=0;let loot=[];
      if(defeated){p.exp+=target.exp;p.gold+=target.gold[0]+Math.floor(Math.random()*(target.gold[1]-target.gold[0]+1));p.kills[target.template]=(p.kills[target.template]||0)+1;updateQuest(p,p.mapId);loot=dropForMonster(p,target);for(const item of loot.filter(x=>x.uid)){const g={id:'d'+seq++,mapId:p.mapId,x:target.x,y:target.y,item};groundItems.set(g.id,g);}monsters.delete(target.id);const lv=levelUp(p);if(lv)send(ws,'level_up',{levels:lv,level:p.level});}
      send(ws,'combat',{targetId:target.id,damage,defeated,loot,player:publicPlayer(p)});broadcastMap(p.mapId,{type:'combat_fx',x:target.x,y:target.y,targetId:target.id,damage,defeated});if(defeated)setTimeout(()=>{const type=target.template;spawnMonster(target.mapId,type,target.x,target.y);broadcastMap(target.mapId,{type:'monster_respawn'});},4000);return;
    }
    if(m.type==='pickup'){const d=groundItems.get(String(m.id));if(!d||d.mapId!==p.mapId||dist(p,d)>3)return;groundItems.delete(d.id);if(d.item) p.inventory.push(d.item);send(ws,'inventory',{player:publicPlayer(p)});broadcastMap(p.mapId,{type:'ground_removed',id:d.id});return;}
    if(m.type==='use_item'){const item=p.inventory.find(i=>i.uid===m.uid);if(!item)return;const def=ITEMS[item.itemId];if(def.type==='consumable'){const s=classStats(p);if(def.heal)p.hp=clamp(p.hp+def.heal,0,s.maxHp);if(def.mana)p.mana=clamp(p.mana+def.mana,0,s.maxMana);p.inventory=p.inventory.filter(i=>i.uid!==item.uid);send(ws,'inventory',{player:publicPlayer(p)});}return;}
    if(m.type==='equip'){const item=p.inventory.find(i=>i.uid===m.uid);if(!item||!item.slot)return;const old=p.equipment[item.slot];p.equipment[item.slot]=item;p.inventory=p.inventory.filter(i=>i.uid!==item.uid);if(old)p.inventory.push(old);const s=classStats(p);p.hp=clamp(p.hp,0,s.maxHp);send(ws,'inventory',{player:publicPlayer(p)});return;}
    if(m.type==='npc'){const npc=NPCS.find(n=>n.id===m.npcId&&n.map===p.mapId);if(!npc)return;let response={npc,options:[]};if(npc.kind==='shop')response.options=[{action:'buy',itemId:1301,price:5000},{action:'buy',itemId:1302,price:5000},{action:'buy',itemId:1001,price:25000}];if(npc.kind==='teleport')response.options=Object.values(MAPS).filter(x=>x.id!==p.mapId).map(x=>({action:'teleport',mapId:x.id,name:x.name,level:x.level}));if(npc.kind==='quest')response.options=[{action:'quest',questId:'mountain_hunt'}];if(npc.kind==='trainer')response.options=[{action:'quest',questId:'first_hunt'}];send(ws,'npc_dialog',response);return;}
    if(m.type==='npc_action'){if(m.action==='buy'){const def=ITEMS[m.itemId];const price=Number(m.price)||0;if(def&&p.gold>=price){p.gold-=price;addItem(p,m.itemId);send(ws,'inventory',{player:publicPlayer(p)});}}if(m.action==='teleport'&&MAPS[m.mapId]&&p.level>=MAPS[m.mapId].level){p.mapId=m.mapId;p.x=MAPS[m.mapId].spawn.x;p.y=MAPS[m.mapId].spawn.y;send(ws,'map_changed',{player:publicPlayer(p),state:mapState(p.mapId,pid),skills:SKILLS[p.classId]});}if(m.action==='quest'&&QUESTS[m.questId]&&canUseQuest(p,m.questId)){p.quests[m.questId]=p.quests[m.questId]||{progress:0,done:false};send(ws,'quest',{quest:QUESTS[m.questId],status:p.quests[m.questId]});}return;}
    if(m.type==='chat'){const msg=String(m.message||'').slice(0,180);if(msg)broadcastMap(p.mapId,{type:'chat',name:p.name,message:msg});return;}
    if(m.type==='sync'){send(ws,'sync_state',{state:mapState(p.mapId,pid),player:publicPlayer(p),skills:SKILLS[p.classId]});return;}
    if(m.type==='save'){savePlayer(p);send(ws,'saved');return;}
    if(m.type==='gm'){
      if(p.name!=='AbuTalia')return;const a=m.action;
      if(a==='max'){p.level=130;p.exp=0;p.gold=100000000;p.cp=100000;p.hp=classStats(p).maxHp;p.mana=classStats(p).maxMana;addItem(p,1201);addItem(p,1202);addItem(p,1002,{plus:12});addItem(p,1102,{plus:12});send(ws,'inventory',{player:publicPlayer(p)});}
      if(a==='spawn_boss'){spawnMonster(p.mapId,'ape_king',p.x+3,p.y);broadcastMap(p.mapId,{type:'monster_respawn'});}
      if(a==='announce')broadcastMap(p.mapId,{type:'system',message:String(m.message||'GM announcement').slice(0,180)});
      return;
    }
  });
  ws.on('close',()=>{if(pid){const p=players.get(pid);if(p){savePlayer(p);players.delete(pid);broadcastMap(p.mapId,{type:'player_leave',id:p.id});}}});
});

setInterval(()=>{for(const m of monsters.values()){if(m.target){const p=players.get(m.target);if(!p||p.mapId!==m.mapId||dist(p,m)>9)m.target=null;else if(Math.random()<.35){const s=classStats(p);p.hp-=Math.max(1,m.atk-s.def);if(p.hp<=0){p.hp=Math.floor(s.maxHp*.5);p.x=MAPS[p.mapId].spawn.x;p.y=MAPS[p.mapId].spawn.y;send(p.ws,'death',{player:publicPlayer(p)});}}}}},1500);
setInterval(()=>{for(const p of players.values())savePlayer(p);for(const [id,d] of groundItems)if(Date.now()-d.createdAt>180000)groundItems.delete(id);},30000);

app.get('/health',(req,res)=>res.json({ok:true,version:'3.0.0',players:players.size,maps:Object.keys(MAPS).length,monsters:monsters.size}));
app.get('/api/world',(req,res)=>res.json({version:'3.0.0',maps:MAPS,npcs:NPCS,classes:CLASSES,items:ITEMS,skills:SKILLS,quests:QUESTS}));
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
server.listen(PORT,'0.0.0.0',()=>console.log(`Talia Online V3 listening on ${PORT}`));
