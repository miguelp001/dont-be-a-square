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
    const envUrl = typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SERVER_URL;
    const isLocal =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.startsWith('192.168.') ||
        window.location.hostname.startsWith('10.'));

    const options = {
      autoConnect: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 5000,
      transports: ['websocket', 'polling']
    };

    const targetUrl =
      envUrl || (isLocal && window.location.port !== '3001' ? `http://${window.location.hostname}:3001` : undefined);
    this.socket = targetUrl ? io(targetUrl, options) : io(options);

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

  public removeGameListeners(): void {
    this.socket.off('opponent_action');
    this.socket.off('opponent_rematch_requested');
    this.socket.off('game_restart');
    this.socket.off('opponent_disconnected');
  }

  public removeLobbyListeners(): void {
    this.socket.off('room_created');
    this.socket.off('room_joined');
    this.socket.off('game_start');
    this.socket.off('room_error');
  }

  public removeAllListeners(): void {
    this.removeGameListeners();
    this.removeLobbyListeners();
  }

  private ensureConnection(): Promise<boolean> {
    if (this.socket.connected) return Promise.resolve(true);
    return new Promise((resolve) => {
      this.socket.connect();
      const onConnect = () => {
        cleanup();
        resolve(true);
      };
      const onError = () => {
        cleanup();
        resolve(false);
      };
      const timer = setTimeout(() => {
        cleanup();
        resolve(false);
      }, 2000);
      const cleanup = () => {
        clearTimeout(timer);
        this.socket.off('connect', onConnect);
        this.socket.off('connect_error', onError);
      };
      this.socket.once('connect', onConnect);
      this.socket.once('connect_error', onError);
    });
  }

  public async getLeaderboard(data: { mode: string; difficulty: string; playerId?: string; limit?: number }): Promise<any> {
    const connected = await this.ensureConnection();
    if (!connected && !this.socket.connected) return null;
    return new Promise((resolve) => {
      this.socket.timeout(3000).emit('get_leaderboard', data, (err: any, response: any) => {
        if (err) {
          resolve(null);
        } else {
          resolve(response);
        }
      });
    });
  }

  public async submitLeaderboardScore(data: any): Promise<any> {
    const connected = await this.ensureConnection();
    if (!connected && !this.socket.connected) return { success: false, error: 'Network unavailable' };
    return new Promise((resolve) => {
      this.socket.timeout(3000).emit('submit_score', data, (err: any, response: any) => {
        if (err) {
          resolve({ success: false, error: 'Network timeout' });
        } else {
          resolve(response);
        }
      });
    });
  }

  public async updatePlayerName(data: { playerId: string; playerSecret: string; displayName: string }): Promise<any> {
    const connected = await this.ensureConnection();
    if (!connected && !this.socket.connected) return { success: false, error: 'Network unavailable' };
    return new Promise((resolve) => {
      this.socket.timeout(3000).emit('update_player_name', data, (err: any, response: any) => {
        if (err) {
          resolve({ success: false, error: 'Network timeout' });
        } else {
          resolve(response);
        }
      });
    });
  }
}
