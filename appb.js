const express = require("express");
const fileUpload = require("express-fileupload");
const cors = require("cors");
require("dotenv").config();
const bodyParser = require("body-parser");
const app = require("express")();
app.use(
  fileUpload({
    createParentPath: true,
  })
);
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/assets", express.static(__dirname + "/client/assets"));
const server = require("http").createServer(app);
const port = process.env.PORT || 7000;
const socketIO = require("socket.io");
const http = require("http");
// const server = http.createServer(app);
const io = socketIO(server); // Initialize socket.io with the server
//
const home = require("./routes/home");
app.use("/", home);
const scan = require("./routes/scan");
app.use("/", scan);
const {
  router: sendMessageRouter,
  handleSocketConnection,
  connectToWhatsApp,
} = require("./routes/sendMessage");
app.use("/", sendMessageRouter);
io.on("connection", handleSocketConnection);
connectToWhatsApp().catch((err) =>
  console.log("Unexpected error in connecting to WhatsApp: " + err)
);

//
const allMessages = require("./routes/allMessages");
app.use("/", allMessages);

const { swaggerUi, swaggerSpecs } = require("./config/swaggerConfig");
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpecs, { explorer: true })
);
server.listen(port, () => {
  console.log("Server Running on Port : " + port);
});
