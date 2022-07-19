const { Router } = require('express');
const mysql = require("mysql2/promise");
const nodeGeocoder = require('node-geocoder');
const ownerRouter = Router();

const employmentRouter = require('./employment');
const ownerMypageRouter = require('./ownerMypage');


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
ownerRouter.post('/signup', getPos, async (req, res) => {
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
      res.send('success');
    }
    catch {
      console.log('error');
      res.send('error');
    }
  })
  
/* 사장님 최저시급 설정 페이지의 모집공고 작성 버튼 || 사장님 홈 페이지의 + 버튼 */
/*
  input form
  {
    'email': 'borinuri@gmail.com',
    'owner_id': 60
  }

  output form
  {
    'name': '보리누리',
    'address': '인천 서구 심곡동 123-4',
    'type': ['서빙', '뭐시기', ...]
  }
*/

/* 1. owners 테이블에서 owner_id 가져오기 */
// app.post('/owner/mypage/employment/button', getOwnerIdByEmail, async (req, res, next) => { next(); })

/* 2. stores 테이블에서 owner_id로 name, address, store_id 가져오기 */
ownerRouter.post('/mypage/employment/button', async (req, res, next) => {
  console.log(req.body)
  const con = await pool.getConnection(async conn => conn);

  try {
    const sql = "SELECT name, address, store_id FROM stores WHERE FK_stores_owners=?";
    const [result] = await con.query(sql, req.body['owner_id']);
    req.body['name'] = result[0]['name'];
    req.body['address'] = result[0]['address'];
    req.body['store_id'] = result[0]['store_id'];
    next();
  }
  catch {
    res.send('error');
  }
})

/* 3. store_job_lists 테이블에서 store_id로 FK_store_job_lists_jobs 모두 가져오기 */
ownerRouter.use('/mypage/employment/button', getJobIdByStoreId, async (req, res) => {
  delete req.body['email'];
  delete req.body['owner_id'];
  delete req.body['store_id'];
  res.send(req.body);
})

ownerRouter.use('/employment', employmentRouter);
ownerRouter.use('/mypage', ownerMypageRouter);

ownerRouter.post('/interview', async (req, res) => {
  //console.log(req.body);
  const con = await pool.getConnection(async conn => conn);
  const owner_id = req.body['owner_id'];
  cards = {};
  console.log(owner_id);
  const sql_store = `select store_id from stores where FK_stores_owners = ${owner_id};`;
  const [result_store] = await con.query(sql_store);
  const store_id = result_store[0]['store_id'];
  // console.log(store_id);

  const sql = `select a.interview_id, a.interview_date, c.time, b.name, a.question, 
  a.state, a.cancel_flag, a.link 
  from interviews a 
  join workers b on a.FK_interviews_workers = b.worker_id 
  join interview_times c on a.FK_interviews_interview_times = c.interview_time_id
  where a.FK_interviews_stores = ${result_store[0]['store_id']}
  order by state, interview_date, time;`;
  const [result] = await con.query(sql)
  n = result.length;
  pre_state = 0;
  console.log('>>>>>',result,'<<<<<');

  const sql_owner = `SELECT name FROM owners WHERE owner_id = ${owner_id};`
  const [result_owner] = await con.query(sql_owner);
  // console.log(result_owner);
  const owner_name = result_owner[0]['name'];

  const step = {1:'now', 2:'wait', 3:'will', 4:'complete'}

  for (let i = 0; i < n; i++) {

      worker_id = result[i]['FK_interviews_workers'];

      date = result[i]['interview_date'].toISOString();
      interview_date = date.split('T')[0];
      interview_time = result[i]['time'];
      interview_id = result[i]['interview_id'];
      // cancel_flag = result[i]['cancel_flag'];        
      // link = result[i]['link'];
      state = result[i]['state'];
      question = result[i]['question'];
      worker_name = result[i]['name'];
      
      card = {
        'interview_id': interview_id,
        'interview_date': interview_date,
        'interview_time': interview_time,
        // 'cancel_flag': cancel_flag,
        // 'link': link,
        'state': state,
        'worker_name': worker_name,
        'question': question
      };

      if(pre_state == state){
        if(cards[step[state]])
            cards[step[state]].push(card);
        else
            cards[step[state]] = [card];
      }
      else{
          cards[step[state]] = [card];
          pre_state = state;
      }  

      // console.log(cards);
      // if (cards) {
      //     cards.push(card);
      // } else {
      //     cards = [card];
      // }        
  }
  
  // let response = {
  //         'name': owner_name,
  //         'result': cards
  // }

// res.send(dummy)
  console.log(cards);
  res.send(cards);
});


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


/* store_job_lists 테이블에서 store_id로 FK_store_job_lists_jobs 모두 가져오기 */
/*
  req.body['types'] === ['청소', '빨래', '설거지']
*/
async function getJobIdByStoreId(req, res, next) {
  const con = await pool.getConnection(async conn => conn);

  try {
    const sql = "SELECT FK_store_job_lists_jobs FROM store_job_lists WHERE FK_store_job_lists_stores=?";
    const [result] = await con.query(sql, req.body['store_id']);
    
    /* 가져온 job_id 개수만큼 for문 돌아서 배열 형태로 masage */
    let job_ids = Array();
    for (let i = 0; i < result.length; i++) {
      job_ids.push(result[i]['FK_store_job_lists_jobs']);
    }
    
    /* 배열에 담긴 job_id를 type으로 변환 */
    try {
      req.body['types'] = await getTypeByJobId(job_ids);
      if (req.body['types'].length === 0)
        throw new Error('error: getTypeByJobId');
    }
    catch (exception) {
      console.log(exception);
    }
    next();
  } 
  catch {
    res.send('error: getJobIdByStoreId');
  }
}

/* 배열에 담긴 job_id를 type으로 변환 */
/* 
  input: [1, 2, 3, 4]
  return: ['청소', '빨래', '설거지', '서빙']
*/
async function getTypeByJobId(job_ids) {
  let job_types = Array();
  const con = await pool.getConnection(async conn => conn);

  try {
    const sql = "SELECT type FROM jobs WHERE job_id IN (?)";
    const [result] = await con.query(sql, [job_ids]); // [[1, 2, 3, 4]]의 형태로 넣어줘야 되네
    for (let i = 0; i < result.length; i++) {
      job_types.push(result[i]['type']);
    }
    return job_types;
  }
  catch {
    console.log('error');
  }
}