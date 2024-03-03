const express = require("express");
const router = express.Router();
const path = require("path");

const {
  mongoClient,
  authInfoCollection,
  sentMessagesCollection,
} = require("../mongodb");

// Function to retrieve all messages from MongoDB
async function getAllMessagesFromDB() {
  try {
    const allMessages = await sentMessagesCollection
      .find(
        {},
        { projection: { recipient: 1, message: 1, timestamp: 1, _id: 0 } }
      )
      .sort({ timestamp: -1 }) // Sort in descending order based on timestamp
      .limit(20) // Limit the result to the last 20 messages
      .toArray();
    return allMessages;
  } catch (error) {
    console.error("Error retrieving messages from database:", error);
    throw error;
  }
}

router.get("/get-all-messages", async (req, res) => {
  try {
    const allMessages = await getAllMessagesFromDB();
    res.setHeader("Content-Type", "application/json");
    res.status(200).send(
      JSON.stringify(
        {
          status: true,
          response: allMessages,
        },
        null,
        4
      )
    );
  } catch (error) {
    res.status(500).json({
      status: false,
      response: "Error retrieving messages",
    });
  }
});

module.exports = router;
