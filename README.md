# Don't Be A Square 🟩✨

[![Live Demo](https://img.shields.io/badge/Live%20Demo-dbas.aredpanic.com-ff69b4?style=for-the-badge&logo=google-chrome&logoColor=white)](https://dbas.aredpanic.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Phaser 3](https://img.shields.io/badge/Phaser-3.80-e056fd?style=for-the-badge&logo=html5&logoColor=white)](https://phaser.io/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.7-010101?style=for-the-badge&logo=socketdotio&logoColor=white)](https://socket.io/)
[![Tests](https://img.shields.io/badge/Vitest-75%20Passing-2ed573?style=for-the-badge&logo=vitest&logoColor=white)](https://vitest.dev/)
[![PWA Ready](https://img.shields.io/badge/PWA-Installable-20bf6b?style=for-the-badge&logo=pwa&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)

An action puzzle game inspired by the legendary mechanics of *Panel de Pon* and *Tetris Attack*, reimagined with modern web technology. Built from scratch with **Phaser 3**, **TypeScript**, and **Vite**, featuring 8 unique anime chibi Slime Catchers, distinct AI bot personalities, real-time WebSocket online multiplayer, universal gamepad/keyboard/touch controls, and candy-themed audiovisual aesthetics.

> 📖 **Looking for in-depth gameplay mechanics, combo setups, and master strategies?** Check out the [Player Manual & Strategy Guide](docs/GUIDE.md)!

---

## 🎮 Play Instantly in Your Browser

* 🌐 **Live Web App:** [https://dbas.aredpanic.com](https://dbas.aredpanic.com)
* 📱 **PWA Installable:** Tap *"Install App"* or *"Add to Home Screen"* on Android, iPhone/Safari, Chrome, or Edge for fullscreen offline play with zero address bar distractions.

---

## ✨ Key Features

### 🧩 Classic Action Puzzle Mechanics
* **Horizontal Panel Swapping:** Fast, responsive horizontal tile swaps with instant gravity and fluid squishy animations.
* **Cascading Chain Reactions ($x2, x3, \dots, x14+$):** Panels dropping into new matches trigger dynamic chain multipliers that pause stack rise and send colossal garbage blocks to opponents.
* **Simultaneous Combos (4+, 5+, 6+):** Multi-slime matches send targeted combo slabs.
* **Stop Time & Dynamic Danger Grace:** Whenever slimes reach the ceiling, a high-tension emergency alarm sounds with a survival countdown (12.0s on Novice down to 3.5s on Grandmaster). Making quick matches halts the rise and buys precious breathing room.
* **5-Step Difficulty Ladder:** Choose between **Novice**, **Adept**, **Expert**, **Master**, or **Grandmaster**. Unlocks 6th color (Mint Cyan) on Expert+, compressed freeze windows, fast stack speeds, and handicap challenge garbage slabs.
* **Mid-Air Catch Swapping:** Catch falling slimes mid-air to clutch buzzer-beating saves before they hit the stack.

### 🕹️ Universal Controls & Input Architecture
* **Desktop Keyboard:** Fully customizable key remapping with persistent `localStorage` storage (WASD, Arrow Keys, Space, Shift, Esc).
* **Native Gamepad API Integration:** Plug-and-play controller support for Xbox, PlayStation, and generic USB/Bluetooth gamepads with live status indicator and haptic rumble.
* **Zero-Offset Mobile Touch:** Touch controls engineered for precision—direct tile swiping with selection glow, plus an on-screen virtual D-Pad and Mint/Pink action pills.

### ⚔️ Game Modes
* **Challenge Mode (Road to Champion):** Select your fighter and battle through 8 distinct AI bot personalities on an interactive storybook map to claim the Champion Crown.
* **Endless Marathon:** Classic high-score survival mode with escalating speed levels and periodic hazard drops.
* **Real-Time Online Multiplayer:** Low-latency 2-player battles powered by Socket.IO with 6-letter private room codes, public quick match, and instant **Play Again** rematch voting.

### 💥 Signature Attack Animations & Ballistic Garbage Delivery
* **6-Frame Attack Sequences:** Every Slime Catcher and secret boss unleashes their signature 6-frame combat animation, dialogue quote, and themed SFX when sending garbage.
* **Ballistic Arc Delivery:** Garbage blocks do not merely pop into existence—they travel dynamically across screen via animated parabolic ballistic vectors into the opponent's threat buffer with screen impact feedback.
* **Combat Hurt & Panic Reactions:** Character portraits react dynamically with tremble, bounce, and hurt frames when under ceiling pressure or receiving heavy slabs.

### 📱 Mobile-First Responsive Design (Phase 4 VS Layout)
* **Asymmetric Mobile VS Layout:** Tailored for vertical mobile screens (iPhone SE, 13/14/15, Pixel 7/8). Features a top-mounted mini-radar grid showing opponent board state, a flashing Threat Buffer bar for incoming garbage, and generous tap gutters.
* **Responsive Options & Guide Screen:** Dynamic geometric scaling that guarantees zero overlap between tab navigation and controls across mobile and widescreen desktop displays with direct **Statistics** access from the main title.

### 📊 Comprehensive Telemetry & Statistics
* **Options Statistics Dashboard:** In-depth telemetry tab featuring 4 specialized views: Lifetime Summary, Performance Charts, Character Matchup Breakdown, and Difficulty Records.
* **Granular Metrics Tracking:** Real-time recording of total matches, simultaneous combos, max cascade chains, cleared lines, playtime, and win/loss records across AI and multiplayer battles.
* **Persistent & Protected Records:** Real-time persistence via `StatsManager` with protected records to safeguard your competitive history.

### ⚡ Optimized WebP Asset Pipeline & PWA
* **Modern WebP Compression:** Preloaded assets converted to high-fidelity WebP format, achieving a 70%+ reduction in initial download size.
* **On-Demand Combat Loading:** Attack spritesheets and audio stems stream asynchronously on-demand to keep initial bundle size minimal.
* **Service Worker v69:** Instant offline caching and PWA app-shell persistence for zero-latency mobile play.

### 🎵 Procedural Audio & Soundtrack
* Zero-latency Web Audio API procedural synthesizer for mechanical clicks, pops, swaps, combo chimes, and panic sirens.
* Nostalgic retro arcade BGM tracks composed with generative AI assistance for menus, character select, battles, and danger panic.

---

## 👥 The Slime Catchers & Secret Boss

Meet the colorful cast of chibi puzzle fighters in the enchanted Candy Forest:

| Character | Species & Theme | Personality & Playstyle |
| :--- | :--- | :--- |
| **Kiri** 🦊 | Mechanic Fox Girl | Methodical and precise. Dismantles garbage blocks like clockwork. |
| **Mizu** 🌊 | Axolotl Swordsman | Fluid and patient. Specializes in cascading chain reactions and counter-attacks. |
| **Riff** 🎸 | Tigress Guitarist | Blazing shredder! High tempo with loud 4+ combos and fast lifts. |
| **Mocha** 🐰 | Bunny Alchemist | Chaotic brewing! Switches tiles rapidly with unpredictable re-routes. |
| **Ember** 🔥 | Shiba Inu Fire Dancer | Fireworks fanatic! Obsessively crafts massive 4+ and 5-in-a-row cross clears. |
| **Volt** ⚡ | Gecko Inventor | Twitchy glitch genius! Moves in rapid overdrive bursts with lightning reflexes. |
| **Salty** 🦦 | Otter Pirate | Relentless raider! Sends heavy slabs and goes full pirate raid under pressure. |
| **Poppy** 🐼 | Red Panda Idol | Rhythm idol! Dances across the board with multi-tier cascading performances. |
| **Void Slime** 👑 | Cosmic Void Champion | **Master Secret Boss!** Ultra cute crowned slime wielding space magic. Unlocks for Online Multiplayer upon defeat! |
| **Nano Banana** 🍌👑 | Glitch Nanite Overlord | **Grandmaster Hidden Boss!** Legendary reality-peeling anomaly with 130ms twitch instincts and 3.0x cascade bias! |

---

## 🎯 Quick Controls Reference

| Action | Desktop Keyboard | Gamepad (Xbox / PS) | Mobile Touchscreen |
| :--- | :--- | :--- | :--- |
| **Move Cursor** | Arrow Keys / `W`, `A`, `S`, `D` | D-Pad / Left Stick | Tap any tile or use virtual D-Pad |
| **Swap Slimes** | `Space` / `X` | Button A / ✕ | Drag horizontally across tiles or tap `SWAP 🔄` |
| **Fast Lift** | `Shift` / `R` | Button B / ◯ / L1 | Flick upward on board or hold `⬆ LIFT` |
| **Pause / Menu**| `Esc` | Start / Options | Tap `⏸` pause button at top-right |

---

## 🛠️ Technical Architecture & Stack

```
                       ┌──────────────────────────────────────────────┐
                       │            Browser Client (PWA)             │
                       │  • Phaser 3.80 Canvas / WebGL Game Engine    │
                       │  • TypeScript 5.5 + Vite 5.4 Build System    │
                       │  • Web Audio API Procedural SFX Synthesizer  │
                       │  • Service Worker v69 Offline App Shell Cache│
                       └──────────────────────┬───────────────────────┘
                                              │
                                 WebSockets / Socket.IO
                                              │
                       ┌──────────────────────▼───────────────────────┐
                       │           Multiplayer Server                │
                       │  • Node.js 18+ Backend (dist-server/index.cjs)│
                       │  • Socket.IO 4.7 Real-Time Room Manager      │
                       │  • Seed Synchronization for Deterministic RNG│
                       │  • Automated Keepalive Cron & Process Daemon │
                       └──────────────────────────────────────────────┘
```

* **Client Engine:** [Phaser 3.80](https://phaser.io/) with `Phaser.Scale.RESIZE` for seamless cross-resolution adaptation.
* **Language & Tooling:** [TypeScript 5.5](https://www.typescriptlang.org/) in strict mode, bundled via [Vite](https://vitejs.dev/) and [esbuild](https://esbuild.github.io/).
* **Multiplayer Protocol:** [Socket.IO](https://socket.io/) rooms with synchronized random seed generation, rematch voting sets, and graceful disconnect management.
* **Testing Suite:** [Vitest](https://vitest.dev/) with 75 automated unit tests across 13 test suites verifying game engine physics, garbage collision, rematch synchronization, touch precision, statistics persistence, difficulty ladder scaling, sound effects, and layout geometry.

---

## 🚀 Getting Started (Local Development)

### Prerequisites
* [Node.js](https://nodejs.org/) v18.0.0 or higher
* npm v9.0.0 or higher

### Installation
```bash
# 1. Clone repository
git clone https://github.com/miguelp001/dont-be-a-square.git
cd dont-be-a-square

# 2. Install dependencies
npm install
```

### Running Locally
To run both the Vite client dev server and the WebSocket multiplayer server concurrently:
```bash
npm run dev:all
```
* **Client Game:** [http://localhost:5173](http://localhost:5173)
* **Multiplayer Server:** `http://localhost:3001`

Alternatively, run them in separate terminals:
```bash
# Terminal 1: Client Dev Server
npm run dev

# Terminal 2: Multiplayer WebSocket Server
npm run server
```

### Running Automated Tests
```bash
# Run full Vitest unit test suite (75 tests across 13 suites)
npm test

# Run tests in watch mode
npm run test:watch
```

### Building for Production
```bash
# Type check, bundle client (Vite), and bundle server (esbuild)
npm run build

# Preview production build locally
npm run preview
```

### Deployment
Deployment to Dreamhost VPS is automated via `scripts/deploy.py`:
```bash
# Deploy static client assets and restart backend server daemon
python scripts/deploy.py
```

---

## 📂 Project Structure

```
dont-be-a-square/
├── assets/                  # High-res character portraits, icons, and audio
├── docs/
│   └── GUIDE.md             # Comprehensive Player Manual & Strategy Guide
├── public/
│   ├── favicon.png
│   ├── manifest.webmanifest # PWA Web App Manifest
│   └── sw.js                # Service Worker cache controller (v69)
├── scripts/
│   └── deploy.py            # Automated SFTP deployment & server keepalive runner
├── server/
│   └── index.ts             # Socket.IO multiplayer matchmaking & room manager
├── src/
│   ├── main.ts              # Phaser 3 Game entry point & config
│   ├── input/               # TouchController with zero-offset precision
│   ├── net/                 # SocketManager multiplayer client
│   ├── objects/             # Board, Panel, Cursor, GarbageBlock, AIBot
│   ├── scenes/              # GameScene, MenuScene, OptionsMenuScene, LobbyScene,
│   │                        # ChallengeMapScene, CharacterSelectScene, BootScene
│   ├── ui/                  # OptionsMenuLayout, VsLayout
│   └── utils/               # Settings, SoundFx, CuteUI, Constants
├── tests/                   # Vitest unit test suites (75 passing tests across 13 suites)
├── package.json
└── tsconfig.json
```

---

## 🤖 AI Disclosure & Transparency

In alignment with responsible AI development:
* **Character Concept Art & Chibi Portraits:** Generated and styled with the assistance of Google DeepMind AI models.
* **Music Themes & Procedural Synthesizers:** Composed and synthesized with generative AI assistance for authentic retro arcade vibes.
* **Code & Game Engine:** Full physics simulation, panel matching algorithms, WebSocket multiplayer networking, and universal controls engineered with AI pair-programming in TypeScript & Phaser 3.

---

## 📜 License & Acknowledgments

This project is created for educational and entertainment purposes. Inspired by the timeless puzzle designs of *Panel de Pon* and *Tetris Attack* (© Nintendo / Intelligent Systems).
