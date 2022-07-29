const { Router } = require('express');
const idRouter = Router();
const mysql = require("mysql2/promise");

const pool = require('../../function');

/* worker의 email을 받아서 id를 return */
/*
  input
  {
    'email': 'dngp93@gmail.com'
  }
  output
  1
*/
idRouter.post('/', async (req, res) => {
    const con = await pool.getConnection(async conn => conn);
    const sql = "SELECT worker_id FROM workers WHERE email=?";
  
    const [result] = await con.query(sql, req.body['email'])
    try {
      con.release();
      res.send(result[0]['worker_id'].toString());
    } catch {
      con.release();
      res.send('error');
    }
})
  
module.exports = idRouter;

/************************ function *************************/
