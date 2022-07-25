const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const path = require('path');
const nodeGeocoder = require('node-geocoder');
const app = express();
const PORT = process.env.PORT || 4000;


/****************************************/
const checkRouter = require('./routes/check');
const workerRouter = require('./routes/worker');
const storeerRouter = require('./routes/store');
const ownerRouter = require('./routes/owner');
const reserveRouter = require('./routes/reserve');
const applyRouter = require('./routes/apply');
const chattingRouter = require('./routes/chatting')

/****************************************/

/* console.log depth에 필요 */
let util = require('util');
// const { off } = require("process");

/* 구글 map api */
const options = {
    provider: 'google',
    apiKey: 'AIzaSyAHZxHAkDSHoI-lJDCg5YfO7bLCFiRBpaU', // 요놈 넣어만 주면 될듯?
};
const geocoder = nodeGeocoder(options);

const pool = require('./routes/function');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(cors());
app.use(bodyParser.json());
/****** webrtc - interview ******/
let http = require('http');
let server = http.createServer(app);
let socketio = require('socket.io');
const { default: job } = require('./timer');
let io = socketio.listen(server);
let socketToRoom = {};
let users = {};

const maximum = 2;

io.on('connection', (socket) => {
    socket.on('join_room', (data) => {
        if (users[data.room]) {
            const length = users[data.room].length;
            if (length === maximum) {
                socket.to(socket.id).emit('room_full');
                return;
            }
            users[data.room].push({ id: socket.id });
        } else {
            users[data.room] = [{ id: socket.id }];
        }
        socketToRoom[socket.id] = data.room;

        socket.join(data.room);
        // console.log(`[${socketToRoom[socket.id]}]: ${socket.id} enter`);

        const usersInThisRoom = users[data.room].filter((user) => user.id !== socket.id);

        // console.log(usersInThisRoom);

        io.sockets.to(socket.id).emit('all_users', usersInThisRoom);
    });

    socket.on('offer', (sdp) => {
        // console.log('offer: ' + socket.id);
        socket.broadcast.emit('getOffer', sdp);
    });

    socket.on('answer', (sdp) => {
        // console.log('answer: ' + socket.id);
        socket.broadcast.emit('getAnswer', sdp);
    });

    socket.on('candidate', (candidate) => {
        // console.log('candidate: ' + socket.id);
        socket.broadcast.emit('getCandidate', candidate);
    });

    socket.on('disconnect', () => {
        // console.log(`[${socketToRoom[socket.id]}]: ${socket.id} exit`);
        const roomID = socketToRoom[socket.id];
        let room = users[roomID];
        if (room) {
            room = room.filter((user) => user.id !== socket.id);
            users[roomID] = room;
            if (room.length === 0) {
                delete users[roomID];
                return;
            }
        }
        socket.broadcast.to(room).emit('user_exit');
        console.log(users);
    });

    socket.on('leave_room', () => {
        const roomID = socketToRoom[socket.id];
        console.log('server roomID:', roomID);
        socket.leave('roomID');

        socket.broadcast.emit(`${roomID}`, '상대방이 나갔습니다.');
    });

    socket.on("join_chat_room", (data) => {
        console.log(data)
        socket.join(data);
        console.log("join_ok");
      });
    
    socket.on("send_message", async (data) => {
        console.log('11111', data);
        socket.to(data.room_id).emit("receive_message", data);
        delete data['caller_name'];
        const con = await pool.getConnection(async conn => conn);
        const sql = `INSERT INTO chattings SET ?`;
        let date = new Date();
        let sec = date.getSeconds().toString();
        if (sec.length === 1)
            sec = '0'+sec
        
        data['createdAt'] = data['createdAt']+':'+sec;
        data['updatedAt'] = data['createdAt']

        data['FK_chattings_rooms'] = data['room_id']
        delete data['room_id']
        delete data['time']

        await con.query(sql, data)

    /* 2. room 테이블의 last_chat, updatedAt 업데이트 */
        const sql2 = `UPDATE rooms SET last_chat=?, updatedAt=? WHERE room_id=?`;
        await con.query(sql2, [data['message'], data['createdAt'], data['FK_chattings_rooms']]);
        con.release();

        console.log("ok")
    });
});

app.post('/interview', (req, res, next) => {
    const interviewId = req.body['interviewId'];
    for (const roomName of Object.values(socketToRoom)) {
        if (parseInt(roomName) === interviewId) {
            return res.send({ enter: true, room: roomName });
        }
    }

    return res.send({ enter: false });
});

app.use('/check', checkRouter);
app.use('/worker', workerRouter);
app.use('/store', storeerRouter);
app.use('/owner', ownerRouter);
app.use('/reserve', reserveRouter);
app.use('/apply', applyRouter);
app.use('/chatting', chattingRouter);

/* 일정 주기로 실행되며 DB 업데이트 실행 */
let timers = require('./timer')
timers.job();

server.listen(PORT, () => {
    console.log(`socket server running on ${PORT}`);
});