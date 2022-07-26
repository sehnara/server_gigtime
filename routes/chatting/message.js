const { Router } = require('express');
const messageRouter = Router();
const mysql = require("mysql2/promise");
const { getConnection } = require('../function');

const pool = require('../function');

const express = require('express')
const app = express();
let http = require('http');
let server = http.createServer(app);
let socketio = require('socket.io');
let io = socketio.listen(server);

module.exports = messageRouter;

/****************************
 *          insert          *
 ****************************/

// io.on('connection', (socket) => {
//     socket.on('message', async (messageObj) => {
//         const { room_id, send_user_id, message, not_read } = messageObj;
//         const con = await pool.getConnection(async conn => conn);
//         const sql = `INSERT INTO chattings  `
//     })
// })

/*
{
    "room_id": 6,
    "send_user_id": 4,
    "send_user_type": 'owner',
    "message": "알바생님 안녕하세요",
    "createdAt": "2022-07-25 10:23"
}
*/
/* 1. 우선 chatting 테이블에 INSERT */
messageRouter.post('/save', async (req, res, next) => {
    console.log('123', req.body)
    const con = await pool.getConnection(async conn => conn);
    const sql = `INSERT INTO chattings SET ?`;
    let date = new Date();
    let sec = date.getSeconds().toString();
    if (sec.length === 1)
        sec = '0'+sec
    req.body['createdAt'] += (':'+sec);
    req.body['updatedAt'] = req.body['createdAt']

    req.body['FK_chattings_rooms'] = req.body['room_id']
    delete req.body['room_id']

    await con.query(sql, req.body)
    con.release();
    next();
})

/* 2. room 테이블의 last_chat, updatedAt 업데이트 */
messageRouter.use('/save', async (req, res) => {
    const con = await pool.getConnection(async conn => conn);
    const sql = `UPDATE rooms SET last_chat=?, updatedAt=? WHERE room_id=?`;
    console.log([req.body['message'], req.body['createdAt'], req.body['FK_chattings_rooms']])
    await con.query(sql, [req.body['message'], req.body['createdAt'], req.body['FK_chattings_rooms']]);
    con.release();
    res.send('success');
})

/****************************
 *            get           *
 ****************************/

/* 
    { "room_id": 6, "cursor": "null" } cursor는 chatting_id. 여기서부터 일정 개수 읽어오는 방식으로 구현해야 한다. null이면 처음부터
*/
/*  */
messageRouter.get('/loading', async (req, res) => {
    console.log(req.query.room_id);
    console.log('ininin')

    const con = await pool.getConnection(async conn => conn);
    const sql = `
    SELECT A.chatting_id, A.FK_chattings_rooms AS room_id, A.send_user_id, A.send_user_type, A.message, A.createdAt, B.name AS owner_name, C.name AS worker_name
    FROM chattings A
    INNER JOIN owners B ON A.send_user_id = B.owner_id
    INNER JOIN workers C ON A.send_user_id = C.worker_id
    WHERE chatting_id<? AND FK_chattings_rooms=? ORDER BY chatting_id DESC LIMIT 10`
    
    let cursor = Number(req.query.cursor) || 9999999999;
    const [result] = await con.query(sql, [cursor, req.query.room_id]);

    for (let i = 0; i < result.length; i++) {
        result[i]['createdAt'] = masageDateToYearMonthDayHourMinSec(result[i]['createdAt']).slice(0,-3)
        if (result[i]['send_user_type'] === 'owner') {
            result[i]['caller_name'] = result[i]['owner_name']
        } else {
            result[i]['caller_name'] = result[i]['worker_name']
        }
        delete result[i]['owner_name']
        delete result[i]['worker_name']
    }
    
    console.log(result)
    res.send(result);
})

messageRouter.get('/loading/:room_id/:cursor', async (req, res) => {
    const con = await pool.getConnection(async conn => conn);
    const sql = `
    SELECT A.chatting_id, A.FK_chattings_rooms AS room_id, A.send_user_id, A.send_user_type, A.message, A.updatedAt, B.name AS owner_name, C.name AS worker_name
    FROM chattings A
    INNER JOIN owners B ON A.send_user_id = B.owner_id
    INNER JOIN workers C ON A.send_user_id = C.worker_id
    WHERE chatting_id<? AND FK_chattings_rooms=? ORDER BY chatting_id DESC LIMIT 10`
    
    let cursor = Number(req.params.cursor) || 9999999999;
    const [result] = await con.query(sql, [cursor, req.params.room_id]);

    for (let i = 0; i < result.length; i++) {
        result[i]['updatedAt'] = masageDateToYearMonthDayHourMinSec(result[i]['updatedAt'])
        if (result[i]['send_user_type'] === 'owner') {
            result[i]['caller_name'] = result[i]['owner_name']
        } else {
            result[i]['caller_name'] = result[i]['worker_name']
        }
        delete result[i]['owner_name']
        delete result[i]['worker_name']
    }
    
    res.send(result);
})


function masageDateToYearMonthDayHourMinSec(date_timestamp) {
    let date = new Date(date_timestamp);
    let hour = date.getHours().toString();
    let min = date.getMinutes().toString();
    let sec = date.getSeconds().toString();
  
    if (hour.length === 1) hour = '0'+hour
    if (min.length === 1) min = '0'+min
    if (sec.length === 1) sec = '0'+sec
  
    return (masageDateToYearMonthDay(date_timestamp)+' '+hour+':'+min+':'+sec);
}

function masageDateToYearMonthDay(date_timestamp) {
    let date = new Date(date_timestamp);
    let year = date.getFullYear().toString();
    let month = (date.getMonth() + 1).toString();
    let day = date.getDate().toString();

    if (month.length === 1) month = '0'+month;
    if (day.length === 1) day = '0'+day;

    return (year+'-'+month+'-'+day);
}
