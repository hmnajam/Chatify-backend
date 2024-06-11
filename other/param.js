const express = require("express");
const { Client, LocalAuth } = require("whatsapp-web.js");
const axios = require("axios");
const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");

require("dotenv").config();

const qrcode = require("qrcode-terminal");

const openai = new OpenAI({
  apiKey:
    process.env.OPENAI_API_KEY ||
    require("dotenv").config().parsed?.process.env.OPENAI_API_KEY,
});

const app = express();
const port = process.env.PORT || 3001;

// Middleware to parse JSON data in the request body
app.use(express.json());

// Define a route for the root path ("/")
app.get("/", (req, res) => {
  const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  res.type("html").send(html);
  console.log(`Server is running on port ${port} Render app.`);
  console.log(`Example app listening on port ${port}!`);
});

// app.get("/", (req, res) => res.type("html").send(html));
const server = app.listen(port, () =>
  console.log(`Example app listening on port ${port}!`)
);

app.post("/api/send-message", async (req, res) => {
  console.log(req);
  console.log(`Received API request on /api/send-message/in params`);

  const { number, message } = req.query;

  try {
    const { number, message } = req.query; // Get the params
    console.log(number, message);
    const msg = await client.sendMessage(`${number}@c.us`, message); // Send the message
    res.send({ msg }); // Send the response
  } catch (error) {
    express(error);
  }
});

// Creating a new whatsapp client
const client = new Client({
  puppeteer: {
    headless: true,
  },
  authStrategy: new LocalAuth({
    clientId: "client-one",
    dataPath: path.join("./", "var", "data", ".wwebjs_auth"),
  }),
});

client.on("qr", (qr) => {
  console.log("QR RECEIVED", qr);
  qrcode.generate(qr, { small: true });
  console.log("Client is ready.");
});

client.on("message", async (message) => {
  console.log("Incoming Message:", message.from, message.body);
  if (message.body.toLowerCase() === "ping") {
    console.log("Pong");
    client.sendMessage(message.from, "Pong");
  }
});
client.initialize();
console.log("Client initialization started");
