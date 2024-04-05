const express = require('express');
const router = express.Router();
//

const app = require('express')();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const { sock, isConnected } = require('./whatsappService');

// Run the isConnected function after 5 seconds
setTimeout(() => {
  const isConnectedToWhatsApp = isConnected();
  console.log('Connected to WhatsApp in send message file:', isConnectedToWhatsApp);
  console.log(sock);
}, 6000);

// Route to send a WhatsApp message
router.get('/send-message', async (req, res) => {
  const tempMessage = req.query.message;
  const number = req.query.number;
  console.log('Message:', tempMessage, 'Number:', number);
  let numberWA;
  try {
    console.log('Send Message api just got hit.');
    if (!number) {
      res.status(500).json({
        status: false,
        response: 'The number does not exist'
      });
      return;
    } else {
      numberWA = number + '@s.whatsapp.net';

      if (isConnected()) {
        console.log('At is connected');
        console.log(isConnected());
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

// Export the router and socket connection event
module.exports = { router };
