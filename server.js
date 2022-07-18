const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const mysql = require("mysql2/promise");
const path = require('path');
const nodeGeocoder = require('node-geocoder');
const app = express();
const PORT = process.env.PORT || 4000;

/* console.log depth에 필요 */
let util = require('util');
// const { off } = require("process");

/* 구글 map api */
const options = {
  provider: 'google',
  apiKey: 'AIzaSyAHZxHAkDSHoI-lJDCg5YfO7bLCFiRBpaU' // 요놈 넣어만 주면 될듯?
};
const geocoder = nodeGeocoder(options);

const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "Rhd93!@#$~",
  database: "gig_time",
  connectionLimit: 10
});

// const con = mysql.createConnection({
//   host: "localhost",
//   user: "root",
//   password: "Rhd93!@#$~",
//   database: "gig_time",
// });

// con.connect(async function (err) {
//   if(err) throw err;
//   console.log('Connected!');
// });

app.use(bodyParser.urlencoded({ extended: false }));
app.use(cors());
app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.send({ hello: "Hello react" });
});

/* 이미 가입된 email인지 체크 
	input
  {
    'email': 'dngp93@gmail.com'
  }
  output
    'owner' or 'worker' or 'NONE' */ 

/* owners 테이블 체크 */
app.post('/check/member', async (req, res, next) => {
  console.log(req.body['email']);
  if (await checkOwner(req.body['email']) > 0) {
    const con = await pool.getConnection(async conn => conn);
    const sql = `SELECT owner_id FROM owners WHERE email='${req.body['email']}'`
    const [result] = await con.query(sql);
    let send_array = {
      'member_type': 'owner', 
      'owner_id': result[0]['owner_id']
    }
    res.send(send_array);
  }
  else 
    next();
});

/* workers 테이블 체크 */
app.use('/check/member', async (req, res) => {
  if (await checkWorker(req.body['email']) > 0) {
    const con = await pool.getConnection(async conn => conn);
    const sql = "SELECT worker_id, `range`, location FROM workers WHERE email=?"
    const [result] = await con.query(sql, req.body['email']);
    let send_array = {
      'member_type': 'worker', 
      'worker_id': result[0]['worker_id'], 
      'address': result[0]['location'],
      'range': result[0]['range']
    }
    con.commit();
    con.release();
    res.send(send_array);
  }
  else {
    res.send('NONE')
  }
});


/********************************************************
 *                        worker                        *
 *******************************************************/ 

/*  */
/* name, email 정보 전달 받아서 worker table에 insert 
  data form === 
  {
		'name': 'kantwang',
		'email': 'dngp93@gmail.com',
		'location': '서울시 관악구 성현동 블라블라',
		'range': 234
  } */

/* 1. workers 테이블에 INSERT */
app.post('/worker/signup', getPos, async (req, res, next) => {
  const con = await pool.getConnection(async conn => conn);
  const sql = "INSERT INTO workers SET ?";
  await con.query(sql, req.body);
  next();
})

/* 2. workers 테이블에서 email로 worker_id 찾아서 send */
app.use('/worker/signup', async (req, res) => {
  const con = await pool.getConnection(async conn => conn);
  const sql = "SELECT worker_id FROM workers WHERE email=?";
  const [result] = await con.query(sql, req.body['email']);
  res.send(result[0]['worker_id'].toString())
})

/* worker의 email을 받아서 id를 return */
/*
  input
  {
    'email': 'dngp93@gmail.com'
  }
  output
  1
*/
app.post('/worker/id', async (req, res) => {
  const con = await pool.getConnection(async conn => conn);
  const sql = "SELECT worker_id FROM workers WHERE email=?";

  const [result] = await con.query(sql, req.body['email'])
  try {
    res.send(result[0]['worker_id'].toString());
  } catch {
    res.send('error');
  }
})

/* 주소 정보 전달 받아서 worker table update
  data form === 
  {
    'email': 'dngp93@gmail.com', 
    'location': '서울시 관악구 성현동'
  } */
app.post('/worker/location/update', getPos, async (req, res, next) => {
  const con = await pool.getConnection(async conn => conn);
  try{        
      const sql = "UPDATE workers SET location=?, latitude=?, longitude=? WHERE email=?";
      const [result] = await con.query(sql, [req.body['location'], req.body['latitude'], req.body['longitude'], req.body['email']])
      console.log('end of post');
      con.release();
      next();
      // res.send('success');
  }
  catch{
    con.release();
    res.send('error - update workers');        
  }
})
app.use('/worker/location/update', async (req, res) => {
  console.log(req.body)
  const con = await pool.getConnection(async conn => conn);
  console.log('start use');
  let msg = "";
  // console.log('msg?');
  try{
      // console.log('try?');
      msg = "select worker_id";
      // console.log('msg?');
      const sql = `SELECT worker_id from workers where email='${req.body['email']}';`;
      const [result] = await con.query(sql);
      console.log('result:',result);

      msg = 'create store_list';
      const sql_store_list = `CREATE OR REPLACE VIEW ${result[0]['worker_id']}_store_list AS 
      select store_id as list_id, name, minimum_wage, get_distance(latitude, ${req.body['latitude']}, longitude-${req.body['longitude']}) AS distance
      from stores;`;
      const [result_store_list] = await con.query(sql_store_list);
      console.log('1. ',result_store_list);
      
      msg = 'create store_qualified';
      const sql_store_qualified = `create or replace view ${result[0]['worker_id']}_store_qualified as
      select a.store_id, a.name, a.description, a.logo, a.background, a.address, b.name owner_name, b.phone
      from stores a, owners b, ${result[0]['worker_id']}_store_list c
      where c.distance < 1000 and a.name = c.name and a.FK_stores_owners = b.owner_id 
      and a.store_id in (select FK_qualifications_stores from qualifications where FK_qualifications_workers = ${result[0]['worker_id']}); `;
      const [result_store_qualified] = await con.query(sql_store_qualified);        
      console.log('2. ',result_store_qualified[0]);
      
      msg = 'create store_unqualified';
      const sql_store_unqualified = `create or replace view ${result[0]['worker_id']}_store_unqualified as
      select a.store_id, a.name, a.description, a.logo, a.background, a.address, b.name owner_name, b.phone
      from stores a, owners b, ${result[0]['worker_id']}_store_list c
      where c.distance < 1000 and a.name = c.name and a.FK_stores_owners = b.owner_id 
      and a.store_id not in (select FK_qualifications_stores from qualifications where FK_qualifications_workers = ${result[0]['worker_id']}); `;
      const [result_store_unqualified] = await con.query(sql_store_unqualified);        
      console.log('3. ', result_store_unqualified[0]);      
      
      msg = 'create order_list';
      const sql_order_list = `create or replace view ${result[0]['worker_id']}_order_list as
      select c.name, a.order_id, a.min_price, 
      b.hourlyorders_id, b.work_date, b.start_time, b.dynamic_price, d.type
      from orders a 
      join hourly_orders b on a.order_id = b.FK_hourlyorders_orders
      join ${result[0]['worker_id']}_store_qualified c on a.FK_orders_stores = c.store_id
      join jobs d on a.FK_orders_jobs = d.job_id; `;
      const [result_order_list] = await con.query(sql_order_list);
      console.log('4. ',result_order_list[0]);

      con.release();
      res.send('success');
  }
  catch{
    con.release();
    console.log('catch');
    res.send(`error - ${msg}`);
  }
});

