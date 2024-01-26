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
const bodyParser = require("body-parser");
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
const port = process.env.PORT || 8000;
const qrcode = require("qrcode"); 

app.use("/assets", express.static(__dirname + "/client/assets")); 

app.get("/scan", (req, res) => {
  res.sendFile("./client/index.html", {
    root: __dirname,
  });
});

app.get("/", (req, res) => {
  res.send("server working"); 
});

let sock;
let qrDinamic;
let soket;

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState("session_auth_info");

  sock = makeWASocket({
    browser: Browsers.macOS("Chatterly"),
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
        console.log(
            `Device closed, remove it ${session} and scan again.`
        );
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
      if (type === "notify") {
        if (!messages[0]?.key.fromMe) {
          const captureMessage = messages[0]?.message?.conversation;
          const numberWa = messages[0]?.key?.remoteJid;

          const compareMessage = captureMessage.toLocaleLowerCase();

          if (compareMessage === "ping") {
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
            await sock.sendMessage(
              numberWa,
              {
                text: "Understood",
              },
              {
                quoted: messages[0],
              }
            );
          }
        }
      }
    } catch (error) {
      console.log("error ", error);
    }
  });

  sock.ev.on("creds.update", saveCreds);
}

const isConnected = () => {
  return sock?.user ? true : false;
};

app.get("/send-message", async (req, res) => {
  const tempMessage = req.query.message;
  const number = req.query.number;
  console.log(tempMessage, number);

  let numberWA;
  try {
    if (!number) {
      res.status(500).json({
        status: false,
        response: "The number does not exist",
      });
    } else {
      numberWA = "92" + number + "@s.whatsapp.net";

      if (isConnected()) {
        const exist = await sock.onWhatsApp(numberWA);

        if (exist?.jid || (exist && exist[0]?.jid)) {
          sock
            .sendMessage(exist.jid || exist[0].jid, {
              text: tempMessage,
            })
            .then((result) => {
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
server.listen(port, () => {
  console.log("Server Run Port : " + port);
});
