require('dotenv').config();
const bodyParser = require('body-parser');
const express = require('express');
const app = require('express')();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const port = process.env.PORT || 7000;
const cors = require('cors');

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
const { mongoClient, authInfoCollection, sentMessagesCollection } = require('./mongodb');
const useMongoDBAuthState = require('./mongoAuthState');
const { Boom } = require('@hapi/boom');

app.use('/assets', express.static(__dirname + './client/assets'));

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());
app.use('/assets', express.static(__dirname + '/client/assets'));

// // Importing Routes
const routes = require('./routes');
const { home, scan, allMessages, swaggerUi, swaggerSpecs } = routes;

// Using simplified routes
app.use('/', home);
app.use('/', scan);
app.use('/', allMessages);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, { explorer: true }));

// WhatsApp Connection Success
connectToWhatsApp()
  .then(() => {
    console.log('Connected to WhatsApp successfully');
  })
  .catch((err) => {
    console.error('Error connecting to WhatsApp:', err);
  });

server.listen(port, () => {
  console.log('Server Running on Port: ' + port);
});

//
//
//
//
//

let sock;
let qrDinamic;
let soket;
// Connect to WhatsApp function
async function connectToWhatsApp() {
  try {
    console.log('Initiating WhatsApp connection');
    await mongoClient.connect();
    const { state, saveCreds } = await useMongoDBAuthState(authInfoCollection);

    // Creating WhatsApp client
    sock = makeWASocket({
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
          console.log(`Bad Session File, Please Delete ${session} and Scan Again`);
          sock.logout();
        } else if (reason === DisconnectReason.connectionClosed) {
          console.log('Connection closed, reconnecting...');
          connectToWhatsApp();
        } else if (reason === DisconnectReason.connectionLost) {
          console.log('Server connection lost, reconnecting...');
          connectToWhatsApp();
        } else if (reason === DisconnectReason.connectionReplaced) {
          console.log('Connection replaced, another new session opened, please close the current session first');
          sock.logout();
        } else if (reason === DisconnectReason.loggedOut) {
          console.log(`Device closed, remove it ${session} and scan again.`);
          sock.logout();
        } else if (reason === DisconnectReason.restartRequired) {
          console.log('Restart required, restarting...');
          connectToWhatsApp();
        } else if (reason === DisconnectReason.timedOut) {
          console.log('Connection time expired, connecting...');
          connectToWhatsApp();
        } else {
          sock.end(`Unknown disconnection reason: ${reason}|${lastDisconnect.error}`);
        }
      } else if (connection === 'open') {
        console.log('Connected ');
        return;
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      try {
        if (type === 'notify' && !messages[0]?.key.fromMe) {
          const { key, message } = messages[0];

          if (message.conversation) {
            const { extendedTextMessage } = message;

            if (messages[0].message.conversation.toLowerCase() === 'ping') {
              console.log('Received ping, sending pong.');
              await sock.sendMessage(key.remoteJid, { text: 'Pong' }, { quoted: messages[0] });
            } else if (messages[0].message.conversation.toLowerCase() === 'testing') {
              console.log('Received testing, sending tested.');
              await sock.sendMessage(key.remoteJid, { text: 'Tested' }, { quoted: messages[0] });
            } else if (extendedTextMessage) {
              console.log(`Received message: (${extendedTextMessage.text}) from: ${key.remoteJid}`);
            } else {
              console.log('No valid message content found.', messages[0].message.conversation);
            }
          } else {
            console.log('No conversation found in the message.');
          }
        }
      } catch (error) {
        console.log('We encountered some Error:', error);
      }
    });

    sock.ev.on('creds.update', saveCreds);
  } catch (error) {
    console.log('Error connecting to WhatsApp:', error);
  }
}

// Check if connected to WhatsApp
const isConnected = () => {
  return sock?.user ? true : false;
};

// Update QR code function
const updateQR = (data) => {
  switch (data) {
    case 'qr':
      qrcode.toDataURL(qrDinamic, (err, url) => {
        soket?.emit('qr', url);
        soket?.emit('log', 'QR code received, scan');
        console.log('sending qr code');
      });
      break;
    case 'connected':
      soket?.emit('qrstatus', './assets/check.svg');
      soket?.emit('log', ' User connected');
      const { id, name } = sock?.user;
      var userinfo = id + ' ' + name;
      soket?.emit('user', userinfo);
      break;
    case 'loading':
      soket?.emit('qrstatus', './assets/loader.gif');
      soket?.emit('log', 'Loading....');
      break;
    default:
      break;
  }
};

// Route to send a WhatsApp message
app.get('/send-message', async (req, res) => {
  const tempMessage = req.query.message;
  const number = req.query.number;
  console.log('Message:', tempMessage, 'Number:', number);
  let numberWA;
  try {
    if (!number) {
      res.status(500).json({
        status: false,
        response: 'The number does not exist'
      });
    } else {
      numberWA = number + '@s.whatsapp.net';

      if (isConnected()) {
        const exist = await sock.onWhatsApp(numberWA);
        console.log('Checking existence of the number', exist);
        if (exist?.jid || (exist && exist[0]?.jid)) {
          sock
            .sendMessage(exist.jid || exist[0].jid, {
              text: tempMessage
            })
            .then(async (result) => {
              // Save sent message to the database
              try {
                await sentMessagesCollection.insertOne({
                  sender: sock.user.id,
                  recipient: numberWA,
                  message: tempMessage,
                  timestamp: new Date()
                });
                console.log('Message saved to database successfully');
              } catch (error) {
                console.error('Error saving message to database:', error);
              }
              // Send the response
              res.status(200).json({
                status: true,
                response: result
              });
            })
            .catch((err) => {
              res.status(500).json({
                status: false,
                response: err
              });
            });
        } else {
          res.status(500).json({
            status: false,
            response: 'This number is not on WhatsApp.'
          });
        }
      } else {
        res.status(500).json({
          status: false,
          response: 'You are not connected yet'
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
    updateQR('connected');
  } else if (qrDinamic) {
    updateQR('qr');
  }
};

io.on('connection', handleSocketConnection);
