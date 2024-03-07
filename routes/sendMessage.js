// const { Boom } = require("@hapi/boom");
// const fileUpload = require("express-fileupload");
// const cors = require("cors");
// app.use(fileUpload({ createParentPath: true }));
// app.use(cors());
const path = require("path");
const fs = require("fs");

// sendMessage.js
const express = require("express");
const router = express.Router();
const qrcode = require("qrcode");
const {
  makeWASocket,
  Browsers,
  DisconnectReason,
  Boom,
} = require("@whiskeysockets/baileys");
const log = require("pino");
const { session } = { session: "session_auth_info" };
const {
  mongoClient,
  authInfoCollection,
  sentMessagesCollection,
} = require("../mongodb");
const useMongoDBAuthState = require("../mongoAuthState");

//

let sock;
let qrDinamic;
let soket;

// Connect to WhatsApp function
async function connectToWhatsApp() {
  try {
    console.log("Initiating WhatsApp connection");
    await mongoClient.connect();
    const { state, saveCreds } = await useMongoDBAuthState(authInfoCollection);

    // Creating WhatsApp client
    sock = makeWASocket({
      browser: Browsers.macOS("Chatify"),
      printQRInTerminal: true,
      auth: state,
      logger: log({ level: "silent" }),
    });

    // Event listeners for connection updates and messages
    // ... (your existing event listeners)

    sock.ev.on("creds.update", saveCreds);
  } catch (error) {
    console.log("Error connecting to WhatsApp:", error);
  }
}

// Check if connected to WhatsApp
const isConnected = () => {
  return sock?.user ? true : false;
};

// Update QR code function
const updateQR = (data) => {
  switch (data) {
    case "qr":
      qrcode.toDataURL(qrDinamic, (err, url) => {
        soket?.emit("qr", url);
        soket?.emit("log", "QR code received, scan");
      });
      break;
    case "connected":
      const indexPath = path.join(__dirname, "../client/assets/check.svg");
      const filePath =
        "D:/Projects/Chatify/chatify-backend/client/assets/check.svg";
      console.log("indexPath path:", path.resolve(indexPath));
      console.log("filePath path:", path.resolve(filePath));

      fs.readFile(indexPath, (err, data) => {
        if (err) {
          console.error(`Error reading file: ${err}`);
          soket?.emit("log", `Error reading file: ${err}`);
        } else {
          const base64Image = Buffer.from(data).toString("base64");
          soket?.emit("qrstatus", `data:image/svg+xml;base64,${base64Image}`);
          soket?.emit("log", "File sent successfully");
        }
      });
      soket?.emit("log", " User connected");
      const { id, name } = sock?.user;
      var userinfo = id + " " + name;
      soket?.emit("user", userinfo);
      break;
    case "loading":
      soket?.emit("qrstatus", "../client/assets/loader.gif");
      soket?.emit("log", "Loading....");
      break;
    default:
      break;
  }
};

// Route to send a WhatsApp message
router.get("/send-message", async (req, res) => {
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
        console.log("Checking existence of the number", exist);
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
            response: "This number is not on WhatsApp.",
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

// Socket connection event
const handleSocketConnection = async (socket) => {
  soket = socket;
  if (isConnected()) {
    updateQR("connected");
  } else if (qrDinamic) {
    updateQR("qr");
  }
};

// Export the router and socket connection event
module.exports = { router, handleSocketConnection, connectToWhatsApp };