/* 거리 정보 전달 받아서 worker table update
   data form === 
  {
    'worker_id': 1, 
    'range': 424
  } */
app.post('/worker/range/update', async (req, res) => {
  const con = await pool.getConnection(async conn => conn);
  const sql = "UPDATE workers SET range=? WHERE worker_id=?";
  try {
    await con.query(sql, req.body);
    res.send('success');
  } catch {
    res.send('error');
  }
})

/* worker의 location 정보 send */
app.post('/worker/location', async (req, res) => {
  const con = await pool.getConnection(async conn => conn);
  const sql = "SELECT `location` FROM workers WHERE email=?";
  try {
    const [result] = await con.query(sql, req.body['email']);
    res.send(result[0]['location']); 
  } catch {
    res.send('error');
  }
});

/* worker의 range 정보 send */
app.post('/worker/range', async (req, res) => {
  const con = await pool.getConnection(async conn => conn);
  const sql = "SELECT `range` FROM workers WHERE email=?";
  const [result] = await con.query(sql, req.body['email'])
  try {
    res.send(result[0]['range'].toString()); // string 형태로만 통신 가능
  } catch {
    res.send('error');
  }
});

/* 알바 예약 페이지 */
/* 페이지 로딩 시 뿌려주는 데이터 */
/* 
{
  'order_id': 2, 
  'work_date': '2022-08-20 00:00:000Z', 
  'type': '설거지'
} */
// app.post('/worker/reservation/list', async (req, res, next) => {
//   console.log(req.body);
//   const con = await pool.getConnection(async conn => conn);
//   const sql = "SELECT job_id FROM jobs WHERE type=?"
//   req.body['work_date'] = masageDateToYearMonthDay(req.body['work_date']);
//   try {
//     const [result] = await con.query(sql, req.body['type'])
//     req.body['job_id'] = result[0]['job_id'];
//     next();
//   } catch {
//     res.send('error');
//   }
// })

// app.use('/worker/reservation/list', async (req, res) => {
//   const con = await pool.getConnection(async conn => conn);
//   const sql = `SELECT hourlyorders_id, dynamic_price, min_price, start_time FROM hourly_orders A
//                       INNER JOIN orders B ON A.FK_hourlyorders_orders = B.order_id
//                       WHERE order_id=? AND work_date=? AND FK_orders_jobs=?`;
//   try{
//     const [result] = await con.query(sql, [req.body['order_id'],req.body['work_date'],req.body['job_id']])
//     console.log(result);
//     res.send(result)
//   } catch {
//     res.send('error');
//   }
// })

/* 
{
  'worker_id': 2,
  'order_id': 2, 
  'work_date': '2022-08-20', 
//   'type': '설거지'
} */
app.post('/worker/reservation/list', async (req, res) => {
  console.log(req.body)
    const con = await pool.getConnection(async conn => conn);
    let msg = '';
    // let work_date = masage_date(req.body['work_date']);
    const worker_id = req.body['worker_id'];
    const order_id = req.body['order_id'];
    let work_date = req.body['work_date'];
    // console.log(req.body);

    try{
        // 1. store_id 찾아서        
        msg = 'select store_id';
        const sql = `SELECT FK_orders_stores FROM orders where order_id = ${order_id};`;
        const [result] = await con.query(sql);
        console.log('result : ',result);
        
        // 2. qualified에서 store정보 가져오고
        msg = 'select qualified';
        const sql_qualified = `select * from ${worker_id}_store_qualified where store_id = ${result[0]['FK_orders_stores']};`;
        const [result_qualified] = await con.query(sql_qualified);
        console.log('result_qualified : ', result_qualified);
        
        let store = {
            'name': result_qualified[0]['name'],
            'address': result_qualified[0]['address'],
            'description': result_qualified[0]['description'],
            'logo': result_qualified[0]['logo'],
            'background': result_qualified[0]['background'],
            'owner_name': result_qualified[0]['owner_name'],
            'owner_phone': result_qualified[0]['phone']
        };
        console.log('store : ', store);

        // 3. order_list에서 order정보 가져오고
        msg = 'select order_list';
        const sql2 = `SELECT hourlyorders_id, dynamic_price, min_price, start_time, type FROM ${worker_id}_order_list
        WHERE order_id=${req.body['order_id']} AND work_date='${work_date}';`;
        const [orders] = await con.query(sql2);
        console.log('order : ', orders);
        res.send({'store':store, 'order':orders});
    }
    catch{
        res.send(`error - ${msg}`);
    }
    
})


