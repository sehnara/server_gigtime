const { Router } = require('express');
const addrRouter = Router();
const mysql = require("mysql2/promise");

const pool = require('../function');

  
addrRouter.post("/range", async (req, res) => {
    console.log(req.body["worker_id"]);
    const con = await pool.getConnection(async (conn) => conn);
    const sql = "SELECT location, `range`, name FROM workers WHERE worker_id=?";
    const [result] = await con.query(sql, req.body["worker_id"]);
    console.log('result:', result);
    con.release();
    res.send(result);
  });
  
module.exports = addrRouter;

/************************ function *************************/
