# Don't Be A Square — Player Manual & Strategy Guide

Welcome to the definitive gameplay guide for **Don't Be A Square**, the fast-paced competitive action puzzle game inspired by *Panel de Pon* and *Tetris Attack*.

Whether you are matching your first trio of slimes or engineering $x14$ cascading chain reactions in competitive multiplayer, this guide covers every rule, mechanic, and advanced strategy you need to master the board.

---

## 📖 Table of Contents

1. [Core Rules & Objective](#1-core-rules--objective)
2. [Universal Controls](#2-universal-controls)
3. [Game Engine Mechanics](#3-game-engine-mechanics)
   - [Panel Swapping & Gravity](#panel-swapping--gravity)
   - [Rising Stack & Fast Lift](#rising-stack--fast-lift)
   - [Stop Time & Danger Grace](#stop-time--danger-grace)
4. [Combos & Cascading Chains](#4-combos--cascading-chains)
   - [Combos (Simultaneous Matches)](#combos-simultaneous-matches)
   - [Chains (Cascading Reactions)](#chains-cascading-reactions)
   - [The Stop Time Freeze Table](#the-stop-time-freeze-table)
5. [Garbage Mechanics](#5-garbage-mechanics)
   - [Garbage Types & Dimensions](#garbage-types--dimensions)
   - [Shattering & Morphing](#shattering--morphing)
6. [Game Modes](#6-game-modes)
   - [Challenge Mode (Road to Champion)](#challenge-mode-road-to-champion)
   - [Endless Marathon](#endless-marathon)
   - [Online Multiplayer](#online-multiplayer)
7. [Advanced Strategy & Master Techniques](#7-advanced-strategy--master-techniques)
   - [Staircase Chains](#staircase-chains)
   - [Sandwich Cascades](#sandwich-cascades)
   - [Mid-Air Catch Swapping](#mid-air-catch-swapping)
   - [Threat Buffer Management](#threat-buffer-management)
   - [Clutch Recovery Under Heavy Garbage](#clutch-recovery-under-heavy-garbage)
8. [Options & Statistics Dashboard](#8-options--statistics-dashboard)
   - [Telemetry & Performance Tracking](#telemetry--performance-tracking)
   - [Controls & Audio Customization](#controls--audio-customization)

---

## 1. Core Rules & Objective

*Don't Be A Square* takes place on a **6-column by 12-row** playing grid filled with colorful jelly slimes:
* 🔴 **Ruby Red**
* 🔵 **Ocean Blue**
* 🟢 **Forest Green**
* 🟡 **Lemon Yellow**
* 🟣 **Amethyst Purple**
* 🩵 **Cyan Mint**

### The Objective:
Keep your slimes from reaching the ceiling! Swap adjacent horizontal slimes to form matching lines of **3 or more** identical colors horizontally or vertically. Cleared slimes vanish in a splash of particles, allowing blocks above them to drop into the empty space below.

---

## 2. Universal Controls

*Don't Be A Square* supports seamless cross-platform input across desktop keyboard, physical gamepads, and touchscreens.

### Desktop Keyboard
| Action | Default Key | Remappable? | Description |
| :--- | :--- | :--- | :--- |
| **Move Left** | `Left Arrow` / `A` | ✅ Yes | Move selection cursor left |
| **Move Right** | `Right Arrow` / `D` | ✅ Yes | Move selection cursor right |
| **Move Up** | `Up Arrow` / `W` | ✅ Yes | Move selection cursor up |
| **Move Down** | `Down Arrow` / `S` | ✅ Yes | Move selection cursor down |
| **Swap Slimes** | `Space` / `X` | ✅ Yes | Swap the two slimes inside cursor |
| **Fast Lift** | `Shift` / `R` | ✅ Yes | Hold to rapidly raise the stack |
| **Pause / Menu** | `Esc` | ✅ Yes | Pause game or exit dialogs |

> ⚙️ *Keys can be customized in the **Options & Guide > Controls** tab and persist automatically via `localStorage`.*

### Gamepad / Controller (Xbox / PlayStation / USB / Bluetooth)
* **Move Cursor:** D-Pad or Left Analog Stick
* **Swap Slimes:** Button A (Xbox) / Cross ✕ (PlayStation) / Button 0
* **Fast Lift:** Button B (Xbox) / Circle ◯ (PlayStation) / Left Shoulder (L1)
* **Pause Game:** Start / Menu button
* *Auto-detected with live visual status indicator and haptic feedback.*

### Mobile Touchscreen
* **Direct Touch Drag:** Tap any tile to position your cursor. Drag horizontally across a pair to swap them with zero offset.
* **On-Screen Virtual D-Pad:** Compact directional arrows located at the bottom-left of the screen.
* **Action Pills:**
  * **Mint Green Pill (`⬆ LIFT`):** Hold to raise the stack.
  * **Candy Pink Pill (`SWAP 🔄`):** Tap to swap the two tiles currently selected.

---

## 3. Game Engine Mechanics

### Panel Swapping & Gravity
1. A cursor always highlights **two adjacent horizontal cells** $(x, y)$ and $(x+1, y)$.
2. When you trigger a swap, the two panels exchange positions with a juicy slide animation.
3. If either slime now has empty space beneath it, **gravity immediately takes over**, pulling the slime downward until it hits a solid block or the bottom of the grid.
4. You can swap an empty cell with an adjacent slime to deliberately drop slimes into specific holes!

### Rising Stack & Fast Lift
* Over time, new rows push up from the bottom of the grid.
* The rise speed increases with difficulty level in Endless Marathon and against higher-tier AI opponents in Challenge Mode.
* When you need more slimes to build a chain or clear garbage, hold **Fast Lift** (`Shift` / `B` / `⬆ LIFT`) to push rows up immediately.

### Stop Time & Danger Grace
* **Stop Time:** Whenever a match is made, the stack **stops rising** for a short duration while panels pop.
* **Danger Grace:** When any column of slimes touches the top ceiling, an emergency siren sounds and a Danger Grace timer begins ticking down (12.0s on Novice down to 3.5s on Grandmaster).
  * Making any match immediately **pauses the countdown** and stops the stack.
  * If you clear enough slimes to drop all columns below the ceiling, the timer resets!
  * Only when the timer reaches `0.0s` does top-out game over occur.

### The 5-Step Difficulty System
Players can select their preferred difficulty on the Fighter Select screen or in the Options Menu:
* 🟢 **Novice:** 5 slime colors, $0.75\times$ rise speed, $1.4\times$ stop-time freeze, and generous 12.0s Danger Grace. AI is relaxed with frequent exploratory moves.
* 🔵 **Adept (Standard):** 5 slime colors, $1.0\times$ rise speed, $1.0\times$ stop-time freeze, and 10.0s Danger Grace. Balanced competitive baseline.
* 🟡 **Expert:** **6 slime colors** (introduces Cyan Mint), $1.5\times$ rise speed, $0.75\times$ stop-time freeze, and 7.0s Danger Grace. AI executes fast routes with low error.
* 🟠 **Master:** 6 slime colors, $2.1\times$ rise speed, $0.5\times$ stop-time freeze, 5.0s Danger Grace, and **1 initial handicap garbage slab**. AI reacts in rapid bursts.
* 🔴 **Grandmaster:** 6 slime colors, $3.0\times$ blazing rise speed, $0.3\times$ stop-time freeze, 3.5s Danger Grace, and **2 initial handicap garbage slabs**. AI has 0% mistake rate and aggressive chain prioritization.

---

## 4. Combos & Cascading Chains

### Combos (Simultaneous Matches)
A **Combo** is achieved when you match 4 or more slimes in a single swap:
* **4-Match Combo:** Sends a **3-wide** garbage block to your opponent.
* **5-Match Combo:** Sends a **4-wide** garbage block.
* **6-Match Combo:** Sends a **5-wide** garbage block.
* **7+ Match Combo:** Sends a full **6-wide** garbage line!

### Chains (Cascading Reactions)
A **Chain** occurs when slimes drop due to gravity and automatically form *new* matches upon landing without additional manual swaps:
$$\text{Match 1} \xrightarrow{\text{Gravity Fall}} \text{Match 2 (x2 Chain)} \xrightarrow{\text{Gravity Fall}} \text{Match 3 (x3 Chain)} \dots$$

* Chains are the ultimate weapon in competitive play.
* A $x2$ chain sends a full **6-wide** single-row solid garbage block.
* A $x3$ chain sends a full **6-wide $\times 2$-row** garbage block.
* A $x4$ chain sends a full **6-wide $\times 3$-row** garbage block.
* Higher chains can drop massive multi-layer slabs capable of instantly pushing an opponent to the ceiling!

### The Stop Time Freeze Table
Every combo and chain step awards valuable **Stop Time** that freezes your stack, giving you precious seconds to plan your next cascade:

| Event | Stop Time Awarded | Garbage Sent |
| :--- | :--- | :--- |
| **Basic 3-Match** | ~1.2s | None |
| **4-Combo** | ~2.0s | 3-wide Block |
| **5-Combo** | ~2.6s | 4-wide Block |
| **6-Combo** | ~3.2s | 5-wide Block |
| **x2 Chain** | ~3.0s | 6-wide Solid Block |
| **x3 Chain** | ~4.5s | 6-wide $\times 2$ Solid Block |
| **x4+ Chain** | ~6.0s+ | 6-wide $\times 3+$ Colossal Block |

---

## 5. Garbage Mechanics

When you battle against AI bots or human players online, offensive combos and chains drop heavy **Garbage Blocks** from above.

```
+-----------------------------------+
|      [====== GARBAGE ======]      |  <- Dropped from ceiling
+-----------------------------------+
| 🔴 | 🔴 | 🔴 | 🔵 | 🟡 | 🟢 |  <- Normal slime match adjacent
```

### Shattering & Morphing
1. Garbage blocks sit inertly on top of your slimes, preventing you from reaching the tiles underneath.
2. When you make a match that is **directly adjacent** (above, below, or to the sides) of a garbage block, the garbage block enters a **shatter animation**.
3. It pops into individual regular jelly slimes that match the current board distribution!
4. The newly morphed slimes immediately experience gravity and can trigger **massive counter-chains**!

---

## 6. Game Modes

### 1. Challenge Mode (Road to Champion)
* Select your favorite Slime Catcher and battle across the interactive world map.
* Defeat the 8 distinct AI personalities in any order:
  1. **Kiri** 🦊 (Methodical mechanic; dismantles garbage like clockwork)
  2. **Mizu** 🌊 (Fluid swordsman; patient cascading counter-attacker)
  3. **Riff** 🎸 (Blazing shredder; aggressive 4+ combos and fast lifts)
  4. **Mocha** 🐰 (Bunny alchemist; rapid swapping and unpredictable re-routes)
  5. **Ember** 🔥 (Fire dancer; crafts massive 4+ and 5-in-a-row cross clears)
  6. **Volt** ⚡ (Gecko inventor; twitchy glitch bursts with lightning speed)
  7. **Salty** 🦦 (Otter pirate; relentless raider dropping heavy slabs under pressure)
  8. **Poppy** 🐼 (Red panda idol; multi-tier cascading performances)
* **Secret Boss Encounters:**
  * **Void Slime** 👑 (Cosmic Void Champion): Appears upon conquering the map on **Master** difficulty! Defeat it to unlock Void Slime for multiplayer.
  * **Nano Banana** 🍌👑 (Glitch Nanite Overlord): Legendary anomaly awaiting challengers on **Grandmaster** difficulty with hyper-twitch 130ms reflexes!
* Defeating all opponents crowns you as the Champion!

### 2. Endless Marathon
* Pure high-score survival mode.
* Stack rise speed increases at regular intervals.
* Periodic hazard garbage blocks drop to test your reflex and clearing speed.

### 3. Online Multiplayer
* Real-time 2-player competitive battles over WebSockets.
* **Private Rooms:** Share a unique 6-letter room code with a friend.
* **Quick Match:** Matchmake instantly with players in the lobby.
* **Asymmetric Mobile VS Layout:** View your opponent's real-time state via the mini radar grid and monitor the Threat Buffer bar to prepare for incoming drops.
* **Rematch System:** Once a round ends, vote **"PLAY AGAIN"** to immediately restart with synchronized random seed generation.

---

## 7. Advanced Strategy & Master Techniques

### Staircase Chains
The easiest way to build intentional chains is the **Staircase Technique**:
1. Place a pair of matching slimes (e.g. 🔴 🔴) on the bottom row.
2. In the column next to them, place the third slime (🔴) one level higher, resting on top of another pair of slimes (🔵 🔵).
3. Underneath the single 🔴, match the 🔵 🔵 with a third 🔵.
4. When the 🔵 trio clears, the top 🔴 falls directly into place with the bottom 🔴 🔴, triggering a seamless $x2$ chain!

### Sandwich Cascades
Place a matching pair of slimes separated vertically by a sacrificial slime:
```
[ 🟢 ]  <- Matching slime
[ 🟡 ]  <- Sacrificial slime (part of a separate match)
[ 🟢 ]  <- Matching slime
[ 🟢 ]  <- Matching slime
```
Clear the 🟡 horizontally; as it pops, the top 🟢 drops down to connect with the bottom pair, initiating a chain reaction!

### Mid-Air Catch Swapping
* You don't have to wait for falling slimes to land!
* As slimes fall through empty columns, you can move your cursor and **swap them mid-air**.
* Use mid-air swaps to slide a matching color into a falling column to make clutch, buzzer-beating saves during Danger Grace!

### Threat Buffer Management
* In VS mode, incoming garbage does not drop instantaneously; it queues in the **Threat Buffer**.
* While you are actively popping slimes, the threat buffer is **frozen**.
* Keep chaining! As long as matches continue popping, opponent garbage will remain suspended above your grid, unable to drop until your chain ends.

### Clutch Recovery Under Heavy Garbage
* If a 4-row colossal garbage block lands on your board, **do not panic**.
* Build a 3-match directly underneath the bottom edge of the block.
* When that single row shatters, the entire 4-row block will morph into 24 normal slimes.
* Look for immediate matches within the newly morphed slimes to trigger a gargantuan counter-attack!

---

## 8. Options & Statistics Dashboard

Access the **Options & Guide** menu from the main title or pause screen to tailor your experience and track your long-term puzzle mastery.

### Telemetry & Performance Tracking
The **Statistics** tab provides deep telemetry powered by `StatsManager`, automatically split into 4 comprehensive sub-views:
* **Lifetime Summary:** Track total games played, victory rate, total slimes matched, lines cleared, and cumulative playtime across all sessions.
* **Performance Charts:** Visual graphs illustrating your combo distribution (4+, 5+, 6+, 7+) and cascading chain multipliers ($x2$ through $x14+$).
* **Fighter Breakdown:** Matchup win/loss records and play counts for every Slime Catcher on the roster.
* **Difficulty Records:** High score, top survival time, and maximum combo record achieved across Novice, Adept, Expert, Master, and Grandmaster ladders.
> 🛡️ *All statistics and competitive achievements are protected in local storage to prevent accidental data loss.*

### Controls & Audio Customization
* **Audio & Settings:** Independent master sliders for procedural sound effects, retro arcade BGM tracks, and fullscreen/vibration toggles.
* **Controls Mapping:** Complete keyboard key remapping with conflict detection and live gamepad connection indicators with haptic testing.

---

*Now get out there and show the world that you're no square! Happy popping!*
