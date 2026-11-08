import { io, Socket } from 'socket.io-client';

export interface GameStartPayload {
  roomId: string;
  seed: number;
  player1: { socketId: string; characterId: string };
  player2: { socketId: string; characterId: string };
}

export interface GameAction {
  type: 'attack' | 'topOut' | 'score' | 'cursor' | 'swap' | 'lift' | 'board_sync' | string;
  payload?: any;
  roomId?: string;
}

export default class SocketManager {
  private socket: Socket;
  private static instance: SocketManager;

  public get isConnected(): boolean {
    return Boolean(this.socket && this.socket.connected);
  }

  private constructor() {
    const isLocal =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    const options = {
      autoConnect: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 5000,
      transports: ['websocket', 'polling']
    };

    this.socket = isLocal ? io('http://localhost:3001', options) : io(options);

    this.socket.on('connect', () => {
      console.log('Connected to multiplayer server:', this.socket.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from multiplayer server:', reason);
    });

    this.socket.on('connect_error', (err) => {
      console.warn('Multiplayer connection error:', err.message);
    });
  }

  public static getInstance(): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager();
    }
    return SocketManager.instance;
  }

  public getSocketId(): string {
    return this.socket.id || '';
  }

  public quickMatch(characterId: string): void {
    this.socket.emit('quick_match', { characterId });
  }

  public createRoom(characterId: string): void {
    this.socket.emit('create_room', { characterId });
  }

  public joinRoom(roomId: string, characterId: string): void {
    this.socket.emit('join_room', { roomId, characterId });
  }

  public leaveRoom(roomId?: string): void {
    this.socket.emit('leave_room', { roomId });
  }

  public sendAction(action: GameAction): void {
    this.socket.emit('game_action', action);
  }

  public onRoomCreated(callback: (data: { roomId: string }) => void): void {
    this.socket.off('room_created');
    this.socket.on('room_created', callback);
  }

  public onRoomJoined(callback: (data: { roomId: string; characterId: string }) => void): void {
    this.socket.off('room_joined');
    this.socket.on('room_joined', callback);
  }

  public requestRematch(roomId?: string): void {
    this.socket.emit('rematch_request', { roomId });
  }

  public onOpponentRematchRequested(callback: (data: { message: string }) => void): void {
    this.socket.off('opponent_rematch_requested');
    this.socket.on('opponent_rematch_requested', callback);
  }

  public onGameRestart(callback: (data: GameStartPayload) => void): void {
    this.socket.off('game_restart');
    this.socket.on('game_restart', callback);
  }

  public onGameStart(callback: (data: GameStartPayload) => void): void {
    this.socket.off('game_start');
    this.socket.on('game_start', callback);
  }

  public onOpponentAction(callback: (data: GameAction) => void): void {
    this.socket.off('opponent_action');
    this.socket.on('opponent_action', callback);
  }

  public onOpponentDisconnected(callback: (data: { message: string }) => void): void {
    this.socket.off('opponent_disconnected');
    this.socket.on('opponent_disconnected', callback);
  }

  public onRoomError(callback: (data: { message: string }) => void): void {
    this.socket.off('room_error');
    this.socket.on('room_error', callback);
  }

  public getLeaderboard(data: { mode: string; difficulty: string; playerId?: string; limit?: number }): Promise<any> {
    return new Promise((resolve) => {
      if (!this.socket.connected) {
        this.socket.connect();
      }
      this.socket.timeout(4000).emit('get_leaderboard', data, (err: any, response: any) => {
        if (err) {
          resolve(null);
        } else {
          resolve(response);
        }
      });
    });
  }

  public submitLeaderboardScore(data: any): Promise<any> {
    return new Promise((resolve) => {
      if (!this.socket.connected) {
        this.socket.connect();
      }
      this.socket.timeout(4000).emit('submit_score', data, (err: any, response: any) => {
        if (err) {
          resolve({ success: false, error: 'Network timeout' });
        } else {
          resolve(response);
        }
      });
    });
  }

  // --- Battle Royale (30-Player FFA) Methods ---

  public joinBRQueue(characterId: string, displayName: string): void {
    this.socket.emit('join_br_queue', { characterId, displayName });
  }

  public leaveBRQueue(): void {
    this.socket.emit('leave_br_queue');
  }

  public sendBRTelemetry(roomId: string, stackHeight: number, isDanger: boolean): void {
    this.socket.emit('br_telemetry', { roomId, stackHeight, isDanger });
  }

  public setBRTarget(roomId: string, targetMode: 'random' | 'attackers' | 'kos' | 'badges' | 'manual', manualTargetId?: string): void {
    this.socket.emit('br_set_target', { roomId, targetMode, manualTargetId });
  }

  public sendBRGarbage(roomId: string, lines: number, targetMode?: any, manualTargetId?: string): void {
    this.socket.emit('br_send_garbage', { roomId, lines, targetMode, manualTargetId });
  }

  public sendBRTopout(roomId: string): void {
    this.socket.emit('br_topout', { roomId });
  }

  public onBRQueueJoined(callback: (data: { roomId: string; playerId: string; playersCount: number; countdown: number }) => void): void {
    this.socket.off('br_queue_joined');
    this.socket.on('br_queue_joined', callback);
  }

  public onBRQueueUpdate(callback: (data: { roomId: string; playersCount: number; countdown: number; players: any[] }) => void): void {
    this.socket.off('br_queue_update');
    this.socket.on('br_queue_update', callback);
  }

  public onBRQueueLeft(callback: () => void): void {
    this.socket.off('br_queue_left');
    this.socket.on('br_queue_left', callback);
  }

  public onBRMatchStart(callback: (data: { roomId: string; seed: number; totalPlayers: number; competitors: any[] }) => void): void {
    this.socket.off('br_match_start');
    this.socket.on('br_match_start', callback);
  }

  public onBRTelemetrySnapshot(callback: (data: { aliveCount: number; phase: 1 | 2 | 3; competitors: any[] }) => void): void {
    this.socket.off('br_telemetry_snapshot');
    this.socket.on('br_telemetry_snapshot', callback);
  }

  public onBRReceiveGarbage(callback: (data: { fromId: string; fromName: string; lines: number }) => void): void {
    this.socket.off('br_receive_garbage');
    this.socket.on('br_receive_garbage', callback);
  }

  public onBRElimination(callback: (data: { victimId: string; victimName: string; killerId: string; killerName: string; rank: number; aliveCount: number }) => void): void {
    this.socket.off('br_elimination');
    this.socket.on('br_elimination', callback);
  }

  public onBRPersonalElimination(callback: (data: { placement: number; killerName: string; kosCount: number; badges: number }) => void): void {
    this.socket.off('br_personal_elimination');
    this.socket.on('br_personal_elimination', callback);
  }

  public onBRPhaseEscalate(callback: (data: { phase: 1 | 2 | 3; aliveCount: number }) => void): void {
    this.socket.off('br_phase_escalate');
    this.socket.on('br_phase_escalate', callback);
  }

  public onBRMatchVictory(callback: (data: { winnerId: string; winnerName: string; characterId: string; badges: number; kosCount: number }) => void): void {
    this.socket.off('br_match_victory');
    this.socket.on('br_match_victory', callback);
  }

  public cleanBRListeners(): void {
    this.socket.off('br_queue_joined');
    this.socket.off('br_queue_update');
    this.socket.off('br_queue_left');
    this.socket.off('br_match_start');
    this.socket.off('br_telemetry_snapshot');
    this.socket.off('br_receive_garbage');
    this.socket.off('br_elimination');
    this.socket.off('br_personal_elimination');
    this.socket.off('br_phase_escalate');
    this.socket.off('br_match_victory');
  }
}
