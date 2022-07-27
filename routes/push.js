const admin = require("firebase-admin");

let serAccount = require("../baroalba-14460-firebase-adminsdk-8blk3-5680e80fd0.json");

admin.initializeApp({
  credential: admin.credential.cert(serAccount),
});

function push_noti(target_token, info) {
  console.log("start");
  let message = {
    // type: 'angel_result',
    data: {
      title: `알바천사 결과`,
      body: JSON.stringify(info),
    },
    token: target_token,
  };
  admin
    .messaging()
    .send(message)
    .then(function (res) {
      console.log("successfully : ", res);
    })
    .catch(function (err) {
      console.log("error : ", err);
    });
  console.log("end");
}

module.exports = admin;
module.exports = push_noti;
