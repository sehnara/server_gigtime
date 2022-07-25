const { Router } = require('express');
const roomRouter = Router();
const mysql = require("mysql2/promise");
const { getConnection } = require('../function');

const pool = require('../function');

/**************************
 *         create         *
 **************************/
/* input: { 'owner_id': 1, 'interview_id': 2 } */

/* 1. interview_id로 worker_id 가져오기 */
roomRouter.post('/create', async (req, res, next) => {
    console.log('/create 진입')
    const con = await pool.getConnection(async conn => conn);
    const sql = `SELECT FK_interviews_workers AS worker_id FROM interviews WHERE interview_id=${req.body['interview_id']}`

    const [result] = await con.query(sql);
    con.release();
    req.body['worker_id'] = result[0]['worker_id']
    next();
})

/* 2. room 테이블에 데이터 삽입 */
roomRouter.use('/create', async (req, res, next) => {
    console.log(req.body)
    const con = await pool.getConnection(async conn => conn);
    const sql = `INSERT INTO rooms SET identifier=?, last_chat=?, createdAt=?, updatedAt=?`;
    let identifier = req.body['owner_id'].toString() + '-' + req.body['worker_id'].toString()
    req.body['identifier'] = identifier;
    let date = masageDateToYearMonthDayHourMinSec(new Date())
    await con.query(sql, [identifier, '', date, date])
    con.release();
    next();
})

/* 3. room_id 리턴 (안해도 될듯) */
roomRouter.use('/create', async (req, res) => {
    const con = await pool.getConnection(async conn => conn);
    const sql = `SELECT id AS room_id, identifier FROM rooms WHERE identifier=?`;
    
    const [result] = await con.query(sql, [req.body['identifier']])
    con.release()
    res.json(result)
})

/**************************
 *          list          *
 **************************/

/* input: { 'type': 'worker', 'id': 1 } */
/* room 정보 가져오기 */
roomRouter.post('/list', async (req, res, next) => {
    const con = await pool.getConnection(async conn => conn);
    const sql = `SELECT A.room_id, A.identifier, A.last_chat, A.updatedAt, B.name AS worker_name, C.name AS owner_name 
    FROM rooms A 
    INNER JOIN workers B ON SUBSTRING_INDEX(A.identifier,'-',-1)=B.worker_id
    INNER JOIN owners C ON SUBSTRING_INDEX(A.identifier,'-',1)=C.owner_id
    WHERE SUBSTRING_INDEX(A.identifier,'-',?)=${req.body['id']}`
    
    
    let flag;
    if (req.body['type'] === 'owner') flag = 1
    else flag = -1

    const [result] = await con.query(sql, [flag]);
    console.log(result)

    for (let i = 0; i < result.length; i++) {
        let identifier = result[i]['identifier'].split('-');
        let owner_id = identifier[0]
        let worker_id = identifier[1]
        if (req.body['type'] === 'worker') { // 현재 사용자가 worker라면
            result[i]['receiver_name'] = result[i]['owner_name']
            result[i]['receiver_id'] = owner_id
        }
        else {
            result[i]['receiver_name'] = result[i]['worker_name']
            result[i]['receiver_id'] = worker_id
        }

        let timeStamp = masageDateToYearMonthDayHourMinSec(result[i]['updatedAt']).split(' ')
        let date = timeStamp[0]
        let time = timeStamp[1].split(':')
        result[i]['date'] = date
        result[i]['time'] = time[0]+'시 '+time[1]+'분' 

        delete result[i]['identifier']
        delete result[i]['updatedAt']
        delete result[i]['owner_name']
        delete result[i]['worker_name']
    }

    // req.body['date'] = 
    // req.body['time'] = 

    con.release();
    res.send(result)
})


/* input: { owner_id: 1 } */
roomRouter.post('/list/owner/:owner_id', async (req, res) => {
    const con = await pool.getConnection(async conn => conn);
    const sql = `SELECT * FROM rooms WHERE SUBSTRING_INDEX(identifier,'-',1)=${req.params.owner_id}`
    const [result] = await con.query(sql);
    con.release();
    console.log(result)
    res.json(result)
})

// GET 방식
// roomRouter.post('/list/owner/:owner_id', async (req, res) => {
//     const con = await pool.getConnection(async conn => conn);
//     const sql = `SELECT * FROM room WHERE SUBSTRING_INDEX(identifier,'-',1)=${req.params.owner_id}`
//     const [result] = await con.query(sql);
//     con.release();
//     console.log(result)
//     res.json(result)
// })



module.exports = roomRouter;

/**************************
 *        function        *
 **************************/
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