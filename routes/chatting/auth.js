const { Router } = require('express');
const authRouter = Router();
const mysql = require("mysql2/promise");

const pool = require('../function');

module.exports = authRouter;