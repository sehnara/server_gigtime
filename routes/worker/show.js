const { Router } = require('express');
const showRouter = Router();
const mysql = require("mysql2/promise");
const pool = require('../function');

let util = require('util');

/* 알바 모집 정보 return (지정 거리 이내)
   data form === 
{
    'worker_id': 1
} */
showRouter.post('/hourly_orders', async (req, res, next) => {
    const con = await pool.getConnection(async conn => conn);
    /* 1. 해당 order에 해당하는 hourly_order 가져오기. */
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
    try {
        const [valid_hourly_orders] = await con.query(sql, req.body['worker_id']);
        req.body['valid_hourly_orders'] = valid_hourly_orders;
        con.release();
        next();
    } catch {
        con.release();
        res.send('error');
    }  
});
  
/* 2. worker의 latitude, longitude 가져오기 */
showRouter.use('/hourly_orders', async (req, res) => {
    const con = await pool.getConnection(async conn => conn);
    try {
        const sql = "SELECT latitude, longitude, `range` FROM workers WHERE worker_id=?";
        const [result] = await con.query(sql, req.body['worker_id']);   
        con.release();
        res.send(masage_data(result[0]['latitude'], result[0]['longitude'], result[0]['range'], req.body['valid_hourly_orders']));
    } catch {
        con.release();
        res.send('error-show/hourly_orders');
    }
});


module.exports = showRouter;

/************************ function *************************/
/* 주변일감 페이지 */
/* front에 전달할 data 전처리 */
function masage_data(latitude, longitude, range, data) {
    let d;
    let len = data.length;
    let databox = [];
    let check = {};
    let count = 0;
  
    for (let i = 0; i < len; i++) {
        d = data[i];
  
        /* 가게 이름이 없으면 새로 만들기 */
        if (!check.hasOwnProperty(d['name'])) {
            let distance = getDistance(latitude, longitude, d['latitude'], d['longitude']);
            if (distance > range) continue; // range 범위 밖이면 pass

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

        /* minimum_price 업데이트 하기 */
        if (databox[check[d['name']]]['minimum_wage'] < d['min_price']) {
            databox[check[d['name']]]['minimum_wage'] = d['min_price']
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
    // console.log(util.inspect(databox, { depth: 20 }));
    
    /* 결과를 거리 순으로 정렬 */
    // databox.sort(function(a, b) {
    //     var distance_A = a.distance;
    //     var distance_B = b.distance;

    //     if (distance_A < distance_B) return -1;
    //     if (distance_A > distance_B) return 1;
    //     return 0;
    // })

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