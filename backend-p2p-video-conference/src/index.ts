import * as http from 'http';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
    cors: {
        origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
    }
});

app.use(cors());

app.get('/randomRoomId', (req, res) => {
    const roomId = uuidv4();
    res.json({ roomId });
})

io.on("connection", (socket) => {
    console.log(`user ${socket.id} connected`);

    function log(...arg: any[]) {
        const array = ['Server:', arg];
        socket.emit('log', array);
    }

    socket.on('message', (message, toId = null, roomId = null) => {
        log('Client ' + socket.id + ' said: ', message);

        if (toId) {
            console.log('From ', socket.id, ' to ', toId, message.type);
            socket.to(toId).emit('message', message, socket.id);
        } else if (roomId) {
            console.log('From ', socket.id, ' to roomId: ', roomId, message.type);
            socket.broadcast.to(roomId).emit('message', message, socket.id);
        } else {
            console.log('From ', socket.id, ' to everyone ', message.type);
            socket.broadcast.emit('message', message, socket.id);
        }
    });

    socket.on('joinRoom', (roomId) => {
        // Get number of clients in the room
        const clientsInRoom = io.sockets.adapter.rooms.get(roomId);
        let numClients = clientsInRoom ? clientsInRoom.size : 0;

        if (numClients === 0) {
            // Create room
            socket.join(roomId);
            socket.emit('roomCreated', roomId, socket.id);
            log(`user ${socket.id} create room ${roomId}`);
        } else {
            // Join room
            socket.join(roomId);
            socket.emit('joined', roomId, socket.id);
            socket.broadcast.to(roomId).emit('join', roomId, socket.id);
            log(`user ${socket.id} join room ${roomId}`);
            // io.sockets.in(roomId).emit('ready', socket.id); // Room is ready for creating connections
        }
    });

    // participant leaves room
    socket.on('leaveRoom', (roomId) => {
        socket.leave(roomId);
        socket.emit('leftRoom', roomId);
        socket.broadcast.to(roomId).emit('message', { type: 'leave' }, socket.id);
    });

    
    //When participant leaves notify other participants
    socket.on('disconnecting', () => {
        socket.rooms.forEach((room) => {
            if (room === socket.id) return;
            socket.broadcast.to(room).emit('message', { type: 'leave' }, socket.id);
        });
    });
})

const port = 5000;
server.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});