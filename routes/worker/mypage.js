const { Router } = require('express');
const mypageRouter = Router();
const mysql = require("mysql2/promise");


const pool = require('../function');


/* 마이페이지 - 알바시간표 */
/* input  { 'email': 'dngp93@gmail.com' }
   output 
    const mockDict = 
    [
      [
          "2022-08-20",
          "커피커피",
          "서빙",
          "대전 유성구 전민로 38",
          "10:00,10255",
          "11:00,10255"
      ],
      [
          "2022-08-20",
          "광세족발",
          "설거지",
          "대전 유성구 전민로22번길 51",
          "16:00,10250"
      ],
    ];
*/

/* 1. workers 테이블에서 email로 worke_id 가져오기 */
// app.post('/worker/mypage/work', async (req, res, next) => {
//   const con = await pool.getConnection(async conn => conn);
//   const sql = `SELECT worker_id FROM workers WHERE email='${req.body['email']}'`;
//   const [result] = await con.query(sql);
//   try {
//     req.body['worker_id'] = result[0]['worker_id'];
//     next();
//   } catch {
//     res.send('error');
//   }
// })

/* 2. hourly_orders 테이블에서 worker_id로 status=0인 모든 row 가져오기 */
// orders, stores 테이블에서 필요한 정보만 추가로 JOIN
mypageRouter.post('/work', async (req, res, next) => {
    const con = await pool.getConnection(async conn => conn);
    const sql = `SELECT A.*, B.min_price, C.name, C.address, D.type FROM hourly_orders A 
                  INNER JOIN orders B ON A.FK_hourlyorders_orders = B.order_id
                  INNER JOIN stores C ON B.FK_orders_stores = C.store_id 
                  INNER JOIN jobs D ON B.FK_orders_jobs = D.job_id
                  WHERE A.FK_hourlyorders_workers='${req.body['worker_id']}'`
    // const sql = `SELECT * FROM hourly_orders WHERE status=0`
    const [result] = await con.query(sql);
    try {
      req.body['hourly_orders'] = result;
        con.release();
        next();
    } catch {
        con.release();
        res.send('error');
    }
  })
  
  /* 3. 출력 형태로 data masage */
  mypageRouter.use('/work', async (req, res, next) => {
    console.log(req.body);
    let send_data = new Array();
  
    let len = req.body['hourly_orders'].length;
    let tmp;
    let check = {};
    let idx = 0;
    for (let i = 0; i < len; i++) {
      let key = new Array();
      tmp = req.body['hourly_orders'][i];
      key.push(masageDateToYearMonthDay(tmp['work_date']));
      key.push(tmp['name']);
      key.push(tmp['type']);
      key.push(tmp['address']);
  
      /* 이미 저장된 key인지 확인 */
      if (!check.hasOwnProperty(key)) {
        send_data.push(key);
        check[Object.assign(new Array(), key)] = idx;
        idx += 1;
      }
      
      /* send_data['key']에 key: value 데이터 삽입 */
      send_data[check[key]].push(
        // 'hour': masageDateToHour(tmp['start_time']),
        // 'price': tmp['min_price'],
        // 'id': tmp['hourlyorders_id']
        masageDateToHour(tmp['start_time'])+','+tmp['min_price'].toString()
      )
      
      // send_data[key].push({
        //   'start_time': masageDateToHour(tmp['start_time']),
        //   'price': tmp['min_price'],
        //   'id': tmp['hourlyorders_id']
        // })
  
      /* send_data['address']에 '가게이름':'가게주소' 삽입 */
      // if (!send_data['address'].hasOwnProperty(tmp['name']))
      //   send_data['address'][tmp['name']] = tmp['address'];    
    }
    console.log(check)
  
    // /* key 별 시급 총합 계산 */
    // for (let i = 0; i < send_data['key'].length; i++) {
    //   let key = send_data['key'][i];
    //   let total_price = 0;
  
    //   for (let j = 0; j < send_data[key].length; j++) {
    //     total_price += send_data[key][j]['price'];  
    //   }
  
    //   /* key 끝에 시급 총합 붙이기 */
    //   // '2022-08-20,커피커피,서빙,20510'
    //   send_data['key'][i] += ','+total_price.toString();
    // }
  
    /* 결과 전송 */
    res.send(send_data);
  })
  

/* 마이페이지 - 합격한 곳 */
/* input  { 'email': 'dngp93@gmail.com' } */

