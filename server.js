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
  database: "gig_time"
})

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

/* 이미 가입된 email인지 체크 */
/* 
	data form: 
  {
    'email': 'dngp93@gmail.com'
  }
*/
app.post('/check/member', (req, res) => {
  /* 우선 owners db 확인 (더 적으니까) */
  const sql = `SELECT * FROM owners WHERE email=?`;
  con.query(sql, req.body['email'], function(err, result, field) {
      if (result.length === 0)
      {
          /* owners에 없으니 workers 확인 */
          const sql2 = `SELECT * FROM workers WHERE email=?`;
          con.query(sql2, req.body['email'], function(err, result2, field) {
              if (result2.length === 0) res.send('NONE');
              else res.send('worker');
          })
      }
      else res.send('owner');
  })
});

/********************************************************
 *                        worker                        *
 *******************************************************/ 

/* name, email 정보 전달 받아서 worker table에 insert 
  data form === 
  {
		'name': 'kantwang',
		'email': 'dngp93@gmail.com',
		'location': '서울시 관악구 성현동 블라블라',
		'range': 234
  } */
    app.post('/worker/signup', getPos, (req, res) => {
      console.log(req.body);
      const sql = "INSERT INTO workers SET ?";
  
      con.query(sql, req.body, function(err, result, field) {
          if (err) throw err;
          console.log(result);

          const sql2 = "SELECT worker_id FROM workers WHERE email=?";
          con.query(sql2, req.body['email'], function(err, result2, field){
            if (err) throw err;
            /* signup 결과로 worker_id send */
            res.send(result2[0]['worker_id'].toString());
          })
      })
  })

/* worker의 email을 받아서 id를 return */
/*
  data form
  {
    'email': 'dngp93@gmail.com'
  }
*/
app.post('/worker/id', (req, res) => {
  const sql = "SELECT worker_id FROM workers WHERE email=?";

  con.query(sql, req.body['email'], function(err, result, field){
    if (err) throw err;
    res.send(result[0]['worker_id'].toString());
  })
})


/* 주소 정보 전달 받아서 worker table update
  data form === 
  {
    'email': 'dngp93@gmail.com', 
    'location': '서울시 관악구 성현동'
  } */
app.post('/worker/location/update', getPos, (req, res) => {
  const sql = "UPDATE workers SET location=?, latitude=?, longitude=? WHERE email=?";
  con.query(sql, [req.body['location'], req.body['latitude'], req.body['longitude'], req.body['email']], function(err, result, field) {
      if (err) throw err;
      res.send('success');
  })
})

/* 거리 정보 전달 받아서 worker table update
   data form === 
  {
    'worker_id': 1, 
    'range': 424
  } */
app.post('/worker/range/update', (req, res) => {
    const sql = "UPDATE workers SET range=? WHERE worker_id=?";
    con.query(sql, req.body, function(err, result, field) {
        if (err) throw err;
        console.log(result);
        res.send('success');
    })
})

/* worker의 location 정보 send */
app.post('/worker/location', (req, res) => {
    const sql = "SELECT `location` FROM workers WHERE email=?";
    con.query(sql, req.body['email'], function(err, result, field) {
        if (err) throw err;
        console.log(result);
        res.send(result[0]['location']);
    }) 
});

/* worker의 range 정보 send */
app.post('/worker/range', (req, res) => {
    const sql = "SELECT `range` FROM workers WHERE email=?";
    con.query(sql, req.body['email'], function(err, result, field) {
        if (err) throw err;
        console.log(result);
        res.send(result[0]['range'].toString()); // string 형태로만 통신 가능
    }) 
});

/* 알바 예약 페이지 */
/* 페이지 로딩 시 뿌려주는 데이터 */
/* 
{
  'order_id': 2, 
  'work_date': '2022-08-20 00:00:000Z', 
  'type': '설거지'
} */
app.post('/worker/reservation/list', (req, res) => {
    
    let work_date = masageDateToYearMonthDay(req.body['work_date']);
    console.log(work_date);

    const sql = "SELECT job_id FROM jobs WHERE type=?"
    con.query(sql, req.body['type'], function(err, result, field) {
        const sql2 = `SELECT hourlyorders_id, dynamic_price, min_price, max_price, start_time FROM hourly_orders A
                        INNER JOIN orders B ON A.FK_hourlyorders_orders = B.order_id
                        WHERE order_id=? AND work_date=? AND FK_orders_jobs=?`
        con.query(sql2, [req.body['order_id'],work_date,result[0]['job_id']], function(err, result2, field) {
            res.send(result2);
        })
    })
})