/* 알바 예약 페이지 */
/* 예약하기 클릭 시 hourly_orders 테이블에 worker_id 기입, closing_time 기입 */
/* 한 order의 hourly_orders가 전부 예약 되었다면, order의 status=1로 UPDATE */ 
/* 
{
    'worker_id': 2, 
    'hourlyorders_id': [5, 6, 7, 8, 9]
} */
app.post('/worker/reservation/save', async (req, res) => {
  console.log(req.body)
  const con = await pool.getConnection(async conn => conn);
  const sql = "UPDATE hourly_orders SET FK_hourlyorders_workers=?, closing_time=? WHERE hourlyorders_id=?";

  for (let i = 0; i < req.body['hourlyorder_id'].length; i++) {
    let tmp = new Date().getTime();
    let timestamp = new Date(tmp);
    /* check! 쿼리를 한 번만 실행해서 해당 column 모두 UPDATE 하는 방법은? */
    await con.query(sql, [req.body['worker_id'], timestamp, req.body['hourlyorder_id'][i]]); 
  }
  check_all_hourlyorders_true(req.body['hourlyorder_id'][0]);
  res.send('success');
})

/* 알바 모집 정보 return (지정 거리 이내)
   data form === 
  {
    'worker_id': 1
  } */
// app.post('/worker/show/hourly_orders', async (req, res, next) => {
//   console.log(req.body);
//   const con = await pool.getConnection(async conn => conn);
//   /* 1. 해당 order에 해당하는 hourly_order 가져오기. */
//   // FK_hourlyorders_workers === NULL인 것만.
//   const sql = `SELECT * FROM hourly_orders A 
//                   INNER JOIN orders B ON A.FK_hourlyorders_orders = B.order_id 
//                   INNER JOIN stores C ON B.FK_orders_stores = C.store_id 
//                   INNER JOIN jobs D ON B.FK_orders_jobs = D.job_id
//                   WHERE FK_hourlyorders_orders IN 
//                   (SELECT order_id FROM orders 
//                       WHERE FK_orders_stores IN 
//                       (SELECT store_id FROM stores WHERE store_id IN 
//                           (SELECT FK_qualifications_stores FROM qualifications 
//                               WHERE FK_qualifications_workers=?)) AND status=0)`
//   try {
//     const [valid_hourly_orders] = await con.query(sql, req.body['worker_id']);
//     req.body['valid_hourly_orders'] = valid_hourly_orders;
//     next();
//   } catch {
//     res.send('error');
//   }  
// });

// /* 2. worker의 latitude, longitude 가져오기 */
// app.use('/worker/show/hourly_orders', async (req, res) => {
//   const con = await pool.getConnection(async conn => conn);
//   const sql = `SELECT latitude, longitude FROM workers WHERE worker_id=?`;
//   const [result] = await con.query(sql, req.body['worker_id']);
//   console.log('서버 들어옴');
//   res.send(masage_data(result[0]['latitude'], result[0]['longitude'], req.body['valid_hourly_orders']));
// });

app.post('/worker/show/hourly_orders', async(req, res) => {
  console.log(req.body)
  const con = await pool.getConnection(async conn => conn);
  let msg = '';
  const worker_id = req.body['worker_id'];
  try{
      msg = 'select range';
      const sql ='SELECT `range` FROM workers WHERE worker_id=?';
      const [result] = await con.query(sql, worker_id);
      console.log('result: ',result);
      
      msg = 'select order_list';
      const sql_orders = `select * from ${worker_id}_order_list a join ${worker_id}_store_list b on a.name = b.name where b.distance < ${result[0]['range']};`;
      const [valid_hourly_orders] = await con.query(sql_orders);
      // console.log('valid: ', valid_hourly_orders);
      /* worker의 latitude, longitude 가져오기 */
      msg = 'masage data';
      let orders = masage_data(valid_hourly_orders);
          
      // console.log('orders: ', orders);
      res.send(orders);
  }
  catch{
      res.send(`error - ${msg}`);
  }

});

/* 최적의 알바 추천 */
/* 
  data form
  {
    'worker_id': 1,
    'work_date': '2022-08-20',
    'start_times': 
      [
        "2022-08-20 10:00:00", 
        "2022-08-20 11:00:00",
        "2022-08-20 12:00:00"
      ]
  }
*/
app.post('/worker/suggestion', async (req, res) => {
  const con = await pool.getConnection(async conn => conn);
  /* 
    hourly_orders 테이블고 orders 테이블을 JOIN 한 후, 
    work_date와 worker_id, start_time 그리고 worker가 권한을 가지고 있는 store로 필터하여 SELECT
  */
  const sql = `SELECT * FROM hourly_orders A 
                INNER JOIN orders B ON A.FK_hourlyorders_orders = B.order_id
                INNER JOIN stores C ON B.FK_orders_stores = C.store_id
                WHERE A.FK_hourlyorders_workers IS Null AND A.work_date=? AND A.start_time IN (?) 
                AND B.FK_orders_stores IN
                (SELECT store_id FROM stores WHERE store_id IN 
                  (SELECT FK_qualifications_stores FROM qualifications 
                    WHERE FK_qualifications_workers=?))`;
  const [result] = await con.query(sql, [req.body['work_date'], req.body['start_times'], req.body['worker_id']]);
    // console.log('모든 개수: ' + result.length);
  suggestion(req.body['worker_id'], result, req.body['start_times']);
})

