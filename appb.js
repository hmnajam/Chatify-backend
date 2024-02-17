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

const useMongoDBAuthState = require("./mongoAuthState");
const mongoURL =
  "mongodb+srv://najam1:cGxJ0o74fNAXDg4t@cluster0.sxwdi4w.mongodb.net/?retryWrites=true&w=majority";
// const mongoURL = `mongodb+srv://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@${process.env.MONGODB_CLUSTER}`;
console.log("I am mongo Url", mongoURL);
const { MongoClient, ServerApiVersion } = require("mongodb");

const log = (pino = require("pino"));
const { session } = { session: "session_auth_info" };
const { Boom } = require("@hapi/boom");
const path = require("path");
const fs = require("fs");
const express = require("express");
const fileUpload = require("express-fileupload");
const cors = require("cors");
const bodyParser = require("body-parser");
(swaggerJsdoc = require("swagger-jsdoc")),
  (swaggerUi = require("swagger-ui-express"));
const app = require("express")();
// enable files upload
app.use(
  fileUpload({
    createParentPath: true,
  })
);
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const server = require("http").createServer(app);
const io = require("socket.io")(server);
require("dotenv").config();
const port = process.env.PORT || 7000;
const qrcode = require("qrcode");
app.use("/assets", express.static(__dirname + "/client/assets"));

// Home page
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
  // res.send("server working");
});

// /**
//  * @swagger
//  * paths:
//  *   /scan:
//  *     get:
//  *       summary: Serve index.html for scanning
//  *       responses:
//  *         '200':
//  *           description: User logged in successfully
//  *       x-swagger-router-controller: scan
//  *       operationId: index
//  *       tags:
//  *         - scan
//  */
app.get("/scan", (req, res) => {
  res.sendFile("./client/index.html", {
    root: __dirname,
  });
});

let sock;
let qrDinamic;
let soket;

// Defining mongoClient for mongodb connection
const mongoClient = new MongoClient(mongoURL, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function connectToWhatsApp() {
  try {
    // const mongoClient = new MongoClient(mongoURL, {
    //   useNewUrlParser: true,
    //   useUnifiedTopology: true,
    // });

    await mongoClient.connect();
    const collection = mongoClient
      .db("whatsapp_api")
      .collection("auth_info_baileys");
    const { state, saveCreds } = await useMongoDBAuthState(collection);

    sock = makeWASocket({
      browser: Browsers.macOS("Chatify"),
      printQRInTerminal: true,
      auth: state,
      logger: log({ level: "silent" }),
    });

    const connectionPromise = new Promise((resolve) => {
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
          resolve();
          return;
        }
      });
    });
    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      try {
        if (type === "notify") {
          if (!messages[0]?.key.fromMe) {
            const numberWa = messages[0]?.key?.remoteJid;
            if (messages[0]?.message?.conversation.toLowerCase() === "ping") {
              await sock.sendMessage(
                numberWa,
                {
                  text: "Pong",
                },
                {
                  quoted: messages[0],
                }
              );
            } else {
              console.log("Received message in not ping:", numberWa);
            }
          }
        }
      } catch (error) {
        console.log("error ", error);
      }
    });

    sock.ev.on("creds.update", saveCreds);
  } catch {
    // console.log("Error connecting to WhatsApp:", error);
    console.log("Error connecting to WhatsApp:", error);
  }
}

// Function to retrieve all messages from MongoDB
async function getAllMessagesFromDB() {
  try {
    const allMessages = await mongoClient
      .db("whatsapp_api")
      .collection("sent_messages")
      .find(
        {},
        { projection: { recipient: 1, message: 1, timestamp: 1, _id: 0 } }
      )
      .sort({ timestamp: -1 }) // Sort in descending order based on timestamp
      .limit(20) // Limit the result to the last 20 messages
      .toArray();

    console.log(allMessages);
    return allMessages;
  } catch (error) {
    console.error("Error retrieving messages from database:", error);
    throw error;
  }
}

app.get("/get-all-messages", async (req, res) => {
  try {
    const allMessages = await getAllMessagesFromDB();
    // Extracting only 'recipient' and 'message' fields
    // const simplifiedMessages = allMessages.map(({ recipient, message }) => ({
    //   recipient,
    //   message,
    // }));
    res.setHeader("Content-Type", "application/json");
    res.status(200).send(
      JSON.stringify(
        {
          status: true,
          response: allMessages,
        },
        null,
        2
      )
    ); // The third parameter (2) specifies the number of spaces for indentation
  } catch (error) {
    res.status(500).json({
      status: false,
      response: "Error retrieving messages",
    });
  }
});

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
  // const mongoClient = new MongoClient(mongoURL, {
  //   useNewUrlParser: true,
  //   useUnifiedTopology: true,
  // });
  await mongoClient.connect();
  const database = process.env.Database || "whatsapp_api";
  const table = process.env.Collection || "sent_messages";
  console.log("Databse is", database, "and collection is", table);

  // New connection for sent messages.
  // const messagesCollection = mongoClient
  //   .db("whatsapp_api")
  //   .collection("sent_messages");

  // New connection for sent messages with env values.
  const messagesCollection = mongoClient.db(database).collection(table);

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
                await messagesCollection.insertOne({
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

connectToWhatsApp().catch((err) => console.log("unexpected error: " + err)); // catch any errors

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
