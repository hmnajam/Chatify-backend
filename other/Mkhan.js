// Creating a basic express app
const express = require("express");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const axios = require("axios");
const OpenAI = require("openai");
require('dotenv').config();


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || require('dotenv').config().parsed.env.OPENAI_API_KEY,
});

const app = express();
const port = process.env.PORT || 3001;

// Middleware to parse JSON data in the request body
app.use(express.json());

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);

  // Define a route for the root path ("/")
  app.get("/", (req, res) => {
    res.send("Hello, this is the root path inside get block");
    console.log(`Server is running on port ${port} inside get block`);
  });



  app.post("/api/send-message", async (req, res) => {
    console.log(`Server is running on port ${port} inside API`);
    console.log(`Received API request on /api/send-message`);

    const { number, message } = req.query;

    try {
      const { number, message } = req.body; // Get the body
      console.log(number, message);
      const msg = await client.sendMessage(`${number}@c.us`, message); // Send the message
      res.send({ msg }); // Send the response
    } catch (error) {
      express(error);
    }
  });
});

// Creating a new whatsapp client
const client = new Client({
  puppeteer: {
    headless: true,
  },
  authStrategy: new LocalAuth({
    clientId: "client-one",
  }),
});

client.on("qr", (qr) => {
  console.log("QR RECEIVED", qr);
  qrcode.generate(qr, { small: true });
  console.log("Client is ready.");
});

client.on("ready", () => {
  console.log("Whatsapp bot is ready");
  const businessNo = "923131060542@c.us";
  client.sendMessage(businessNo, "Whatsapp bot is ready");
});

client.on("message", async (message) => {
  console.log("Incoming Message:", message.from, message.body);
  if (message.body.toLowerCase() === "ping") {
    console.log("Pong");
    client.sendMessage(message.from, "Pong");
  } else if (message.body.toLowerCase() === "joke") {
    const joke = await axios
      .get(
        "https://api.api-ninjas.com/v1/jokes?limit=1&X-Api-Key=p7shyiRQFPkuSSSH3hH9Bg==tIaHX7YGYnFl92Xz"
      )
      .then((res) => res.data);
    console.log(joke);
    client.sendMessage(
      message.from,
      `There is an random joke for you: \n\n ${joke[0].joke}`
    );
  } else if (message.body.toLowerCase() === "fact") {
    const fact = await axios
      .get(
        "https://api.api-ninjas.com/v1/facts?limit=1&X-Api-Key=p7shyiRQFPkuSSSH3hH9Bg==tIaHX7YGYnFl92Xz"
      )
      .then((res) => res.data);
    console.log(fact);
    client.sendMessage(
      message.from,
      `There is a random fact for you: \n\n ${fact[0].fact}`
    );
  } else if (message.body.toLowerCase() === "quote") {
    const quote = await axios
      .get(
        "https://api.api-ninjas.com/v1/quotes?category=inspirational&X-Api-Key=p7shyiRQFPkuSSSH3hH9Bg==tIaHX7YGYnFl92Xz"
      )
      .then((res) => res.data);
    console.log(quote);
    client.sendMessage(
      message.from,
      `There is an inspirational quote for you: \n\n ${quote[0].quote}\n      ${
        quote[0]?.author || "Unknown"
      }`
    );
    console.log(
      `There is an inspirational quote for you: \n\n ${quote[0].quote}`
    );
  } else if (message.body.toLowerCase().endsWith("@ai")) {
    try {
      const userMessage = message.body;
      const completion = await openai.chat.completions.create({
        messages: [{ role: "system", content: userMessage }],
        model: "gpt-3.5-turbo",
        max_tokens: 100,
        temperature: 0.0,
      });

      const reply = completion.choices[0].message.content;

      console.log("Sending reply from OpenAI:", reply);

      // Sending the completion as a message
      client.sendMessage(message.from, `Reply from OpenAI:\n\n ${reply}`);
    } catch (error) {
      console.error("Error from OpenAI:", error);
      client.sendMessage(
        message.from,
        "There was an error processing your request."
      );
    }
  }
});
client.initialize();
console.log("Client initialization started");
