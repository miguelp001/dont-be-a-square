import { Server } from 'socket.io';
import { createServer } from 'http';

const httpServer = createServer();
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
}

const rooms = new Map<string, Room>();

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  // Create a room (private or public for quick match)
  socket.on('create_room', (data: { characterId?: string; isPublic?: boolean } = {}) => {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const characterId = data.characterId || 'kiri';

    const room: Room = {
      id: roomId,
      players: [{ socketId: socket.id, characterId }],
      isPublic: data.isPublic ?? true,
      seed: Math.floor(Math.random() * 1000000)
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
    const roomId = (data.roomId || '').toUpperCase().trim();
    const room = rooms.get(roomId);
    const characterId = data.characterId || 'mizu';

    if (room && room.players.length < 2) {
      room.players.push({ socketId: socket.id, characterId });
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
    const characterId = data.characterId || 'kiri';

    // Search for waiting public room
    let availableRoom: Room | null = null;
    for (const r of rooms.values()) {
      if (r.isPublic && r.players.length === 1) {
        availableRoom = r;
        break;
      }
    }

    if (availableRoom) {
      availableRoom.players.push({ socketId: socket.id, characterId });
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
      const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      const room: Room = {
        id: roomId,
        players: [{ socketId: socket.id, characterId }],
        isPublic: true,
        seed: Math.floor(Math.random() * 1000000)
      };
      rooms.set(roomId, room);
      socket.join(roomId);
      socket.emit('room_created', { roomId, player: { characterId } });
      console.log(`Quick match waiting in room ${roomId}`);
    }
  });

  // Forward game actions (attacks, topouts, cursor updates) to the other player in the room
  socket.on('game_action', (data: { roomId?: string; type: string; payload?: any }) => {
    let roomId = data.roomId;
    if (!roomId) {
      roomId = Array.from(socket.rooms).find((r) => r !== socket.id);
    }
    if (roomId) {
      socket.to(roomId).emit('opponent_action', data);
    }
  });

  socket.on('leave_room', (data: { roomId?: string } = {}) => {
    for (const [roomId, room] of rooms.entries()) {
      if (data.roomId && roomId !== data.roomId) continue;
      const idx = room.players.findIndex((p) => p.socketId === socket.id);
      if (idx !== -1) {
        room.players.splice(idx, 1);
        socket.leave(roomId);
        socket.to(roomId).emit('opponent_disconnected', { message: 'Opponent left the room.' });
        if (room.players.length === 0) {
          rooms.delete(roomId);
        }
        console.log(`Player ${socket.id} left room ${roomId}`);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    for (const [roomId, room] of rooms.entries()) {
      const idx = room.players.findIndex((p) => p.socketId === socket.id);
      if (idx !== -1) {
        room.players.splice(idx, 1);
        socket.to(roomId).emit('opponent_disconnected', { message: 'Opponent disconnected!' });
        if (room.players.length === 0) {
          rooms.delete(roomId);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Panel de Pon WebSocket server running on port ${PORT}`);
});
