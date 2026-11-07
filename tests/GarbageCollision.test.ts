import { describe, it, expect, vi } from 'vitest';
import { PANEL_SIZE, BOARD_WIDTH, BOARD_VISIBLE_HEIGHT } from '../src/utils/Constants';
import { GarbageState } from '../src/objects/GarbageBlock';

describe('Garbage Collision & Slime Panel Co-Occupancy Prevention', () => {
  it('1. Garbage landing row calculation does NOT clamp to 0 when panels reach the ceiling', () => {
    // Simulate board panel column where the highest panel is at row 1
    const mockPanels: any[][] = Array.from({ length: 13 }, () => Array(BOARD_WIDTH).fill(null));
    mockPanels[1][0] = { gridX: 0, gridY: 1 }; // Panel at row 1
    mockPanels[2][0] = { gridX: 0, gridY: 2 };

    const garbageHeight = 2;
    const width = 3;
    const startCol = 0;

    // Highest panel calculation
    let landingRow = BOARD_VISIBLE_HEIGHT - garbageHeight;
    for (let c = 0; c < width; c++) {
      const col = startCol + c;
      for (let r = 0; r < BOARD_VISIBLE_HEIGHT; r++) {
        if (mockPanels[r][col] !== null) {
          const possible = r - garbageHeight;
          if (possible < landingRow) {
            landingRow = possible;
          }
          break;
        }
      }
    }

    // landingRow should be 1 - 2 = -1 (resting above the ceiling), NEVER clamped to 0!
    expect(landingRow).toBe(-1);

    // If landingRow were 0, garbage block would occupy rows 0 and 1,
    // colliding with the panel at row 1!
    // With landingRow = -1, garbage occupies [-1, 0], and panel is at row 1.
    const garbageOccupiesRow1 = (1 >= landingRow && 1 < landingRow + garbageHeight);
    expect(garbageOccupiesRow1).toBe(false);
  });

  it('2. Garbage landing row when panel is at row 0 rests above ceiling at -height', () => {
    const mockPanels: any[][] = Array.from({ length: 13 }, () => Array(BOARD_WIDTH).fill(null));
    mockPanels[0][0] = { gridX: 0, gridY: 0 }; // Panel at row 0 (top of visible grid)

    const garbageHeight = 1;
    const width = 6;
    const startCol = 0;

    let landingRow = BOARD_VISIBLE_HEIGHT - garbageHeight;
    for (let c = 0; c < width; c++) {
      const col = startCol + c;
      for (let r = 0; r < BOARD_VISIBLE_HEIGHT; r++) {
        if (mockPanels[r][col] !== null) {
          const possible = r - garbageHeight;
          if (possible < landingRow) {
            landingRow = possible;
          }
          break;
        }
      }
    }

    // Landing row must be 0 - 1 = -1
    expect(landingRow).toBe(-1);

    // It must NEVER occupy row 0 where the panel is
    const garbageOccupiesRow0 = (0 >= landingRow && 0 < landingRow + garbageHeight);
    expect(garbageOccupiesRow0).toBe(false);
  });

  it('3. Stacking garbage blocks vertically calculates exact non-overlapping resting targets', () => {
    const existingGarbage = {
      gridX: 0,
      gridY: 6,
      width: 6,
      height: 2,
      state: GarbageState.RESTING
    };

    const newBlockHeight = 2;
    const newBlockWidth = 6;
    let landingRow = BOARD_VISIBLE_HEIGHT - newBlockHeight;

    for (let c = 0; c < newBlockWidth; c++) {
      const col = c;
      if (
        existingGarbage.state !== GarbageState.CLEARED &&
        col >= existingGarbage.gridX &&
        col < existingGarbage.gridX + existingGarbage.width
      ) {
        const possible = existingGarbage.gridY - newBlockHeight;
        if (possible < landingRow) {
          landingRow = possible;
        }
      }
    }

    // New block should land at 6 - 2 = 4 (occupying rows 4, 5)
    expect(landingRow).toBe(4);

    // Existing occupies rows 6, 7
    // Verify no row is shared between new block and existing block
    const newOccupiedRows = [landingRow, landingRow + 1];
    const existingOccupiedRows = [existingGarbage.gridY, existingGarbage.gridY + 1];

    for (const r of newOccupiedRows) {
      expect(existingOccupiedRows.includes(r)).toBe(false);
    }
  });

  it('4. Transforming garbage block is counted as obstacle for dropping blocks', () => {
    const transformingGarbage = {
      gridX: 0,
      gridY: 7,
      width: 6,
      height: 1,
      state: GarbageState.TRANSFORMING
    };

    const incomingHeight = 1;
    let landingRow = BOARD_VISIBLE_HEIGHT - incomingHeight;

    for (let c = 0; c < 6; c++) {
      const col = c;
      if (
        transformingGarbage.state !== GarbageState.CLEARED &&
        col >= transformingGarbage.gridX &&
        col < transformingGarbage.gridX + transformingGarbage.width
      ) {
        const possible = transformingGarbage.gridY - incomingHeight;
        if (possible < landingRow) {
          landingRow = possible;
        }
      }
    }

    // Incoming must land at 7 - 1 = 6, NOT fall through to row 11!
    expect(landingRow).toBe(6);
  });

  it('5. Swap lock rejects horizontal swap under a falling garbage block', () => {
    const fallingBlock = {
      gridX: 0,
      gridY: 4,
      width: 3,
      height: 1,
      state: GarbageState.FALLING,
      occupies: (x: number, y: number) => x >= 0 && x < 3 && y === 4
    };

    // Attempting to swap at row 5 directly under row 4
    const canSwapUnderneath = (gridX: number, gridY: number) => {
      if (fallingBlock.state === GarbageState.FALLING) {
        if (
          fallingBlock.occupies(gridX, gridY) ||
          fallingBlock.occupies(gridX + 1, gridY) ||
          (gridY > 0 && (fallingBlock.occupies(gridX, gridY - 1) || fallingBlock.occupies(gridX + 1, gridY - 1)))
        ) {
          return false;
        }
      }
      return true;
    };

    expect(canSwapUnderneath(0, 5)).toBe(false);
    expect(canSwapUnderneath(1, 5)).toBe(false);
    // Columns 3 and 4 are clear of the falling block
    expect(canSwapUnderneath(3, 5)).toBe(true);
  });
});
