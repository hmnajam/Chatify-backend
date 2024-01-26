const {
  DisconnectReason,
  useMultiFileAuthState,
} = require("@whiskeysockets/baileys");
const useMongoDBAuthState = require("./mongoAuthState");
const makeWASocket = require("@whiskeysockets/baileys").default;
require("dotenv").config(); // Load environment variables from .env file

const {
  MessageType,
  MessageOptions,
  Mimetype,
} = require("@whiskeysockets/baileys");

const mongoURL =
  "mongodb+srv://najam1:cGxJ0o74fNAXDg4t@cluster0.sxwdi4w.mongodb.net/?retryWrites=true&w=majority";
// const mongoURL = `mongodb+srv://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@${process.env.MONGODB_CLUSTER}`;
console.log("I am mongo Url", mongoURL);

const { MongoClient } = require("mongodb");

async function connectionLogic() {
  const mongoClient = new MongoClient(mongoURL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  await mongoClient.connect();
  // const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
  const collection = mongoClient
    .db("whatsapp_api")
    .collection("auth_info_baileys");
  const { state, saveCreds } = await useMongoDBAuthState(collection);
  const sock = makeWASocket({
    // can provide additional config here
    printQRInTerminal: true,
    auth: state,
  });

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update || {};
    if (qr) {
      console.log(qr);
      // write custom logic over here
    }
    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut;
      if (shouldReconnect) {
        connectionLogic();
      }
    }
  });

  sock.ev.on("messages.update", (messageInfo) => {
    console.log("I am message info log");
    // console.log("I am message info log", messageInfo);
  });

  sock.ev.on("messages.upsert", async (messageInfoUpsert) => {
    // console.log("I am message upsert log",messageInfoUpsert.messages);
    console.log(
      `Incoming message '${messageInfoUpsert.messages[0].message.conversation}', from: '${messageInfoUpsert.messages[0].key.remoteJid}'`
    );

    const captureMessage = messageInfoUpsert.messages[0]?.message?.conversation;
    const numberWa = messageInfoUpsert.messages[0]?.key?.remoteJid;
    const compareMessage = captureMessage.toLocaleLowerCase();
    if (compareMessage === "ping") {
      await sock.sendMessage(
        numberWa,
        {
          text: "Pong",
        }
        // {
        //   quoted: messageInfoUpsert.messages[0],
        // }
      );
    }
    // const id = "923131060542@s.whatsapp.net"; // the WhatsApp ID
    // const sentMsg = await sock.sendMessage(id, {
    //   text: "oh hello there again",
    // });
  });


  // async function sendWhatsAppMessage() {
  //   try {
  //     const id = "923131060542@s.whatsapp.net"; // the WhatsApp ID
  //     const sentMsg = await sock.sendMessage(id, {
  //       text: "oh hello there again",
  //     });
  //     return sentMsg;
  //   } catch (error) {
  //     console.error("Error sending WhatsApp message:", error);
  //     throw error; // Propagate the error to the caller
  //   }
  // }
  
  
  // sendWhatsAppMessage();

  sock.ev.on("creds.update", saveCreds);
}

connectionLogic();

// module.exports = { connectionLogic };



