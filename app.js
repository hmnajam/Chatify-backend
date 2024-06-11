require('dotenv').config();
const bodyParser = require('body-parser');
const app = require('express')();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const port = process.env.PORT || 7000;
const cors = require('cors');
const express = require('express');
const path = require('path');

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());
app.use('/assets', express.static(__dirname + '/client/assets'));

// Serve the HTML file from the root directory
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Importing Routes
const routes = require('./routes');
const { home, scan, allMessages, swaggerUi, swaggerSpecs } = routes;
const { router: sendMessageRouter, handleSocketConnection, connectToWhatsApp } = require('./routes/sendMessage');

// Socket.io connection
io.on('connection', (socket) => {
  const clientId = socket.handshake.query.clientId;
  if (!clientId) {
    console.log('Client ID not provided');
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

// Using simplified routes
app.use('/', home);
app.use('/', scan);
app.use('/', sendMessageRouter);
app.use('/', allMessages);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, { explorer: true }));

server.listen(port, () => {
  console.log('Server Running on Port: ' + port);
});
