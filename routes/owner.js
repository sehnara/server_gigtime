const { Router } = require('express');
const mysql = require("mysql2/promise");

const ownerRouter = Router();

const signupRouter = require('./owner/signup');
const interviewRouter = require('./owner/interview');
const employmentRouter = require('./owner/employment');
const ownerMypageRouter = require('./owner/mypage');


const pool = mysql.createPool({
  host: "albadb.cpew3pq0biup.ap-northeast-2.rds.amazonaws.com",
  user: "admin",
  password: "dnjstnddlek",
  database: "gig_time",
  connectionLimit: 10
});

ownerRouter.use('/signup', signupRouter);
ownerRouter.use('/interview', interviewRouter);
ownerRouter.use('/employment', employmentRouter);
ownerRouter.use('/mypage', ownerMypageRouter);

module.exports = ownerRouter;

/************************ function *************************/

/* 두 좌표 간 거리 구하기 */
async function getPos(req, res, next) {
    const regionLatLongResult = await geocoder.geocode(req.body['location']);
    const Lat = regionLatLongResult[0].latitude; //위도
    const Long =  regionLatLongResult[0].longitude; //경도
    req.body['latitude'] = Lat;
    req.body['longitude'] = Long;
    next();
}