/* 1. qualifications 테이블에서 worker_id로 FK_qualifications_stores 가져오기 */
mypageRouter.post('/myStore', async (req, res, next) => {
    console.log(req.body)
    const con = await pool.getConnection(async conn => conn);
    const sql = `SELECT FK_qualifications_stores AS store_id FROM qualifications 
                  WHERE FK_qualifications_workers='${req.body['worker_id']}'`
    const [result] = await con.query(sql);
    let store_ids = Array();
    for (let i = 0; i < result.length; i++) {
      store_ids.push(result[i]['store_id'])
    }
  
    req.body['store_ids'] = store_ids;
    con.release();
    next();
  })
  
  /* 2. stores 테이블에서 store_id에 해당하는 name, address 가져오기 */
mypageRouter.use('/myStore', async (req, res) => {
    const con = await pool.getConnection(async conn => conn);
    const sql = `SELECT store_id, name, address 
                 FROM stores 
                 WHERE store_id IN (${req.body['store_ids']})`;
    const [result] = await con.query(sql);
  
    /* 3. store_job_lists 테이블에서 store_id에 해당하는 job_id 가져오기 */
    const sql2 = `SELECT A.FK_store_job_lists_stores AS store_id, B.type
                  FROM store_job_lists A
                  INNER JOIN jobs B ON A.FK_store_job_lists_jobs = B.job_id
                  WHERE FK_store_job_lists_stores IN (${req.body['store_ids']})`;
    const [result2] = await con.query(sql2);
    
    /* 4. masage */
    let types = {};
    let store_id;
    for (let i = 0; i < result2.length; i++) {
      store_id = result2[i]['store_id'];
      if (!types.hasOwnProperty(store_id))
        types[store_id] = Array();
      types[store_id].push(result2[i]['type']);
    }
    
    for (let i = 0; i < result.length; i++) {
      result[i]['types'] = types[result[i]['store_id']];
    }
    
    /* result에 최종 send 형태로 담았음 */
    console.log(result);
    con.release();
    res.send(result);
  })


// 마이페이지 - 면접시간표
// 'worker_id' : 1
mypageRouter.post('/interview', async (req, res) => {
    console.log('mypage:', req.body)
    const con = await pool.getConnection(async conn => conn);
    worker_id = req.body['worker_id'];
    cards = [];
    // console.log(worker_id);
    const sql = `SELECT a.interview_id, a.FK_interviews_stores, a.interview_date, a.FK_interviews_interview_times, 
    a.reject_flag, a.result_flag, a.link, a.state, b.name, b.address, c.time
    From interviews as a, stores as b, interview_times as c 
    where a.FK_interviews_stores = b.store_id and a.FK_interviews_interview_times = c.interview_time_id 
    and FK_interviews_workers = ${worker_id} order by state, interview_date, time;`;
    const [result] = await con.query(sql);
    n = result.length;
    pre_state = 0;
  
    const worker_sql = `SELECT name FROM workers WHERE worker_id = ${worker_id};`
    const [result_worker] = await con.query(worker_sql);
    worker_name = result_worker[0]['name'];
    console.log(worker_name);
    for (let i = 0; i < n; i++) {
      store_id = result[i]['FK_interviews_stores'];
  
      const type_sql = `SELECT type FROM store_job_lists JOIN jobs 
      ON store_job_lists.FK_store_job_lists_jobs = jobs.job_id 
      WHERE store_job_lists.FK_store_job_lists_stores = ${store_id};`;
      const [result_type] = await con.query(type_sql);
  
      date = result[i]['interview_date'].toISOString();
      interview_date = date.split('T')[0];
      interview_time = result[i]['time'];
      reject_flag = result[i]['reject_flag'];
      result_flag = result[i]['result_flag'];
      link = result[i]['link'];
      state = result[i]['state'];
      interview_id = result[i]['interview_id'];
      store_name = result[i]['name'];
      store_address = result[i]['address'];
      store_type = result_type.map(result_type => result_type['type']);
  
      card = {
          'interview_date': interview_date,
          'interview_time': interview_time,
          'reject_flag': reject_flag,
          'result_flag': result_flag,
          'link': link,
          'state': state,
          'interview_id': interview_id,
          'store_name': store_name,
          'store_address': store_address,
          'store_type': store_type
      };
      if (cards) {
          cards.push(card);
      } else {
          cards = [card];
      }
    }
    let response = {
            'name': worker_name,
            'result': cards
        }
        // console.log(response);
    con.release();
    res.send(response);
});
  

module.exports = mypageRouter;

/************************ function *************************/

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