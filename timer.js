const express = require("express");
const mysql = require('mysql2/promise');
const pool = require('./routes/function');
const schedule = require('node-schedule');

// const job = schedule.scheduleJob('0-59 * * * * *', async function() {
//     console.log('hi')
// });

module.exports = {
    /* 매 정시마다 실행되며 orders 테이블 status 업데이트 */
    update_orders_table: async function () { 
            schedule.scheduleJob('* * 0-23 * * *', async function() {
            console.log('hi')
            const con = await pool.getConnection(async conn => conn);
            const sql = `UPDATE `
        })
    }
};