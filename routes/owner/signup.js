const { Router } = require('express');
const signupRouter = Router();
const mysql = require("mysql2/promise");

const nodeGeocoder = require('node-geocoder');
/* 구글 map api */
const options = {
    provider: 'google',
    apiKey: 'AIzaSyAHZxHAkDSHoI-lJDCg5YfO7bLCFiRBpaU' // 요놈 넣어만 주면 될듯?
  };
const geocoder = nodeGeocoder(options);

const pool = mysql.createPool({
  host: "albadb.cpew3pq0biup.ap-northeast-2.rds.amazonaws.com",
  user: "admin",
  password: "dnjstnddlek",
  database: "gig_time",
  connectionLimit: 10
});

/* 사장님 사장님 최저시급 설정 페이지 */
/* owner db에 사장님 회원정보 INSERT & store db에 가게정보 INSERT */
/* 
data form
{
	'name': 'kantwang', 
	'email': 'dngp93@gmail.com',
	'phone': '01089570356'
	'store_name': '보리누리',
	'location': '인천 서구 심곡동',
	'store_jobs': ['서빙', '카운터', '주방', '청소'],
	'background': (양식에 맞게),
	'logo': (양식에 맞게),
	'description': "보리누리 많이 사랑해주세요",
	'minimum_wage': 10200,
} 
*/
// 이거 하기 전에 들어온 데이터가 정확한지 체크하는 과정이 필요
signupRouter.post('/signup', getPos, async (req, res) => {
    const con = await pool.getConnection(async conn => conn);
  
    try {
      /* 먼저, owners 테이블에 name, eamil, phone INSERT */
      const sql = "INSERT INTO owners SET name=?, email=?, phone=?";
      await con.query(sql, [req.body['name'], req.body['email'], req.body['phone']])
  
      /* 다음으로, owners 테이블에서 owner_id SELECT */
      const sql2 = "SELECT owner_id FROM owners WHERE email=?";
      const [sql2_result] = await con.query(sql2, req.body['email'])
  
      /* 마지막으로, stores db에 INSERT */
      let tmp = {
        'FK_stores_owners': sql2_result['owner_id'],
        'name': req.body['store_name'],
        'address': req.body['location'],
        'latitude': req.body['latitude'],
        'longitude': req.body['longitude'],
        'description': req.body['description'],
        'minimum_wage': req.body['minimum_wage']
      }
      const sql3 = "INSERT INTO stores SET ?";
      await con.query(sql3, tmp)
  
      console.log('owner signup success!');
      con.release();
      res.send('success');
    }
    catch {
      console.log('error');
      con.release();
      res.send('error');
    }
})
  
module.exports = signupRouter;

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