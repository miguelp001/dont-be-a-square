import type Phaser from 'phaser';
import type Board from '../objects/Board';
import type Cursor from '../objects/Cursor';
import type Panel from '../objects/Panel';
import { PanelState, PANEL_SIZE, BOARD_WIDTH, BOARD_VISIBLE_HEIGHT } from '../utils/Constants';

export interface TouchControllerConfig {
  occlusionOffsetY?: number; // Visual lift above thumb (default 24px)
  flickVelocityThreshold?: number; // px/s (default 400)
  flickDistanceThreshold?: number; // fraction of cell width (default 0.2)
  dragCommitThreshold?: number; // fraction of cell width (default 0.4)
  snapBackDuration?: number; // ms (default 120)
  onSwapCommit?: (col: number, row: number) => void;
  onSnapBack?: () => void;
}

export function triggerHaptic(type: 'snap' | 'tap' | 'danger'): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      if (type === 'snap') {
        navigator.vibrate(15);
      } else if (type === 'tap') {
        navigator.vibrate(10);
      } else if (type === 'danger') {
        navigator.vibrate([25, 40, 25]);
      }
    } catch {
      // Audio or vibration permissions unavailable
    }
  }
}

export class TouchController {
  private scene: Phaser.Scene;
  private board: Board;
  private cursor?: Cursor;
  private config: Required<TouchControllerConfig>;

  // Touch Drag State
  public isDragging: boolean = false;
  public touchRow: number = -1;
  public primaryCol: number = -1;
  public neighborCol: number = -1;
  public startPointerX: number = 0;
  public startPointerY: number = 0;
  public currentDx: number = 0; // Screen pixel delta X
  public startTime: number = 0;
  public lastX: number = 0;
  public lastTime: number = 0;
  public releaseVelocity: number = 0; // px/sec

