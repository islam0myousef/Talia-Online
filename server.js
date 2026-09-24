const http = require("http");
const path = require("path");
const express = require("express");
const { WebSocketServer } = require("ws");

const app = express();
app.use(express.static(path.join(__dirname, "public")));
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 8080;

const CONFIG = {
  goldMin: 1_000_000,
  goldMax: 100_000_000,
  cpsMin: 50_000,
  cpsMax: 100_000,
  meteorRate: 0.70,
  dragonBallRate: 0.80,
  rareItemRate: 0.30,
  weaponQuality: "SUPER"
};

const players = new Map();
const monsters = new Map();

const WORLD = { width: 2400, height: 1400 };

function id(prefix = "") {
  return prefix + Math.random().toString(36).slice(2, 10);
}

function randInt(a, b) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

function chance(rate) {
  return Math.random() < rate;
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function send(ws, type, data = {}) {
  if (ws.readyState === 1) ws.send(JSON.stringify({ type, ...data }));
}

function broadcast(type, data = {}) {
  const msg = JSON.stringify({ type, ...data });
  for (const p of players.values()) {
    if (p.ws.readyState === 1) p.ws.send(msg);
  }
}

const weaponNames = ["Blade", "Sword", "Bow", "Club", "Wand", "Spear"];
const rareNames = ["Phoenix Ring", "Dragon Armor", "Thunder Blade", "Celestial Bow"];

function createMonster() {
  const m = {
    id: id("m_"),
    name: ["Bandit", "Ape", "Birdman", "Fire Spirit", "Serpent"][randInt(0, 4)],
    x: randInt(150, WORLD.width - 150),
    y: randInt(150, WORLD.height - 150),
    hp: 100,
    maxHp: 100
  };
  monsters.set(m.id, m);
  return m;
}

for (let i = 0; i < 35; i++) createMonster();

function snapshot() {
  return {
    world: WORLD,
    config: CONFIG,
    players: [...players.values()].map(p => ({
      id: p.id, name: p.name, x: p.x, y: p.y, level: p.level,
      cps: p.cps, gold: p.gold, role: p.role
    })),
    monsters: [...monsters.values()]
  };
}

function giveDrops(p) {
  const drops = [];
  const gold = randInt(CONFIG.goldMin, CONFIG.goldMax);
  const cps = randInt(CONFIG.cpsMin, CONFIG.cpsMax);

  p.gold += gold;
  p.cps += cps;
  drops.push(`Gold +${gold.toLocaleString()}`);
  drops.push(`CPs +${cps.toLocaleString()}`);

  if (chance(CONFIG.meteorRate)) drops.push("Meteor x1");
  if (chance(CONFIG.dragonBallRate)) drops.push("DragonBall x1");

  if (chance(CONFIG.rareItemRate)) {
    const item = rareNames[randInt(0, rareNames.length - 1)];
    drops.push(`RARE: ${item}`);
  }

  // Any weapon dropped by this high-rate server is always SUPER.
  if (chance(0.35)) {
    const weapon = weaponNames[randInt(0, weaponNames.length - 1)];
    drops.push(`SUPER ${weapon}`);
  }

  send(p.ws, "drops", { drops });
}

function spawnIfNeeded() {
  while (monsters.size < 35) createMonster();
}

wss.on("connection", ws => {
  const p = {
    ws,
    id: id("p_"),
    name: "Player",
    role: "PLAYER",
    x: WORLD.width / 2,
    y: WORLD.height / 2,
    level: 1,
    cps: 0,
    gold: 0,
    lastAttack: 0
  };

  players.set(p.id, p);

  send(ws, "hello", { playerId: p.id });
  send(ws, "state", snapshot());

  ws.on("message", raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === "login") {
      p.name = String(msg.name || "Player").slice(0, 16);
      // Demo GM account. Production version will use hashed credentials.
      if (p.name.toLowerCase() === "abutalia" && msg.password === "CHANGE_ME") {
        p.role = "GM";
      }
      send(ws, "login_ok", {
        player: { id: p.id, name: p.name, role: p.role, level: p.level, cps: p.cps, gold: p.gold }
      });
      broadcast("state", snapshot());
      return;
    }

    if (msg.type === "move") {
      p.x = clamp(Number(msg.x) || p.x, 0, WORLD.width);
      p.y = clamp(Number(msg.y) || p.y, 0, WORLD.height);
      broadcast("state", snapshot());
      return;
    }

    if (msg.type === "attack") {
      const now = Date.now();
      if (now - p.lastAttack < 350) return;
      p.lastAttack = now;

      const m = monsters.get(msg.monsterId);
      if (!m) return;

      m.hp -= 100;
      if (m.hp <= 0) {
        monsters.delete(m.id);
        giveDrops(p);
        spawnIfNeeded();
      }
      broadcast("state", snapshot());
      return;
    }

    if (msg.type === "gm_config" && p.role === "GM") {
      for (const key of [
        "goldMin", "goldMax", "cpsMin", "cpsMax",
        "meteorRate", "dragonBallRate", "rareItemRate"
      ]) {
        if (msg.config && Number.isFinite(Number(msg.config[key]))) {
          CONFIG[key] = Number(msg.config[key]);
        }
      }
      send(ws, "gm_saved", { config: CONFIG });
      broadcast("state", snapshot());
      return;
    }

    if (msg.type === "gm_give" && p.role === "GM") {
      const amount = Math.max(0, Math.floor(Number(msg.amount) || 0));
      const target = players.get(msg.targetId);
      if (!target) return;
      if (msg.currency === "cps") target.cps += amount;
      if (msg.currency === "gold") target.gold += amount;
      send(ws, "notice", { text: `Gave ${amount.toLocaleString()} ${msg.currency} to ${target.name}` });
      broadcast("state", snapshot());
    }
  });

  ws.on("close", () => {
    players.delete(p.id);
    broadcast("state", snapshot());
  });
});

setInterval(() => {
  spawnIfNeeded();
  broadcast("state", snapshot());
}, 3000);

server.listen(PORT, () => {
  console.log(`Talia Online running at http://localhost:${PORT}`);
});