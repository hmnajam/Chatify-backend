const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
const { connectionLogic } = require("./index");

// Middleware to parse JSON in the request body
app.use(express.json());
app.get("/", (req, res) => {
  console.log("Received a request on Home.");
  res.sendFile(__dirname + "/index.html");
});
// API endpoint for sending message.
app.post("/send-message", (req, res) => {
  const { number, message } = req.body;
  console.log(req.body);
  res.status(200).send("Message sent successfully");
});
// API endpoint for creating or logging in account.
app.post("/create-account", (req, res) => {
  const { number, message } = req.body;
  // console.log(req.body);
  connectionLogic();
  res.status(200).send("Creating Account");
});

const server = app.listen(port, () =>
  console.log(`Example app listening on port ${port}!`)
);
server.keepAliveTimeout = 120 * 1000;
server.headersTimeout = 120 * 1000;