/* bruteforce 방식의 suggestion 함수 */
/* 이때, 거리 상관 없이 모든 hourly_order가 들어온다 */
async function suggestion(worker_id, hourly_orders, start_times)
{
  const con = await pool.getConnection(async conn => conn);
  const sql = "SELECT `range`, `latitude`, `longitude` FROM workers WHERE worker_id=?"
  const [result] = await con.query(sql, worker_id); 
  let range = result[0]['range'];
  let latitude = result[0]['latitude'];
  let longitude = result[0]['longitude'];
  let times_count = start_times.length;
    
  /* 우선, range 이내의 hourly_order를 가져오자. */
  let hourly_orders_sliced = getInnerRange(latitude, longitude, range, hourly_orders);
  // console.log('총 개수: ' + hourly_orders_sliced.length);
  // console.log(hourly_orders_sliced);

  /* 이제 들어온 시간 별로 나눠야 한다. */
  let hourly_orders_divided_by_start_time = {};
  for (let i = 0; i < times_count; i++) 
  {
    let tmp = new Date(start_times[i]);
    hourly_orders_divided_by_start_time[tmp] = Array();
  }
  // console.log(hourly_orders_divided_by_start_time);

  /* 각 시간에 해당하는 hourorders_id를 모두 push. min_price와 함께 */
  /* 여기서 idx와 id의 연결 관계를 만들어주자 */
  let id_idx = {};
  for (let i = 0; i < hourly_orders_sliced.length; i++)
  {
    let tmp = new Date(hourly_orders_sliced[i]['start_time']);
    hourly_orders_divided_by_start_time[tmp].push({
      'idx': i,
      'id': hourly_orders_sliced[i]['hourlyorders_id'],
      'price': hourly_orders_sliced[i]['min_price']
    });
    id_idx[hourly_orders_sliced[i]['hourlyorders_id']] = i;
  }
  
  /* 이제 각 시간별로 min_price 순으로 정렬하자, 앞에 올수록 가격이 높아지도록 */
  // 참고로, hourly_orders_sliced 이 안에 다 있다.
  for (let i = 0; i < times_count; i++) {
    let tmp = new Date(start_times[i]);
    hourly_orders_divided_by_start_time[tmp].sort(function(a, b) {
      var price_A = a.price;
      var price_B = b.price;

      if (price_A < price_B) return 1;
      if (price_A > price_B) return -1;
      return 0;
    })
  }

  /* 재귀 방식 - dp 코드 추가 전이라 안돌아감 */
  // let max = recur(0, start_times, latitude, longitude, hourly_orders_divided_by_start_time, hourly_orders_sliced, 0);

  /* 완성된 방식 - 브루트포스 + dp */
  let queue = Array(); // [depth, latitude, longitude, revenue, visit, total_move]
  let key = new Date(start_times[0]);
  for (let i = 0; i < hourly_orders_divided_by_start_time[key].length; i++) {
    let short = hourly_orders_divided_by_start_time[key][i];
    let move_first = getDistance(latitude, 
                                  longitude, 
                                  hourly_orders_sliced[short['idx']]['latitude'],
                                  hourly_orders_sliced[short['idx']]['longitude']);
    queue.push([1, 
                hourly_orders_sliced[short['idx']]['latitude'],
                hourly_orders_sliced[short['idx']]['longitude'],
                short['price'] - move_first * 2.5,
                [short['id']],
                move_first]); // 비트마스킹으로 하자
  }
    
  let answer = 0;
  let answer_move = 0;
  let answer_visit = [];
  let dp = {};

  /* 터미널에 보기 좋게 출력 */
  console.log();
  console.log("**************************************")
  console.log("*                                    *")
  console.log("*            알바시간표추천          *")
  console.log("*                                    *")
  console.log('*          근로일시: 2022-08-20      *');
  console.log('*          모집시간: ' + start_times.length + '시간          *');
  console.log("*                                    *")
  console.log("**************************************")
  console.log()
  console.log();
  console.log('------------- 추천 시작 -------------')
  while (queue.length > 0) 
  {
    let now = queue.shift(); // popleft
    let depth = now[0];
    let latitude = now[1];
    let longitude = now[2];
    let revenue = now[3];
    let visit = Object.assign(Array(), now[4]);
    // visit.push(now[4]);
    let total_move = now[5];
    
    /* 탈출 조건 */
    if (depth === times_count)
    {
      if (answer < revenue) {
        let before = answer;
        answer = revenue;
        answer_move = total_move;
        answer_visit = Object.assign(Array(), visit);
        if (before > 0)
          console.log('   ' + answer + '원     -->     ' + (answer-before) + '원 증가!');
        else
          console.log('   ' + answer + '원');
      }
      continue;
    }

    let key = new Date(start_times[depth]);
    let len = hourly_orders_divided_by_start_time[key].length;

    for (let i = 0; i < len; i++) {
      let short = hourly_orders_divided_by_start_time[key][i];
      let next_latitude = hourly_orders_sliced[short['idx']]['latitude'];
      let next_longitude = hourly_orders_sliced[short['idx']]['longitude'];
      let next_visit = Object.assign(Array(), visit);
      /* 거리를 계산하자 */
      let move = getDistance(latitude, 
                              longitude,
                              next_latitude,
                              next_longitude);
      
      /* 다음 revenue를 계산하자 */
      let next_revenue = revenue + short['price'] - move * 2.5;

      /* dp 값 업데이트 및 continue 처리 */
      if (!dp.hasOwnProperty([depth, i]))
        dp[[depth, i]] = next_revenue;
      else
      {
        if (dp[[depth, i]] > next_revenue) continue;
        else dp[[depth, i]] = next_revenue;
      }

      /* visit 처리 */
      next_visit.push(short['id']);
      
      /* queue에 삽입 */ 
      // [depth, latitude, longitude, revenue, visit]
      queue.push([depth+1, 
                  next_latitude,
                  next_longitude,
                  next_revenue,
                  next_visit,
                  total_move+move]);
      
    }
  }
  console.log();
  console.log('------------- 추천 결과 -------------')
  console.log('1. 최고수익: ' + answer + '원');
  console.log('2. 이동거리: ' + answer_move + 'm');
  console.log('3. 방문순서');

  
  for (let i = 0; i < answer_visit.length; i++)
  {
    let idx = id_idx[answer_visit[i]];
    console.log('   ' + start_times[i] + ' -- ' + hourly_orders_sliced[idx]['name']);
  }
}

