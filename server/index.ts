import { Server } from 'socket.io';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { LeaderboardManager, SubmitScorePayload } from './leaderboard';
import { TelemetryManager } from './telemetry';

const leaderboard = new LeaderboardManager();
const telemetry = new TelemetryManager();

const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  let url: URL;
  try {
    url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Malformed request URL or Host header' }));
    return;
  }

  if (url.pathname === '/api/leaderboard/name' || (url.pathname === '/api/leaderboard' && (req.method === 'PUT' || req.method === 'PATCH'))) {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 50000) req.destroy();
    });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body) as { playerId: string; playerSecret: string; displayName: string };
        const result = leaderboard.updatePlayerName(payload.playerId, payload.playerSecret, payload.displayName);
        res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Malformed JSON payload' }));
      }
    });
    return;
  }

  if (url.pathname === '/api/leaderboard') {
    if (req.method === 'GET') {
      const mode = url.searchParams.get('mode') || 'endless';
      const difficulty = url.searchParams.get('difficulty') || 'adept';
      const playerId = url.searchParams.get('playerId') || undefined;
      const limit = Number(url.searchParams.get('limit')) || 20;

      const data = leaderboard.getLeaderboard(mode, difficulty, playerId, limit);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 50000) req.destroy();
      });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body) as SubmitScorePayload;
          const result = leaderboard.submitScore(payload);
          res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Malformed JSON payload' }));
        }
      });
      return;
    }
  }

  if (url.pathname === '/api/telemetry') {
    if (req.method === 'GET') {
      const summary = telemetry.getSummary();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(summary));
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 50000) req.destroy();
      });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          const success = telemetry.recordMatch(payload);
          res.writeHead(success ? 200 : 400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Malformed JSON payload' }));
        }
      });
      return;
    }
  }

  // Default healthcheck
  if (url.pathname === '/health' || url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'Panel de Pon Server' }));
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

interface Player {
  socketId: string;
  characterId: string;
}

interface Room {
  id: string;
  players: Player[];
  isPublic: boolean;
  seed: number;
  rematchVotes?: Set<string>;
  state?: 'waiting' | 'in_game';
}

const rooms = new Map<string, Room>();

