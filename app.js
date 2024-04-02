const bodyParser = require('body-parser');
const app = require('express')();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
require('dotenv').config();
const port = process.env.PORT || 7000;
const cors = require('cors');
const express = require('express');

app.use('/assets', express.static(__dirname + '/client/assets'));
// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

// // Importing Routes
const routes = require('./routes');
const { home, scan, allMessages, swaggerUi, swaggerSpecs } = routes;
const { router: sendMessageRouter, handleSocketConnection, connectToWhatsApp } = require('./routes/sendMessage');
io.on('connection', handleSocketConnection);

// WhatsApp Connection Success
connectToWhatsApp()
  .then(() => {
    console.log('Connected to WhatsApp successfully');
  })
  .catch((err) => {
    console.error('Error connecting to WhatsApp:', err);
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