  // Visual Ghost Projection & Anchor (24px above thumb to defeat thumb occlusion)
  private ghostContainer: Phaser.GameObjects.Container;
  private ghostSprite: Phaser.GameObjects.Sprite;
  private ghostGlow: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, board: Board, cursor?: Cursor, config?: TouchControllerConfig) {
    this.scene = scene;
    this.board = board;
    this.cursor = cursor;

    this.config = {
      occlusionOffsetY: config?.occlusionOffsetY ?? 24,
      flickVelocityThreshold: config?.flickVelocityThreshold ?? 400,
      flickDistanceThreshold: config?.flickDistanceThreshold ?? 0.2,
      dragCommitThreshold: config?.dragCommitThreshold ?? 0.4,
      snapBackDuration: config?.snapBackDuration ?? 120,
      onSwapCommit: config?.onSwapCommit ?? (() => {}),
      onSnapBack: config?.onSnapBack ?? (() => {})
    };

    // Setup Occlusion Ghost Projection
    this.ghostContainer = scene.add.container(0, 0);
    this.ghostContainer.setDepth(45);
    this.ghostContainer.setVisible(false);

    this.ghostGlow = scene.add.graphics();
    this.ghostGlow.lineStyle(3, 0xffffff, 0.85);
    this.ghostGlow.strokeRoundedRect(-PANEL_SIZE / 2 - 2, -PANEL_SIZE / 2 - 2, PANEL_SIZE + 4, PANEL_SIZE + 4, 8);

    this.ghostSprite = scene.add.sprite(0, 0, 'panel');
    this.ghostSprite.setDisplaySize(PANEL_SIZE, PANEL_SIZE);
    this.ghostSprite.setAlpha(0.9);

    this.ghostContainer.add([this.ghostGlow, this.ghostSprite]);
  }

  public setCursor(cursor: Cursor): void {
    this.cursor = cursor;
  }

  /**
   * Handle Pointer Down:
   * Locks the interaction strictly to the touched row (single-axis lock).
   */
  public handlePointerDown(pointer: Phaser.Input.Pointer): boolean {
    if (this.board.isTopOut) return false;

    const bX = this.board.boardOffsetX;
    const bY = this.board.boardOffsetY;
    const scale = this.board.scaleFactor;
    const bW = BOARD_WIDTH * PANEL_SIZE * scale;
    const bH = BOARD_VISIBLE_HEIGHT * PANEL_SIZE * scale;
    const pad = 12 * scale;

    if (
      pointer.x < bX - pad ||
      pointer.x > bX + bW + pad ||
      pointer.y < bY - pad ||
      pointer.y > bY + bH + pad
    ) {
      return false;
    }

    // Convert screen coordinates to grid coordinates
    const localX = (pointer.x - bX) / scale;
    const localY = (pointer.y - (bY - this.board.stackOffsetPixels * scale)) / scale;

    const col = Math.max(0, Math.min(BOARD_WIDTH - 1, Math.floor(localX / PANEL_SIZE)));
    const row = Math.max(0, Math.min(BOARD_VISIBLE_HEIGHT - 1, Math.floor(localY / PANEL_SIZE)));

    // Lock strictly to touched row
    this.isDragging = true;
    this.touchRow = row;
    this.primaryCol = col;
    this.neighborCol = -1;
    this.startPointerX = pointer.x;
    this.startPointerY = pointer.y;
    this.currentDx = 0;
    this.startTime = pointer.time || Date.now();
    this.lastX = pointer.x;
    this.lastTime = this.startTime;
    this.releaseVelocity = 0;

    // Position cursor at touched tile
    if (this.cursor) {
      const cursorCol = Math.min(col, BOARD_WIDTH - 2);
      this.cursor.setGridPosition(cursorCol, row);
    }

    // Setup ghost projection preview
    const primaryPanel = this.board.panels[row]?.[col];
    if (primaryPanel && primaryPanel.color !== undefined) {
      const texKey = this.scene.textures.exists(`panel_${primaryPanel.color}`)
        ? `panel_${primaryPanel.color}`
        : 'panel';
      this.ghostSprite.setTexture(texKey);
      this.ghostContainer.setScale(scale * 1.1); // Slightly enlarged projection
      this.ghostContainer.setPosition(pointer.x, pointer.y - this.config.occlusionOffsetY * scale);
      this.ghostContainer.setVisible(true);
    }

    return true;
  }

  /**
   * Handle Pointer Move:
   * Strictly discards dY deviations.
   * Computes 1:1 reciprocal drag displacement for primary and adjacent tile.
   */
  public handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.isDragging || this.touchRow < 0) return;

    const scale = this.board.scaleFactor;
    const cellWidth = PANEL_SIZE * scale;

    // 1. Single-Axis Lock: Discard all vertical movement deviations (dY)
    const rawDx = pointer.x - this.startPointerX;
    // Clamp displacement strictly between -cellWidth and +cellWidth
    this.currentDx = Math.max(-cellWidth, Math.min(cellWidth, rawDx));

    // 2. Velocity Tracking
    const now = pointer.time || Date.now();
    const dt = Math.max(1, now - this.lastTime);
    this.releaseVelocity = (Math.abs(pointer.x - this.lastX) / dt) * 1000; // px/sec
    this.lastX = pointer.x;
    this.lastTime = now;

    // 3. Determine Adjacent Neighbor Column
    if (this.currentDx > 0) {
      // Dragging Right -> neighbor is to the right (primaryCol + 1)
      this.neighborCol = this.primaryCol < BOARD_WIDTH - 1 ? this.primaryCol + 1 : -1;
    } else if (this.currentDx < 0) {
      // Dragging Left -> neighbor is to the left (primaryCol - 1)
      this.neighborCol = this.primaryCol > 0 ? this.primaryCol - 1 : -1;
    } else {
      this.neighborCol = -1;
    }

    // Clamp currentDx if at edge of board
    if (this.neighborCol === -1) {
      this.currentDx = 0;
    }

    // 4. Reciprocal Push: 1:1 visual displacement with subtle 1.05x squash & stretch
    const primaryPanel = this.board.panels[this.touchRow]?.[this.primaryCol];
    if (primaryPanel && primaryPanel.state === PanelState.IDLE) {
      primaryPanel.x = this.primaryCol * PANEL_SIZE + this.currentDx / scale;
      if (typeof primaryPanel.setScale === 'function') {
        const isMoved = Math.abs(this.currentDx) > 3;
        primaryPanel.setScale(isMoved ? 1.05 : 1.0, isMoved ? 0.95 : 1.0);
      }
    }

    if (this.neighborCol >= 0) {
      const neighborPanel = this.board.panels[this.touchRow]?.[this.neighborCol];
      if (neighborPanel && neighborPanel.state === PanelState.IDLE) {
        neighborPanel.x = this.neighborCol * PANEL_SIZE - this.currentDx / scale;
        if (typeof neighborPanel.setScale === 'function') {
          const isMoved = Math.abs(this.currentDx) > 3;
          neighborPanel.setScale(isMoved ? 1.05 : 1.0, isMoved ? 0.95 : 1.0);
        }
      }
    }

    // 5. Update Occlusion Ghost Projection (shifted 24px above thumb)
    if (this.ghostContainer.visible) {
      this.ghostContainer.setPosition(pointer.x, pointer.y - this.config.occlusionOffsetY * scale);
    }
  }

  /**
   * Handle Pointer Up:
   * Evaluates Flick vs Detent vs Snap-Back.
   */
  public handlePointerUp(pointer: Phaser.Input.Pointer): boolean {
    if (!this.isDragging || this.touchRow < 0) return false;

    const scale = this.board.scaleFactor;
    const cellWidth = PANEL_SIZE * scale;
    const row = this.touchRow;
    const primaryCol = this.primaryCol;
    const neighborCol = this.neighborCol;
    const absDx = Math.abs(this.currentDx);

    this.isDragging = false;
    this.ghostContainer.setVisible(false);

    // Tap detection: minimal movement and short duration
    const now = pointer.time || Date.now();
    const duration = now - this.startTime;
    const totalDist = Math.hypot(pointer.x - this.startPointerX, pointer.y - this.startPointerY);

    if (totalDist < 8 * scale && duration < 250) {
      // Clean tap swap at touched position
      const swapCol = Math.min(primaryCol, BOARD_WIDTH - 2);
      this.snapBackPanels(row, primaryCol, neighborCol);
      triggerHaptic('tap');
      this.board.swap(swapCol, row);
      this.config.onSwapCommit(swapCol, row);
      return true;
    }

    if (neighborCol < 0 || primaryCol < 0) {
      this.snapBackPanels(row, primaryCol, neighborCol);
      return false;
    }

    // Detent & Flick Decision:
    // 1. Release velocity > 400px/s AND |dX| > 0.2 * cellWidth -> Commit immediately
    // 2. Velocity <= 400px/s:
    //    - |dX| >= 0.4 * cellWidth -> Commit
    //    - |dX| < 0.4 * cellWidth -> Snap back with 120ms spring
    const isFlickCommit =
      this.releaseVelocity > this.config.flickVelocityThreshold &&
      absDx > this.config.flickDistanceThreshold * cellWidth;

    const isDragCommit = absDx >= this.config.dragCommitThreshold * cellWidth;

    if (isFlickCommit || isDragCommit) {
      // Commit Swap
      const swapLeftCol = Math.min(primaryCol, neighborCol);
      this.resetPanelPositions(row, primaryCol, neighborCol);
      triggerHaptic('snap');
      this.board.swap(swapLeftCol, row);
      this.config.onSwapCommit(swapLeftCol, row);
      return true;
    } else {
      // Abort: Snap Back to origin with ease-out spring (120ms)
      triggerHaptic('snap');
      this.snapBackPanels(row, primaryCol, neighborCol);
      this.config.onSnapBack();
      return false;
    }
  }

  /** Snap panels smoothly back to their grid origin */
  private snapBackPanels(row: number, colA: number, colB: number): void {
    const panelsToSnap: { panel: Panel; targetX: number }[] = [];

    if (colA >= 0) {
      const pA = this.board.panels[row]?.[colA];
      if (pA && pA.state === PanelState.IDLE) {
        panelsToSnap.push({ panel: pA, targetX: colA * PANEL_SIZE });
      }
    }

    if (colB >= 0) {
      const pB = this.board.panels[row]?.[colB];
      if (pB && pB.state === PanelState.IDLE) {
        panelsToSnap.push({ panel: pB, targetX: colB * PANEL_SIZE });
      }
    }

    for (const item of panelsToSnap) {
      this.scene.tweens.add({
        targets: item.panel,
        x: item.targetX,
        duration: this.config.snapBackDuration,
        ease: 'Back.easeOut',
        onComplete: () => {
          item.panel.x = item.targetX;
        }
      });
    }
  }

  /** Reset panel positions and restore standard scale prior to authoritative swap */
  private resetPanelPositions(row: number, colA: number, colB: number): void {
    if (colA >= 0) {
      const pA = this.board.panels[row]?.[colA];
      if (pA && pA.state === PanelState.IDLE) {
        pA.x = colA * PANEL_SIZE;
        if (typeof pA.setScale === 'function') pA.setScale(1.0);
      }
    }
    if (colB >= 0) {
      const pB = this.board.panels[row]?.[colB];
      if (pB && pB.state === PanelState.IDLE) {
        pB.x = colB * PANEL_SIZE;
        if (typeof pB.setScale === 'function') pB.setScale(1.0);
      }
    }
  }

  public destroy(): void {
    this.ghostContainer.destroy();
  }
}
