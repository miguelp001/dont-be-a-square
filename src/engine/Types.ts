export enum TileState {
  EMPTY = 'EMPTY',
  IDLE = 'IDLE',
  SWAPPING = 'SWAPPING',
  HOVER = 'HOVER',
  FALLING = 'FALLING',
  MATCH_FLASH = 'MATCH_FLASH',
  POP = 'POP'
}

export interface Tile {
  state: TileState;
  color: number; // 0..5 or -1 for EMPTY
  chainEligible: boolean;
  timer: number; // state countdown timer in ms
  swapTargetCol?: number; // target column during swap
  popDelay: number; // pop sequence delay in ms
  popIndex?: number;
}

export interface SwapCommand {
  col: number;
  row: number;
  ttl: number; // remaining time-to-live in input buffer (ms)
}

export interface MatchGroup {
  tiles: { col: number; row: number; color: number }[];
  isChain: boolean;
  chainLevel: number;
  comboSize: number;
}

export interface EngineEvents {
  onSwap?: (c1: number, r1: number, c2: number, r2: number) => void;
  onMatch?: (group: MatchGroup) => void;
  onChain?: (chainLevel: number) => void;
  onPop?: (col: number, row: number, color: number) => void;
  onTopOut?: () => void;
}
