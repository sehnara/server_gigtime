const { Router } = require('express');
const applyRouter = Router();
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: "albadb.cpew3pq0biup.ap-northeast-2.rds.amazonaws.com",
  user: "admin",
  password: "dnjstnddlek",
  database: "gig_time",
  connectionLimit: 10
});

// 면접신청 페이지 - 매장정보
// store_id : 1
applyRouter.post('/load_store', async (req, res) => {
    const con = await pool.getConnection(async conn => conn);
    store_id = req.body['store_id'];
    store = {};
  
    const sql_store = `SELECT FK_stores_owners, name, address, description, logo, background FROM stores WHERE store_id = ${store_id}`;
    const [store_info] = await con.query(sql_store);
    // console.log(store_info);
    owner_id = store_info[0]['FK_stores_owners'];
    // console.log('owner: ', owner_id);
    // console.log(store_info);
  
    store['name'] = store_info[0]['name'];
    store['address'] = store_info[0]['address'];
    store['description'] = store_info[0]['description'];
    store['logo'] = store_info[0]['logo'];
    store['background'] = store_info[0]['background'];
  
    const sql_owner = `SELECT name, phone FROM owners WHERE owner_id = ${owner_id}`;
    const owner_info = await con.query(sql_owner);
    // console.log('owner: ', owner_info[0][0]['name']);
    store['owner_name'] = owner_info[0][0]['name'];
    store['owner_phone'] = owner_info[0][0]['phone'];
    // console.log('store: ', store);
    con.release();
    res.send(store);
});
  
calendar = { 1: 31, 2: 28, 3: 31, 4: 30, 5: 31, 6: 30, 7: 31, 8: 31, 9: 30, 10: 31, 11: 30, 12: 31 };
hours = { 10: 0, 11: 1, 13: 2, 14: 3, 15: 4, 16: 5, 17: 6, 19: 7, 20: 8, 21: 9 };
times = [];
for (a = 0; a <= 31; a += 1) {
    times.push([10, 11, 13, 14, 15, 16, 17, 19, 20, 21]);
}
  
// 'store_id' : 1, 'interview_month' : 3
applyRouter.post('/load_interview', async (req, res) => {
    const con = await pool.getConnection(async conn => conn);
    console.log("11111111", req.body);
    store_id = req.body['store_id'];
    month = req.body['interview_month'];
    result = [];
  
    let today = new Date();
    year = today.getFullYear();
    if (!month)
        month = today.getMonth() + 1;
    day = today.getDate();
  
    interview = {};
    const sql = `SELECT a.interview_date, b.time 
                    FROM interviews AS a, interview_times AS b
                    WHERE a.FK_interviews_interview_times = b.interview_time_id 
                    AND a.FK_interviews_stores = ${store_id}`;
    const [interview_info] = await con.query(sql);
    n = interview_info.length;
  
    for (i = 0; i < n; i += 1) { // 면접이 잡힌 날짜들
        date = String(interview_info[i]['interview_date']);
        date = date.split('T')[0];
        time = interview_info[i]['time'];
        if (interview[date]) { // 면접일자별 시간 - 예약완료
            interview[date].push(time);
        } else {
            interview[date] = [time];
        }
    }
  
    for (day; day <= calendar[month]; day += 1) {
        month_str = String(month);
        day_str = String(day);
        month_str = month_str.padStart(2, '0');
        day_str = day_str.padStart(2, '0');
        new_date = `${year}-${month_str}-${day_str}`;
  
        if (interview[new_date]) {
            for (hour of interview[new_date]) {
                times[day].splice(hours[hour], 1);
            }
        }
        result.push({ 'date': new_date, 'time': times[day] });
    }
    // console.log(">>>>>>>>>>>>", result);
    // return result;
    con.release();
    res.send(result);
});
  
// 'interview_date' : 2022-07-18    // (날짜), 
// 'interview_time' : 10    // (시간), 
// 'question' : "쥐 나오나요"   // (질문)
// 'worker_id' : 1  // (알바생id), 
// 'store_id' : 1   // (가게id), 
applyRouter.post('/submit', async (req, res) => {
    const con = await pool.getConnection(async conn => conn);
    console.log(req.body);
    interview_date = req.body['interview_date'];
    interview_time = req.body['interview_time'];
    worker_id = req.body['worker_id'];
    store_id = req.body['store_id'];
    question = req.body['question'];
  
    let today = new Date();
    year = today.getFullYear();
    month = today.getMonth() + 1;
    day = today.getDate();
  
    month_str = String(month);
    day_str = String(day);
    month_str = month_str.padStart(2, '0');
    day_str = day_str.padStart(2, '0');
  
    new_date = `${year}-${month_str}-${day_str}`;
  
    console.log('interview_time: ', interview_time);
    tmp = hours[interview_time] + 1;
    console.log('tmp: ', tmp);
    const check_sql = `SELECT * FROM interviews WHERE FK_interviews_interview_times = ${tmp} 
    AND interview_date = '${interview_date}' AND FK_interviews_workers = ${worker_id};`;
    const [check_result] = await con.query(check_sql);
    console.log(check_result[0]);
    // let timeString = check_result[0]['request_date'].toLocaleString("en-US", {timeZone: "Asia/Seoul"});
    // console.log(check_result[0]['request_date']);
    if (check_result[0]) {
        // console.log('yes');
        // response = '안됨. 다른면접있음.';
        con.release();
        res.send('안됨. 다른면접있음.');
    } 
    else{
        // console.log('no');
        const sql = `INSERT INTO interviews (FK_interviews_stores, FK_interviews_workers, 
            request_date, interview_date, FK_interviews_interview_times, question) 
            VALUES (${store_id}, ${worker_id}, '${new_date}', '${interview_date}', '${tmp}', '${question}');`;
        const [result] = await con.query(sql);

        con.release();
        res.send('신청 완료!'); // 메세지만   
    }
});
  
module.exports = applyRouter;

/************************ function *************************/