const express = require("express");
const router = express.Router();
const path = require("path");

const {
  mongoClient,
  authInfoCollection,
  sentMessagesCollection,
} = require("../mongodb");

/**
 * @swagger
 * paths:
 *   /send-message:
 *     get:
 *       summary: Send a WhatsApp message
 *       parameters:
 *         - name: message
 *           in: query
 *           description: The message to be sent
 *           required: true
 *           schema:
 *             type: string
 *         - name: number
 *           in: query
 *           description: The recipient's phone number
 *           required: true
 *           schema:
 *             type: string
 *       responses:
 *         '200':
 *           description: Successful response
 *           content:
 *             application/json:
 *               example:
 *                 status: true
 *                 response: Success message
 *         '500':
 *           description: Error response
 *           content:
 *             application/json:
 *               example:
 *                 status: false
 *                 response: Error message
 *       x-swagger-router-controller: sendMessage
 *       operationId: index
 *       tags:
 *         - sendMessage
 */

router.get("/send-message", async (req, res) => {
  const tempMessage = req.query.message;
  const number = req.query.number;
  console.log("Message:", tempMessage, "Number:", number);
  await mongoClient.connect();
  let numberWA;
  try {
    if (!number) {
      res.status(500).json({
        status: false,
        response: "The number does not exist",
      });
    } else {
      numberWA = number + "@s.whatsapp.net";

      if (isConnected()) {
        const exist = await sock.onWhatsApp(numberWA);
        console.log("Chacking existance of the number", exist);
        if (exist?.jid || (exist && exist[0]?.jid)) {
          sock
            .sendMessage(exist.jid || exist[0].jid, {
              text: tempMessage,
            })
            .then(async (result) => {
              // Save sent message to the database
              try {
                await sentMessagesCollection.insertOne({
                  sender: sock.user.id,
                  recipient: numberWA,
                  message: tempMessage,
                  timestamp: new Date(),
                });
                console.log("Message saved to database successfully");
              } catch (error) {
                console.error("Error saving message to database:", error);
              }
              // Send the response
              res.status(200).json({
                status: true,
                response: result,
              });
            })
            .catch((err) => {
              res.status(500).json({
                status: false,
                response: err,
              });
            });
        } else {
          res.status(500).json({
            status: false,
            response: "This number is not on Whatsapp.",
          });
        }
      } else {
        res.status(500).json({
          status: false,
          response: "You are not connected yet",
        });
      }
    }
  } catch (err) {
    res.status(500).send(err);
  }
});

module.exports = router;