/********************************************************
 *                        store                         *
 *******************************************************/ 

/* 면접 가능한 매장 정보를 return (지정 거리 이내) 
  data form === 
  {
    'worker_id': 1
  } */
// app.post('/store/list', async (req, res) => {
//   console.log(req.body);
//   const con = await pool.getConnection(async conn => conn);
//   const sql = "SELECT `latitude`, `longitude`, `range` FROM workers WHERE worker_id=?";
//   /* 1. 해당 worker의 위도, 경도, 거리 설정 정보 가져오기 */
//   const [worker_info] = await con.query(sql, req.body['worker_id']);
//   console.log(worker_info);
      
//   /* 2. store 정보 모두 가져오기 */
//   // 내게 권한 없는 정보만 가져와야 한다. 어떻게?
//   const sql2 = "SELECT * FROM stores WHERE store_id NOT IN (SELECT FK_qualifications_stores FROM qualifications WHERE FK_qualifications_workers=?)";
//   const [stores_info] = await con.query(sql2, req.body['worker_id']);
//   console.log(stores_info);
      
//   /* 3. 거리 계산해서 send할 배열 생성 */
//   let stores = getStore(worker_info[0]['latitude'], worker_info[0]['longitude'], worker_info[0]['range'], stores_info);  
//   console.log(stores);
//   res.send(stores);
// });

app.post('/store/list', async (req, res, next) => {
  const con = await pool.getConnection(async conn => conn);
  let msg = '';
  const worker_id = req.body['worker_id'];
  try{
      /* 해당 worker의 위도, 경도, 거리 설정 정보 가져오기 */
      msg = 'select range';
      const sql ='SELECT `range` FROM workers WHERE worker_id=?';
      const [result] = await con.query(sql, worker_id);
      // req.body['worker_range'] = result[0]['range'];
      console.log('result:',result);
      
      msg = 'select unqualified';
      const sql_unqualified =`select a.*, b.name, b.minimum_wage, b.distance from ${worker_id}_store_unqualified a join ${worker_id}_store_list b on a.store_id = b.list_id 
      where b.distance < ${result[0]['range']} ;`;
      const [result_unqualified] = await con.query(sql_unqualified);
      delete result_unqualified['list_id'];
      
      res.send(result_unqualified);
      // // console.log('result_unqualified:',result_unqualified);      

      // n = result_unqualified.length;
      // console.log(n);
      // let store = []
      // for(i=0; i<n; i++){
      //     respon = {
      //         "store_id": result_unqualified[i]['store_id'],
      //         "name": result_unqualified[i]['name'],
      //         "address": result_unqualified[i]['address'],
      //         "description": result_unqualified[i]['description'],
      //         "logo": result_unqualified[i]['logo'],
      //         "minimum_wage": result_unqualified[i]['minimum_wage'],
      //         "distance": result_unqualified[i]['distance']
      //         // "owner_name": result_unqualified[i]['owner_name'],
      //         // "owner_phone": result_unqualified[i]['phone']
      //         // "background": result_unqualified[i]['background'],
      //     }
      //     store.push(respon);
      //     // console.log(i);
      //     // console.log(store[i]);
      //     // console.log(result_unqualified[i]);
      // }
      // console.log(store);
      // res.send(store);
      // next();
  }
  catch{
      res.send(`error - ${msg}`);
  }
});

/* 주소 정보 전달 받아서 store table update
  data form === 
  {
    'FK_stores_owners': 2, 
    'location': '서울시 관악구 성현동'
  } */
  app.post('/store/address/update', getPos, async (req, res) => {
    const con = await pool.getConnection(async conn => conn);
    const sql = "UPDATE stores SET address=?, latitude=?, longitude=? WHERE FK_stores_owners=?";
    try {
      await con.query(sql, [req.body['location'], req.body['latitude'], req.body['longitude'], req.body['FK_stores_owners']]);
      res.send('success');
    } catch {
      res.send('error');
    }
})

