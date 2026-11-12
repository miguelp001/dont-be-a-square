import SocketManager from '../net/SocketManager';
import { GameDifficulty } from './Difficulty';

export interface LeaderboardRow {
  rank: number;
  id: string;
  playerId: string;
  displayName: string;
  characterId: string;
  mode: 'endless' | 'challenge';
  difficulty: string;
  score: number;
  maxChain: number;
  submittedAt: string;
}

export interface LeaderboardData {
  mode: string;
  difficulty: string;
  top: LeaderboardRow[];
  playerRank?: {
    rank: number;
    entry: LeaderboardRow;
  };
  totalCount: number;
}

const STORAGE_KEYS = {
  PLAYER_ID: 'dbas_lb_player_id',
  PLAYER_SECRET: 'dbas_lb_player_secret',
  DISPLAY_NAME: 'dbas_lb_player_name'
};

export class LeaderboardClient {
  private static cachedPlayerId: string | null = null;
  private static cachedPlayerSecret: string | null = null;
  private static cachedDisplayName: string | null = null;

  public static getPlayerId(): string {
    if (this.cachedPlayerId) return this.cachedPlayerId;
    try {
      if (typeof localStorage !== 'undefined') {
        let id = localStorage.getItem(STORAGE_KEYS.PLAYER_ID);
        if (!id) {
          id = `usr_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
          localStorage.setItem(STORAGE_KEYS.PLAYER_ID, id);
        }
        this.cachedPlayerId = id;
        return id;
      }
    } catch (e) {
      console.warn('localStorage error:', e);
    }
    return 'usr_guest';
  }

  public static getPlayerSecret(): string {
    if (this.cachedPlayerSecret) return this.cachedPlayerSecret;
    try {
      if (typeof localStorage !== 'undefined') {
        let secret = localStorage.getItem(STORAGE_KEYS.PLAYER_SECRET);
        if (!secret) {
          secret = `sec_${Math.random().toString(36).substring(2, 12)}_${Math.random().toString(36).substring(2, 12)}`;
          localStorage.setItem(STORAGE_KEYS.PLAYER_SECRET, secret);
        }
        this.cachedPlayerSecret = secret;
        return secret;
      }
    } catch (e) {
      console.warn('localStorage error:', e);
    }
    return 'sec_guest';
  }

  public static getDisplayName(): string {
    if (this.cachedDisplayName) return this.cachedDisplayName;
    try {
      if (typeof localStorage !== 'undefined') {
        const name = localStorage.getItem(STORAGE_KEYS.DISPLAY_NAME);
        if (name) {
          this.cachedDisplayName = name;
          return name;
        }
      }
    } catch (e) {
      console.warn('localStorage error:', e);
    }
    return 'PLAYER';
  }

  public static setDisplayName(name: string): string {
    const cleaned = (name || 'PLAYER').toUpperCase().replace(/[^A-Z0-9_\-]/g, '').trim().slice(0, 10);
    const finalName = cleaned.length >= 2 ? cleaned : 'PLAYER';
    this.cachedDisplayName = finalName;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.DISPLAY_NAME, finalName);
      }
    } catch (e) {
      console.warn('localStorage error:', e);
    }
    return finalName;
  }

  public static async updateDisplayName(
    newName: string
  ): Promise<{ success: boolean; displayName: string; error?: string }> {
    const finalName = this.setDisplayName(newName);
    const playerId = this.getPlayerId();
    const playerSecret = this.getPlayerSecret();

    const payload = {
      playerId,
      playerSecret,
      displayName: finalName
    };

    // 1. Try Socket.IO first
    try {
      const socketMgr = SocketManager.getInstance();
      const res = await socketMgr.updatePlayerName(payload);
      if (res && res.success) {
        return { success: true, displayName: res.displayName || finalName };
      }
    } catch (e) {
      console.warn('Socket updatePlayerName failed, falling back to HTTP:', e);
    }

    // 2. HTTP Fallback
    try {
      const response = await fetch('/api/leaderboard/name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        const res = await response.json();
        return { success: true, displayName: res.displayName || finalName };
      }
    } catch (err) {
      console.warn('HTTP updatePlayerName failed:', err);
    }

    // Persisted locally even if network/offline
    return { success: true, displayName: finalName };
  }

  public static async fetchLeaderboard(
    mode: 'endless' | 'challenge',
    difficulty: GameDifficulty | string,
    limit: number = 20
  ): Promise<LeaderboardData | null> {
    const playerId = this.getPlayerId();
    const cleanDiff = difficulty.toLowerCase();

    // 1. Try Socket.IO first
    try {
      const socketMgr = SocketManager.getInstance();
      const res = await socketMgr.getLeaderboard({
        mode,
        difficulty: cleanDiff,
        playerId,
        limit
      });
      if (res && Array.isArray(res.top)) {
        return res as LeaderboardData;
      }
    } catch (e) {
      console.warn('Socket leaderboard fetch failed, falling back to HTTP:', e);
    }

    // 2. HTTP Fallback
    try {
      const url = `/api/leaderboard?mode=${mode}&difficulty=${cleanDiff}&playerId=${playerId}&limit=${limit}`;
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (response.ok) {
        return (await response.json()) as LeaderboardData;
      }
    } catch (err) {
      console.warn('HTTP leaderboard fetch failed:', err);
    }

    return null;
  }

  public static async submitScore(
    mode: 'endless' | 'challenge',
    difficulty: GameDifficulty | string,
    characterId: string,
    score: number,
    maxChain: number = 1,
    nameOverride?: string
  ): Promise<{ success: boolean; isNewBest?: boolean; rank?: number; error?: string }> {
    const playerId = this.getPlayerId();
    const playerSecret = this.getPlayerSecret();
    const displayName = nameOverride ? this.setDisplayName(nameOverride) : this.getDisplayName();
    const cleanDiff = difficulty.toLowerCase();

    const payload = {
      playerId,
      playerSecret,
      displayName,
      characterId,
      mode,
      difficulty: cleanDiff,
      score,
      maxChain
    };

    // 1. Try Socket.IO
    try {
      const socketMgr = SocketManager.getInstance();
      const res = await socketMgr.submitLeaderboardScore(payload);
      if (res && res.success) {
        return res;
      }
    } catch (e) {
      console.warn('Socket submit score failed, falling back to HTTP:', e);
    }

    // 2. HTTP Fallback
    try {
      const response = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.warn('HTTP score submission failed:', err);
    }

    return { success: false, error: 'Offline / Could not connect to score server' };
  }
}
