const fileUpload = require("express-fileupload");
const cors = require("cors");
require("dotenv").config();
const bodyParser = require("body-parser");
const socketIO = require("socket.io");
const app = require("express")();
const server = require("http").createServer(app);
const io = socketIO(server); // Initialize socket.io with the server
const port = process.env.PORT || 7000;

// Middleware
app.use(fileUpload({ createParentPath: true }));
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

//Routes
const home = require("./routes/home");
const scan = require("./routes/scan");
const allMessages = require("./routes/allMessages");
const {
  router: sendMessageRouter,
  handleSocketConnection,
  connectToWhatsApp,
} = require("./routes/sendMessage");

io.on("connection", handleSocketConnection);
connectToWhatsApp().catch((err) =>
  console.log("Unexpected error in connecting to WhatsApp: " + err)
);
const { swaggerUi, swaggerSpecs } = require("./config/swaggerConfig");

// Using my routes
app.use("/", home);
app.use("/", scan);
app.use("/", sendMessageRouter);
app.use("/", allMessages);
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpecs, { explorer: true })
);
server.listen(port, () => {
  console.log("Server Running on Port : " + port);
});
