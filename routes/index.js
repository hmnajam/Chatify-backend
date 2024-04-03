const home = require('./home');
const scan = require('./scan');
const allMessages = require('./allMessages');
const sendMessageRouter = require('./sendMessage');
const { swaggerUi, swaggerSpecs } = require('./api-docs');

module.exports = {
  home,
  scan,
  allMessages,
  sendMessageRouter,
  swaggerUi,
  swaggerSpecs
};
