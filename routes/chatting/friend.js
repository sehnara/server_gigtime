const { Router } = require('express');
const friendRouter = Router();
const mysql = require("mysql2/promise");

const pool = require('../function');

module.exports = friendRouter;