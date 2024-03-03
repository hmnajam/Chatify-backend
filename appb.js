const {
  default: makeWASocket,
  Browsers,
  MessageType,
  MessageOptions,
  Mimetype,
  DisconnectReason,
  BufferJSON,
  AnyMessageContent,
  delay,
  fetchLatestBaileysVersion,
  isJidBroadcast,
  makeCacheableSignalKeyStore,
  makeInMemoryStore,
  MessageRetryMap,
  useMultiFileAuthState,
  msgRetryCounterMap,
} = require("@whiskeysockets/baileys");
const log = (pino = require("pino"));
const { session } = { session: "session_auth_info" };
const { Boom } = require("@hapi/boom");
const path = require("path");
const fs = require("fs");
const express = require("express");
const fileUpload = require("express-fileupload");
const cors = require("cors");
require("dotenv").config();
const useMongoDBAuthState = require("./mongoAuthState");
const bodyParser = require("body-parser");
(swaggerJsdoc = require("swagger-jsdoc")),
  (swaggerUi = require("swagger-ui-express"));
const app = require("express")();

const {
  mongoClient,
  authInfoCollection,
  sentMessagesCollection,
} = require("./mongodb");

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
const io = require("socket.io")(server);
const port = process.env.PORT || 7000;
const qrcode = require("qrcode");
//
//
//
const home = require("./routes/home");
app.use("/", home);

const scan = require("./routes/scan");
app.use("/", scan);

const allMessages = require("./routes/allMessages");
app.use("/", allMessages);

//
//
//

let sock;
let qrDinamic;
let soket;

async function connectToWhatsApp() {
  try {
    console.log("Initiating whtsapp connection");
    await mongoClient.connect();
    const { state, saveCreds } = await useMongoDBAuthState(authInfoCollection);

    // Creating whatsapp client
    sock = makeWASocket({
      browser: Browsers.macOS("Chatify"),
      printQRInTerminal: true,
      auth: state,
      logger: log({ level: "silent" }),
    });

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;
      qrDinamic = qr;
      if (connection === "close") {
        let reason = new Boom(lastDisconnect.error).output.statusCode;
        if (reason === DisconnectReason.badSession) {
          console.log(
            `Bad Session File, Please Delete ${session} and Scan Again`
          );
          sock.logout();
        } else if (reason === DisconnectReason.connectionClosed) {
          console.log("Connection closed, reconnecting...");
          connectToWhatsApp();
        } else if (reason === DisconnectReason.connectionLost) {
          console.log("Server connection lost, reconnecting...");
          connectToWhatsApp();
        } else if (reason === DisconnectReason.connectionReplaced) {
          console.log(
            "Connection replaced, another new session opened, please close the current session first"
          );
          sock.logout();
        } else if (reason === DisconnectReason.loggedOut) {
          console.log(`Device closed, remove it ${session} and scan again.`);
          sock.logout();
        } else if (reason === DisconnectReason.restartRequired) {
          console.log("Restart required, restarting...");
          connectToWhatsApp();
        } else if (reason === DisconnectReason.timedOut) {
          console.log("Connection time expired, connecting...");
          connectToWhatsApp();
        } else {
          sock.end(
            `Unknown disconnection reason: ${reason}|${lastDisconnect.error}`
          );
        }
      } else if (connection === "open") {
        console.log("Connected ");
        return;
      }
    });

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      try {
        if (type === "notify" && !messages[0]?.key.fromMe) {
          const { key, message } = messages[0];
          const { extendedTextMessage } = message;
          if (
            extendedTextMessage &&
            extendedTextMessage.text.toLowerCase() === "ping"
          ) {
            console.log("Received ping, sending pong.");
            await sock.sendMessage(
              key.remoteJid,
              { text: "Pong" },
              { quoted: messages[0] }
            );
          } else if (extendedTextMessage) {
            console.log(
              `Received message: (${extendedTextMessage.text}) from: ${key.remoteJid}`
            );
          } else {
            console.log("No valid message content found.");
          }
        }
      } catch (error) {
        console.log("We encountered some Error:", error);
      }
    });
    sock.ev.on("creds.update", saveCreds);
  } catch {
    console.log("Error connecting to WhatsApp:", error);
  }
}

