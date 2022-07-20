const { Router } = require("express");
const mysql = require("mysql2/promise");
  
const pool = mysql.createPool({
    host: "albadb.cpew3pq0biup.ap-northeast-2.rds.amazonaws.com",
    user: "admin",
    password: "dnjstnddlek",
    database: "albaDB",
    connectionLimit: 1000,
    multipleStatements : true
});

module.exports = pool;
