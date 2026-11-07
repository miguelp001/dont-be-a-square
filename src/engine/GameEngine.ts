import { TileState, Tile, SwapCommand, MatchGroup, EngineEvents } from './Types';

export const COLS = 6;
export const ROWS = 12;

export const SWAP_DURATION = 100; // ms (6 frames @ 60fps)
export const HOVER_DELAY = 250; // ms unsupported hover
export const FALL_INTERVAL = 40; // ms per row drop
export const MATCH_FLASH_DURATION = 300; // ms strobe
export const POP_DURATION = 120; // ms per panel pop
export const INPUT_BUFFER_TTL = 150; // ms input queue window

export class GameEngine {
  public grid: Tile[][]; // [col][row], where col: 0..5, row: 0..11 (0 = bottom, 11 = top)
  public inputBuffer: SwapCommand[] = [];
  public chainMultiplier: number = 1;
  public isChainActive: boolean = false;
  public isTopOut: boolean = false;
  public events: EngineEvents = {};

  constructor(events?: EngineEvents) {
    if (events) this.events = events;
    this.grid = this.createEmptyGrid();
  }

  public createEmptyGrid(): Tile[][] {
    const grid: Tile[][] = [];
    for (let c = 0; c < COLS; c++) {
      grid[c] = [];
      for (let r = 0; r < ROWS; r++) {
        grid[c][r] = this.createEmptyTile();
      }
    }
    return grid;
  }

  public createEmptyTile(): Tile {
    return {
      state: TileState.EMPTY,
      color: -1,
      chainEligible: false,
      timer: 0,
      popDelay: 0
    };
  }

  public getTile(col: number, row: number): Tile | null {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
    return this.grid[col][row];
  }

  public setTile(col: number, row: number, color: number, state: TileState = TileState.IDLE, chainEligible: boolean = false): void {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
    this.grid[col][row] = {
      state,
      color,
      chainEligible,
      timer: 0,
      popDelay: 0
    };
  }

  /**
   * Attempt to execute or queue a horizontal swap between (col, row) and (col+1, row).
   * Inputs during busy states remain in the 150ms input buffer queue.
   */
  public swap(col: number, row: number): boolean {
    if (this.isTopOut) return false;
    if (col < 0 || col >= COLS - 1 || row < 0 || row >= ROWS) return false;

    if (this.canSwap(col, row)) {
      this.executeSwap(col, row);
      return true;
    } else {
      // Buffer the input with 150ms window
      this.inputBuffer.push({ col, row, ttl: INPUT_BUFFER_TTL });
      return false;
    }
  }

  public canSwap(col: number, row: number): boolean {
    if (col < 0 || col >= COLS - 1 || row < 0 || row >= ROWS) return false;
    const tileA = this.grid[col][row];
    const tileB = this.grid[col + 1][row];

    // Cannot swap if both are empty
    if (tileA.state === TileState.EMPTY && tileB.state === TileState.EMPTY) return false;

    // Both tiles must be either IDLE or EMPTY
    const isASwappable = tileA.state === TileState.IDLE || tileA.state === TileState.EMPTY;
    const isBSwappable = tileB.state === TileState.IDLE || tileB.state === TileState.EMPTY;
    if (!isASwappable || !isBSwappable) return false;

    // A tile cannot swap if a tile directly above is falling into it or clearing
    if (row < ROWS - 1) {
      const aboveA = this.grid[col][row + 1];
      const aboveB = this.grid[col + 1][row + 1];
      if (aboveA && (aboveA.state === TileState.FALLING || aboveA.state === TileState.SWAPPING)) return false;
      if (aboveB && (aboveB.state === TileState.FALLING || aboveB.state === TileState.SWAPPING)) return false;
    }

    return true;
  }

  private executeSwap(col: number, row: number): void {
    const tileA = this.grid[col][row];
    const tileB = this.grid[col + 1][row];

    tileA.state = TileState.SWAPPING;
    tileA.timer = SWAP_DURATION;
    tileA.swapTargetCol = col + 1;

    tileB.state = TileState.SWAPPING;
    tileB.timer = SWAP_DURATION;
    tileB.swapTargetCol = col;

    if (this.events.onSwap) {
      this.events.onSwap(col, row, col + 1, row);
    }
  }

