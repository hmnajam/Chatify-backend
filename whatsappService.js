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
const useMongoDBAuthState = require("./mongoAuthState");
const { Boom } = require("@hapi/boom");
const path = require("path");
const fs = require("fs");




async function connectToWhatsApp() {
  try {
    console.log("Initiating whtsapp connection");
    await mongoClient.connect();
    const collection = mongoClient
      // .db("whatsapp_api")
      .db(database)
      .collection(auth_info);
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

module.exports = { connectToWhatsApp };
