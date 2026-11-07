import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TouchController } from '../src/input/TouchController';
import { PANEL_SIZE, BOARD_WIDTH, BOARD_VISIBLE_HEIGHT } from '../src/utils/Constants';

describe('TouchController - Phase 2 Mobile Touch Interaction & Zero-Latency Drag', () => {
  let mockScene: any;
  let mockBoard: any;
  let mockCursor: any;
  let touchController: TouchController;
  let committedSwaps: { col: number; row: number }[] = [];
  let snappedBackCount = 0;

  beforeEach(() => {
    committedSwaps = [];
    snappedBackCount = 0;

    // Setup mock Phaser Scene
    mockScene = {
      add: {
        container: vi.fn(() => ({
          setDepth: vi.fn(),
          setVisible: vi.fn(),
          setScale: vi.fn(),
          setPosition: vi.fn(),
          add: vi.fn(),
          destroy: vi.fn(),
          visible: false
        })),
        graphics: vi.fn(() => ({
          lineStyle: vi.fn(),
          strokeRoundedRect: vi.fn()
        })),
        sprite: vi.fn(() => ({
          setDisplaySize: vi.fn(),
          setAlpha: vi.fn(),
          setTexture: vi.fn()
        }))
      },
      textures: {
        exists: vi.fn(() => true)
      },
      tweens: {
        add: vi.fn((config) => {
          if (config.onComplete) config.onComplete();
        })
      }
    };

    // Setup mock Board
    mockBoard = {
      isTopOut: false,
      boardOffsetX: 64,
      boardOffsetY: 64,
      scaleFactor: 1.0,
      stackOffsetPixels: 0,
      panels: Array.from({ length: 12 }, () =>
        Array.from({ length: 6 }, (_, c) => ({
          x: c * PANEL_SIZE,
          color: c,
          state: 'IDLE'
        }))
      ),
      swap: vi.fn((c, r) => true)
    };

    // Setup mock Cursor
    mockCursor = {
      setGridPosition: vi.fn()
    };

    touchController = new TouchController(mockScene, mockBoard, mockCursor, {
      onSwapCommit: (c, r) => committedSwaps.push({ col: c, row: r }),
      onSnapBack: () => snappedBackCount++
    });
  });

  it('1. Touch Locking: Pointerdown locks strictly to touched row and moves cursor', () => {
    // Cell (2, 4) at screen pos: (64 + 2*32, 64 + 4*32) = (128, 192)
    const pointerDown = {
      x: 128 + 16,
      y: 192 + 16,
      time: 1000
    } as any;

    const locked = touchController.handlePointerDown(pointerDown);
    expect(locked).toBe(true);
    expect(touchController.isDragging).toBe(true);
    expect(touchController.touchRow).toBe(4);
    expect(touchController.primaryCol).toBe(2);
    expect(mockCursor.setGridPosition).toHaveBeenCalledWith(2, 4);
  });

  it('2. Drag & Reciprocal Push: 1:1 visual displacement clamped to cell width', () => {
    // Pointerdown at (2, 4)
    touchController.handlePointerDown({ x: 128 + 16, y: 192 + 16, time: 1000 } as any);

    // Drag right by +20px (cell width is 32px), with vertical drift of +40px (which must be discarded!)
    touchController.handlePointerMove({ x: 128 + 16 + 20, y: 192 + 16 + 40, time: 1050 } as any);

    expect(touchController.currentDx).toBe(20);
    expect(touchController.neighborCol).toBe(3); // Right neighbor

    const primaryPanel = mockBoard.panels[4][2];
    const neighborPanel = mockBoard.panels[4][3];

    // Primary panel pushed right by +20px
    expect(primaryPanel.x).toBe(2 * PANEL_SIZE + 20);
    // Neighbor panel pushed left by -20px (reciprocal push)
    expect(neighborPanel.x).toBe(3 * PANEL_SIZE - 20);
  });

  it('3. Detent Threshold: Drag >= 0.4 * cellWidth commits swap', () => {
    touchController.handlePointerDown({ x: 144, y: 208, time: 1000 } as any);

    // Drag right by 15px (0.4 * 32 = 12.8px -> 15px >= 12.8px) at slow velocity (50px/s)
    touchController.handlePointerMove({ x: 144 + 15, y: 208, time: 1300 } as any);

    const committed = touchController.handlePointerUp({ x: 144 + 15, y: 208, time: 1300 } as any);

    expect(committed).toBe(true);
    expect(mockBoard.swap).toHaveBeenCalledWith(2, 4);
    expect(committedSwaps).toEqual([{ col: 2, row: 4 }]);
  });

  it('4. Flick Detection: Velocity > 400px/s with distance > 0.2 * cellWidth commits swap', () => {
    touchController.handlePointerDown({ x: 144, y: 208, time: 1000 } as any);

    // Fast flick: 8px movement in 15ms -> 8 / 0.015 = 533 px/s (> 400px/s) and 8px > 6.4px (0.2 * 32)
    touchController.handlePointerMove({ x: 144 + 8, y: 208, time: 1015 } as any);

    const committed = touchController.handlePointerUp({ x: 144 + 8, y: 208, time: 1015 } as any);

    expect(committed).toBe(true);
    expect(mockBoard.swap).toHaveBeenCalledWith(2, 4);
  });

  it('5. Abort & Snap-Back: Drag < 0.4 * cellWidth at low velocity snaps back with spring', () => {
    touchController.handlePointerDown({ x: 144, y: 208, time: 1000 } as any);

    // Drag 10px: beyond tap threshold (8px) but below 40% detent (12.8px) at slow velocity
    touchController.handlePointerMove({ x: 144 + 10, y: 208, time: 1350 } as any);

    const committed = touchController.handlePointerUp({ x: 144 + 10, y: 208, time: 1350 } as any);

    expect(committed).toBe(false);
    expect(mockBoard.swap).not.toHaveBeenCalled();
    expect(snappedBackCount).toBe(1);
    expect(mockScene.tweens.add).toHaveBeenCalled(); // 120ms ease-out spring
  });

  it('6. Tap Detection: Minimal movement with short duration triggers tap swap', () => {
    touchController.handlePointerDown({ x: 144, y: 208, time: 1000 } as any);

    // Quick tap: 2px movement in 80ms
    const committed = touchController.handlePointerUp({ x: 144 + 2, y: 208 + 1, time: 1080 } as any);

    expect(committed).toBe(true);
    expect(mockBoard.swap).toHaveBeenCalledWith(2, 4);
  });

  it('7. Zero Offset & Precise Cursor Tracking: Cursor stays locked to swapping pair with 0px vertical offset', () => {
    // Touch at (3, 5)
    touchController.handlePointerDown({ x: 64 + 3 * 32 + 16, y: 64 + 5 * 32 + 16, time: 2000 } as any);
    expect(touchController.touchRow).toBe(5);
    expect(touchController.primaryCol).toBe(3);
    expect(mockCursor.setGridPosition).toHaveBeenCalledWith(3, 5);

    // Drag left by -15px
    touchController.handlePointerMove({ x: 64 + 3 * 32 + 16 - 15, y: 64 + 5 * 32 + 16, time: 2050 } as any);
    expect(touchController.neighborCol).toBe(2);
    // Cursor must frame the swapping pair (cols 2 and 3 at row 5)
    expect(mockCursor.setGridPosition).toHaveBeenCalledWith(2, 5);

    // Drag right by +15px
    touchController.handlePointerMove({ x: 64 + 3 * 32 + 16 + 15, y: 64 + 5 * 32 + 16, time: 2100 } as any);
    expect(touchController.neighborCol).toBe(4);
    // Cursor must frame the swapping pair (cols 3 and 4 at row 5)
    expect(mockCursor.setGridPosition).toHaveBeenCalledWith(3, 5);
  });
});
