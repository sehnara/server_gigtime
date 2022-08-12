const { Router } = require("express");
const pool = require('./function');
  
require('dotenv').config();

/* owner_id로 stores 테이블에서 store id 가져오기 */
async function getStoreIdByOwnerId(owner_id) {
  // console.log(req.body);
  const con = await pool.getConnection(async (conn) => conn);

  try {
    const sql = "SELECT store_id FROM stores WHERE FK_stores_owners=?";
    const [result] = await con.query(sql, [owner_id]);
    con.release();
    // console.log(result[0]["store_id"]);
    return result[0]["store_id"];
  } catch {
    console.log("error");
    return -1;
  }
}

async function getStoreIdByHourlyOrdersId(hourlyorders_id) {
  const con = await pool.getConnection(async (conn) => conn);
  const sql = "SELECT FK_hourlyorders_orders AS order_id FROM hourly_orders WHERE hourlyorders_id=?"
  const [order_id] = await con.query(sql, hourlyorders_id);

  const sql2 = "SELECT FK_orders_stores AS store_id FROM orders WHERE order_id=?"
  const [store_id] = await con.query(sql2, order_id[0]["order_id"]);
  console.log(store_id[0]["store_id"]);
  return store_id[0]["store_id"];
}

async function getStoreIdByOrderId(order_id) {
  const con = await pool.getConnection(async (conn) => conn);
  const sql = "SELECT FK_orders_stores AS store_id FROM orders WHERE order_id=?"
  const [store_id] = await con.query(sql, order_id);

  console.log(store_id[0]["store_id"]);
  return store_id[0]["store_id"];
}

module.exports.getStoreIdByOwnerId = getStoreIdByOwnerId;
module.exports.getStoreIdByHourlyOrdersId = getStoreIdByHourlyOrdersId;
module.exports.getStoreIdByOrderId = getStoreIdByOrderId;
