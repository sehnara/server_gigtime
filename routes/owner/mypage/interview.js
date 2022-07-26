const { Router } = require('express');
const interviewRouter = Router();
const mysql = require('mysql2/promise');

const pool = require('../../function');

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
        if (value != true) {
            const sql = `update interviews set state = 3, reject_flag = 1 where interview_id = ${interview_id};`;
            const [result] = await con.query(sql);
        } else {
            const sql = `update interviews set state = 3, reject_flag = 0 where interview_id = ${interview_id};`;
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
    console.log('result');
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
        con.release();
        res.send('success');
    } catch {
        con.release();
        res.send(`error - ${msg}`);
    }
});

module.exports = interviewRouter;

/************************ function *************************/
