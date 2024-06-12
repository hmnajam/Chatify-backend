const express = require('express');
const router = express.Router();
const qrcode = require('qrcode');
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
  msgRetryCounterMap
} = require('@whiskeysockets/baileys');
const log = require('pino');
const { session } = { session: 'session_auth_info' };
const { mongoClient, authInfoCollection, sentMessagesCollection } = require('../mongodb');
const useMongoDBAuthState = require('../mongoAuthState');
const { Boom } = require('@hapi/boom');
const app = require('express')();
const server = require('http').createServer(app);
const bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/assets', express.static(__dirname + '../client/assets'));

let sock;
let qrDinamic;
let soket;

// Connect to WhatsApp function
let clients = {};

async function connectToWhatsApp(clientId) {
  try {
    console.log(`Initiating WhatsApp connection for client: ${clientId}`);
    await mongoClient.connect();
    const { state, saveCreds } = await useMongoDBAuthState(authInfoCollection, clientId);

    const sock = makeWASocket({
      browser: Browsers.macOS('Chatify'),
      printQRInTerminal: true,
      auth: state,
      logger: log({ level: 'silent' })
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      qrDinamic = qr;
      if (connection === 'close') {
        let reason = new Boom(lastDisconnect.error).output.statusCode;
        if (reason === DisconnectReason.badSession) {
          console.log(`Bad Session File for client ${clientId}, Please Delete and Scan Again`);
          sock.logout();
        } else if (reason === DisconnectReason.connectionClosed) {
          console.log(`Connection closed for client ${clientId}, reconnecting...`);
          connectToWhatsApp(clientId);
        } else if (reason === DisconnectReason.connectionLost) {
          console.log(`Server connection lost for client ${clientId}, reconnecting...`);
          connectToWhatsApp(clientId);
        } else if (reason === DisconnectReason.connectionReplaced) {
          console.log(`Connection replaced for client ${clientId}, please close the current session first`);
          sock.logout();
        } else if (reason === DisconnectReason.loggedOut) {
          console.log(`Device closed for client ${clientId}, remove it and scan again.`);
          sock.logout();
        } else if (reason === DisconnectReason.restartRequired) {
          console.log(`Restart required for client ${clientId}, restarting...`);
          connectToWhatsApp(clientId);
        } else if (reason === DisconnectReason.timedOut) {
          console.log(`Connection time expired for client ${clientId}, connecting...`);
          connectToWhatsApp(clientId);
        } else {
          sock.end(`Unknown disconnection reason for client ${clientId}: ${reason}|${lastDisconnect.error}`);
        }
      } else if (connection === 'open') {
        console.log(`Client ${clientId} connected`);
        clients[clientId] = sock; // Store the client's socket
        // Save client ID and auth info to the database
        await authInfoCollection.updateOne(
          { clientId: clientId },
          { $set: { clientId: clientId, authInfo: state } },
          { upsert: true }
        );
      }
    });

    sock.ev.on('creds.update', saveCreds);
  } catch (error) {
    console.log(`Error connecting to WhatsApp for client ${clientId}:`, error);
  }
}

// Check if connected to WhatsApp
const isConnected = () => {
  return sock?.user ? true : false;
};

// Route to send a WhatsApp message
router.get('/send-message', async (req, res) => {
  const { message, number, clientId } = req.query;
  console.log('Message:', message, 'Number:', number, 'Client:', clientId);
  let numberWA;

  try {
    if (!number) {
      return res.status(500).json({ status: false, response: 'The number does not exist' });
    }

    numberWA = number + '@s.whatsapp.net';
    const clientSock = clients[clientId];

    if (clientSock) {
      const exist = await clientSock.onWhatsApp(numberWA);
      console.log('Checking existence of the number', exist);
      if (exist?.jid || (exist && exist[0]?.jid)) {
        clientSock
          .sendMessage(exist.jid || exist[0].jid, { text: message })
          .then(async (result) => {
            // Save sent message to the database
            try {
              await sentMessagesCollection.insertOne({
                sender: clientSock.user.id,
                recipient: numberWA,
                message: message,
                timestamp: new Date()
              });
              console.log('Message saved to database successfully');
            } catch (error) {
              console.error('Error saving message to database:', error);
            }
            // Send the response
            res.status(200).json({ status: true, response: result });
          })
          .catch((err) => {
            res.status(500).json({ status: false, response: err });
          });
      } else {
        res.status(500).json({ status: false, response: 'This number is not on WhatsApp.' });
      }
    } else {
      res.status(500).json({ status: false, response: 'Client is not connected yet' });
    }
  } catch (err) {
    res.status(500).send(err);
  }
});

// Handle socket connection
const handleSocketConnection = async (socket) => {
  const clientId = socket.handshake.query.clientId;
  soket = socket;

  if (clients[clientId]) {
    updateQR('connected', clientId);
  } else if (qrDinamic) {
    updateQR('qr', clientId);
  }

  socket.on('disconnect', () => {
    console.log(`Client ${clientId} disconnected`);
    delete clients[clientId];
  });
};

const updateQR = (data, clientId) => {
  switch (data) {
    case 'qr':
      console.log(`Generating QR code for client ${clientId}`);
      qrcode.toDataURL(qrDinamic, (err, url) => {
        if (err) {
          console.error(`Error generating QR code for client ${clientId}:`, err);
          return;
        }
        console.log(`Emitting QR code for client ${clientId} to the frontend`);
        soket?.emit('qr', { url, clientId });
        console.log(`QR code emitted for client ${clientId}`);
        soket?.emit('log', 'QR code received, scan');
      });
      break;
    case 'connected':
      console.log(`Client ${clientId} connected`);
      soket?.emit('qrstatus', './assets/check.svg');
      soket?.emit('log', `User connected for client ${clientId}`);
      const { id, name } = clients[clientId]?.user;
      const userinfo = `${id} ${name}`;
      soket?.emit('user', userinfo);
      break;
    case 'loading':
      console.log(`Loading for client ${clientId}`);
      soket?.emit('qrstatus', './assets/loader.gif');
      soket?.emit('log', 'Loading....');
      break;
    default:
      break;
  }
};

module.exports = { router, handleSocketConnection, connectToWhatsApp };
