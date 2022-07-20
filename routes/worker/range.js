const { Router } = require('express');
const rangeRouter = Router();
const mysql = require("mysql2/promise");

const nodeGeocoder = require('node-geocoder');

/* 구글 map api */
const options = {
    provider: 'google',
    apiKey: 'AIzaSyAHZxHAkDSHoI-lJDCg5YfO7bLCFiRBpaU' // 요놈 넣어만 주면 될듯?
  };
const geocoder = nodeGeocoder(options);

const pool = require('../function');


/* 거리 정보 전달 받아서 worker table update
   data form === 
  {
    'worker_id': 1, 
    'range': 424
  } */
rangeRouter.post('/update', async (req, res) => {
    console.log('here1');
    const con = await pool.getConnection(async conn => conn);
    const sql = "UPDATE workers SET `range`=? WHERE worker_id=?";
    try {
        await con.query(sql, [req.body['range'], req.body['worker_id']]);
      con.release();
      res.send('success');
    } catch {
      con.release();
      res.send('error');
    }
})

/* worker의 range 정보 send */
rangeRouter.post('/', async (req, res) => {
    console.log('here2');
    const con = await pool.getConnection(async conn => conn);
    const sql = "SELECT `range` FROM workers WHERE email=?";
    const [result] = await con.query(sql, req.body['email'])
    try {
      con.release();
      res.send(result[0]['range'].toString()); // string 형태로만 통신 가능
    } catch {
      con.release();
      res.send('error');
    }
});


module.exports = rangeRouter;

/************************ function *************************/