import Phaser from 'phaser';
import Panel, { PanelState } from './Panel';
import GarbageBlock, { GarbageState } from './GarbageBlock';
import {
  BOARD_WIDTH,
  BOARD_HEIGHT,
  BOARD_VISIBLE_HEIGHT,
  PANEL_SIZE,
  COLORS,
  BASE_RISE_SPEED,
  FAST_LIFT_SPEED,
  DANGER_GRACE_TIME,
  CHARACTERS
} from '../utils/Constants';
import { randomInt } from '../utils/Helpers';
import { SoundFx } from '../utils/SoundFx';
import { GameDifficulty, getDifficultyInfo } from '../utils/Difficulty';

export interface MatchEvent {
  panels: Panel[];
  comboSize: number;
  chainLevel: number;
  scoreGained: number;
}

export interface GarbageSnapshot {
  gridX: number;
  gridY: number;
  width: number;
  height: number;
}

export interface GarbageLandEvent {
  block: GarbageBlock;
  width: number;
  height: number;
  isLarge: boolean;
}

export default class Board extends Phaser.Events.EventEmitter {
  public scene: Phaser.Scene;
  public panels: (Panel | null)[][] = [];
  public garbageBlocks: GarbageBlock[] = [];
  public container: Phaser.GameObjects.Container;
  public boardOffsetX: number = 64;
  public boardOffsetY: number = 64;
  public scaleFactor: number = 1.0;

  /** Stack rising sub-pixel scroll offset (0 to PANEL_SIZE) */
  public stackOffsetPixels: number = 0;
  public riseSpeed: number = BASE_RISE_SPEED;
  public isLifting: boolean = false;
  public elapsedPlayTime: number = 0;

  /** Current active chain counter (1 = standard clear, 2+ = chain) */
  public activeChain: number = 1;
  public maxChain: number = 1;
  public isChainActive: boolean = false;

  /** Stack freeze/stop time in milliseconds */
  public stopTime: number = 0;

  /** Danger & Top-Out state */
  public isDanger: boolean = false;
  public dangerGraceTimer: number = DANGER_GRACE_TIME;
  public isTopOut: boolean = false;
  private dangerBeepTimer: number = 0;

  /** 5-Step Difficulty settings */
  public difficulty: GameDifficulty = GameDifficulty.ADEPT;
  public colorCount: number = 5;
  public riseSpeedMultiplier: number = 1.0;
  public stopTimeMultiplier: number = 1.0;
  public dangerGraceDuration: number = DANGER_GRACE_TIME;

  /** Input buffer queue (150ms window) so inputs during animations are never lost */
  public inputBuffer: { gridX: number; gridY: number; ttl: number }[] = [];

  /** Character & Power Meter system */
  public characterId: string = 'kiri';
  public powerMeter: number = 0; // 0 to 100
  public isPowerActive: boolean = false;
  public powerDurationTimer: number = 0;

  /** Status Effects applied to this board */
  public isReverseLiftActive: boolean = false; // Mizu's Tidal Flow
  public reverseLiftTimer: number = 0;

  public isLiftFrozen: boolean = false; // Salty's Flash Freeze
  public liftFrozenTimer: number = 0;

  public isGrooveActive: boolean = false; // Riff's Groove Extension
  public grooveTimer: number = 0;