const isConnected = () => {
  return sock?.user ? true : false;
};

/**
 * @swagger
 * paths:
 *   /send-message:
 *     get:
 *       summary: Send a WhatsApp message
 *       parameters:
 *         - name: message
 *           in: query
 *           description: The message to be sent
 *           required: true
 *           schema:
 *             type: string
 *         - name: number
 *           in: query
 *           description: The recipient's phone number
 *           required: true
 *           schema:
 *             type: string
 *       responses:
 *         '200':
 *           description: Successful response
 *           content:
 *             application/json:
 *               example:
 *                 status: true
 *                 response: Success message
 *         '500':
 *           description: Error response
 *           content:
 *             application/json:
 *               example:
 *                 status: false
 *                 response: Error message
 *       x-swagger-router-controller: sendMessage
 *       operationId: index
 *       tags:
 *         - sendMessage
 */

app.get("/send-message", async (req, res) => {
  const tempMessage = req.query.message;
  const number = req.query.number;
  console.log("Message:", tempMessage, "Number:", number);
  await mongoClient.connect();
  let numberWA;
  try {
    if (!number) {
      res.status(500).json({
        status: false,
        response: "The number does not exist",
      });
    } else {
      numberWA = number + "@s.whatsapp.net";

      if (isConnected()) {
        const exist = await sock.onWhatsApp(numberWA);
        console.log("Chacking existance of the number", exist);
        if (exist?.jid || (exist && exist[0]?.jid)) {
          sock
            .sendMessage(exist.jid || exist[0].jid, {
              text: tempMessage,
            })
            .then(async (result) => {
              // Save sent message to the database
              try {
                await sentMessagesCollection.insertOne({
                  sender: sock.user.id,
                  recipient: numberWA,
                  message: tempMessage,
                  timestamp: new Date(),
                });
                console.log("Message saved to database successfully");
              } catch (error) {
                console.error("Error saving message to database:", error);
              }
              // Send the response
              res.status(200).json({
                status: true,
                response: result,
              });
            })
            .catch((err) => {
              res.status(500).json({
                status: false,
                response: err,
              });
            });
        } else {
          res.status(500).json({
            status: false,
            response: "This number is not on Whatsapp.",
          });
        }
      } else {
        res.status(500).json({
          status: false,
          response: "You are not connected yet",
        });
      }
    }
  } catch (err) {
    res.status(500).send(err);
  }
});

io.on("connection", async (socket) => {
  soket = socket;
  if (isConnected()) {
    updateQR("connected");
  } else if (qrDinamic) {
    updateQR("qr");
  }
});

const updateQR = (data) => {
  switch (data) {
    case "qr":
      qrcode.toDataURL(qrDinamic, (err, url) => {
        soket?.emit("qr", url);
        soket?.emit("log", "QR code received, scan");
      });
      break;
    case "connected":
      soket?.emit("qrstatus", "./assets/check.svg");
      soket?.emit("log", " User connected");
      const { id, name } = sock?.user;
      var userinfo = id + " " + name;
      soket?.emit("user", userinfo);
      break;
    case "loading":
      soket?.emit("qrstatus", "./assets/loader.gif");
      soket?.emit("log", "Loading....");
      break;
    default:
      break;
  }
};
connectToWhatsApp().catch((err) =>
  console.log("unexpected error in connecting to whatsapp: " + err)
); // catch any errors

// Swagger options
const options = {
  definition: {
    openapi: "3.1.0",
    info: {
      title: "Chatterly APIs with Swagger",
      version: "0.1.0",
      description: "Official swagger documentation of Chatterly APIs.",
      license: {
        name: "MIT",
        url: "https://spdx.org/licenses/MIT.html",
      },
      contact: {
        name: "Najam Saeed",
        url: "https://najam.pk/",
        email: "hmnajam@gmail.com",
      },
    },
    servers: [
      {
        url: "http://localhost:8000",
      },
    ],
  },
  apis: ["./appb.js"],
};

const specs = swaggerJsdoc(options);
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(specs, { explorer: true })
);

server.listen(port, () => {
  console.log("Server Running on Port : " + port);
});
