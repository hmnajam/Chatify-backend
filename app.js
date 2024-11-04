require('dotenv').config();
const express = require('express');
const app = express();

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() }); // or diskStorage if needed
const fs = require('fs');

const qrcode = require('qrcode');
const log = require('pino');
const { Boom } = require('@hapi/boom');
const server = require('http').createServer(app);
const bodyParser = require('body-parser');
const io = require('socket.io')(server);
const port = process.env.PORT || 8000;
const cors = require('cors');
const path = require('path');
const useMongoDBAuthState = require('./mongoAuthState');
const { mongoClient, authInfoCollection, sentMessagesCollection, clientCollection } = require('./mongodb');
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

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use('/assets', express.static(__dirname + '/client/assets'));

let sock;
let qrDinamic;
let soket;
let clients = {};

// Connect to WhatsApp function
async function connectToWhatsApp(clientId) {
  try {
    console.log(`Initiating WhatsApp connection for client: ${clientId}`);
    await mongoClient.connect();
    console.log('MongoDB connected successfully');
    const { state, saveCreds } = await useMongoDBAuthState(authInfoCollection, clientId);
    const sock = makeWASocket({
      browser: Browsers.macOS('Chatify'),
      printQRInTerminal: true,
      auth: state,
      logger: log({ level: 'silent' })
    });
    sock.ev.on('connection.update', async (update) => {
      console.log(`Connection update for client ${clientId}:`, update);
      const { connection, lastDisconnect, qr } = update;
      qrDinamic = qr;
      if (connection === 'close') {
        let reason = new Boom(lastDisconnect.error).output.statusCode;
        console.log(`Client ${clientId} connection closed with reason: ${reason}`);
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
        // Save the client information to the clients collection
        await clientCollection.updateOne(
          { clientId: clientId },
          { $set: { clientId: clientId, connected: true } },
          { upsert: true }
        );
      }
    });
    sock.ev.on('creds.update', saveCreds);
  } catch (error) {
    console.log(`Error connecting to WhatsApp for client ${clientId}:`, error);
  }
}

