# Don't Be A Square

An action puzzle game inspired by *Panel de Pon* and *Tetris Attack*, built with **Phaser 3**, **TypeScript**, and **Vite**. Features 8 unique anime chibi Slime Catchers, distinct AI bot personalities, real-time online multiplayer, full mobile touch controls, and candy-themed aesthetics.

---

## ✨ Features

- **Classic Action Puzzle Gameplay**:
  - Horizontal panel swapping with instant gravity and air swaps.
  - Combos (4+ matching slimes) and Chains (cascading falls into new matches).
  - Stop Time & 6.5s Danger Grace counter to survive top-out pressure.
  - Squishy, procedural jelly slime animations and juicy particle effects.

- **Game Modes**:
  - **Challenge Mode (Road to Champion)**: Select your fighter and battle through 8 distinct AI bot personalities in any order to claim the champion crown.
  - **Endless Marathon**: High-score survival mode with escalating speed and periodic garbage drops.
  - **Online Multiplayer**: Real-time 2-player battles powered by Socket.IO with 6-letter private room codes and cross-player garbage attacks.

- **Full Mobile & Touch Support**:
  - Direct board swiping: tap to position cursor, swipe left/right to swap instantly, tap to switch, flick up to lift.
  - On-screen virtual gamepad: compact D-pad (◀ ▶ ▲ ▼), dedicated Mint Green Lift button, and Candy Pink Swap pill button.
  - Touch-optimized viewport with zero rubber-banding or accidental zoom.

- **Audio & Customization**:
  - Full BGM soundtrack for menus, character select, battles, and panic danger states.
  - Zero-latency procedural Web Audio sound synthesizer for swaps, matches, combos, and chains.
  - In-game Options Menu with persistent volume controls and AI disclosure.

---

## 🎮 Controls

| Action | Desktop Keyboard | Mobile / Touch |
| :--- | :--- | :--- |
| **Move Cursor** | Arrow Keys / `W`, `A`, `S`, `D` | Tap on any tile OR use on-screen D-Pad |
| **Swap Slimes** | `Space` / `X` / `C` | Swipe left/right on tiles OR tap `SWAP 🔄` |
| **Fast Lift** | Hold `Shift` / `R` | Hold `⬆ LIFT` button OR flick up on board |
| **Pause / Menu** | `Esc` | Tap `⏸` at top-right |

---

## 🛠️ Tech Stack

- **Client**: [Phaser 3.80](https://phaser.io/), [TypeScript 5.5](https://www.typescriptlang.org/), [Vite 5.4](https://vitejs.dev/)
- **Multiplayer Server**: [Node.js](https://nodejs.org/), [Socket.IO 4.7](https://socket.io/), [tsx](https://github.com/privatenumber/tsx)
- **Audio**: Procedural Web Audio API synthesizer + Lyria generative BGM
- **Art**: Kawaii procedural canvas slimes + generative chibi character art

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm or yarn

### Installation

```bash
git clone https://github.com/miguelp001/dont-be-a-square.git
cd dont-be-a-square
npm install
```

### Running Locally

Run both the Vite dev server and WebSocket multiplayer server concurrently:
```bash
npm run dev:all
```

Or run them in separate terminals:
```bash
# Terminal 1: Client web server (http://localhost:5173)
npm run dev

# Terminal 2: Multiplayer WebSocket server (http://localhost:3001)
npm run server
```

### Building for Production

```bash
npm run build
npm run preview
```

---

## 📁 Project Structure

```
├── assets/              # Chibi character portraits and BGM audio tracks
├── server/              # Socket.IO multiplayer room server
├── src/
│   ├── main.ts          # Game entry point and Phaser configuration
│   ├── objects/         # Board, Panel, Cursor, GarbageBlock, AIBot
│   ├── scenes/          # BootScene, PreloadScene, MenuScene, CharacterSelectScene,
│   │                    # ChallengeMapScene, GameScene, LobbyScene, OptionsMenuScene
│   ├── net/             # Socket.IO client manager
│   └── utils/           # Constants, CuteUI, Settings, SoundFx
├── index.html           # HTML entry point with mobile touch optimization
├── package.json
└── tsconfig.json
```

---

## 📜 License

This project is created for educational and entertainment purposes. Inspired by *Panel de Pon* and *Tetris Attack* (© Nintendo / Intelligent Systems).
