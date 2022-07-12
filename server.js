const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const mysql = require("mysql");
const app = express();
const PORT = process.env.PORT || 4000;

const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "1234",
  database: "gig_time",
});

connection.connect();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(cors());
app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.send({ hello: "Hello react" });
});

app.listen(PORT, () => {
  console.log(`Server On : http://localhost:${PORT}/`);
});
