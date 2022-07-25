const { Router } = require('express');
const userRouter = Router();
const mysql = require("mysql2/promise");

const pool = require('../function');

module.exports = userRouter;