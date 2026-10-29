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
  DANGER_GRACE_TIME
} from '../utils/Constants';
import { randomInt } from '../utils/Helpers';
import { SoundFx } from '../utils/SoundFx';

export interface MatchEvent {
  panels: Panel[];
  comboSize: number;
  chainLevel: number;
  scoreGained: number;
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

  /** Current active chain counter (1 = standard clear, 2+ = chain) */
  public activeChain: number = 1;
  public isChainActive: boolean = false;

  /** Stack freeze/stop time in milliseconds */
  public stopTime: number = 0;

  /** Danger & Top-Out state */
  public isDanger: boolean = false;
  public dangerGraceTimer: number = DANGER_GRACE_TIME;
  public isTopOut: boolean = false;
  private dangerBeepTimer: number = 0;

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
    const maskGraphics = scene.make.graphics();
    maskGraphics.fillStyle(0xffffff);
    maskGraphics.fillRect(
      offsetX,
      offsetY,
      BOARD_WIDTH * PANEL_SIZE * scale,
      BOARD_VISIBLE_HEIGHT * PANEL_SIZE * scale
    );
    const mask = maskGraphics.createGeometryMask();
    this.container.setMask(mask);

    this.initializeBoard();
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
  public addInitialPanels(rows: number = 6): void {
    const startY = BOARD_VISIBLE_HEIGHT - 1;
    const endY = Math.max(1, BOARD_VISIBLE_HEIGHT - rows);

    for (let y = startY; y >= endY; y--) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        const color = this.getValidColor(x, y);
        const panel = new Panel(this.scene, x * PANEL_SIZE, y * PANEL_SIZE, color);
        panel.setGridPosition(x, y);
        this.panels[y][x] = panel;
        this.container.add(panel);
      }
    }

    this.generateBufferRow();
  }

  /** Generate the next hidden row waiting below the visible screen */
  private generateBufferRow(): void {
    const bufferY = BOARD_VISIBLE_HEIGHT;
    for (let x = 0; x < BOARD_WIDTH; x++) {
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
    do {
      color = randomInt(0, COLORS.COUNT - 1);
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
    return this.garbageBlocks.some((b) => b.occupies(x, y));
  }

  /** Spawn incoming garbage sent from opponent attack */
  public queueGarbage(width: number, height: number = 1): void {
    const safeWidth = Math.min(width, BOARD_WIDTH);
    const maxStartCol = BOARD_WIDTH - safeWidth;
    const startCol = randomInt(0, Math.max(0, maxStartCol));
    const startRow = -height; // Start above visible playfield so it falls in!

    const block = new GarbageBlock(this.scene, this.container, startCol, startRow, safeWidth, height);
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

      // Check other resting or falling garbage blocks
      for (const other of this.garbageBlocks) {
        if (
          other !== block &&
          (other.state === GarbageState.RESTING || other.state === GarbageState.FALLING) &&
          other.occupies(col, other.gridY)
        ) {
          const possible = other.gridY - block.height;
          if (possible < landingRow) {
            landingRow = possible;
          }
        }
      }
    }

    landingRow = Math.max(0, landingRow);
    const distance = Math.max(1, landingRow - block.gridY);
    const duration = Math.min(360, Math.max(120, distance * 36));
    block.fallTo(landingRow, duration);
  }

  /** Update garbage gravity when panels beneath clear or fall */
  private updateGarbage(): void {
    for (const block of this.garbageBlocks) {
      if (block.state !== GarbageState.RESTING) continue;

      const nextY = block.gridY + block.height;
      if (nextY >= BOARD_VISIBLE_HEIGHT) continue; // At the floor

      // Check if row directly below is entirely clear across block width
      let canFall = true;
      for (let c = 0; c < block.width; c++) {
        const col = block.gridX + c;
        if (this.panels[nextY][col] !== null) {
          canFall = false;
          break;
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
          const checkY = testY + block.height - 1;
          for (let c = 0; c < block.width; c++) {
            const col = block.gridX + c;
            if (this.panels[checkY][col] !== null) {
              testRowClear = false;
              break;
            }
            for (const other of this.garbageBlocks) {
              if (other !== block && other.occupies(col, checkY)) {
                testRowClear = false;
                break;
              }
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
          block.fallTo(landingY, 80);
        }
      }
    }
  }

  /**
   * Execute horizontal swap at (x, y) with (x + 1, y).
   * Supports swapping with empty space (air swap).
   */
  public swap(gridX: number, gridY: number): boolean {
    if (this.isTopOut) return false;
    if (gridX < 0 || gridX >= BOARD_WIDTH - 1 || gridY < 0 || gridY >= BOARD_HEIGHT) {
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

    if (!left && !right) return false;

    if (left && !left.canSwap()) return false;
    if (right && !right.canSwap()) return false;

    if (gridY > 0) {
      const aboveLeft = this.panels[gridY - 1][gridX];
      const aboveRight = this.panels[gridY - 1][gridX + 1];
      if (aboveLeft && (aboveLeft.state === PanelState.FALLING || aboveLeft.state === PanelState.HOVER)) {
        return false;
      }
      if (aboveRight && (aboveRight.state === PanelState.FALLING || aboveRight.state === PanelState.HOVER)) {
        return false;
      }
    }

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

  public canPanelFallInto(x: number, y: number): boolean {
    if (y >= BOARD_VISIBLE_HEIGHT) return false;
    if (this.panels[y][x] !== null) return false;
    if (this.isCellOccupiedByGarbage(x, y)) return false;
    return true;
  }

  private checkPanelGravity(x: number, y: number): void {
    if (y >= BOARD_VISIBLE_HEIGHT) return;
    const panel = this.panels[y][x];
    if (!panel || panel.state !== PanelState.IDLE) return;

    if (this.canPanelFallInto(x, y + 1)) {
      panel.startHover(80);
    }
  }

  /** Returns true if any panels or garbage blocks are in mid-air or mid-animation */
  public hasBusyPanels(): boolean {
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

    if (this.stopTime > 0) {
      this.stopTime = Math.max(0, this.stopTime - delta);
    }

    this.updateHoverAndFalling(delta);
    this.updateClearingPanels(delta);
    this.updateGarbage();
    this.checkMatches();
    this.updateChainState();
    this.updateDangerAndTopOut(delta);
    this.updateStackRising(delta);

    // Continuous safety synchronization: snap any resting IDLE panels to their authoritative grid coordinates
    for (let y = 0; y <= BOARD_VISIBLE_HEIGHT; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        const panel = this.panels[y][x];
        if (panel && panel.state === PanelState.IDLE) {
          const expectedX = x * PANEL_SIZE;
          const expectedY = y * PANEL_SIZE;
          if (panel.x !== expectedX) panel.x = expectedX;
          if (panel.y !== expectedY) panel.y = expectedY;
        }
      }
    }
  }

  /** Update stack rising and handle row shift transitions */
  private updateStackRising(delta: number): void {
    // In classic Panel de Pon, stopTime completely halts the stack rise
    if (this.stopTime > 0) return;
    if (this.isDanger && !this.isLifting) return;

    // Do NOT auto-rise while active cascades or clears are resolving
    if (this.isChainActive) return;

    const currentSpeed = this.isLifting ? FAST_LIFT_SPEED : this.riseSpeed;
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
          this.dangerGraceTimer = DANGER_GRACE_TIME;
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
        this.dangerGraceTimer = DANGER_GRACE_TIME;
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
        this.dangerGraceTimer = DANGER_GRACE_TIME;
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
    if (this.isLifting && !lifting) {
      this.stopTime = Math.max(this.stopTime, 120);
    }
    this.isLifting = lifting;
  }

  private updateHoverAndFalling(delta: number): void {
    for (let y = BOARD_VISIBLE_HEIGHT - 1; y >= 0; y--) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        const panel = this.panels[y][x];
        if (!panel) continue;

        if (panel.state === PanelState.HOVER) {
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
          continue;
        }

        if (panel.state === PanelState.IDLE) {
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
  }

  private dropPanel(x: number, y: number): void {
    const panel = this.panels[y][x];
    if (!panel || panel.state === PanelState.SWAPPING || panel.isClearing()) return;

    // Find the lowest landing row
    let targetRow = y;
    while (this.canPanelFallInto(x, targetRow + 1)) {
      targetRow++;
    }

    if (targetRow === y) {
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
            panel.pop();

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

    const matchedList = Array.from(matchedPanelsSet);
    const comboSize = matchedList.length;

    const isChainMatch = matchedList.some((p) => p.chainEligible);

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

    this.stopTime = 600 + Math.min(comboSize * 150, 1500) + (this.activeChain > 1 ? 800 : 0);

    if (this.isDanger) {
      // Matching while in danger awards bonus grace time and pauses danger!
      this.dangerGraceTimer = Math.min(DANGER_GRACE_TIME, this.dangerGraceTimer + 1800);
      this.stopTime = Math.max(this.stopTime, 1400);
    }

    if (this.activeChain > 1 || comboSize >= 4) {
      SoundFx.playCombo(this.activeChain);
    } else {
      SoundFx.playMatch();
    }

    // Trigger de-transformation for any adjacent resting garbage blocks
    this.checkGarbageTransformations(matchedList);

    matchedList.forEach((panel) => {
      for (let y = panel.gridY - 1; y >= 0; y--) {
        const above = this.panels[y][panel.gridX];
        if (above && !matchedPanelsSet.has(above)) {
          above.chainEligible = true;
        }
      }
    });

    matchedList.forEach((panel, i) => {
      panel.startMatch(380, i * 40);
    });

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
      this.dangerGraceTimer = Math.min(DANGER_GRACE_TIME, this.dangerGraceTimer + 2500);
      this.stopTime = Math.max(this.stopTime, 1600);
    }

    for (const block of blocksToTransform) {
      block.transformBottomRow().then((positions) => {
        positions.forEach((pos) => {
          if (pos.gridY < 0 || pos.gridY >= BOARD_HEIGHT || pos.gridX < 0 || pos.gridX >= BOARD_WIDTH) return;
          const existing = this.panels[pos.gridY][pos.gridX];
          if (existing) {
            existing.destroy();
          }
          const color = randomInt(0, COLORS.COUNT - 1);
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

    let hasActiveChainElements = false;
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
      this.panels[y][x] = panel;
    }
  }

  public isEmpty(x: number, y: number): boolean {
    return this.getPanelAt(x, y) === null && !this.isCellOccupiedByGarbage(x, y);
  }
}
