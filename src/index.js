const path = require('path');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const Filter = require('bad-words');
const {generateMessage, generateLocationMessage} = require('./utils/messages');
const {addUser, removeUser, getUser, getUsersInRoom} = require('./utils/users');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const port = process.env.PORT || 3000;
const publicDirectoryPath = path.join(__dirname, '../public');

app.use(express.static(publicDirectoryPath));

io.on('connection', (socket) => {
    console.log("New websocket connection");

    socket.on('join', ({username, room}, callback) => {
        const {error, user} = addUser({id : socket.id, username, room});

        if(error) {
            return callback(error);
        }

        socket.join(room);

        socket.emit('message', generateMessage('Admin', 'Welcome'));

        // sends msg to all clients except the current client in specific room 
        socket.broadcast.to(user.room).emit('message', generateMessage('Admin',`${user.username} has joined.`));
        io.to(user.room).emit('roomData', {
            room : user.room,
            users : getUsersInRoom(user.room)
        });
        callback();
        // sends msg to current client
        // socket.emit('message', generateMessage('Welcome'));

        // sends msg to all clients except the current client
        // socket.broadcast.emit('message', generateMessage('A new user has joined.'));
    })

    socket.on('sendMessage', (msg, callback) => {
        const user = getUser(socket.id);

        const filter = new Filter();
        if(filter.isProfane(msg)) {
            return callback('Profanity not allowed!');
        }

        // sends msg to only specific room
        io.to(user.room).emit('message', generateMessage(user.username, msg));
        callback();
    })

    socket.on('disconnect', () => {
        const user = removeUser(socket.id);
        if(user) {
            io.to(user.room).emit('message', generateMessage('Admin', `${user.username} has left!`));

            io.to(user.room).emit('roomData', {
                room : user.room,
                users : getUsersInRoom(user.room)
            });
        }
    })

    socket.on('sendLocation', (coords, callback) => {
        const user = getUser(socket.id);
        const msg = `https://google.com/maps?q=${coords.latitude},${coords.longitude}`;
        io.to(user.room).emit('locationMessage', generateLocationMessage(user.username, msg))
        // io.emit('locationMessage', generateLocationMessage(msg))
        callback();
    })
});

server.listen(port, () => {
    console.log('Server is up on port ' + port);
});