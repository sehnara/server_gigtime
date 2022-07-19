const { Router } = require("express");
const mysql = require("mysql2/promise");
const nodeGeocoder = require("node-geocoder");
const signupRouter = Router();

/* 구글 map api */
const options = {
  provider: "google",
  apiKey: "AIzaSyAHZxHAkDSHoI-lJDCg5YfO7bLCFiRBpaU", // 요놈 넣어만 주면 될듯?
};
const geocoder = nodeGeocoder(options);

const pool = mysql.createPool({
  host: "albadb.cpew3pq0biup.ap-northeast-2.rds.amazonaws.com",
  user: "admin",
  password: "dnjstnddlek",
  database: "gig_time",
  connectionLimit: 100,
});

/* name, email 정보 전달 받아서 worker table에 insert 
  data form === 
  {
		'name': 'kantwang',
		'email': 'dngp93@gmail.com',
		'location': '서울시 관악구 성현동 블라블라',
		'range': 234
  } */

/* 1. workers 테이블에 INSERT */
signupRouter.post("/", getPos, async (req, res, next) => {
  console.log("aaa");
  console.log(req.body);
  const con = await pool.getConnection(async (conn) => conn);
  const sql = "INSERT INTO workers SET ?";
  await con.query(sql, req.body);
  con.release();
  next();
});

/* 2. workers 테이블에서 email로 worker_id 찾아서 send */
signupRouter.use("/", async (req, res) => {
  const con = await pool.getConnection(async (conn) => conn);
  const sql = "SELECT worker_id FROM workers WHERE email=?";
  const [result] = await con.query(sql, req.body["email"]);
  con.release();
  res.send(result[0]["worker_id"].toString());
});

module.exports = signupRouter;

/************************ function *************************/

/* 두 좌표 간 거리 구하기 */
async function getPos(req, res, next) {
  console.log("getpos123: ", req.body);
  const regionLatLongResult = await geocoder.geocode(req.body["location"]);
  console.log("???", regionLatLongResult);
  const Lat = regionLatLongResult[0].latitude; //위도
  const Long = regionLatLongResult[0].longitude; //경도
  req.body["latitude"] = Lat;
  req.body["longitude"] = Long;
  console.log("end of getpos: ", req.body);
  next();
}
