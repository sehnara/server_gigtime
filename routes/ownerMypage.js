const { Router } = require('express');
const ownerMypageRouter = Router();
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: "albadb.cpew3pq0biup.ap-northeast-2.rds.amazonaws.com",
  user: "admin",
  password: "dnjstnddlek",
  database: "gig_time",
  connectionLimit: 10
});

/* 사장님 홈 - 모집내역 */
/* input { 'owner_id': 2 } */

/* 1. owners 테이블에서 owner_id로 FK_orders_stores 가져오기 */
ownerMypageRouter.post('/work', getStoreIdByOwnerId, async (req, res, next) => {
    next();
  })
  
  /* 2. order 테이블에서 store_id로 order_id 배열에 담기 */
  ownerMypageRouter.use('/work', async (req, res, next) => {
    const con = await pool.getConnection(async conn => conn);
    const sql = `SELECT order_id FROM orders WHERE FK_orders_stores=${req.body['store_id']} AND (status=0 OR status=1)`
    const [result] = await con.query(sql);
    let order_ids = Array();
    for (let i = 0; i < result.length; i++)
      order_ids.push(result[i]['order_id'])
    req.body['order_ids'] = order_ids;
    console.log(req.body)
    con.release();
    next();
  })
  
  /* 3. hourly_orders 테이블에서 order_id에 해당하는 모든 row 가져오기 */
  // orders, workers, jobs 테이블에서 필요한 정보만 추가로 JOIN
  ownerMypageRouter.use('/work', async (req, res, next) => {
    const con = await pool.getConnection(async conn => conn);
    const sql = `SELECT A.*, B.order_id, B.min_price AS price, C.name, D.type FROM hourly_orders A 
                 INNER JOIN orders B ON A.FK_hourlyorders_orders = B.order_id
                 LEFT OUTER JOIN workers C ON A.FK_hourlyorders_workers = C.worker_id
                 INNER JOIN jobs D ON B.FK_orders_jobs = D.job_id
                 WHERE FK_hourlyorders_orders IN (${req.body['order_ids']})`
    const [result] = await con.query(sql)
    req.body['hourly_orders'] = result;
    console.log(result.length)
    con.release();
    next();
  })
  
  /* 4. masage data */
  ownerMypageRouter.use('/work', async (req, res, next) => {
    let send_data = new Array();
  
    let len = req.body['hourly_orders'].length;
    let tmp;
    let date;
    let type;
    let order_id;
    let check = {};
    let idx = 0;
    for (let i = 0; i < len; i++) {
      let key = new Array();
      tmp = req.body['hourly_orders'][i];
      key.push(masageDateToYearMonthDay(tmp['work_date']));
      key.push(tmp['type']);
      key.push(tmp['order_id']);
  
      /* 이미 저장된 key인지 확인 */
      if (!check.hasOwnProperty(key)) {
        send_data.push(key);
        check[Object.assign(new Array(), key)] = idx;
        idx += 1;
      }
  
      send_data[check[key]].push(
        masageDateToHour(tmp['start_time'])+','+tmp['price'].toString()+','+tmp['name']+','+tmp['hourlyorders_id']
      )
    }
    console.log(send_data)
    res.send(send_data);
  })

/* 사장님 홈 - 나의긱워커 */
/* input : { 'owner_id': 60 } */

/* 1. owner_id로 store_id 가져온 후 qualifications 테이블에서 worker_id들 가져오기 */
ownerMypageRouter.post('/myWorker', getStoreIdByOwnerId, async (req, res, next) => {
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
    res.send({'name':owner_name, 'store':store_name});
  } catch {
    res.send('error');
  }

});



/* state = 2(승인대기)일 때 수락or거절 선택 */
/* {inerview_id:1, value:true/false} */
ownerMypageRouter.post('/interview/accept', async (req, res) => {
  const con = await pool.getConnection(async conn => conn);
  let msg = '';
  console.log('accept');
  const interview_id = req.body['interview_id'];
  const value = req.body['value'];
  console.log(interview_id, value);
  try{
    msg = 'update state';
    if(value!=true){
      const sql = `update interviews set state = 3, reject_flag = 1 where interview_id = ${interview_id};`;
      const [result] = await con.query(sql);
    }
    else{    
      const sql = `update interviews set state = 3, reject_flag = 0 where interview_id = ${interview_id};`;
      const [result] = await con.query(sql);
    }
    // console.log('result: ',result);
    
    con.release();
    res.send('success');    
  }
  catch{
    con.release();
    res.send(`error - ${msg}`);
  } 
  });
  
  /* state = 3일 때  */
  /* {inerview_id:1, value:true/false} */
  ownerMypageRouter.post('/interview/result', async (req, res) => {
  const con = await pool.getConnection(async conn => conn);
  console.log('result');
  let msg = '';
  const interview_id = req.body['interview_id'];
  const value = req.body['value'];
  console.log(interview_id, value);
  try{
    msg = 'update state';
    if(value==='true'){
      const sql = `update interviews set state = 0, result_flag = 1 where interview_id = ${interview_id};`;
      const [result] = await con.query(sql);
    }
    else{    
      const sql = `update interviews set state = 0, result_flag = 0 where interview_id = ${interview_id};`;
      const [result] = await con.query(sql);
    }
    // const [result] = await con.query(sql);
    // console.log('result: ',result);
    res.send('success');
  }
  catch{
    res.send(`error - ${msg}`);
  } 
  });
  
module.exports = ownerMypageRouter;

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

/* '2022-08-20 00:00:000Z' 형식의 input을 '0000-00-00'형식으로 변환하여 리턴 */
function masageDateToYearMonthDay(date_timestamp) {
  let date = new Date(date_timestamp);
  let year = date.getFullYear().toString();
  let month = (date.getMonth() + 1).toString();
  let day = date.getDate().toString();
  
  if (month.length === 1) month = '0'+month;
  if (day.length === 1) day = '0'+day;
  
  return (year+'-'+month+'-'+day);
}

/* '0000:00:00 ??:00:00.000Z' 형식을 받아서 '??:00' return */
function masageDateToHour(timestamp) {
  timestamp = new Date(timestamp);
  let hour = timestamp.getHours().toString();
  if (hour.length === 1)
    hour = '0'+hour;
  
  return hour+':00';
}

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
