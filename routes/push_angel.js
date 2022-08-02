const admin = require("firebase-admin");

// let serAccount = require('C:/Users/ASUS/Documents/GitHub/namanmoo/baroalba-14460-firebase-adminsdk-8blk3-5680e80fd0.json');

// admin.initializeApp({
//     credential: admin.credential.cert(serAccount),
// })

function push_angel(target_token, info) {
  console.log("start-angel");
  let message = {
    // "type": 'angel_call',
    data: {
      title: `알바천사 콜`,
      // body: 'body string'
      body: JSON.stringify(info),
    },
    tokens: target_token,
    webpush: {
      fcmOptions: {
        link: "https://www.naver.com", // 로컬
      },
    },
  };
  console.log(message);

  // let tmp = JSON.stringify(message);
  admin
    .messaging()
    .sendMulticast(message)
    .then(function (res) {
      console.log("successfully : ", res);
    })
    .catch(function (err) {
      console.log("error : ", err);
    });
  console.log("end-angel");
}

module.exports = push_angel;