/* 알바 예약 페이지 */
/* 예약하기 클릭 시 hourly_orders 테이블에 worker_id 기입, closing_time 기입 */
/* 한 order의 hourly_orders가 전부 예약 되었다면, order의 status=1로 UPDATE */ 
/* 
{
    'worker_id': 2, 
    'hourlyorders_id': [5, 6, 7, 8, 9]
} */
app.post('/worker/reservation/save', (req, res) => {
    console.log(req.body);
    const sql = "UPDATE hourly_orders SET FK_hourlyorders_workers=?, closing_time=? WHERE hourlyorders_id=?";
    console.log(req.body['hourlyorder_id'].length-1);
    for (let i = 0; i < req.body['hourlyorder_id'].length; i++) {
        let tmp = new Date().getTime();
        let timestamp = new Date(tmp);
        con.query(sql, [req.body['worker_id'], timestamp, req.body['hourlyorder_id'][i]], function(err, result, field){
            if (err) throw err;
            /* 수정필요. 이렇게 매 번 확인할 필요 없다. 끝나고 한 번만 하는 방법은? */
            check_all_hourlyorders_true(req.body['hourlyorder_id'][0]);
        })
    }
    res.send('success');
})

/* 알바 모집 정보 return (지정 거리 이내)
   data form === 
  {
    'worker_id': 1
  } */
