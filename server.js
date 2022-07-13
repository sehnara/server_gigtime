const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const mysql = require("mysql");
const path = require('path');
const nodeGeocoder = require('node-geocoder');
const app = express();
const PORT = process.env.PORT || 4000;

/* 구글 map api */
const options = {
  provider: 'google',
  apiKey: 'AIzaSyAHZxHAkDSHoI-lJDCg5YfO7bLCFiRBpaU' // 요놈 넣어만 주면 될듯?
};
const geocoder = nodeGeocoder(options);

const con = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Rhd93!@#$~",
  database: "gig_time",
});

con.connect(function (err) {
  if(err) throw err;
  console.log('Connected!');
});

app.use(bodyParser.urlencoded({ extended: false }));
app.use(cors());
app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.send({ hello: "Hello react" });
});

/********************************************************
 *                        login                         *
 *******************************************************/ 

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
  'work_date': '2022-08-20', 
  'type': '설거지'
} */
app.post('/worker/reservation/list', (req, res) => {
    const sql = "SELECT job_id FROM jobs WHERE type=?"
    con.query(sql, req.body['type'], function(err, result, field) {
        const sql2 = `SELECT hourlyorders_id, dynamic_price, min_price, max_price, start_time FROM hourly_orders A
                        INNER JOIN orders B ON A.FK_hourlyorders_orders = B.order_id
                        WHERE order_id=? AND work_date=? AND FK_orders_jobs=?`
        con.query(sql2, [req.body['order_id'],req.body['work_date'],result[0]['job_id']], function(err, result2, field) {
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
    console.log(result);
    suggestion(req.body['worker_id'], result, req.body['start_times']);
  })
})

function suggestion(worker_id, hourly_orders, start_times)
{
  console.log(worker_id);
  const sql = "SELECT `range`, `latitude`, `longitude` FROM workers WHERE worker_id=?"
  con.query(sql, worker_id, function(err, result, field) {
    let range = result[0]['range'];
    let latitude = result[0]['latitude'];
    let longitude = result[0]['longitude'];
    let n = start_times.length;

    /* 우선, range 이내의 hourly_order만 가져오자. 지금은 권한 있는 모든 hourly_order이 들어와 있다. */
    getStore()

    for (let i = 0; i < n; i++) {


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
            let stores = getStore(worker_info, stores_info);
            console.log(stores);
            
            res.send(stores);
        })
    });
});

/********************************************************
 *                        owner                         *
 *******************************************************/  

/* owner db에 사장님 회원정보 INSERT & store db에 가게정보 INSERT */
/* data form: {
	'name': 'kantwang', 
	'email': 'dngp93@gmail.com',
	'store_name': '보리누리',
	'store_location': '인천 서구 심곡동',
	'latitude': 37.0124,
	'longitude': 170.4567,
	'store_jobs': ['서빙', '카운터', '주방', '청소'],
	'background': (양식에 맞게),
	'logo': (양식에 맞게),
	'description': "보리누리 많이 사랑해주세요",
	'minimum_wage': 10200,
	'phone': '01089570356'
} */
app.post('/owner/signup', (req, res) => {    
    /* owners db에 name, eamil, phone INSERT */
    const sql = "INSERT INTO owners SET name=?, email=?, phone=?";
    con.query(sql, [req.body['name'], req.body['email'], req.body['phone']], function(err, result, field) {
        if (err) throw err;
        
        /* owner_id SELECT */
        const sql2 = "SELECT owner_id FROM owners WHERE email=?";
        con.query(sql2, req.body['email'], function(err, result2, field) {
            if (err) throw err;
            
            /* stores db에 INSERT */
            const sql3 = `INSERT INTO stores SET ?`;
            let tmp = {
                'FK_stores_owners': result2['owner_id'],
                'name': req.body['store_name'],
                'address': req.body['store_location'],
                'latitude': req.body['latitude'],
                'longitude': req.body['longitude'],
                'description': req.body['description'],
                'minimum_wage': req.body['minimum_wage']
            }
            con.query(sql3, tmp, function(err, result3, field) {
                if (err) throw err;
                res.send('success');
            })
        }) 
    })
})

/********************************************************
 *                      function                        *
 *******************************************************/ 

/* worker가 설정한 반경 이내의 가게 정보를 return */
function getStore(worker_info, stores_info) {
  const n = stores_info.length;
  let answer = new Array();
  let tmp = 0;

  /* 이렇게 짜면 너무 너무 비효율적이다 */
  /* db 구조를 바꿔야 하나? 아니면, 탐색 방식을 개선? */
  for (let i = 0; i < n; i++) {
      tmp = getDistance(worker_info[0]['latitude'], worker_info[0]['longitude'], stores_info[i]['latitude'], stores_info[i]['longitude']);
      console.log('tmp: ' + tmp);
      if (tmp <= worker_info[0]['range']) {
          stores_info[i]['distance'] = tmp;
          answer.push(stores_info[i]);
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
          databox[check[d['name']]]['key'].push([d['work_date'], d['type'], d['order_id']]);
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
/* 미들웨어 사용 (맞나?) */
async function getPos(req, res, next) {
  console.log('abc');
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

















app.listen(PORT, () => {
  console.log(`Server On : http://localhost:${PORT}/`);
});
