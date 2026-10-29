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
}