  public isOverchargeActive: boolean = false; // Volt's Overcharge
  public overchargeTimer: number = 0;
  private poppingPanels: Set<Panel> = new Set<Panel>();
  private maskGraphics?: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, offsetX: number = 64, offsetY: number = 64, scale: number = 1.0) {
    super();
    this.scene = scene;
    this.boardOffsetX = offsetX;
    this.boardOffsetY = offsetY;
    this.scaleFactor = scale;

    this.container = scene.add.container(offsetX, offsetY);
    this.container.setScale(scale);
    this.container.setDepth(10); // Ensure panels render above backdrop (depth 1) and below frame (depth 22)

    // Geometry mask to clip the rising stack cleanly within the visible board frame
    this.maskGraphics = scene.make.graphics();
    this.maskGraphics.fillStyle(0xffffff);
    this.maskGraphics.fillRect(
      offsetX,
      offsetY,
      BOARD_WIDTH * PANEL_SIZE * scale,
      BOARD_VISIBLE_HEIGHT * PANEL_SIZE * scale
    );
    const mask = this.maskGraphics.createGeometryMask();
    this.container.setMask(mask);

    this.initializeBoard();
  }

  /** Apply 5-step difficulty parameters to board physics and RNG */
  public applyDifficulty(diff: GameDifficulty): void {
    this.difficulty = diff;
    const info = getDifficultyInfo(diff);
    this.colorCount = info.colorCount;
    this.riseSpeedMultiplier = info.baseRiseSpeedMultiplier;
    this.stopTimeMultiplier = info.stopTimeMultiplier;
    this.dangerGraceDuration = info.dangerGraceTimeMs;
    this.dangerGraceTimer = this.dangerGraceDuration;
  }

  private initializeBoard(): void {
    this.panels = [];
    this.garbageBlocks = [];
    for (let y = 0; y < BOARD_HEIGHT; y++) {
      this.panels[y] = [];
      for (let x = 0; x < BOARD_WIDTH; x++) {
        this.panels[y][x] = null;
      }
    }
  }

  /** Populate initial playing rows from bottom up without immediate matches */
  public addInitialPanels(rows: number = 6, initialGarbageSlabs: number = 0): void {
    const startY = BOARD_VISIBLE_HEIGHT - 1;
    const endY = Math.max(1, BOARD_VISIBLE_HEIGHT - rows);

    for (let y = startY; y >= endY; y--) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        if (this.isCellOccupiedByGarbage(x, y)) continue;
        const color = this.getValidColor(x, y);
        const panel = new Panel(this.scene, x * PANEL_SIZE, y * PANEL_SIZE, color);
        panel.setGridPosition(x, y);
        this.panels[y][x] = panel;
        this.container.add(panel);
      }
    }

    // Spawn initial handicap garbage slabs on Master/Grandmaster difficulty
    if (initialGarbageSlabs > 0) {
      for (let s = 0; s < initialGarbageSlabs; s++) {
        this.queueGarbage(BOARD_WIDTH, 1);
      }
    }

    this.generateBufferRow();
  }

  /** Generate the next hidden row waiting below the visible screen */
  private generateBufferRow(): void {
    const bufferY = BOARD_VISIBLE_HEIGHT;
    for (let x = 0; x < BOARD_WIDTH; x++) {
      if (this.isCellOccupiedByGarbage(x, bufferY)) continue;
      const color = this.getValidColor(x, bufferY);
      const panel = new Panel(this.scene, x * PANEL_SIZE, bufferY * PANEL_SIZE, color);
      panel.setGridPosition(x, bufferY);
      panel.setAlpha(0.75);
      this.panels[bufferY][x] = panel;
      this.container.add(panel);
    }
  }

  private getValidColor(x: number, y: number): number {
    let color: number;
    let attempts = 0;
    const maxColor = Math.max(1, this.colorCount - 1);
    do {
      color = randomInt(0, maxColor);
      attempts++;
    } while (attempts < 15 && this.wouldCreateMatch(x, y, color));
    return color;
  }

  private wouldCreateMatch(x: number, y: number, color: number): boolean {
    let count = 1;
    let nx = x - 1;
    while (nx >= 0 && this.panels[y][nx] && this.panels[y][nx]!.color === color) {
      count++;
      nx--;
    }
    nx = x + 1;
    while (nx < BOARD_WIDTH && this.panels[y][nx] && this.panels[y][nx]!.color === color) {
      count++;
      nx++;
    }
    if (count >= 3) return true;

    count = 1;
    let ny = y - 1;
    while (ny >= 0 && this.panels[ny] && this.panels[ny][x] && this.panels[ny][x]!.color === color) {
      count++;
      ny--;
    }
    ny = y + 1;
    while (ny < BOARD_HEIGHT && this.panels[ny] && this.panels[ny][x] && this.panels[ny][x]!.color === color) {
      count++;
      ny++;
    }
    if (count >= 3) return true;

    return false;
  }

  /** Check if a cell is covered by any resting or active garbage block */
  public isCellOccupiedByGarbage(x: number, y: number): boolean {
    if (this.garbageBlocks.length === 0) return false;
    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (x < 0 || x >= BOARD_WIDTH) return false;
    const blocks = this.garbageBlocks;
    const len = blocks.length;
    for (let i = 0; i < len; i++) {
      const b = blocks[i];
      if (b && typeof b.occupies === 'function' && b.occupies(x, y)) {
        return true;
      }
    }
    return false;
  }

  /** Spawn incoming garbage sent from opponent attack */
  public queueGarbage(width: number, height: number = 1, fixedCol?: number): void {
    const safeWidth = Math.max(1, Math.min(Math.round(Number(width) || 3), BOARD_WIDTH));
    const safeHeight = Math.max(1, Math.min(Math.round(Number(height) || 1), 4));
    const maxStartCol = BOARD_WIDTH - safeWidth;
    const startCol =
      typeof fixedCol === 'number' && Number.isFinite(fixedCol)
        ? Math.max(0, Math.min(Math.round(fixedCol), maxStartCol))
        : randomInt(0, Math.max(0, maxStartCol));
    const startRow = -safeHeight; // Start above visible playfield so it falls in!

    const block = new GarbageBlock(this.scene, this.container, startCol, startRow, safeWidth, safeHeight);
    this.garbageBlocks.push(block);

    // Resolve landing position immediately and drop
    this.dropGarbageBlock(block);
  }

  /** Calculate floor landing position for garbage block and drop it */
  private dropGarbageBlock(block: GarbageBlock): void {
    let landingRow = BOARD_VISIBLE_HEIGHT - block.height;

    for (let c = 0; c < block.width; c++) {
      const col = block.gridX + c;

      // Find highest panel in this column
      for (let r = 0; r < BOARD_VISIBLE_HEIGHT; r++) {
        if (this.panels[r][col] !== null) {
          const possible = r - block.height;
          if (possible < landingRow) {
            landingRow = possible;
          }
          break;
        }
      }

      // Check other resting, falling, or transforming garbage blocks
      for (const other of this.garbageBlocks) {
        if (
          other !== block &&
          other.state !== GarbageState.CLEARED &&
          col >= other.gridX &&
          col < other.gridX + other.width
        ) {
          const possible = other.gridY - block.height;
          if (possible < landingRow) {
            landingRow = possible;
          }
        }
      }
    }

    // Safety adjustment: verify that every cell the block will occupy is completely clear of panels and other garbage blocks.
    // If any cell contains a panel or garbage, push landingRow above it so they never co-occupy the same grid space.
    let collisionDetected = true;
    while (collisionDetected) {
      collisionDetected = false;
      for (let r = 0; r < block.height; r++) {
        const checkY = landingRow + r;
        for (let c = 0; c < block.width; c++) {
          const col = block.gridX + c;
          if (checkY >= 0 && checkY < BOARD_HEIGHT && this.panels[checkY][col] !== null) {
            landingRow = checkY - block.height;
            collisionDetected = true;
            break;
          }
          for (const other of this.garbageBlocks) {
            if (
              other !== block &&
              other.state !== GarbageState.CLEARED &&
              col >= other.gridX &&
              col < other.gridX + other.width &&
              checkY >= other.gridY &&
              checkY < other.gridY + other.height
            ) {
              landingRow = other.gridY - block.height;
              collisionDetected = true;
              break;
            }
          }
          if (collisionDetected) break;
        }
        if (collisionDetected) break;
      }
    }

    // Do NOT clamp landingRow to 0!
    // If landingRow < 0 (stack reaches ceiling), block rests above ceiling (negative gridY)
    // and alerts danger/top-out. Clamping to 0 would force the garbage block to penetrate
    // into existing slime panels at row 0+, causing overlapping tiles!
    const distance = Math.max(1, landingRow - block.gridY);
    const duration = Math.min(360, Math.max(120, distance * 36));
    block.fallTo(landingRow, duration).then(() => {
      this.emit('garbageLand', {
        block,
        width: block.width,
        height: block.height,
        isLarge: block.width >= BOARD_WIDTH || block.height >= 2
      });
      const meterGain = block.width >= BOARD_WIDTH ? 10 * block.height : 5 * block.height;
      this.addPowerMeter(meterGain);
    });
  }

  /** Update garbage gravity when panels beneath clear or fall */
  private updateGarbage(): void {
    this.garbageBlocks = this.garbageBlocks.filter((b) => b && b.state !== GarbageState.CLEARED);
    for (const block of this.garbageBlocks) {
      if (block.state !== GarbageState.RESTING) continue;

      const nextY = block.gridY + block.height;
      if (nextY >= BOARD_VISIBLE_HEIGHT) continue; // At the floor

      // Check if row directly below is entirely clear across block width
      let canFall = true;
      for (let c = 0; c < block.width; c++) {
        const col = block.gridX + c;
        if (nextY >= 0 && nextY < BOARD_HEIGHT) {
          const p = this.panels[nextY][col];
          if (p !== null) {
            canFall = false;
            break;
          }
        }
        for (const other of this.garbageBlocks) {
          if (other !== block && other.occupies(col, nextY)) {
            canFall = false;
            break;
          }
        }
        if (!canFall) break;
      }

      if (canFall) {
        // Calculate lowest landing row
        let landingY = block.gridY;
        for (let testY = block.gridY + 1; testY <= BOARD_VISIBLE_HEIGHT - block.height; testY++) {
          let testRowClear = true;
          // Verify all cells across the block height and width are clear
          for (let r = 0; r < block.height; r++) {
            const checkY = testY + r;
            for (let c = 0; c < block.width; c++) {
              const col = block.gridX + c;
              if (checkY >= 0 && checkY < BOARD_HEIGHT) {
                const p = this.panels[checkY][col];
                if (p !== null) {
                  testRowClear = false;
                  break;
                }
              }
              for (const other of this.garbageBlocks) {
                if (other !== block && other.occupies(col, checkY)) {
                  testRowClear = false;
                  break;
                }
              }
              if (!testRowClear) break;
            }
            if (!testRowClear) break;
          }
          if (testRowClear) {
            landingY = testY;
          } else {
            break;
          }
        }

        if (landingY > block.gridY) {
          block.fallTo(landingY, 80).then(() => {
            this.emit('garbageLand', {
              block,
              width: block.width,
              height: block.height,
              isLarge: block.width >= BOARD_WIDTH || block.height >= 2
            });
            const meterGain = block.width >= BOARD_WIDTH ? 10 * block.height : 5 * block.height;
            this.addPowerMeter(meterGain);
          });
        }
      }
    }
  }

  public canSwap(gridX: number, gridY: number): boolean {
    if (this.isTopOut) return false;
    if (
      typeof gridX !== 'number' ||
      typeof gridY !== 'number' ||
      !Number.isInteger(gridX) ||
      !Number.isInteger(gridY) ||
      gridX < 0 ||
      gridX >= BOARD_WIDTH - 1 ||
      gridY < 0 ||
      gridY >= BOARD_HEIGHT ||
      !this.panels[gridY]
    ) {
      return false;
    }

    if (
      this.isCellOccupiedByGarbage(gridX, gridY) ||
      this.isCellOccupiedByGarbage(gridX + 1, gridY)
    ) {
      return false;
    }

    // Do not allow swapping directly into or beneath a falling garbage block
    for (const b of this.garbageBlocks) {
      if (b.state === GarbageState.FALLING) {
        if (
          b.occupies(gridX, gridY) ||
          b.occupies(gridX + 1, gridY) ||
          (gridY > 0 && (b.occupies(gridX, gridY - 1) || b.occupies(gridX + 1, gridY - 1)))
        ) {
          return false;
        }
      }
    }

    const left = this.panels[gridY][gridX];
    const right = this.panels[gridY][gridX + 1];

    if (!left && !right) return false;

    // Volt's Overcharge: high-voltage static disruption makes inputs occasionally stutter/misfire
    if (this.isOverchargeActive && Math.random() < 0.22) {
      SoundFx.playElectricZap();
      return false;
    }

    if (left && !left.canSwap()) return false;
    if (right && !right.canSwap()) return false;

    if (gridY > 0) {
      const aboveRow = this.panels[gridY - 1];
      if (aboveRow) {
        const aboveLeft = aboveRow[gridX];
        const aboveRight = aboveRow[gridX + 1];
        if (aboveLeft && (aboveLeft.state === PanelState.FALLING || aboveLeft.state === PanelState.HOVER)) {
          return false;
        }
        if (aboveRight && (aboveRight.state === PanelState.FALLING || aboveRight.state === PanelState.HOVER)) {
          return false;
        }
      }
    }

    return true;
  }

  private executeSwap(gridX: number, gridY: number): boolean {
    if (
      typeof gridX !== 'number' ||
      typeof gridY !== 'number' ||
      !Number.isInteger(gridX) ||
      !Number.isInteger(gridY) ||
      gridX < 0 ||
      gridX >= BOARD_WIDTH - 1 ||
      gridY < 0 ||
      gridY >= BOARD_HEIGHT ||
      !this.panels[gridY]
    ) {
      return false;
    }

    if (
      this.isCellOccupiedByGarbage(gridX, gridY) ||
      this.isCellOccupiedByGarbage(gridX + 1, gridY)
    ) {
      return false;
    }

    const left = this.panels[gridY][gridX];
    const right = this.panels[gridY][gridX + 1];

    SoundFx.playSwap();

    this.panels[gridY][gridX] = right;
    this.panels[gridY][gridX + 1] = left;

    if (left) {
      left.setGridPosition(gridX + 1, gridY);
      left.startSwap((gridX + 1) * PANEL_SIZE, 85).then(() => {
        this.checkPanelGravity(left.gridX, left.gridY);
      });
    }

    if (right) {
      right.setGridPosition(gridX, gridY);
      right.startSwap(gridX * PANEL_SIZE, 85).then(() => {
        this.checkPanelGravity(right.gridX, right.gridY);
      });
    }

    this.checkPanelGravity(gridX, gridY);
    this.checkPanelGravity(gridX + 1, gridY);

    this.emit('swap');
    return true;
  }

  /**
   * Execute horizontal swap at (x, y) with (x + 1, y).
   * If cells are currently busy, queues the command in the 150ms input buffer.
   */
  public swap(gridX: number, gridY: number): boolean {
    if (this.isTopOut) return false;

    if (
      typeof gridX !== 'number' ||
      typeof gridY !== 'number' ||
      !Number.isInteger(gridX) ||
      !Number.isInteger(gridY) ||
      gridX < 0 ||
      gridX >= BOARD_WIDTH - 1 ||
      gridY < 0 ||
      gridY >= BOARD_HEIGHT
    ) {
      return false;
    }

    if (this.canSwap(gridX, gridY)) {
      return this.executeSwap(gridX, gridY);
    } else {
      // Input buffer (150ms window) ensures rapid swipes during animations are never lost!
      this.inputBuffer.push({ gridX, gridY, ttl: 150 });
      return false;
    }
  }

  public canPanelFallInto(x: number, y: number): boolean {
    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isInteger(x) || !Number.isInteger(y)) return false;
    if (x < 0 || x >= BOARD_WIDTH || y < 0 || y >= BOARD_HEIGHT) return false;
    if (y >= BOARD_VISIBLE_HEIGHT) return false;
    if (!this.panels[y] || this.panels[y][x] !== null) return false;
    if (this.isCellOccupiedByGarbage(x, y)) return false;
    return true;
  }

  private checkPanelGravity(x: number, y: number): void {
    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isInteger(x) || !Number.isInteger(y)) return;
    if (x < 0 || x >= BOARD_WIDTH || y < 0 || y >= BOARD_HEIGHT) return;
    if (y >= BOARD_VISIBLE_HEIGHT) return;
    if (!this.panels[y]) return;
    const panel = this.panels[y][x];
    if (!panel || panel.state !== PanelState.IDLE) return;

    if (this.canPanelFallInto(x, y + 1)) {
      panel.startHover(80);
    }
  }

  /** Returns true if any panels or garbage blocks are in mid-air or mid-animation */
  public hasBusyPanels(): boolean {
    if (this.poppingPanels.size > 0) return true;
    for (let y = 0; y <= BOARD_VISIBLE_HEIGHT; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        const p = this.panels[y][x];
        if (
          p &&
          (p.state === PanelState.FALLING ||
            p.state === PanelState.HOVER ||
            p.state === PanelState.SWAPPING ||
            p.state === PanelState.FLASHING ||
            p.state === PanelState.POPPING)
        ) {
          return true;
        }
      }
    }
    for (const b of this.garbageBlocks) {
      if (b.state === GarbageState.FALLING || b.state === GarbageState.TRANSFORMING) {
        return true;
      }
    }
    return false;
  }

  /** Main board update loop */
  public update(time: number, delta: number): void {
    if (this.isTopOut) return;

    this.elapsedPlayTime += delta;
    // Gradually ramp up rise speed over time (+0.75 px/s every 30 seconds, up to +6 px/s max)
    this.riseSpeed = BASE_RISE_SPEED + Math.min(6, (this.elapsedPlayTime / 30000) * 0.75);

    if (this.stopTime > 0) {
      this.stopTime = Math.max(0, this.stopTime - delta);
    }

    // Tick down active character status effect timers
    if (this.reverseLiftTimer > 0) {
      this.reverseLiftTimer = Math.max(0, this.reverseLiftTimer - delta);
      if (this.reverseLiftTimer <= 0) this.isReverseLiftActive = false;
    }
    if (this.liftFrozenTimer > 0) {
      this.liftFrozenTimer = Math.max(0, this.liftFrozenTimer - delta);
      if (this.liftFrozenTimer <= 0) this.isLiftFrozen = false;
    }
    if (this.grooveTimer > 0) {
      this.grooveTimer = Math.max(0, this.grooveTimer - delta);
      if (this.grooveTimer <= 0) this.isGrooveActive = false;
    }
    if (this.overchargeTimer > 0) {
      this.overchargeTimer = Math.max(0, this.overchargeTimer - delta);
      if (this.overchargeTimer <= 0) this.isOverchargeActive = false;
    }

    this.updateHoverAndFalling(delta);
    this.updateClearingPanels(delta);
    this.processInputBuffer(delta);
    this.updateGarbage();
    this.checkMatches();
    this.updateChainState();
    this.updateDangerAndTopOut(delta);
    this.updateStackRising(delta);

    // Continuous safety synchronization: snap any resting IDLE panels to their authoritative grid coordinates
    for (let y = 0; y <= BOARD_VISIBLE_HEIGHT; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        const panel = this.panels[y][x];
        if (panel && panel.state === PanelState.IDLE && !panel.isDragged) {
          const expectedX = x * PANEL_SIZE;
          const expectedY = y * PANEL_SIZE;
          if (panel.x !== expectedX) panel.x = expectedX;
          if (panel.y !== expectedY) panel.y = expectedY;
        }
      }
    }

    // Absolute mutual exclusivity: garbage blocks and regular slimes can NEVER occupy the same grid space!
    for (const b of this.garbageBlocks) {
      if (b.state === GarbageState.CLEARED) continue;
      if (!Number.isFinite(b.gridY) || !Number.isFinite(b.gridX)) continue;
      for (let r = 0; r < b.height; r++) {
        const gy = b.gridY + r;
        if (!Number.isInteger(gy) || gy < 0 || gy >= BOARD_HEIGHT) continue;
        if (!this.panels[gy]) continue;
        for (let c = 0; c < b.width; c++) {
          const gx = b.gridX + c;
          if (!Number.isInteger(gx) || gx < 0 || gx >= BOARD_WIDTH) continue;
          const p = this.panels[gy][gx];
          if (p !== null) {
            p.destroy();
            this.panels[gy][gx] = null;
          }
        }
      }
    }
  }

  /** Evaluate queued swap inputs in the 150ms buffer */
  private processInputBuffer(delta: number): void {
    for (let i = this.inputBuffer.length - 1; i >= 0; i--) {
      const item = this.inputBuffer[i];
      if (
        !item ||
        typeof item.gridX !== 'number' ||
        typeof item.gridY !== 'number' ||
        !Number.isInteger(item.gridX) ||
        !Number.isInteger(item.gridY)
      ) {
        this.inputBuffer.splice(i, 1);
        continue;
      }
      item.ttl -= delta;

      if (this.canSwap(item.gridX, item.gridY)) {
        this.executeSwap(item.gridX, item.gridY);
        this.inputBuffer.splice(i, 1);
      } else if (item.ttl <= 0) {
        this.inputBuffer.splice(i, 1);
      }
    }
  }

  /** Update stack rising and handle row shift transitions */
  private updateStackRising(delta: number): void {
    // Salty's Flash Freeze completely halts the stack
    if (this.isLiftFrozen) return;

    // Mizu's Tidal Flow: reverse rising blocks and scroll downwards
    if (this.isReverseLiftActive) {
      const reverseSpeed = BASE_RISE_SPEED * 2.5;
      this.stackOffsetPixels = Math.max(0, this.stackOffsetPixels - (reverseSpeed * delta) / 1000);
      this.container.y = this.boardOffsetY - this.stackOffsetPixels * this.scaleFactor;
      this.emit('stackRise', { offset: this.stackOffsetPixels });
      return;
    }

    // In classic Panel de Pon, stopTime completely halts the stack rise
    if (this.stopTime > 0) return;
    if (this.isDanger && !this.isLifting) return;

    // Do NOT auto-rise while active cascades or clears are resolving
    if (this.isChainActive) return;

    const currentSpeed = this.isLifting ? FAST_LIFT_SPEED : (this.riseSpeed * this.riseSpeedMultiplier);
    const deltaPixels = (currentSpeed * delta) / 1000;
    this.stackOffsetPixels += deltaPixels;

    this.container.y = this.boardOffsetY - this.stackOffsetPixels * this.scaleFactor;
    this.emit('stackRise', { offset: this.stackOffsetPixels });

    if (this.stackOffsetPixels >= PANEL_SIZE) {
      // If panels are currently in motion (swapping, falling, hovering, popping),
      // pause the stack at the top of the rise until all panels settle!
      // This prevents row shifts from desynchronizing in-flight slimes.
      if (this.hasBusyPanels()) {
        this.stackOffsetPixels = PANEL_SIZE;
        return;
      }
      this.shiftStackUp();
    }
  }

  /** Shift all grid rows up by 1 full cell */
  private shiftStackUp(): void {
    for (let x = 0; x < BOARD_WIDTH; x++) {
      if (this.panels[0][x] !== null || this.isCellOccupiedByGarbage(x, 0)) {
        // Ceiling hit! Cap stack at top and trigger danger countdown, do not insta-kill!
        this.stackOffsetPixels = 0;
        this.container.y = this.boardOffsetY;
        this.isLifting = false;
        this.emit('stackRise', { offset: 0 });
        if (!this.isDanger) {
          this.isDanger = true;
          this.dangerGraceTimer = this.dangerGraceDuration;
          this.dangerBeepTimer = 0;
          this.emit('dangerStart');
        }
        return;
      }
    }

    // Shift rows 0..9 up
    for (let y = 0; y < BOARD_VISIBLE_HEIGHT; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        const nextPanel = this.panels[y + 1][x];
        this.panels[y][x] = nextPanel;
        if (nextPanel) {
          nextPanel.setGridPosition(x, y);
          nextPanel.x = x * PANEL_SIZE;
          nextPanel.y = y * PANEL_SIZE;
          nextPanel.setAlpha(1.0);
        }
      }
    }

    // Shift garbage blocks up
    for (const b of this.garbageBlocks) {
      if (b.state !== GarbageState.CLEARED) {
        b.shiftUp();
      }
    }

    // Reset buffer row
    for (let x = 0; x < BOARD_WIDTH; x++) {
      this.panels[BOARD_VISIBLE_HEIGHT][x] = null;
    }

    this.generateBufferRow();

    this.stackOffsetPixels -= PANEL_SIZE;
    this.container.y = this.boardOffsetY - this.stackOffsetPixels * this.scaleFactor;

    if (this.isLifting) {
      SoundFx.playLiftTick();
      this.emit('liftRow');
    }

    this.emit('stackRise', { offset: this.stackOffsetPixels });
    this.emit('rowShift', { offset: this.stackOffsetPixels });
    this.checkMatches();
  }

  private updateDangerAndTopOut(delta: number): void {
    let hasTopRowObstacle = false;
    for (let x = 0; x < BOARD_WIDTH; x++) {
      if (this.panels[0][x] !== null || this.isCellOccupiedByGarbage(x, 0)) {
        hasTopRowObstacle = true;
        break;
      }
    }

    if (hasTopRowObstacle) {
      if (!this.isDanger) {
        this.isDanger = true;
        this.dangerGraceTimer = this.dangerGraceDuration;
        this.dangerBeepTimer = 0;
        this.emit('dangerStart');
      }

      // In classic Panel de Pon, stopTime (matches/combos) and active cascades FREEZE the danger timer!
      if (this.stopTime <= 0 && !this.isChainActive) {
        this.dangerGraceTimer -= delta;
      }

      this.dangerBeepTimer -= delta;
      if (this.dangerBeepTimer <= 0) {
        SoundFx.playDangerBeep();
        this.dangerBeepTimer = 340;
        this.emit('dangerPulse', { remainingMs: Math.max(0, this.dangerGraceTimer) });
      }

      if (this.dangerGraceTimer <= 0) {
        this.triggerTopOut();
      }
    } else {
      if (this.isDanger) {
        this.isDanger = false;
        this.dangerGraceTimer = this.dangerGraceDuration;
        this.emit('dangerEnd');
      }
    }
  }

  private triggerTopOut(): void {
    if (this.isTopOut) return;
    this.isTopOut = true;
    SoundFx.playTopOut();
    this.emit('topOut');
  }

  public setLifting(lifting: boolean): void {
    if (this.isLiftFrozen && lifting) return;
    if (this.isLifting && !lifting) {
      this.stopTime = Math.max(this.stopTime, Math.round(280 * this.stopTimeMultiplier));
    }
    this.isLifting = lifting;
  }

  private updateHoverAndFalling(delta: number): void {
    // Pass 1: Decrement hover timers for all panels currently in HOVER
    for (let y = BOARD_VISIBLE_HEIGHT - 1; y >= 0; y--) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        const panel = this.panels[y][x];
        if (!panel || panel.state !== PanelState.HOVER) continue;

        panel.hoverTimer -= delta;
        if (panel.hoverTimer <= 0) {
          if (this.canPanelFallInto(x, y + 1)) {
            this.dropPanel(x, y);
          } else {
            // Space below is blocked! Safely return to IDLE so panel isn't trapped
            panel.state = PanelState.IDLE;
            panel.chainEligible = false;
          }
        }
      }
    }

    // Pass 2: Detect newly unsupported IDLE panels and initiate synchronized column hover
    for (let y = BOARD_VISIBLE_HEIGHT - 1; y >= 0; y--) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        const panel = this.panels[y][x];
        if (!panel || panel.state !== PanelState.IDLE) continue;

        if (this.canPanelFallInto(x, y + 1)) {
          panel.startHover(80);
          // Propagate hover to contiguous idle panels directly above so the column drops together
          for (let aboveY = y - 1; aboveY >= 0; aboveY--) {
            const above = this.panels[aboveY][x];
            if (above && above.state === PanelState.IDLE) {
              above.startHover(80);
            } else {
              break;
            }
          }
        }
      }
    }
  }

  private dropPanel(x: number, y: number): void {
    const panel = this.panels[y][x];
    if (!panel || panel.state === PanelState.SWAPPING || panel.isClearing()) return;

    // Find the lowest landing row
    let targetRow = y;
    while (this.canPanelFallInto(x, targetRow + 1)) {
      targetRow++;
    }

    if (targetRow === y || this.isCellOccupiedByGarbage(x, targetRow)) {
      panel.state = PanelState.IDLE;
      panel.chainEligible = false;
      return;
    }

    // Pass chain eligibility to panels directly above this falling column
    for (let aboveY = y - 1; aboveY >= 0; aboveY--) {
      const above = this.panels[aboveY][x];
      if (above && panel.chainEligible) {
        above.chainEligible = true;
      }
    }

    // Update grid immediately so no other panel or swap collides
    this.panels[y][x] = null;
    this.panels[targetRow][x] = panel;
    panel.setGridPosition(x, targetRow);

    const distance = targetRow - y;
    const fallDuration = Math.min(220, Math.max(55, distance * 45));
    const targetLocalY = targetRow * PANEL_SIZE;

    panel.fallTo(targetLocalY, fallDuration).then(() => {
      SoundFx.playLand();
      panel.playLandingBounce();

      // Check if newly landed panel triggers a match
      this.checkMatches();

      // Clear chain eligibility after landing if panel remained idle
      this.scene.time.delayedCall(160, () => {
        if (panel && panel.state === PanelState.IDLE) {
          panel.chainEligible = false;
        }
      });
    });
  }

  private updateClearingPanels(delta: number): void {
    for (let y = 0; y <= BOARD_VISIBLE_HEIGHT; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        const panel = this.panels[y][x];
        if (!panel) continue;

        if (panel.state === PanelState.FLASHING) {
          panel.matchTimer -= delta;
          if (panel.matchTimer <= 0) {
            // Free the grid cell IMMEDIATELY so panels above can fall!
            this.panels[y][x] = null;
            SoundFx.playPop(panel.color);
            this.emit('panelPop', { x, y, color: panel.color });

            // Pop animation on the sprite
            this.poppingPanels.add(panel);
            panel.pop().then(() => {
              this.poppingPanels.delete(panel);
            }).catch(() => {
              this.poppingPanels.delete(panel);
            });

            // Trigger hover on panels directly above this column
            for (let aboveY = y - 1; aboveY >= 0; aboveY--) {
              const above = this.panels[aboveY][x];
              if (above && above.state === PanelState.IDLE) {
                above.chainEligible = true;
                above.startHover(80);
              }
            }

            // Also check if any garbage blocks above should now fall
            this.updateGarbage();
          }
        }
      }
    }
  }

  /** Scan the entire board for 3+ matches and trigger garbage transformations */
  private checkMatches(): void {
    const matchedPanelsSet = new Set<Panel>();

    for (let y = 0; y < BOARD_VISIBLE_HEIGHT; y++) {
      let runStart = 0;
      let runLength = 1;

      for (let x = 1; x < BOARD_WIDTH; x++) {
        const curr = this.panels[y][x];
        const prev = this.panels[y][x - 1];

        if (
          curr &&
          prev &&
          curr.state === PanelState.IDLE &&
          prev.state === PanelState.IDLE &&
          curr.color === prev.color
        ) {
          runLength++;
        } else {
          if (runLength >= 3) {
            for (let k = runStart; k < runStart + runLength; k++) {
              matchedPanelsSet.add(this.panels[y][k]!);
            }
          }
          runStart = x;
          runLength = 1;
        }
      }

      if (runLength >= 3) {
        for (let k = runStart; k < runStart + runLength; k++) {
          matchedPanelsSet.add(this.panels[y][k]!);
        }
      }
    }

    for (let x = 0; x < BOARD_WIDTH; x++) {
      let runStart = 0;
      let runLength = 1;

      for (let y = 1; y < BOARD_VISIBLE_HEIGHT; y++) {
        const curr = this.panels[y][x];
        const prev = this.panels[y - 1][x];

        if (
          curr &&
          prev &&
          curr.state === PanelState.IDLE &&
          prev.state === PanelState.IDLE &&
          curr.color === prev.color
        ) {
          runLength++;
        } else {
          if (runLength >= 3) {
            for (let k = runStart; k < runStart + runLength; k++) {
              matchedPanelsSet.add(this.panels[k][x]!);
            }
          }
          runStart = y;
          runLength = 1;
        }
      }

      if (runLength >= 3) {
        for (let k = runStart; k < runStart + runLength; k++) {
          matchedPanelsSet.add(this.panels[k][x]!);
        }
      }
    }

    if (matchedPanelsSet.size === 0) return;

    this.processMatchGroup(Array.from(matchedPanelsSet));
  }

  public processMatchGroup(matchedList: Panel[], forceChain: boolean = false): void {
    if (!matchedList || matchedList.length === 0) return;
    const matchedPanelsSet = new Set<Panel>(matchedList);
    const comboSize = matchedList.length;

    const isChainMatch = forceChain || matchedList.some((p) => p.chainEligible);

    if (isChainMatch) {
      this.activeChain++;
      this.isChainActive = true;
    } else {
      if (!this.isChainActive) {
        this.activeChain = 1;
      }
    }

    const baseScore = comboSize * 10;
    const comboBonus = comboSize > 3 ? (comboSize - 3) * 50 : 0;
    const chainBonus = this.activeChain > 1 ? (this.activeChain - 1) * 200 : 0;
    const totalScore = baseScore + comboBonus + chainBonus;

    const rawStopTime = 1800 + Math.min(comboSize * 250, 2500) + (this.activeChain > 1 ? 1400 : 0);
    this.stopTime = Math.max(this.stopTime, Math.round(rawStopTime * this.stopTimeMultiplier));

    if (this.isDanger) {
      // Matching while in danger awards bonus grace time and pauses danger!
      this.dangerGraceTimer = Math.min(this.dangerGraceDuration, this.dangerGraceTimer + Math.round(2500 * this.stopTimeMultiplier));
      this.stopTime = Math.max(this.stopTime, Math.round(2200 * this.stopTimeMultiplier));
    }

    if (this.activeChain > 1 || comboSize >= 4) {
      SoundFx.playCombo(this.activeChain);
    } else {
      SoundFx.playMatch();
    }

    // Option B Meter generation: Combos & Chains (1.5x boost during danger!)
    let meterGain = 1;
    if (comboSize === 4) meterGain = 8;
    else if (comboSize === 5) meterGain = 14;
    else if (comboSize >= 6) meterGain = 20;

    if (this.activeChain === 2) meterGain += 15;
    else if (this.activeChain === 3) meterGain += 25;
    else if (this.activeChain >= 4) meterGain += 35;

    if (this.isDanger) {
      meterGain = Math.round(meterGain * 1.5);
    }
    this.addPowerMeter(meterGain);

    // Trigger de-transformation for any adjacent resting garbage blocks
    this.checkGarbageTransformations(matchedList);

    // Unlock any gear-locked panels adjacent to this match
    this.checkLockedPanels(matchedList);

    matchedList.forEach((panel) => {
      for (let y = panel.gridY - 1; y >= 0; y--) {
        const above = this.panels[y]?.[panel.gridX];
        if (above && !matchedPanelsSet.has(above)) {
          above.chainEligible = true;
        }
      }
    });

    matchedList.forEach((panel, i) => {
      panel.startMatch(380, i * 40);
    });

    this.maxChain = Math.max(this.maxChain, this.activeChain);
    const matchEvent: MatchEvent = {
      panels: matchedList,
      comboSize,
      chainLevel: this.activeChain,
      scoreGained: totalScore
    };
    this.emit('match', matchEvent);
  }

  /** Transform any garbage blocks touching cleared matches */
  private checkGarbageTransformations(matchedPanels: Panel[]): void {
    const blocksToTransform = new Set<GarbageBlock>();

    for (const panel of matchedPanels) {
      for (const block of this.garbageBlocks) {
        if (block.state !== GarbageState.RESTING) continue;

        // Check if panel touches bottom, top, left, or right of the garbage block
        const touchingBottom = block.occupies(panel.gridX, panel.gridY - 1);
        const touchingTop = block.occupies(panel.gridX, panel.gridY + 1);
        const touchingLeft = block.occupies(panel.gridX + 1, panel.gridY);
        const touchingRight = block.occupies(panel.gridX - 1, panel.gridY);

        if (touchingBottom || touchingTop || touchingLeft || touchingRight) {
          blocksToTransform.add(block);
        }
      }
    }

    if (blocksToTransform.size > 0 && this.isDanger) {
      // De-transforming garbage grants major survival recovery bonus!
      this.dangerGraceTimer = Math.min(this.dangerGraceDuration, this.dangerGraceTimer + Math.round(3500 * this.stopTimeMultiplier));
      this.stopTime = Math.max(this.stopTime, Math.round(2400 * this.stopTimeMultiplier));
    }

    for (const block of blocksToTransform) {
      block.transformBottomRow().then((positions) => {
        if (positions.length > 0) {
          this.emit('garbageCleared', { count: positions.length });
          this.addPowerMeter(3 * positions.length);
        }
        positions.forEach((pos) => {
          if (pos.gridY < 0 || pos.gridY >= BOARD_HEIGHT || pos.gridX < 0 || pos.gridX >= BOARD_WIDTH) return;
          // Ensure this position is not occupied by any other active garbage block
          if (this.garbageBlocks.some((b) => b !== block && b.occupies(pos.gridX, pos.gridY))) {
            return;
          }
          const existing = this.panels[pos.gridY][pos.gridX];
          if (existing) {
            existing.destroy();
            this.panels[pos.gridY][pos.gridX] = null;
          }
          const color = randomInt(0, Math.max(1, this.colorCount - 1));
          const panel = new Panel(this.scene, pos.gridX * PANEL_SIZE, pos.gridY * PANEL_SIZE, color);
          panel.setGridPosition(pos.gridX, pos.gridY);
          panel.chainEligible = true; // Enables counter-attacks!
          this.panels[pos.gridY][pos.gridX] = panel;
          this.container.add(panel);

          // Bouncy pop-in tween for newly transformed cute slime
          const baseScale = panel.width > 0 ? PANEL_SIZE / panel.width : 1.0;
          panel.setScale(baseScale * 0.2);
          this.scene.tweens.add({
            targets: panel,
            scaleX: baseScale,
            scaleY: baseScale,
            duration: 180,
            ease: 'Back.easeOut',
            onComplete: () => {
              panel.setDisplaySize(PANEL_SIZE, PANEL_SIZE);
            }
          });

          this.checkPanelGravity(pos.gridX, pos.gridY);
        });

        this.garbageBlocks = this.garbageBlocks.filter((b) => b.state !== GarbageState.CLEARED);
        this.updateGarbage();
        this.checkMatches();
      });
    }
  }

  private updateChainState(): void {
    if (!this.isChainActive) return;

    let hasActiveChainElements = this.poppingPanels.size > 0;
    if (!hasActiveChainElements) {
      for (let y = 0; y < BOARD_VISIBLE_HEIGHT; y++) {
        for (let x = 0; x < BOARD_WIDTH; x++) {
          const p = this.panels[y][x];
          if (!p) continue;
          if (
            p.state === PanelState.FALLING ||
            p.state === PanelState.HOVER ||
            p.state === PanelState.SWAPPING ||
            p.state === PanelState.FLASHING ||
            p.state === PanelState.POPPING
          ) {
            hasActiveChainElements = true;
            break;
          }
        }
        if (hasActiveChainElements) break;
      }
    }

    if (!hasActiveChainElements) {
      for (const block of this.garbageBlocks) {
        if (block.state === GarbageState.FALLING || block.state === GarbageState.TRANSFORMING) {
          hasActiveChainElements = true;
          break;
        }
      }
    }

    if (!hasActiveChainElements) {
      // Board has completely settled! Clear chainEligible across all panels to avoid lingering state
      for (let y = 0; y < BOARD_HEIGHT; y++) {
        for (let x = 0; x < BOARD_WIDTH; x++) {
          const p = this.panels[y][x];
          if (p) {
            p.chainEligible = false;
          }
        }
      }

      this.isChainActive = false;
      if (this.activeChain > 1) {
        this.emit('chainEnd', { maxChain: this.activeChain });
      }
      this.activeChain = 1;
    }
  }

  public getPanelAt(x: number, y: number): Panel | null {
    if (x < 0 || x >= BOARD_WIDTH || y < 0 || y >= BOARD_HEIGHT) return null;
    return this.panels[y][x];
  }

  public setPanelAt(x: number, y: number, panel: Panel | null): void {
    if (x >= 0 && x < BOARD_WIDTH && y >= 0 && y < BOARD_HEIGHT) {
      if (panel !== null && this.isCellOccupiedByGarbage(x, y)) {
        return;
      }
      this.panels[y][x] = panel;
    }
  }

  public isEmpty(x: number, y: number): boolean {
    return this.getPanelAt(x, y) === null && !this.isCellOccupiedByGarbage(x, y);
  }

  /** Serialize current visible panels and buffer row into a compact array for network sync */
  public serializeGrid(): number[] {
    const data: number[] = [];
    for (let y = 0; y <= BOARD_VISIBLE_HEIGHT; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        const p = this.panels[y] ? this.panels[y][x] : null;
        data.push(p ? p.color : -1);
      }
    }
    return data;
  }

  /** Serialize current active garbage blocks for network sync */
  public serializeGarbage(): GarbageSnapshot[] {
    return this.garbageBlocks
      .filter((b) => b.state !== GarbageState.CLEARED && b.height > 0)
      .map((b) => ({
        gridX: b.gridX,
        gridY: b.gridY,
        width: b.width,
        height: b.height
      }));
  }

  /** Synchronize garbage blocks to match opponent network state */
  public syncGarbageBlocks(snapshots?: GarbageSnapshot[]): void {
    if (!snapshots || !Array.isArray(snapshots)) return;

    // Sanitize snapshots: only accept valid numbers and positive dimensions
    const validSnapshots = snapshots.filter(
      (s) =>
        s &&
        typeof s.gridX === 'number' &&
        Number.isFinite(s.gridX) &&
        typeof s.gridY === 'number' &&
        Number.isFinite(s.gridY) &&
        typeof s.width === 'number' &&
        s.width > 0 &&
        typeof s.height === 'number' &&
        s.height > 0
    );

    const remaining: GarbageBlock[] = [];
    const pendingSnaps = validSnapshots.map((s) => ({ ...s }));

    for (const block of this.garbageBlocks) {
      if (block.state === GarbageState.CLEARED) continue;

      const matchIndex = pendingSnaps.findIndex(
        (s) => s.gridX === block.gridX && s.width === block.width && Math.abs(s.gridY - block.gridY) <= 1
      );

      if (matchIndex === -1) {
        // If the block is currently mid-fall from a recent attack, do not discard it yet
        // since the remote opponent's snapshot might not have processed or landed it yet
        if (block.state === GarbageState.FALLING) {
          remaining.push(block);
        } else {
          // Block was cleared or transformed away on the opponent's board!
          block.destroy();
        }
      } else {
        const snap = pendingSnaps[matchIndex];
        if (block.state === GarbageState.FALLING) {
          // Keep dropping to its target without interrupting animation
          remaining.push(block);
        } else if (block.height !== snap.height) {
          block.destroy();
          if (this.scene && this.container && this.container.active) {
            const updated = new GarbageBlock(this.scene, this.container, snap.gridX, snap.gridY, snap.width, snap.height);
            updated.setResting();
            remaining.push(updated);
          }
        } else {
          block.setResting(snap.gridY);
          remaining.push(block);
        }
        pendingSnaps.splice(matchIndex, 1);
      }
    }

    // Add any remaining snapshots that didn't exist locally
    if (this.scene && this.container && this.container.active) {
      for (const snap of pendingSnaps) {
        const newBlock = new GarbageBlock(this.scene, this.container, snap.gridX, snap.gridY, snap.width, snap.height);
        newBlock.setResting();
        remaining.push(newBlock);
      }
    }

    this.garbageBlocks = remaining;
  }

  /** Sync this board's panels and rising stack offset to match an opponent's network snapshot */
  public applyGridSnapshot(grid: number[], stackOffset?: number, garbageSnapshots?: GarbageSnapshot[]): void {
    if (!grid || !Array.isArray(grid) || grid.length < (BOARD_VISIBLE_HEIGHT + 1) * BOARD_WIDTH) return;

    if (typeof stackOffset === 'number' && Number.isFinite(stackOffset)) {
      this.stackOffsetPixels = stackOffset;
      if (this.container && this.container.active) {
        this.container.y = this.boardOffsetY - this.stackOffsetPixels * this.scaleFactor;
      }
      this.emit('stackRise', { offset: this.stackOffsetPixels });
    }

    if (garbageSnapshots && Array.isArray(garbageSnapshots)) {
      this.syncGarbageBlocks(garbageSnapshots);
    }

    let idx = 0;
    for (let y = 0; y <= BOARD_VISIBLE_HEIGHT; y++) {
      if (!this.panels[y]) continue;
      for (let x = 0; x < BOARD_WIDTH; x++) {
        const targetColor = grid[idx++];
        const cur = this.panels[y][x];

        if (targetColor < 0) {
          if (cur && (cur.state === PanelState.IDLE || cur.state === PanelState.FALLING)) {
            cur.destroy();
            this.panels[y][x] = null;
          }
        } else {
          if (!cur) {
            if (!this.isCellOccupiedByGarbage(x, y)) {
              const p = new Panel(this.scene, x * PANEL_SIZE, y * PANEL_SIZE, targetColor);
              p.setGridPosition(x, y);
              if (y === BOARD_VISIBLE_HEIGHT) p.setAlpha(0.75);
              this.panels[y][x] = p;
              if (this.container && this.container.active) {
                this.container.add(p);
              }
            }
          } else if (cur.color !== targetColor && cur.state === PanelState.IDLE) {
            cur.setColor(targetColor);
          }
        }
      }
    }
  }

  /** Return current visible stack height (0 to BOARD_VISIBLE_HEIGHT) */
  public getStackHeight(): number {
    for (let r = 0; r < BOARD_VISIBLE_HEIGHT; r++) {
      for (let c = 0; c < BOARD_WIDTH; c++) {
        if (this.panels[r][c] !== null) {
          return BOARD_VISIBLE_HEIGHT - r;
        }
      }
    }
    return 0;
  }

  /**
   * =========================================================================
   * CHARACTER SUPER POWERS & POWER METER ENGINE
   * =========================================================================
   */

  /** Add energy to the power meter gauge (0 to 100) */
  public addPowerMeter(amount: number): void {
    if (this.characterId === 'nano_banana') return; // Nano Banana has zero powers (handicap pick)
    if (this.isTopOut) return;

    const old = this.powerMeter;
    this.powerMeter = Math.max(0, Math.min(100, this.powerMeter + amount));
    if (old < 100 && this.powerMeter >= 100) {
      this.emit('powerReady');
    }
    this.emit('powerMeterChange', { meter: this.powerMeter });
  }

  /** Check if the super power is charged and ready to cast */
  public canActivatePower(): boolean {
    return this.powerMeter >= 100 && this.characterId !== 'nano_banana' && !this.isTopOut;
  }

  /** Unlock any gear-locked panels adjacent to newly cleared matches */
  public checkLockedPanels(matchedPanels: Panel[]): void {
    for (const panel of matchedPanels) {
      const neighbors = [
        { x: panel.gridX - 1, y: panel.gridY },
        { x: panel.gridX + 1, y: panel.gridY },
        { x: panel.gridX, y: panel.gridY - 1 },
        { x: panel.gridX, y: panel.gridY + 1 }
      ];
      for (const n of neighbors) {
        if (n.x >= 0 && n.x < BOARD_WIDTH && n.y >= 0 && n.y < BOARD_HEIGHT) {
          const neighbor = this.panels[n.y][n.x];
          if (neighbor && neighbor.isLocked) {
            neighbor.setLocked(false);
            SoundFx.playWrenchClank();
          }
        }
      }
    }
  }

  /** Activate this character's superpower */
  public activatePower(opponentBoard?: Board): { success: boolean; powerName: string } {
    if (!this.canActivatePower()) {
      return { success: false, powerName: '' };
    }

    this.powerMeter = 0;
    this.emit('powerMeterChange', { meter: 0 });

    const charData = CHARACTERS.find((c) => c.id === this.characterId);
    const powerName = charData?.powerName || 'Special';

    switch (this.characterId) {
      case 'mocha':
        if (opponentBoard) {
          this.triggerMochaTransmute(opponentBoard);
        } else {
          this.triggerMochaSoloTransmute();
        }
        break;
      case 'mizu':
        this.triggerMizuTidalFlow();
        break;
      case 'ember':
        this.triggerEmberWildfire();
        break;
      case 'riff':
        this.triggerRiffGrooveExtension();
        break;
      case 'poppy':
        this.triggerPoppySubFloorBlast();
        break;
      case 'salty':
        if (opponentBoard) {
          this.triggerSaltyFlashFreeze(opponentBoard);
        } else {
          this.isLiftFrozen = true;
          this.liftFrozenTimer = 6000;
          SoundFx.playCannonBoom();
        }
        break;
      case 'void_slime':
        if (opponentBoard) {
          this.triggerVoidSlimeAetherDrain(opponentBoard);
        } else {
          this.stopTime = Math.max(this.stopTime, 6000);
          SoundFx.playSparkleIdol();
        }
        break;
      case 'volt':
        if (opponentBoard) {
          this.triggerVoltOvercharge(opponentBoard);
        } else {
          this.stopTime = Math.max(this.stopTime, 5000);
          this.emit('match', { panels: [], comboSize: 4, chainLevel: 1, scoreGained: 500 });
          SoundFx.playElectricZap();
        }
        break;
      case 'kiri':
        if (opponentBoard) {
          this.triggerKiriGearLock(opponentBoard);
        } else {
          this.unlockAllPanels();
          this.stopTime = Math.max(this.stopTime, 4000);
          SoundFx.playWrenchClank();
        }
        break;
      case 'nano_banana':
      default:
        break;
    }

    this.emit('powerActivated', {
      characterId: this.characterId,
      powerName,
      powerDescription: charData?.powerDescription || ''
    });

    return { success: true, powerName };
  }

  /** Mocha: Transmute 3 random enemy blocks into a 3-block garbage unit */
  public triggerMochaTransmute(opponentBoard: Board): void {
    const candidates: { x: number; y: number }[] = [];
    for (let y = 0; y < BOARD_VISIBLE_HEIGHT; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        const p = opponentBoard.panels[y][x];
        if (p && p.state === PanelState.IDLE) {
          candidates.push({ x, y });
        }
      }
    }

    if (candidates.length >= 3) {
      Phaser.Utils.Array.Shuffle(candidates);
      const picked = candidates.slice(0, 3);
      for (const pos of picked) {
        const p = opponentBoard.panels[pos.y][pos.x];
        if (p) {
          p.destroy();
          opponentBoard.panels[pos.y][pos.x] = null;
        }
      }
      opponentBoard.queueGarbage(3, 1, Math.min(picked[0].x, BOARD_WIDTH - 3));
    } else {
      opponentBoard.queueGarbage(3, 1);
    }
    SoundFx.playPotionBubble();
  }

  /** Mocha: Solo transmute clears/transforms lowest garbage block or matches highest idle panels */
  public triggerMochaSoloTransmute(): void {
    if (this.garbageBlocks.length > 0) {
      const targetGarbage = this.garbageBlocks[0];
      targetGarbage.transformBottomRow().then((positions) => {
        if (positions.length > 0) {
          this.emit('garbageCleared', { count: positions.length });
          this.addPowerMeter(3 * positions.length);
        }
        positions.forEach((pos) => {
          if (pos.gridY < 0 || pos.gridY >= BOARD_HEIGHT || pos.gridX < 0 || pos.gridX >= BOARD_WIDTH) return;
          const existing = this.panels[pos.gridY][pos.gridX];
          if (existing) {
            existing.destroy();
            this.panels[pos.gridY][pos.gridX] = null;
          }
          const color = randomInt(0, Math.max(1, this.colorCount - 1));
          const panel = new Panel(this.scene, pos.gridX * PANEL_SIZE, pos.gridY * PANEL_SIZE, color);
          panel.setGridPosition(pos.gridX, pos.gridY);
          panel.chainEligible = true;
          this.panels[pos.gridY][pos.gridX] = panel;
          this.container.add(panel);
          this.checkPanelGravity(pos.gridX, pos.gridY);
        });
        this.garbageBlocks = this.garbageBlocks.filter((b) => b.state !== GarbageState.CLEARED);
        this.updateGarbage();
        this.checkMatches();
      });
      SoundFx.playPotionBubble();
      return;
    }
    const highestPanels: Panel[] = [];
    for (let y = 0; y < BOARD_VISIBLE_HEIGHT; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        const p = this.panels[y][x];
        if (p && p.state === PanelState.IDLE && p.color >= 0) {
          highestPanels.push(p);
          if (highestPanels.length >= 3) break;
        }
      }
      if (highestPanels.length >= 3) break;
    }
    if (highestPanels.length > 0) {
      highestPanels.forEach((p) => { p.chainEligible = true; });
      this.processMatchGroup(highestPanels, true);
    } else {
      this.stopTime = Math.max(this.stopTime, 4000);
    }
    SoundFx.playPotionBubble();
  }

  /** Unlocks all panels on the board */
  public unlockAllPanels(): void {
    for (let y = 0; y < BOARD_VISIBLE_HEIGHT; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        const p = this.panels[y][x];
        if (p && p.isLocked) {
          p.setLocked(false);
        }
      }
    }
  }

  /** Mizu: Reverses rising blocks and makes stack scroll downward for 5 seconds */
  public triggerMizuTidalFlow(): void {
    this.isReverseLiftActive = true;
    this.reverseLiftTimer = 5000;
    SoundFx.playWaterSlash();
  }

  /** Ember: Sets fire to all slimes of a chosen color and vaporizes them completely */
  public triggerEmberWildfire(): void {
    const colorBuckets = new Map<number, Panel[]>();
    for (let y = 0; y < BOARD_VISIBLE_HEIGHT; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        const p = this.panels[y][x];
        if (p && p.state === PanelState.IDLE && p.color >= 0) {
          if (!colorBuckets.has(p.color)) colorBuckets.set(p.color, []);
          colorBuckets.get(p.color)!.push(p);
        }
      }
    }

    if (colorBuckets.size === 0) return;

    let targetPanels: Panel[] = [];
    for (const [, list] of colorBuckets.entries()) {
      if (list.length > targetPanels.length) {
        targetPanels = list;
      }
    }

    if (targetPanels.length > 0) {
      targetPanels.forEach((p) => {
        p.chainEligible = true;
      });
      this.processMatchGroup(targetPanels, true);
    }
    SoundFx.playFireWhoosh();
  }

  /** Riff: Extends chain grace & pause window for 8 seconds */
  public triggerRiffGrooveExtension(): void {
    this.isGrooveActive = true;
    this.grooveTimer = 8000;
    this.stopTime = Math.max(this.stopTime, 4000);
    SoundFx.playPowerChord();
  }

  /** Poppy: Explodes the bottom two rows to instantly drop stack height */
  public triggerPoppySubFloorBlast(): void {
    const bottomRows = [BOARD_VISIBLE_HEIGHT - 1, BOARD_VISIBLE_HEIGHT - 2];
    let poppedCount = 0;
    for (const y of bottomRows) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        const p = this.panels[y][x];
        if (p) {
          p.pop();
          this.panels[y][x] = null;
          poppedCount++;
        }
      }
    }

    for (let x = 0; x < BOARD_WIDTH; x++) {
      for (let y = BOARD_VISIBLE_HEIGHT - 3; y >= 0; y--) {
        const p = this.panels[y][x];
        if (p) {
          p.chainEligible = true;
        }
        this.checkPanelGravity(x, y);
      }
    }
    this.updateGarbage();
    if (poppedCount > 0) {
      this.emit('match', {
        panels: [],
        comboSize: poppedCount,
        chainLevel: this.activeChain,
        scoreGained: poppedCount * 30
      });
    }
    SoundFx.playSparkleIdol();
  }

  /** Salty: Freezes the enemy stack mechanism for 6 seconds */
  public triggerSaltyFlashFreeze(opponentBoard: Board): void {
    opponentBoard.isLiftFrozen = true;
    opponentBoard.liftFrozenTimer = 6000;
    SoundFx.playCannonBoom();
  }

  /** Void Slime: Wipes out the enemy's power meter down to 0% */
  public triggerVoidSlimeAetherDrain(opponentBoard: Board): void {
    opponentBoard.powerMeter = 0;
    opponentBoard.emit('powerMeterChange', { meter: 0 });
    SoundFx.playCancel();
  }

  /** Volt: Electrifies enemy board with high-voltage static disruption */
  public triggerVoltOvercharge(opponentBoard: Board): void {
    opponentBoard.isOverchargeActive = true;
    opponentBoard.overchargeTimer = 6000;
    SoundFx.playElectricZap();
  }

  /** Kiri: Jams 3–4 enemy blocks with gear locks */
  public triggerKiriGearLock(opponentBoard: Board): void {
    const idlePanels: Panel[] = [];
    for (let y = 0; y < BOARD_VISIBLE_HEIGHT; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        const p = opponentBoard.panels[y][x];
        if (p && p.state === PanelState.IDLE && !p.isLocked) {
          idlePanels.push(p);
        }
      }
    }

    Phaser.Utils.Array.Shuffle(idlePanels);
    const lockCount = Math.min(idlePanels.length, randomInt(3, 4));
    for (let i = 0; i < lockCount; i++) {
      idlePanels[i].setLocked(true);
    }
    SoundFx.playWrenchClank();
  }

  public destroy(): void {
    this.removeAllListeners();
    this.poppingPanels.clear();
    if (this.maskGraphics) {
      this.maskGraphics.destroy();
      this.maskGraphics = undefined;
    }
    if (this.garbageBlocks) {
      for (const b of this.garbageBlocks) {
        b?.destroy();
      }
      this.garbageBlocks = [];
    }
    for (let r = 0; r < BOARD_HEIGHT; r++) {
      if (this.panels[r]) {
        for (let c = 0; c < BOARD_WIDTH; c++) {
          const p = this.panels[r][c];
          if (p) {
            p.destroy();
            this.panels[r][c] = null;
          }
        }
      }
    }
    if (this.container) {
      this.container.destroy();
    }
  }
}
