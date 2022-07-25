const { Router } = require('express');
const mysql = require("mysql2/promise");

const chattingRouter = Router();

const roomRouter = require('./chatting/room');
const authRouter = require('./chatting/auth');
const friendRouter = require('./chatting/friend');
const userRouter = require('./chatting/user');
const messageRouter = require('./chatting/message');

const pool = require('./function');

chattingRouter.use('/room', roomRouter);
chattingRouter.use('/auth', authRouter);
chattingRouter.use('/friend', friendRouter);
chattingRouter.use('/user', userRouter);
chattingRouter.use('/message', messageRouter);

module.exports = chattingRouter;