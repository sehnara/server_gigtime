const { Router } = require('express');
const myWorkerRouter = Router();
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: "albadb.cpew3pq0biup.ap-northeast-2.rds.amazonaws.com",
  user: "admin",
  password: "dnjstnddlek",
  database: "gig_time",
  connectionLimit: 10
});

/* 사장님 홈 - 나의긱워커 */
/* input : { 'owner_id': 60 } */

/* 1. owner_id로 store_id 가져온 후 qualifications 테이블에서 worker_id들 가져오기 */
myWorkerRouter.post('/', getStoreIdByOwnerId, async (req, res, next) => {
    console.log(req.body)
    const con = await pool.getConnection(async conn => conn);
    
    /* worker_id를 모두 담은 배열 가져오기 */
    let worker_ids = await getWorkerIdByStoreId(req.body['store_id']);
    
    /* workers 테이블에서 worker_id에 해당하는 name 가져오기 */
    const sql = `SELECT name FROM workers WHERE worker_id IN (${worker_ids})`
    const [result] = await con.query(sql);
    
    /* masage data */
    let worker_names = new Array();
    for (let i = 0; i < result.length; i++) {
      worker_names.push(result[i]['name'])
    }
  
    let send_data = {
      'workers': worker_names
    }
    con.release();
    res.send(send_data);
})
  
module.exports = myWorkerRouter;

/************************ function *************************/

/* owner_id로 stores 테이블에서 store id 가져오기 */
async function getStoreIdByOwnerId (req, res, next) {
    console.log(req.body)
    const con = await pool.getConnection(async conn => conn);
  
    try {
      const sql = "SELECT store_id FROM stores WHERE FK_stores_owners=?";
      const [result] = await con.query(sql, req.body['owner_id']);
      req.body['store_id'] = result[0]['store_id'];
      con.release();
      next();
    }
    catch {
      console.log('error')
      res.send('error');
    }
  }

/* store_id에 해당하는 모든 worker_id를 배열로 return */
async function getWorkerIdByStoreId (store_id) {
    const con = await pool.getConnection(async conn => conn);
    const sql = `SELECT FK_qualifications_workers AS worker_id FROM qualifications WHERE FK_qualifications_stores='${store_id}'` 
    const [result] = await con.query(sql);
    console.log(result)
    
    let worker_ids = new Array();
    for (let i = 0; i < result.length; i++) {
      worker_ids.push(result[i]['worker_id'])
    }
  
    con.release();
    return worker_ids;
  }
  