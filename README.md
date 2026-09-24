# Talia Online V3

Original browser MMORPG foundation inspired by the *classic 2D MMORPG* experience and designed around a 5065-era server architecture.

## What V3 adds

- Browser client + WebSocket multiplayer server
- Five connected world maps: Twin City, Phoenix Castle, Desert City, Bird Island, Ape Mountain
- Original NPC system: shops, teleports, trainer, quests
- Four classes: Warrior, Trojan, Archer, Taoist
- Levels, EXP, HP, Mana, Gold, CP
- Normal attacks and class skills
- Monster AI, respawns, bosses, drops
- Inventory, equipment and consumables
- Quests and quest progress
- Chat and multiplayer player visibility
- GM account (`AbuTalia`) with max/reward, boss spawn and announcement commands
- JSON persistence for accounts/characters
- `/health` and `/api/world` endpoints
- Docker/Back4App ready
- Mobile touch controls + keyboard/mouse

## Run

```bash
npm install
npm start
```

Open `http://localhost:10000`.

## Important

This project does **not** include Conquer Online/TQ Digital's proprietary client, sprites, maps, sounds, text, or other copyrighted assets. The client visuals in this repository are original procedural drawings and UI. The project can use public interoperability documentation as a technical reference; it does not bundle proprietary client assets.

## Technical references

The Conquer Online community GitHub organization publishes public server/client-development documentation and projects. Redux documents a 5065-era server architecture, while the community wiki documents packet types, cryptography, client file formats, constants, and system overviews. See:

- https://github.com/conquer-online/redux
- https://github.com/conquer-online/wiki
- https://github.com/conquer-online/cops-protocols-doc

Before redistributing third-party source code, verify and preserve the applicable license. This repository itself contains only original Talia Online code.
