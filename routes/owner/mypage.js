const { Router } = require('express');
const ownerMypageRouter = Router();
const mysql = require("mysql2/promise");

const workRouter = require('./mypage/work');
const myWorkerRouter = require('./mypage/myWorker');
const interviewRouter = require('./mypage/interview');
const employmentRouter = require('./mypage/employment');

const pool = mysql.createPool({
  host: "albadb.cpew3pq0biup.ap-northeast-2.rds.amazonaws.com",
  user: "admin",
  password: "dnjstnddlek",
  database: "gig_time",
  connectionLimit: 10
});


ownerMypageRouter.post('/', async (req, res) => {
  const con = await pool.getConnection(async conn => conn);
  // console.log('##### start owner/name #####');
  // console.log(req.body);
  const sql_owner = `SELECT name FROM owners WHERE owner_id = ${req.body['owner_id']};`
  const [result_owner] = await con.query(sql_owner);
  const owner_name = result_owner[0]['name'];
  const sql_store = `SELECT name from stores where FK_stores_owners = ${req.body['owner_id']};`;
  try {
    const [result_store] = await con.query(sql_store);
    // console.log(result_store)
    const store_name = result_store[0]['name'];
    // console.log(owner_name, store_name);
    con.release();
    res.send({'name':owner_name, 'store':store_name});
  } catch {
    con.release();
    res.send('error');
  }

});

ownerMypageRouter.use('/work', workRouter);
ownerMypageRouter.use('/myWorker', myWorkerRouter);
ownerMypageRouter.use('/interview', interviewRouter);
ownerMypageRouter.use('/employment', employmentRouter);
  
module.exports = ownerMypageRouter;

/************************ function *************************/