// Route to send a WhatsApp message
app.get('/send-message', async (req, res) => {
  const { message, number, clientId } = req.query;
  // console.log('Message:', message, 'Number:', number, 'Client:', clientId);
  let numberWA;
  try {
    if (!number) {
      return res.status(500).json({ status: false, response: 'The number does not exist' });
    }
    numberWA = number + '@s.whatsapp.net';
    const clientSock = clients[clientId];
    if (clientSock) {
      try {
        const exist = await clientSock.onWhatsApp(numberWA);
        // console.log('Checking existence of the number', exist);
        if (exist?.jid || (exist && exist[0]?.jid)) {
          clientSock
            .sendMessage(exist.jid || exist[0].jid, { text: message, linkPreview: true })
            .then(async (result) => {
              // Send the response
              res.status(200).json({ status: true, response: result });
            })
            .catch(async (err) => {
              res.status(500).json({ status: false, response: err });
            });
        } else {
          res.status(500).json({ status: false, response: 'This number is not on WhatsApp.' });
        }
      } catch (error) {
        console.error('Error saving message to database:', error);
        res.status(500).json({ status: false, response: 'Error saving message to database' });
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
    updateQR('qr', clientId, soket); // Pass soket as an argument
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

// Reconnect clients on server restart
async function reconnectClients() {
  // await mongoClient.connect();
  const clients = await clientCollection.find({ connected: true }).toArray();
  for (const client of clients) {
    await connectToWhatsApp(client.clientId);
  }
}

// Serve the HTML file from the root directory
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Scan Page
app.get('/scan', (req, res) => {
  const indexPath = path.join(__dirname, '../client/index.html');
  res.sendFile(indexPath);
});

app.get('/generate-qr-code', async (req, res) => {
  console.log('Request to generate QR code received');

  // Check if qrDinamic is set
  if (!qrDinamic) {
    console.log('No QR code available, generating a new one...');
    const clientId = req.query.clientId; // Get clientId from query params
    // const clientId = 'hardcode'
    // Check if clientId is provided
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID is required to generate a QR code' });
    }
    // Initiate WhatsApp connection for the client to generate a new QR code
    try {
      await connectToWhatsApp(clientId); // Initiates connection and generates a new QR code
    } catch (error) {
      console.error('Error generating new QR code:', error);
      return res.status(500).json({ error: 'Failed to generate new QR code' });
    }
    // Wait a few seconds for the QR code to be generated
    let attempts = 0;
    const maxAttempts = 5; // Maximum attempts to check for the QR code

    const waitForQRCode = setInterval(() => {
      if (qrDinamic) {
        clearInterval(waitForQRCode);
        qrcode
          .toDataURL(qrDinamic)
          .then((qrCodeUrl) => {
            res.json({ qrCodeUrl });
          })
          .catch((err) => {
            console.error('Error generating QR code URL:', err);
            res.status(500).json({ error: 'Failed to generate QR code' });
          });
      } else if (attempts >= maxAttempts) {
        clearInterval(waitForQRCode);
        res.status(500).json({ error: 'QR code generation timed out. Please try again.' });
      }
      attempts++;
    }, 1000); // Check every second
  } else {
    // QR code is available, generate and return it
    try {
      const qrCodeUrl = await qrcode.toDataURL(qrDinamic);
      res.json({ qrCodeUrl });
    } catch (error) {
      console.error('Error generating QR code:', error);
      res.status(500).json({ error: 'Failed to generate QR code' });
    }
  }
});

// Route to send a WhatsApp message
app.post('/send-media-message', upload.single('file'), async (req, res) => {
  try {
    const { number, message, clientId } = req.body;
    const file = req.file;
    console.log('Message:', message, 'Number:', number, 'Client:', clientId, 'File:', file);
    let numberWA;
    if (!number) {
      return res.status(500).json({ status: false, response: 'The number does not exist' });
    }
    numberWA = number + '@s.whatsapp.net';
    const clientSock = clients[clientId];
    if (clientSock) {
      try {
        const exist = await clientSock.onWhatsApp(numberWA);
        console.log('Checking existence of the number', exist);
        if (exist?.jid || (exist && exist[0]?.jid)) {
          clientSock
            .sendMessage(exist.jid || exist[0].jid, {
              document: file.buffer, // Directly use the buffer
              mimetype: 'application/pdf',
              fileName: file.originalname,
              caption: message // Optional caption for the file
            })
            .then(async (result) => {
              // Send the response
              res.status(200).json({ status: true, response: result });
            })
            .catch(async (err) => {
              res.status(500).json({ status: false, response: err });
            });
        } else {
          res.status(500).json({ status: false, response: 'This number is not on WhatsApp.' });
        }
      } catch (error) {
        console.error('Error saving message to database1:', error);
        res.status(500).json({ status: false, response: 'Error saving message to database2' });
      }
    } else {
      res.status(500).json({ status: false, response: 'Client is not connected yet bhai ' });
    }
  } catch (err) {
    res.status(500).send(err);
  }
});

// Socket.io connection
io.on('connection', (socket) => {
  const clientId = socket.handshake.query.clientId;
  if (!clientId) {
    // console.log('Client ID not provided');
    socket.disconnect(true);
    return;
  }
  console.log(`Client connected: ${clientId}`);
  handleSocketConnection(socket, clientId);
  connectToWhatsApp(clientId)
    .then(() => {
      console.log(`Connected to WhatsApp successfully for client: ${clientId}`);
    })
    .catch((err) => {
      console.error(`Error connecting to WhatsApp for client ${clientId}:`, err);
    });
});

reconnectClients().then(() => {
  server.listen(port, () => {
    console.log('Server Running on Port: ' + port);
  });
});