/********************************************************
 *                        owner                         *
 *******************************************************/  

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
app.post('/owner/signup', getPos, async (req, res) => {
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
app.use('/owner/mypage/employment/button', async (req, res, next) => {
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
app.use('/owner/mypage/employment/button', getJobIdByStoreId, async (req, res) => {
  delete req.body['email'];
  delete req.body['owner_id'];
  delete req.body['store_id'];
  res.send(req.body);
})

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

/*************************************
 * 모집공고 작성 페이지의 등록하기 버튼 *
 *************************************/
/* 
  input form
  {
    'owner_id': 60,
    'store_name': '보리누리',
    'type': '설거지',
    'description': '설거지 알바 모집합니다',
    'start_date': '2022-08-20',
    'end_date': '2022-08-22',
    'start_time': '10:00',
    'end_time': '14:00',
    'price': 10000 
  }
*/

// /* 1. owners 테이블에서 email로 owner_id 가져오기 */
// app.post('/owner/employment', getOwnerIdByEmail, async (req, res, next) => { next(); })

/* 2. stores 테이블에서 owner_id로 store_id 가져오기 */
app.use('/owner/employment', getStoreIdByOwnerId, async (req, res, next) => { 
  console.log(req.body)
  next(); 
})

/* 3. jobs 테이블에서 type으로 job_id 가져오기 */
app.use('/owner/employment', getJobIdByType, async (req, res, next) => { next(); })

/* 4. orders 테이블에 INSERT */
app.use('/owner/employment', async (req, res, next) => {
  const con = await pool.getConnection(async conn => conn);

  try {
    const sql = "INSERT INTO orders SET FK_orders_stores=?, request_date=?, FK_orders_jobs=?, description=?, min_price=?, status=?";
    let request_date = new Date();
    await con.query(sql, [req.body['store_id'], request_date, req.body['job_id'], req.body['description'], req.body['price'], 0])
    req.body['request_date'] = request_date;
    con.release();
    next();
  }
  catch {
    con.release();
    console.log('error 4');
  }
})

/* 5. orders 테이블에서 request_date로 order_id 가져오기 */
app.use('/owner/employment', async (req, res, next) => {
  const con = await pool.getConnection(async conn => conn);

  try {
    // const sql = "SELECT order_id FROM orders WHERE request_date=?"; // 이거 request_date로 하면 안된다. 마지막 행을 읽자
    const sql = "SELECT order_id FROM orders ORDER BY order_id DESC LIMIT 1";
    /* check! */
    // 마지막 행을 읽는데 만약 여기서 다른 request가 들어와서 마지막이 아니게 된다면?
    // 그럴 수 있나? 그럴 수 있다면, 해결책은?
    const [result] = await con.query(sql, masageDateToYearMonthDayHourMinSec(req.body['request_date']));
    req.body['order_id'] = result[0]['order_id']; // result[0]인 것 주의
    con.release();
    next();
  }
  catch {
    con.release();
    console.log('error 5');
  }
})

/* 6. hourly_orders 테이블에 INSERT */
app.use('/owner/employment', async (req, res) => {
  const con = await pool.getConnection(async conn => conn);

  /* 6-1. 총 일수 계산 */
  let start_date = new Date(req.body['start_date']);
  let end_date = new Date(req.body['end_date']);
  let day = Math.abs((end_date - start_date) / (1000 * 60 * 60 * 24)) + 1; // 1000ms * 60s * 60m * 24h

  /* 6-2. 시작, 끝 시간 계산 */
  let start_hour = Number(req.body['start_time'].split(':')[0]);
  let end_hour = Number(req.body['end_time'].split(':')[0]);
  let hour = end_hour - start_hour;
  
  /* 6-3. for문 돌면서 hourly_orders 테이블에 INSERT */
  try {
    // const sql = "INSERT INTO hourly_orders SET FK_hourlyorders_orders=?, work_date=?, start_time=?"; 
    const sql = "INSERT INTO hourly_orders (FK_hourlyorders_orders, work_date, start_time) VALUES ?";
    let order_id = req.body['order_id'];
    let date = new Date(start_date);
    
    /* 시간을 담은 배열 생성 */
    let all_hours = Array();
    for (let i = 0; i < hour; i++) {
      if (start_hour.toString().length === 1)      
        all_hours.push('0'+(start_hour+i).toString()+':00:00')
      else
        all_hours.push((start_hour+i).toString()+':00:00')
    }

    /* check! (완료) */
    /* 매번 INSERT query를 실행하면 너무 무거울 것 같은데, INSERT 한 번에 끝내는 법을 알아보자 */
    /* 날짜 순회 */
    let insert_array = Array();
    for (let i = 0; i < day; i++) {
      date.setDate(start_date.getDate()+i);
      // let work_date = new Date(masageDateToYearMonthDay(date)); // 불필요. 그냥 string으로 넣으면 된다
      // console.log(work_date);

      /* 시간 순회 */
      for (let j = 0; j < hour; j++) {
        // let start_time = new Date(masageDateToYearMonthDay(date)+' '+all_hours[j]); // 불필요.
        insert_array.push([order_id, masageDateToYearMonthDay(date), masageDateToYearMonthDay(date)+' '+all_hours[j]])
        // await con.query(sql, [order_id, masageDateToYearMonthDay(date), masageDateToYearMonthDay(date)+' '+all_hours[j]])
      }
    }
    // console.log(insert_array);
    console.log(insert_array);
    await con.query(sql, [insert_array]);
    con.release();
    res.send('success');
  } 
  catch {
    con.release();
    console.log('error 6');
  }
})

/*****************************
 * 사장님 홈 - 면접관리 페이지 *
 *****************************/

app.post('/owner/mypage/interview', async (req, res) => {
  

})


/********************************************************
 * ******************************************************
 * ******************************************************
 ********************************************************/
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
app.post('/worker/mypage/work', async (req, res, next) => {
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
    next();
  } catch {
    res.send('error');
  }
})

/* 3. 출력 형태로 data masage */
app.use('/worker/mypage/work', async (req, res, next) => {
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


/* '0000:00:00 ??:00:00.000Z' 형식을 받아서 '??:00' return */
function masageDateToHour(timestamp) {
  timestamp = new Date(timestamp);
  let hour = timestamp.getHours().toString();
  if (hour.length === 1)
    hour = '0'+hour;
  
  return hour+':00';
}

/* 마이페이지 - 합격한 곳 */
/* input  { 'email': 'dngp93@gmail.com' } */

/* 1. qualifications 테이블에서 worker_id로 FK_qualifications_stores 가져오기 */
app.post('/worker/mypage/myStore', async (req, res, next) => {
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
  next();
})

/* 2. stores 테이블에서 store_id에 해당하는 name, address 가져오기 */
app.use('/worker/mypage/myStore', async (req, res) => {
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
  res.send(result);
})

async function getWorkerIdByEmail(req, res, next) {
  const con = await pool.getConnection(async conn => conn);
  const sql = `SELECT worker_id FROM workers WHERE email='${req.body['email']}'`;
  const [result] = await con.query(sql)
  req.body['worker_id'] = result[0]['worker_id'];
  next();
}

/* 사장님 홈 - 모집내역 */
/* input { 'owner_id': 2 } */

/* 1. owners 테이블에서 owner_id로 FK_orders_stores 가져오기 */
app.post('/owner/mypage/work', getStoreIdByOwnerId, async (req, res, next) => {
  next();
})

/* 2. order 테이블에서 store_id로 order_id 배열에 담기 */
app.use('/owner/mypage/work', async (req, res, next) => {
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
app.use('/owner/mypage/work', async (req, res, next) => {
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
app.use('/owner/mypage/work', async (req, res, next) => {
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
app.post('/owner/mypage/myWorker', getStoreIdByOwnerId, async (req, res, next) => {
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

/********************************************************
 *                      function                        *
 *******************************************************/ 

/* worker가 설정한 반경 이내의 가게 정보를 return */
function getStore(latitude, longitude, range, stores_info) {
  const n = stores_info.length;
  console.log(stores_info);
  let answer = new Array();
  let tmp = 0;

  /* 이렇게 짜면 너무 너무 비효율적이다 */
  /* db 구조를 바꿔야 하나? 아니면, 탐색 방식을 개선? */
  for (let i = 0; i < n; i++) {
      tmp = getDistance(latitude, longitude, stores_info[i]['latitude'], stores_info[i]['longitude']);
      if (tmp <= range) {
          stores_info[i]['distance'] = tmp;
          answer.push(stores_info[i]);
      }
  }

  return answer;
}

/* 현재위치에서 range 이내인 info 원소만 뽑아서 return */
function getInnerRange(latitude, longitude, range, info) {
  const n = info.length;
  let answer = new Array();
  let tmp = 0;

  /* 이렇게 짜면 너무 너무 비효율적이다 */
  /* db 구조를 바꿔야 하나? 아니면, 탐색 방식을 개선? */
  for (let i = 0; i < n; i++) {
      tmp = getDistance(latitude, longitude, info[i]['latitude'], info[i]['longitude']);
      if (tmp <= range) {
          answer.push(info[i]);
      }
  }

  return answer;
}

/* 주변일감 페이지 */
/* front에 전달할 data 전처리 */
function masage_data(data) {
  let d;
  let len = data.length;
  let databox = [];
  let check = {};
  let count = 0;

  for (let i = 0; i < len; i++) {
      d = data[i];

      /* 가게 이름이 없으면 새로 만들기 */
      if (!check.hasOwnProperty(d['name'])) {
          databox.push({
              'name': d['name'],
              'minimum_wage': d['minimum_wage'],
              'distance': d['distance'],
              'key': [],
              'work_date_and_type_and_id': {}
          });
          check[d['name']] = count;
          count += 1;
      }

      /* work_date_and_type가 없으면 새로 만들기 */
      if (!databox[check[d['name']]]['work_date_and_type_and_id'].hasOwnProperty([d['work_date'], d['type'], d['order_id']])) {
          databox[check[d['name']]]['work_date_and_type_and_id'][
              [d['work_date'], d['type'], d['order_id']]
          ] = {
              'min_price': d['min_price'],
              // 'max_price': d['max_price'],
              'start_time_and_id': Array()
          };

          /* 이렇게라도 검색할 수 있게 key 목록을 주자.. */
          let date = new Date(d['work_date']);
          let n = date.getTimezoneOffset();
          databox[check[d['name']]]['key'].push([d['work_date'], d['type'], d['order_id']]);
      }

      /* start_time이 없으면 새로 만들기 */
      if (!databox[check[d['name']]]['work_date_and_type_and_id'][
              [d['work_date'], d['type'], d['order_id']]
          ]['start_time_and_id'].hasOwnProperty([d['start_time'], d['hourlyorders_id']])) {
          databox[check[d['name']]]['work_date_and_type_and_id'][
              [d['work_date'], d['type'], d['order_id']]
          ]['start_time_and_id'].push([d['start_time'], d['hourlyorders_id']]);
      }
  }
  console.log(util.inspect(databox, { depth: 20 }));
  return databox;
}

/* 두 개의 좌표 간 거리 구하기 */
function getDistance(lat1, lon1, lat2, lon2) {
  if ((lat1 == lat2) && (lon1 == lon2)) return 0;

  let radLat1 = Math.PI * lat1 / 180;
  let radLat2 = Math.PI * lat2 / 180;

  let theta = lon1 - lon2;
  let radTheta = Math.PI * theta / 180;
  let dist = Math.sin(radLat1) * Math.sin(radLat2) + Math.cos(radLat1) * Math.cos(radLat2) * Math.cos(radTheta);

  if (dist > 1) dist = 1;
  
  dist = Math.acos(dist);
  dist = dist * 180 / Math.PI;
  dist = dist * 60 * 1.1515 * 1.609344 * 1000;

  if (dist < 100) dist = Math.round(dist / 10) * 10;
  else dist = Math.round(dist / 100) * 100;
  
  return dist;
}

/* 두 좌표 간 거리 구하기 */
async function getPos(req, res, next) {
  const regionLatLongResult = await geocoder.geocode(req.body['location']);
  const Lat = regionLatLongResult[0].latitude; //위도
  const Long =  regionLatLongResult[0].longitude; //경도
  req.body['latitude'] = Lat;
  req.body['longitude'] = Long;
  next();
}

/* order의 모든 hourlyorder가 예약 된 경우, order의 status=1로 변경 */
async function check_all_hourlyorders_true(hourlyorders_id) {
  console.log('start check!');
  const con = await pool.getConnection(async conn => conn);

  /* 우선 hourlyorders_id에 딸린 FK_hourlyorders_orders를 찾아옴 */
  const sql = `SELECT FK_hourlyorders_orders FROM hourly_orders WHERE hourlyorders_id=?`;
  const [result] = await con.query(sql, hourlyorders_id);
  let order_id = result[0]['FK_hourlyorders_orders'];
      
  /* 이제 order_id에 해당하는 hourly_order를 모두 SELECT (아직 예약되지 않은 것만) */ 
  const sql2 = `SELECT * FROM hourly_orders WHERE FK_hourlyorders_orders=? AND closing_time IS Null`
  const [result2] = await con.query(sql2, order_id); 

  /* 만약 SELECT 된 것이 없다면 (모두 예약된 상태라면) */
  if (result2.length === 0) 
  {
    /* orders table의 status=1로 업데이트 */
    const sql3 = `UPDATE orders SET status=1 WHERE order_id=?`;
    try {
      await con.query(sql3, order_id);
    } catch {
      console.log('error');
    }
  }
};

/* email로 owner id 가져오기 */
async function getOwnerIdByEmail(req, res, next) {
  const con = await pool.getConnection(async conn => conn);

  try {
    const sql = "SELECT owner_id FROM owners WHERE email=?";
    const [result] = await con.query(sql, req.body['email']);
    req.body['owner_id'] = result[0]['owner_id'];
    next();
  }
  catch {
    res.send('error');
  }
}

/* owner_id로 stores 테이블에서 store id 가져오기 */
async function getStoreIdByOwnerId (req, res, next) {
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

/* '2022-08-20 00:00:000Z' 형식의 input을 '0000-00-00 00:00:00'형식으로 변환하여 리턴 */
function masageDateToYearMonthDayHourMinSec(date_timestamp) {
  let date = new Date(date_timestamp);
  let hour = date.getHours().toString();
  let min = date.getMinutes().toString();
  let sec = date.getSeconds().toString();

  if (hour.length === 1) hour = '0'+hour
  if (min.length === 1) min = '0'+min
  if (sec.length === 1) sec = '0'+sec

  return (masageDateToYearMonthDay(date_timestamp)+' '+hour+':'+min+':'+sec);
}

/* 현재 시간을 다음 양식으로 리턴: "0000-00-00 00:00:00" */
function getNowYearMonthDayHourMinSec() {
  let date = new Date();
  let year = date.getFullYear().toString();
  let month = (date.getMonth() + 1).toString();
  let day = date.getDate().toString();
  let hour = date.getHours().toString();
  let minute = date.getMinutes().toString();
  let second = date.getSeconds().toString(); 
  
  if (month.length === 1) month = '0'+month;
  if (day.length === 1) day = '0'+day;
  if (hour.length === 1) hour = '0'+hour;
  if (minute.length === 1) minute = '0'+minute;
  if (second.length === 1) second = '0'+second;
  
  return (year+'-'+month+'-'+day+' '+hour+':'+minute+':'+second);
}

/* type으로 jobs 테이블에서 job_id 가져오기 */
async function getJobIdByType(req, res, next) {
  const con = await pool.getConnection(async conn => conn);

  try {
    const sql = "SELECT job_id FROM jobs WHERE type=?";
    const [result] = await con.query(sql, req.body['type']);
    req.body['job_id'] = result[0]['job_id'];
    con.release();
    next();
  }
  catch {
    res.send('error');
  }
}

/* owners 테이블에 존재하는 email이면 1, 아니면 0 */
async function checkOwner(email) {
  const con = await pool.getConnection(async conn => conn);
  
  /* 우선 owners db 확인 (더 적으니까) */
  const sql = `SELECT * FROM owners WHERE email=?`;
  const [result] = await con.query(sql, email);
  if (result.length > 0) return 1;
  else return 0;
}

/* workers 테이블에 존재하는 email이면 1, 아니면 0 */
async function checkWorker(email) {
  const con = await pool.getConnection(async conn => conn);

  /* 우선 owners db 확인 (더 적으니까) */
  const sql = `SELECT * FROM workers WHERE email=?`;
  const [result] = await con.query(sql, email);
  if (result.length > 0) return 1; 
  else return 0;
}

/********************************************************
 *                        fail                          *
 *******************************************************/ 

/* 추천을 해줘.. 무한루프만 돌지 말고 */
/* 브루트포스 추천 */
function recur(idx, start_times, latitude, longitude, dict, hourly_orders, sum) {
  console.log('idx: '+idx);
  if (idx === start_times.length-1) {
    return sum;
  }
  
  /* 완전탐색 그냥 해보자. */
  let key = new Date(start_times[idx]);
  let n = dict[key].length;
  // console.log('key: '+key+', n: '+n);
  let array = Array();

  for (let i = 0; i < n; i++) {
    let dest_latitude = hourly_orders[dict[key][i]['idx']]['latitude'];
    let dest_longitude = hourly_orders[dict[key][i]['idx']]['longitude'];
    let tmp = dict[key][i]['price'];
    tmp -= getDistance(latitude, 
                       longitude, 
                       dest_latitude,
                       dest_longitude) * 2.5;
    array.push(recur(idx + 1, start_times, dest_latitude, dest_longitude, dict, hourly_orders, sum + tmp));
    visit.push(i);
    // array.push(sum+tmp);
    // console.log('tmp: '+tmp);
  }
  // let max = array.reduce(function (previous, current) {
  //   return previous > current ? previous:current;
  // })
  console.log('리턴값: '+Math.max.apply(null, array));
  console.log('visit: '+visit);
  return Math.max.apply(null, array);
}


app.listen(PORT, () => {
  console.log(`Server On : http://localhost:${PORT}/`);
});