  /**
   * Deterministic game tick loop.
   * @param dt Delta time in milliseconds
   */
  public tick(dt: number): void {
    if (this.isTopOut) return;

    // 1. Update Swapping tiles first so newly completed swaps free tiles for inputs
    this.updateSwapping(dt);

    // 2. Process Input Buffer Queue (150ms window)
    this.processInputBuffer(dt);

    // 3. Update Hovering tiles
    this.updateHovering(dt);

    // 4. Update Falling tiles
    this.updateFalling(dt);

    // 5. Detect and initiate Hover for unsupported IDLE tiles
    this.detectUnsupportedTiles();

    // 6. Update Match Flashing tiles
    this.updateMatchFlashing(dt);

    // 7. Update Popping tiles
    this.updatePopping(dt);

    // 8. Match Detection across IDLE tiles
    this.checkMatches();

    // 9. Update Chain State
    this.updateChainState();
  }

  private processInputBuffer(dt: number): void {
    for (let i = this.inputBuffer.length - 1; i >= 0; i--) {
      const cmd = this.inputBuffer[i];
      cmd.ttl -= dt;

      if (this.canSwap(cmd.col, cmd.row)) {
        this.executeSwap(cmd.col, cmd.row);
        this.inputBuffer.splice(i, 1);
      } else if (cmd.ttl <= 0) {
        this.inputBuffer.splice(i, 1);
      }
    }
  }

