export interface MatchTelemetryPayload {
  mode: string;
  difficulty?: string;
  characterId: string;
  opponentCharacterId?: string;
  isVictory?: boolean;
  score?: number;
  maxChain?: number;
  matchDurationSeconds?: number;
  panelsCleared?: number;
  garbageCleared?: number;
  swaps?: number;
  fastLifts?: number;
  combos4?: number;
  combos5?: number;
  combos6Plus?: number;
  chains2?: number;
  chains3?: number;
  chains4?: number;
  chains5Plus?: number;
  powerActivations?: Record<string, number>;
  inputDevice?: 'keyboard' | 'touch' | 'gamepad';
}

export interface CharacterBalanceSummary {
  id: string;
  picks: number;
  wins: number;
  losses: number;
  winRate: number;
  pickRate: number;
  powerActivations: number;
  powerPerMatch: number;
  totalScore: number;
  avgScore: number;
  maxChain: number;
}

export interface TelemetrySummaryResponse {
  totalMatches: number;
  totalPlayTimeSeconds: number;
  totalPanelsCleared: number;
  totalGarbageCleared: number;
  totalSwaps: number;
  totalFastLifts: number;
  totalPowersActivated: number;
  characters: Record<string, CharacterBalanceSummary>;
  modes: Record<string, number>;
  difficulties: Record<string, number>;
  inputDevices: {
    keyboard: number;
    touch: number;
    gamepad: number;
  };
  combos: {
    combos4: number;
    combos5: number;
    combos6Plus: number;
  };
  chains: {
    chains2: number;
    chains3: number;
    chains4: number;
    chains5Plus: number;
  };
  lastUpdated: string;
}

export class TelemetryClient {
  public static async submitMatchTelemetry(payload: MatchTelemetryPayload): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      // Telemetry is non-blocking / best-effort
      return false;
    }
  }

  public static async fetchTelemetrySummary(): Promise<TelemetrySummaryResponse | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch('/api/telemetry', {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      if (response.ok) {
        return (await response.json()) as TelemetrySummaryResponse;
      }
      return null;
    } catch {
      return null;
    }
  }
}
