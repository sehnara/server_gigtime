const { Router } = require('express');
const interviewRouter = Router();
const mysql = require('mysql2/promise');

const pool = require('../../function');
const push_noti = require('../../push');

/* state = 1(입장대기)일 때  */
/* {inerview_id:1 } */
interviewRouter.post('/exit', async (req, res) => {
    // 해당 인터뷰 state 변경
    const con = await pool.getConnection(async (conn) => conn);
    const interview_id = req.body['interview_id'];
    console.log('/owner/interview/exit', interview_id);
    try {
        const sql = `update interviews set state = 4 where interview_id = ${interview_id}`;
        const [result] = await con.query(sql);
        con.release();
        res.send({ state: 'success' });
    } catch {
        con.release();
        res.send({ state: 'fail' });
    }
});

/* state = 2(승인대기)일 때 수락or거절 선택 */
/* {inerview_id:1, value:true/false} */
interviewRouter.post('/accept', async (req, res) => {
    const con = await pool.getConnection(async (conn) => conn);
    let msg = '';
    console.log('accept');
    const interview_id = req.body['interview_id'];
    const value = req.body['value'];
    console.log(interview_id, value);
    try {
        msg = 'update state';
        if (value === 'true') {    // 수락
            const sql = `update interviews set state = 1, reject_flag = 0 where interview_id = ${interview_id};`;
            // const sql = `update interviews set state = 3, reject_flag = 0 where interview_id = ${interview_id};`;
            const [result] = await con.query(sql);
        } else {                // 거절
            const sql = `update interviews set state = 0, reject_flag = 1 where interview_id = ${interview_id};`;
            // const sql = `update interviews set state = 3, reject_flag = 1 where interview_id = ${interview_id};`;
            const [result] = await con.query(sql);
        }
        // console.log('result: ',result);

        con.release();
        res.send('success');
    } catch {
        con.release();
        res.send(`error - ${msg}`);
    }
});

/* state = 3일 때  */
/* {inerview_id:1, value:true/false} */
interviewRouter.post('/result', async (req, res) => {
    const con = await pool.getConnection(async (conn) => conn);
    let msg = '';
    const interview_id = req.body['interview_id'];
    const value = req.body['value'];
    console.log(interview_id, value);
    try {
        msg = 'update state';
        if (value === 'true') {
            const sql = `update interviews set state = 0, result_flag = 1 where interview_id = ${interview_id};`;
            const [result] = await con.query(sql);
        } else {
            const sql = `update interviews set state = 0, result_flag = 0 where interview_id = ${interview_id};`;
            const [result] = await con.query(sql);
        }
        // const [result] = await con.query(sql);
        // console.log('result: ',result);
        
        /* worker_id 찾고 */
        msg = 'select worker_id';
        const sql_worker = `select FK_interviews_workers, FK_interviews_stores from interviews where interview_id = ${interview_id};`;
        const [worker] = await con.query(sql_worker);
        
        msg = 'select name';
        const sql_store = `select name from stores where store_id = ${worker[0]['FK_interviews_stores']};`;
        const [store] = await con.query(sql_store);
        
        /* token 찾아서 push */
        
        msg = 'select token';
        const sql_token = `select token from permissions 
        where FK_permissions_workers = ${worker[0]['FK_interviews_workers']};`;
        const [token] = await con.query(sql_token);
        
        let push_token = token[0]['token'];
        console.log(push_token);
        
        let title = '면접 결과'
        let info = {
            'store_name': store[0]['name'],
        }
        
        msg = 'push_noti';
        push_noti(push_token, title, info);

        /* create chatting room */

        /* 1. interview_id로 worker_id 가져오기 */
        console.log('/create 진입')
        const sql = `SELECT FK_interviews_workers AS worker_id FROM interviews WHERE interview_id=${req.body['interview_id']}`

        const [result_room] = await con.query(sql);
        req.body['worker_id'] = result_room[0]['worker_id']

        /* 2. room 테이블에 데이터 삽입 */
        const sql2 = `INSERT INTO rooms SET identifier=?, last_chat=?, createdAt=?, updatedAt=?`;
        let identifier = req.body['owner_id'].toString() + '-' + req.body['worker_id'].toString()
        req.body['identifier'] = identifier;
        let date = masageDateToYearMonthDayHourMinSec(new Date())
        await con.query(sql2, [identifier, '', date, date])

        // /* 3. room_id 리턴 (안해도 될듯) */
        // const sql3 = `SELECT id AS room_id, identifier FROM rooms WHERE identifier=?`;
        // await con.query(sql3, [req.body['identifier']])

        con.release();
        res.send('success');
    } catch {
        con.release();
        res.send(`error - ${msg}`);
    }
});

module.exports = interviewRouter;

/************************ function *************************/

/* '2022-08-20 00:00:000Z' 형식의 input을 '0000-00-00'형식으로 변환하여 리턴 */
function masageDateToYearMonthDay(date_timestamp) {
    let date = new Date(date_timestamp);
    let year = date.getFullYear().toString();
    let month = (date.getMonth() + 1).toString();
    let day = date.getDate().toString();
  
    if (month.length === 1) month = "0" + month;
    if (day.length === 1) day = "0" + day;
  
    return year + "-" + month + "-" + day;
  }
  
  /* '2022-08-20 00:00:000Z' 형식의 input을 '0000-00-00 00:00:00'형식으로 변환하여 리턴 */
  function masageDateToYearMonthDayHourMinSec(date_timestamp) {
    let date = new Date(date_timestamp);
    let hour = date.getHours().toString();
    let min = date.getMinutes().toString();
    let sec = date.getSeconds().toString();
  
    if (hour.length === 1) hour = "0" + hour;
    if (min.length === 1) min = "0" + min;
    if (sec.length === 1) sec = "0" + sec;
  
    return (
      masageDateToYearMonthDay(date_timestamp) +
      " " +
      hour +
      ":" +
      min +
      ":" +
      sec
    );
  }