  private updateSwapping(dt: number): void {
    const completedSwaps: { col: number; row: number }[] = [];

    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const tile = this.grid[c][r];
        if (tile.state === TileState.SWAPPING && tile.swapTargetCol !== undefined) {
          tile.timer -= dt;
          if (tile.timer <= 0 && c < tile.swapTargetCol) {
            completedSwaps.push({ col: c, row: r });
          }
        }
      }
    }

    for (const swap of completedSwaps) {
      const c1 = swap.col;
      const c2 = c1 + 1;
      const r = swap.row;

      const tileA = this.grid[c1][r];
      const tileB = this.grid[c2][r];

      // Exchange tile contents
      const tempColor = tileA.color;
      const tempChain = tileA.chainEligible;

      tileA.color = tileB.color;
      tileA.chainEligible = tileB.chainEligible;
      tileA.state = tileA.color === -1 ? TileState.EMPTY : TileState.IDLE;
      tileA.timer = 0;
      delete tileA.swapTargetCol;

      tileB.color = tempColor;
      tileB.chainEligible = tempChain;
      tileB.state = tileB.color === -1 ? TileState.EMPTY : TileState.IDLE;
      tileB.timer = 0;
      delete tileB.swapTargetCol;

      // Active Interception check:
      // If a tile was swapped into a column where a tile above is FALLING or HOVERING,
      // it supports that tile when it reaches this row.
      // Also, if either swapped tile is now unsupported, it enters HOVER immediately!
      this.checkTileSupport(c1, r);
      this.checkTileSupport(c2, r);
    }
  }

  private checkTileSupport(col: number, row: number): void {
    const tile = this.grid[col][row];
    if (tile.state !== TileState.IDLE || tile.color === -1) return;

    if (row === 0) return; // Floor supports it

    const below = this.grid[col][row - 1];
    if (below.state === TileState.EMPTY) {
      tile.state = TileState.HOVER;
      tile.timer = HOVER_DELAY;
    }
  }

  private detectUnsupportedTiles(): void {
    for (let c = 0; c < COLS; c++) {
      for (let r = 1; r < ROWS; r++) {
        const tile = this.grid[c][r];
        if (tile.state === TileState.IDLE && tile.color !== -1) {
          const below = this.grid[c][r - 1];
          if (below.state === TileState.EMPTY) {
            tile.state = TileState.HOVER;
            tile.timer = HOVER_DELAY;
          }
        }
      }
    }
  }

  private updateHovering(dt: number): void {
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const tile = this.grid[c][r];
        if (tile.state === TileState.HOVER) {
          tile.timer -= dt;
          if (tile.timer <= 0) {
            tile.state = TileState.FALLING;
            tile.timer = FALL_INTERVAL;
          }
        }
      }
    }
  }

  private updateFalling(dt: number): void {
    // Process falling from bottom to top so multiple falling tiles move synchronously
    for (let c = 0; c < COLS; c++) {
      for (let r = 1; r < ROWS; r++) {
        const tile = this.grid[c][r];
        if (tile.state === TileState.FALLING) {
          tile.timer -= dt;
          if (tile.timer <= 0) {
            const below = this.grid[c][r - 1];

            // If cell below is EMPTY, drop down by 1 row
            if (below.state === TileState.EMPTY) {
              below.color = tile.color;
              below.state = TileState.FALLING;
              below.chainEligible = tile.chainEligible;
              below.timer = FALL_INTERVAL;

              tile.color = -1;
              tile.state = TileState.EMPTY;
              tile.chainEligible = false;
              tile.timer = 0;
            } else if (below.state === TileState.IDLE) {
              // Active Interception / Landing on support!
              tile.state = TileState.IDLE;
              tile.timer = 0;
            } else if (below.state === TileState.SWAPPING || below.state === TileState.HOVER || below.state === TileState.MATCH_FLASH || below.state === TileState.POP) {
              // Paused above an active or clearing block
              tile.timer = FALL_INTERVAL;
            }
          }
        }
      }

      // Check if tile at row 0 is falling and landed on floor
      const bottomTile = this.grid[c][0];
      if (bottomTile.state === TileState.FALLING) {
        bottomTile.state = TileState.IDLE;
        bottomTile.timer = 0;
      }
    }
  }

  private updateMatchFlashing(dt: number): void {
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const tile = this.grid[c][r];
        if (tile.state === TileState.MATCH_FLASH) {
          tile.timer -= dt;
          if (tile.timer <= 0) {
            tile.state = TileState.POP;
            tile.timer = tile.popDelay + POP_DURATION;
          }
        }
      }
    }
  }

  private updatePopping(dt: number): void {
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const tile = this.grid[c][r];
        if (tile.state === TileState.POP) {
          tile.timer -= dt;
          if (tile.timer <= 0) {
            const poppedColor = tile.color;
            tile.state = TileState.EMPTY;
            tile.color = -1;
            tile.chainEligible = false;
            tile.timer = 0;

            if (this.events.onPop) {
              this.events.onPop(c, r, poppedColor);
            }

            // Any tiles directly above this popped cell become unsupported and chain eligible!
            for (let aboveR = r + 1; aboveR < ROWS; aboveR++) {
              const aboveTile = this.grid[c][aboveR];
              if (aboveTile.color !== -1 && aboveTile.state === TileState.IDLE) {
                aboveTile.chainEligible = true;
                aboveTile.state = TileState.HOVER;
                aboveTile.timer = HOVER_DELAY;
              }
            }
          }
        }
      }
    }
  }

  /**
   * Search for horizontal and vertical matches of 3+ identical colors among IDLE tiles.
   */
  public checkMatches(): void {
    const matchedCoords = new Set<string>();

    // Horizontal check
    for (let r = 0; r < ROWS; r++) {
      let runStart = 0;
      while (runStart < COLS) {
        const startTile = this.grid[runStart][r];
        if (startTile.state !== TileState.IDLE || startTile.color === -1) {
          runStart++;
          continue;
        }

        let runEnd = runStart + 1;
        while (runEnd < COLS) {
          const nextTile = this.grid[runEnd][r];
          if (nextTile.state === TileState.IDLE && nextTile.color === startTile.color) {
            runEnd++;
          } else {
            break;
          }
        }

        const runLength = runEnd - runStart;
        if (runLength >= 3) {
          for (let c = runStart; c < runEnd; c++) {
            matchedCoords.add(`${c},${r}`);
          }
        }
        runStart = runEnd;
      }
    }

    // Vertical check
    for (let c = 0; c < COLS; c++) {
      let runStart = 0;
      while (runStart < ROWS) {
        const startTile = this.grid[c][runStart];
        if (startTile.state !== TileState.IDLE || startTile.color === -1) {
          runStart++;
          continue;
        }

        let runEnd = runStart + 1;
        while (runEnd < ROWS) {
          const nextTile = this.grid[c][runEnd];
          if (nextTile.state === TileState.IDLE && nextTile.color === startTile.color) {
            runEnd++;
          } else {
            break;
          }
        }

        const runLength = runEnd - runStart;
        if (runLength >= 3) {
          for (let r = runStart; r < runEnd; r++) {
            matchedCoords.add(`${c},${r}`);
          }
        }
        runStart = runEnd;
      }
    }

    if (matchedCoords.size === 0) return;

    // Evaluate Chain & Combo
    let isChainMatch = false;
    const matchedTilesList: { col: number; row: number; color: number }[] = [];

    // Sort matched tiles left-to-right, bottom-to-top for sequential pop delay
    const sortedCoords = Array.from(matchedCoords)
      .map((str) => {
        const [c, r] = str.split(',').map(Number);
        return { col: c, row: r };
      })
      .sort((a, b) => a.row !== b.row ? a.row - b.row : a.col - b.col);

    for (const pos of sortedCoords) {
      const tile = this.grid[pos.col][pos.row];
      if (tile.chainEligible) {
        isChainMatch = true;
      }
      matchedTilesList.push({ col: pos.col, row: pos.row, color: tile.color });
    }

    if (isChainMatch) {
      this.chainMultiplier++;
      this.isChainActive = true;
      if (this.events.onChain) {
        this.events.onChain(this.chainMultiplier);
      }
    }

    const matchGroup: MatchGroup = {
      tiles: matchedTilesList,
      isChain: isChainMatch,
      chainLevel: this.chainMultiplier,
      comboSize: matchedTilesList.length
    };

    if (this.events.onMatch) {
      this.events.onMatch(matchGroup);
    }

    // Flag tiles directly above the match as chain-eligible
    for (const pos of sortedCoords) {
      for (let aboveR = pos.row + 1; aboveR < ROWS; aboveR++) {
        const aboveTile = this.grid[pos.col][aboveR];
        if (aboveTile.color !== -1) {
          aboveTile.chainEligible = true;
        }
      }
    }

    // Set tiles to MATCH_FLASH and assign pop sequence delays
    sortedCoords.forEach((pos, idx) => {
      const tile = this.grid[pos.col][pos.row];
      tile.state = TileState.MATCH_FLASH;
      tile.timer = MATCH_FLASH_DURATION;
      tile.popDelay = idx * 40; // 40ms stagger between sequential pops
      tile.popIndex = idx;
    });

    // Clear chainEligible for resting IDLE tiles that have fully settled on solid ground and did not match
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const tile = this.grid[c][r];
        if (tile.state === TileState.IDLE && !matchedCoords.has(`${c},${r}`)) {
          if (!this.hasClearingBelow(c, r)) {
            tile.chainEligible = false;
          }
        }
      }
    }
  }

  private hasClearingBelow(col: number, row: number): boolean {
    for (let r = 0; r < row; r++) {
      const tile = this.grid[col][r];
      if (
        tile.state === TileState.MATCH_FLASH ||
        tile.state === TileState.POP ||
        tile.state === TileState.EMPTY ||
        tile.state === TileState.HOVER ||
        tile.state === TileState.FALLING
      ) {
        return true;
      }
    }
    return false;
  }

  private updateChainState(): void {
    // If no tiles are clearing, popping, or hovering/falling while chain-eligible, reset chain
    let hasActiveCascade = false;

    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const tile = this.grid[c][r];
        if (
          tile.state === TileState.MATCH_FLASH ||
          tile.state === TileState.POP ||
          ((tile.state === TileState.HOVER || tile.state === TileState.FALLING) && tile.chainEligible)
        ) {
          hasActiveCascade = true;
          break;
        }
      }
      if (hasActiveCascade) break;
    }

    if (!hasActiveCascade && this.isChainActive) {
      this.isChainActive = false;
      this.chainMultiplier = 1;
    }
  }

  /**
   * Manual stack raise: pushes a new row into row 0 from below.
   * Shifts all existing rows upward.
   * If any non-empty tile is pushed above row 11, triggers top-out!
   */
  public raiseStack(newRowColors: number[]): boolean {
    if (this.isTopOut) return false;

    // Check top ceiling row (row 11) for top-out
    for (let c = 0; c < COLS; c++) {
      if (this.grid[c][ROWS - 1].color !== -1) {
        this.isTopOut = true;
        if (this.events.onTopOut) {
          this.events.onTopOut();
        }
        return false;
      }
    }

    // Shift all rows up by 1
    for (let c = 0; c < COLS; c++) {
      for (let r = ROWS - 1; r >= 1; r--) {
        this.grid[c][r] = this.grid[c][r - 1];
      }
      // Insert new row at row 0
      this.grid[c][0] = {
        state: TileState.IDLE,
        color: newRowColors[c],
        chainEligible: false,
        timer: 0,
        popDelay: 0
      };
    }

    // Adjust any in-flight input buffer rows
    for (const cmd of this.inputBuffer) {
      cmd.row = Math.min(ROWS - 1, cmd.row + 1);
    }

    this.checkMatches();
    return true;
  }
}