function generateUniqueRoomId(): string {
  let roomId = '';
  let attempts = 0;
  do {
    roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    attempts++;
  } while ((rooms.has(roomId) || roomId.length !== 6) && attempts < 100);
  return roomId;
}

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  // Create a room (private or public for quick match)
  socket.on('create_room', (data: { characterId?: string; isPublic?: boolean } = {}) => {
    const safeData = data && typeof data === 'object' ? data : {};
    const roomId = generateUniqueRoomId();
    const characterId = typeof safeData.characterId === 'string' && safeData.characterId ? safeData.characterId : 'kiri';

    const room: Room = {
      id: roomId,
      players: [{ socketId: socket.id, characterId }],
      isPublic: safeData.isPublic ?? false,
      seed: Math.floor(Math.random() * 1000000),
      rematchVotes: new Set<string>(),
      state: 'waiting'
    };

    rooms.set(roomId, room);
    socket.join(roomId);

    socket.emit('room_created', {
      roomId,
      player: { characterId }
    });
    console.log(`Room created: ${roomId} by ${characterId}`);
  });

  // Join a specific room by 6-letter code
  socket.on('join_room', (data: { roomId: string; characterId?: string }) => {
    if (!data || typeof data !== 'object') {
      socket.emit('room_error', { message: 'Invalid room data provided.' });
      return;
    }
    const roomId = (typeof data.roomId === 'string' ? data.roomId : '').toUpperCase().trim();
    const room = rooms.get(roomId);
    const characterId = typeof data.characterId === 'string' && data.characterId ? data.characterId : 'mizu';

    if (
      room &&
      room.players.length < 2 &&
      room.state !== 'in_game' &&
      !room.players.some((p) => p.socketId === socket.id)
    ) {
      room.players.push({ socketId: socket.id, characterId });
      room.state = 'in_game';
      socket.join(roomId);

      socket.emit('room_joined', { roomId, characterId });

      // Both players present: start game!
      io.to(roomId).emit('game_start', {
        roomId,
        seed: room.seed,
        player1: room.players[0],
        player2: room.players[1]
      });
      console.log(`Game started in room ${roomId}: ${room.players[0].characterId} vs ${room.players[1].characterId}`);
    } else {
      socket.emit('room_error', { message: 'Room not found or already full!' });
    }
  });

  // Quick match: find any open public room with 1 player, or create one
  socket.on('quick_match', (data: { characterId?: string } = {}) => {
    const safeData = data && typeof data === 'object' ? data : {};
    const characterId = typeof safeData.characterId === 'string' && safeData.characterId ? safeData.characterId : 'kiri';

    // Search for waiting public room
    let availableRoom: Room | null = null;
    for (const r of rooms.values()) {
      if (
        r.isPublic &&
        r.players.length === 1 &&
        r.state !== 'in_game' &&
        !r.players.some((p) => p.socketId === socket.id)
      ) {
        availableRoom = r;
        break;
      }
    }

    if (availableRoom) {
      availableRoom.players.push({ socketId: socket.id, characterId });
      availableRoom.state = 'in_game';
      socket.join(availableRoom.id);
      socket.emit('room_joined', { roomId: availableRoom.id, characterId });

      io.to(availableRoom.id).emit('game_start', {
        roomId: availableRoom.id,
        seed: availableRoom.seed,
        player1: availableRoom.players[0],
        player2: availableRoom.players[1]
      });
      console.log(`Quick match paired room ${availableRoom.id}`);
    } else {
      // Create new waiting room
      const roomId = generateUniqueRoomId();
      const room: Room = {
        id: roomId,
        players: [{ socketId: socket.id, characterId }],
        isPublic: true,
        seed: Math.floor(Math.random() * 1000000),
        rematchVotes: new Set<string>(),
        state: 'waiting'
      };
      rooms.set(roomId, room);
      socket.join(roomId);
      socket.emit('room_created', { roomId, player: { characterId } });
      console.log(`Quick match waiting in room ${roomId}`);
    }
  });

  // Rematch / Play Again Handler
  socket.on('rematch_request', (data: { roomId?: string } = {}) => {
    const safeData = data && typeof data === 'object' ? data : {};
    let roomId = typeof safeData.roomId === 'string' ? safeData.roomId : undefined;
    if (!roomId) {
      roomId = Array.from(socket.rooms).find((r) => r !== socket.id);
    }
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('room_error', { message: 'Room no longer exists.' });
      return;
    }

    // Verify sender is actually a player in this room
    if (!room.players.some((p) => p.socketId === socket.id)) {
      socket.emit('room_error', { message: 'Unauthorized: you are not a player in this room.' });
      return;
    }

    if (!room.rematchVotes) {
      room.rematchVotes = new Set<string>();
    }
    room.rematchVotes.add(socket.id);
    console.log(`Player ${socket.id} requested rematch in room ${roomId} (${room.rematchVotes.size}/${room.players.length})`);

    // Notify opponent that this player voted to play again
    socket.to(roomId).emit('opponent_rematch_requested', {
      message: 'Opponent wants to play again!'
    });

    // If both players have voted to play again, restart the match!
    if (room.rematchVotes.size >= 2 && room.players.length >= 2) {
      room.rematchVotes.clear();
      room.seed = Math.floor(Math.random() * 1000000);

      io.to(roomId).emit('game_restart', {
        roomId,
        seed: room.seed,
        player1: room.players[0],
        player2: room.players[1]
      });
      console.log(`Rematch started in room ${roomId}: ${room.players[0].characterId} vs ${room.players[1].characterId}`);
    }
  });

  // Forward game actions (attacks, topouts, cursor updates, stack lift) to the other player in the room
  socket.on('game_action', (data: { roomId?: string; type: string; payload?: any }) => {
    if (!data || typeof data !== 'object') return;
    let roomId = typeof data.roomId === 'string' ? data.roomId : undefined;
    if (!roomId) {
      roomId = Array.from(socket.rooms).find((r) => r !== socket.id);
    }
    if (!roomId) return;

    // Validate that sender is an actual member of this room
    if (!socket.rooms.has(roomId)) return;
    const room = rooms.get(roomId);
    if (!room || !room.players.some((p) => p.socketId === socket.id)) return;

    // Whitelist allowable game action types (including stack lift)
    const allowedTypes = ['cursor', 'swap', 'lift', 'attack', 'board_sync', 'super_power_activated', 'topOut'];
    if (typeof data.type !== 'string' || !allowedTypes.includes(data.type)) return;

    socket.to(roomId).emit('opponent_action', data);
  });

  socket.on('leave_room', (data: { roomId?: string } = {}) => {
    const targetRoomId = data && typeof data === 'object' && typeof data.roomId === 'string' ? data.roomId : undefined;
    for (const [roomId, room] of rooms.entries()) {
      if (targetRoomId && roomId !== targetRoomId) continue;
      const idx = room.players.findIndex((p) => p.socketId === socket.id);
      if (idx !== -1) {
        room.players.splice(idx, 1);
        if (room.state === 'in_game') {
          room.state = 'finished' as any;
        } else {
          room.state = 'waiting';
        }
        room.rematchVotes?.delete(socket.id);
        socket.leave(roomId);
        socket.to(roomId).emit('opponent_disconnected', { message: 'Opponent left the room.' });
        if (room.players.length === 0) {
          rooms.delete(roomId);
        }
        console.log(`Player ${socket.id} left room ${roomId}`);
      }
    }
  });

  // Leaderboard Socket.IO Events
  socket.on(
    'get_leaderboard',
    (
      data: { mode?: string; difficulty?: string; playerId?: string; limit?: number } = {},
      callback?: (res: any) => void
    ) => {
      try {
        const mode = data?.mode || 'endless';
        const difficulty = data?.difficulty || 'adept';
        const playerId = data?.playerId;
        const limit = Number(data?.limit) || 20;

        const result = leaderboard.getLeaderboard(mode, difficulty, playerId, limit);
        if (typeof callback === 'function') {
          callback(result);
        } else {
          socket.emit('leaderboard_data', result);
        }
      } catch (err) {
        console.error('Error fetching leaderboard:', err);
        const fallback = { entries: [], totalCount: 0 };
        if (typeof callback === 'function') callback(fallback);
        else socket.emit('leaderboard_data', fallback);
      }
    }
  );

  socket.on('submit_score', (data: SubmitScorePayload, callback?: (res: any) => void) => {
    try {
      const result = leaderboard.submitScore(data);
      if (typeof callback === 'function') {
        callback(result);
      } else {
        socket.emit('score_submitted', result);
      }
    } catch (err) {
      console.error('Error submitting score:', err);
      const fallback = { success: false, error: 'Internal server error', isNewBest: false, rank: -1 };
      if (typeof callback === 'function') callback(fallback);
      else socket.emit('score_submitted', fallback);
    }
  });

  socket.on('update_player_name', (data: { playerId: string; playerSecret: string; displayName: string }, callback?: (res: any) => void) => {
    try {
      const result = leaderboard.updatePlayerName(data?.playerId, data?.playerSecret, data?.displayName);
      if (typeof callback === 'function') {
        callback(result);
      } else {
        socket.emit('player_name_updated', result);
      }
    } catch (err) {
      console.error('Error updating player name:', err);
      const fallback = { success: false, error: 'Internal server error' };
      if (typeof callback === 'function') callback(fallback);
      else socket.emit('player_name_updated', fallback);
    }
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    for (const [roomId, room] of rooms.entries()) {
      const idx = room.players.findIndex((p) => p.socketId === socket.id);
      if (idx !== -1) {
        room.players.splice(idx, 1);
        if (room.state === 'in_game') {
          room.state = 'finished' as any;
        } else {
          room.state = 'waiting';
        }
        room.rematchVotes?.delete(socket.id);
        socket.to(roomId).emit('opponent_disconnected', { message: 'Opponent disconnected!' });
        if (room.players.length === 0) {
          rooms.delete(roomId);
        }
      }
    }
  });
});

// Graceful process shutdown
const handleShutdown = () => {
  console.log('Flushing pending leaderboard and telemetry saves to disk...');
  leaderboard.flushPendingSave();
  telemetry.flushPendingSave();
  process.exit(0);
};

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Panel de Pon WebSocket server running on port ${PORT}`);
});