app.post('/worker/show/hourly_orders', (req, res) => {
    /* 다음으로, 해당 order에 해당하는 hourly_order 가져오기. */
    // FK_hourlyorders_workers === NULL인 것만.
    const sql = `SELECT * FROM hourly_orders A 
                    INNER JOIN orders B ON A.FK_hourlyorders_orders = B.order_id 
                    INNER JOIN stores C ON B.FK_orders_stores = C.store_id 
                    INNER JOIN jobs D ON B.FK_orders_jobs = D.job_id
                    WHERE FK_hourlyorders_orders IN 
                    (SELECT order_id FROM orders 
                        WHERE FK_orders_stores IN 
                        (SELECT store_id FROM stores WHERE store_id IN 
                            (SELECT FK_qualifications_stores FROM qualifications 
                                WHERE FK_qualifications_workers=?)) AND status=0)`
    con.query(sql, req.body['worker_id'], function(err, valid_hourly_orders, field) {
        if (err) throw err;
        console.log(valid_hourly_orders);
        /* worker의 latitude, longitude 가져오기 */
        const sql2 = `SELECT latitude, longitude FROM workers WHERE worker_id=?`;
        con.query(sql2, req.body['worker_id'], function(err, result, field) {
            res.send(masage_data(result[0]['latitude'], result[0]['longitude'], valid_hourly_orders));
        });
    });
    console.log();
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
app.post('/worker/suggestion', (req, res) => {
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
  con.query(sql, [req.body['work_date'], req.body['start_times'], req.body['worker_id']], function(err, result, field) {
    // console.log('모든 개수: ' + result.length);
    suggestion(req.body['worker_id'], result, req.body['start_times']);
  })
})

/* bruteforce 방식의 suggestion 함수 */
/* 이때, 거리 상관 없이 모든 hourly_order가 들어온다 */
function suggestion(worker_id, hourly_orders, start_times)
{
  const sql = "SELECT `range`, `latitude`, `longitude` FROM workers WHERE worker_id=?"
  con.query(sql, worker_id, function(err, result, field) {
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
    /* 최초의 optimal은 각 시간대별로 최대의 price로 조합 */
    // 참고로, hourly_orders_sliced 이 안에 다 있다.
    let optimal = Array();
    for (let i = 0; i < times_count; i++) {
      let tmp = new Date(start_times[i]);
      hourly_orders_divided_by_start_time[tmp].sort(function(a, b) {
        var price_A = a.price;
        var price_B = b.price;
  
        if (price_A < price_B) return 1;
        if (price_A > price_B) return -1;
        return 0;
      })
      optimal.push(hourly_orders_divided_by_start_time[tmp][0]['idx']);
    }
    
    // console.log(hourly_orders_divided_by_start_time);
    
    /* 현재 optimal의 가치는? */
    /* 우선 시급의 총합을 구하자. */
    let sum_of_price = 0;
    for (let i = 0; i < times_count; i++) {
      sum_of_price += hourly_orders_sliced[optimal[i]]['min_price'];
    }

    /* 다음으로, 이동 거리의 총합을 구하자. */
    let sum_of_walk = getDistance(
                  latitude, 
                  longitude, 
                  hourly_orders_sliced[optimal[0]]['latitude'],
                  hourly_orders_sliced[optimal[0]]['longitude']);

    for (let i = 0; i < times_count - 1; i++) {
      sum_of_walk += getDistance(
                  hourly_orders_sliced[optimal[i]]['latitude'],
                  hourly_orders_sliced[optimal[i]]['longitude'],
                  hourly_orders_sliced[optimal[i+1]]['latitude'],
                  hourly_orders_sliced[optimal[i+1]]['longitude'])
      // console.log(sum_of_walk + ' ' + hourly_orders_sliced[optimal[i+1]]['name']);
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
  })
}


/********************************************************
 *                        store                         *
 *******************************************************/ 

/* 면접 가능한 매장 정보를 return (지정 거리 이내) 
  data form === 
  {
    'worker_id': 1
  } */
app.post('/store/list', (req, res) => {
    const sql = "SELECT `latitude`, `longitude`, `range` FROM workers WHERE worker_id=?";
    /* 해당 worker의 위도, 경도, 거리 설정 정보 가져오기 */
    con.query(sql, req.body['worker_id'], function(err, worker_info, field){
        if (err) throw err;
        
        /* store 정보 모두 가져오기 */
        // 내게 권한 없는 정보만 가져와야 한다. 어떻게?
        const sql2 = "SELECT * FROM stores WHERE store_id NOT IN (SELECT FK_qualifications_stores FROM qualifications WHERE FK_qualifications_workers=?)";
        con.query(sql2, req.body['worker_id'], function(err, stores_info, field) {
            if (err) throw err;
            
            /* 거리 계산해서 send할 배열 생성 */
            let stores = getStore(worker_info[0]['latitude'], worker_info[0]['longitude'], worker_info[0]['range'], stores_info);
            console.log(stores);
            
            res.send(stores);
        })
    });
});

/* 주소 정보 전달 받아서 store table update
  data form === 
  {
    'FK_stores_owners': 2, 
    'location': '서울시 관악구 성현동'
  } */
  app.post('/store/address/update', getPos, (req, res) => {
    console.log(req.body);
    const sql = "UPDATE stores SET address=?, latitude=?, longitude=? WHERE FK_stores_owners=?";
    con.query(sql, [req.body['location'], req.body['latitude'], req.body['longitude'], req.body['FK_stores_owners']], function(err, result, field) {
        if (err) throw err;
        res.send('success');
    })
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
    'email': 'borinuri@gmail.com'
  }

  output form
  {
    'name': '보리누리',
    'address': '인천 서구 심곡동 123-4',
    'type': ['서빙', '뭐시기', ...]
  }
*/

/* 1. owners 테이블에서 owner_id 가져오기 */
app.post('/store/info', getOwnerIdByEmail, async (req, res, next) => { next(); })

/* 2. stores 테이블에서 owner_id로 name, address, store_id 가져오기 */
app.use('/store/info', async (req, res, next) => {
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
app.use('/store/info', getJobIdByStoreId, async (req, res) => {
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
    'email': 'borinuri@gmail.com',
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

/* 1. owners 테이블에서 email로 owner_id 가져오기 */
app.post('/owner/employment', getOwnerIdByEmail, async (req, res, next) => { next(); })

/* 2. stores 테이블에서 owner_id로 store_id 가져오기 */
app.use('/owner/employment', getStoreIdByOwnerId, async (req, res, next) => { next(); })

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
    next();
  }
  catch {
    console.log('error 4');
  }
})

/* 5. orders 테이블에서 request_date로 order_id 가져오기 */
app.use('/owner/employment', async (req, res, next) => {
  const con = await pool.getConnection(async conn => conn);
  console.log('5-1')

  try {
    // const sql = "SELECT order_id FROM orders WHERE request_date=?"; // 이거 request_date로 하면 안된다. 마지막 행을 읽자
    const sql = "SELECT order_id FROM orders ORDER BY order_id DESC LIMIT 1";
    /* check! */
    // 마지막 행을 읽는데 만약 여기서 다른 request가 들어와서 마지막이 아니게 된다면?
    // 그럴 수 있나? 그럴 수 있다면, 해결책은?
    const [result] = await con.query(sql, masageDateToYearMonthDayHourMinSec(req.body['request_date']));
    req.body['order_id'] = result[0]['order_id']; // result[0]인 것 주의
    next();
  }
  catch {
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
    await con.query(sql, [insert_array]);
    res.send('success');
  } 
  catch {
    console.log('error 6');
  }
})

/*****************************
 * 사장님 홈 - 면접관리 페이지 *
 *****************************/

app.post('/owner/mypage/interview', async (req, res) => {
  

})


// app.post('/owner/signup', async (req, res) => {  
//     console.log(req.body);  
//     /* 먼저, owners 테이블에 name, eamil, phone INSERT */
//     const sql = "INSERT INTO owners SET name=?, email=?, phone=?";
//     await con.query(sql, [req.body['name'], req.body['email'], req.body['phone']], async function(err, result, field) {
//         if (err) throw err;
        
//         /* owners 테이블에서 owner_id SELECT */
//         const sql2 = "SELECT owner_id FROM owners WHERE email=?";
//         await con.query(sql2, req.body['email'], async function(err, result2, field) {
//           console.log(req.body)
//           if (err) throw err;

//           /* stores db에 INSERT */
//           const sql3 = `INSERT INTO stores SET ?`;
//           let tmp = {
//               'FK_stores_owners': result2['owner_id'],
//               'name': req.body['store_name'],
//               'address': req.body['location'],
//               'latitude': req.body['latitude'], // 여기 바꿔야
//               'longitude': req.body['longitude'], // 여기도
//               'description': req.body['description'],
//               'minimum_wage': req.body['minimum_wage']
//           }
//           await con.query(sql3, tmp, async function(err, result3, field) {
//               if (err) throw err;
//               res.send('success');
//           })
//         }) 
//     })
// })

/********************************************************
 *                      function                        *
 *******************************************************/ 

/* worker가 설정한 반경 이내의 가게 정보를 return */
function getStore(latitude, longitude, range, stores_info) {
  const n = stores_info.length;
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
function masage_data(latitude, longitude, data) {
  let d;
  let len = data.length;
  let databox = [];
  let check = {};
  let count = 0;

  for (let i = 0; i < len; i++) {
      d = data[i];

      /* 가게 이름이 없으면 새로 만들기 */
      if (!check.hasOwnProperty(d['name']))
      {
          let distance = getDistance(latitude, longitude, d['latitude'], d['longitude']);
          databox.push({
              'name': d['name'],
              'minimum_wage': d['minimum_wage'], 
              'distance': distance,
              'key': [],
              'work_date_and_type_and_id': {}
          });
          check[d['name']] = count;
          count += 1;
      }

      /* work_date_and_type가 없으면 새로 만들기 */
      if (!databox[check[d['name']]]['work_date_and_type_and_id'].hasOwnProperty([d['work_date'], d['type'], d['order_id']]))
      {
          databox[check[d['name']]]['work_date_and_type_and_id'][[d['work_date'], d['type'], d['order_id']]] = {
              'min_price': d['min_price'],
              'max_price': d['max_price'],
              'start_time_and_id': Array()
          };
          
          /* 이렇게라도 검색할 수 있게 key 목록을 주자.. */
          var tmp = new Date(d['work_date']);
          databox[check[d['name']]]['key'].push([tmp, d['type'], d['order_id']]);
      }
      
      /* start_time이 없으면 새로 만들기 */
      if (!databox[check[d['name']]]['work_date_and_type_and_id'][[d['work_date'], d['type'], d['order_id']]]['start_time_and_id'].hasOwnProperty([d['start_time'], d['hourlyorders_id']]))
      {
          databox[check[d['name']]]['work_date_and_type_and_id'][[d['work_date'], d['type'], d['order_id']]]['start_time_and_id'].push([d['start_time'], d['hourlyorders_id']]);
      }
  }
  console.log(util.inspect(databox, {depth:10}));
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
function check_all_hourlyorders_true(hourlyorders_id) {
  console.log('start check!');

  /* 우선 hourlyorders_id에 딸린 FK_hourlyorders_orders를 찾아옴 */
  const sql = `SELECT FK_hourlyorders_orders FROM hourly_orders WHERE hourlyorders_id=?`;
  con.query(sql, hourlyorders_id, function(err, result, field) {
      let order_id = result[0]['FK_hourlyorders_orders'];
      
      /* 이제 order_id에 해당하는 hourly_order를 모두 SELECT (아직 예약되지 않은 것만) */ 
      const sql2 = `SELECT * FROM hourly_orders WHERE FK_hourlyorders_orders=? AND closing_time IS Null`
      con.query(sql2, order_id, function(err, result2, field) {
          if (err) throw err;
          console.log(result2);
          /* 만약 SELECT 된 것이 없다면 (모두 예약된 상태라면) */
          if (result2.length === 0) 
          {
              /* orders table의 status=1로 업데이트 */
              const sql3 = `UPDATE orders SET status=1 WHERE order_id=?`;
              con.query(sql3, order_id, function(err, result3, field) {
                  if (err) throw err;
                  console.log('status is updated');
              })
          }
      });
  })
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
    next();
  }
  catch {
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
    next();
  }
  catch {
    res.send('error');
  }
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

