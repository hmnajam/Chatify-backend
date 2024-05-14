const express = require('express');
const router = express.Router();
const app = require('express')();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const { sock, connectToWhatsApp, getSock, isConnected } = require('./whatsappService');


// Run the isConnected function after 5 seconds
// setTimeout(() => {
//   const isConnectedToWhatsApp = isConnected();
//   console.log('Connected to WhatsApp in send message file:', isConnectedToWhatsApp);
//   // console.log('The value of sock in sendMessage.js is', sock);
// }, 4000);

// Route to send a WhatsApp message
router.get('/send-message', async (req, res) => {


    const whatsappConnection = await connectToWhatsApp();
    
    // console.log(whatsappConnection,"line 21");

    const tempMessage = req.query.message;
    const number = req.query.number;

    // console.log('Message:', tempMessage, 'Number:', number);

    try {

        // console.log('Send Message api just got hit. Sock is, ', whatsappConnection);
        // console.log(whatsappConnection.user);

        if (!number) {

            res.status(500).json({
                status: false,
                response: 'Please send a whatsapp number in api request.'
            });

            return;

        } else {

            
            if (isConnected(whatsappConnection)) {
                
                const numberWA = number + '@s.whatsapp.net';

                console.log('At is connected in sendMessage.js', isConnected(whatsappConnection));

                // console.log(whatsappConnection.onWhatsApp(), getSock.onWhatsApp());
                // console.log(whatsappConnection.onWhatsApp(numberWA), getSock.onWhatsApp(numberWA));


                const exist = await whatsappConnection.onWhatsApp(numberWA);
                // const exist2 = await getSock.onWhatsApp(numberWA);

                console.log('Checking existence of the number', exist, "line 48");

                if (exist?.jid || (exist && exist[0]?.jid)) {

                    whatsappConnection
                        .sendMessage(exist.jid || exist[0].jid, {
                            text: tempMessage
                        })
                        .then(async (result) => {

                            // Save sent message to the database
                            try {

                                await sentMessagesCollection.insertOne({
                                    sender: whatsappConnection.user.id,
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
