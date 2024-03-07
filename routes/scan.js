const express = require("express");
const router = express.Router();
const path = require("path");
const qrcode = require("qrcode");

// Scan Page
router.get("/scan", (req, res) => {
  const indexPath = path.join(__dirname, "../client/index.html");
  res.sendFile(indexPath);
});

// let qrDinamic;
// let soket;
//
// Update QR code function
// const updateQR = (data) => {
//   switch (data) {
//     case "qr":
//       qrcode.toDataURL(qrDinamic, (err, url) => {
//         soket?.emit("qr", url);
//         soket?.emit("log", "QR code received, scan");
//       });
//       break;
//     case "connected":
//       const indexPath = path.join(__dirname, "../client/assets/check.svg");
//       // console.log("indexPath path:", path.resolve(indexPath));
//       fs.readFile(indexPath, (err, data) => {
//         if (err) {
//           console.error(`Error reading file: ${err}`);
//           soket?.emit("log", `Error reading file: ${err}`);
//         } else {
//           const base64Image = Buffer.from(data).toString("base64");
//           soket?.emit("qrstatus", `data:image/svg+xml;base64,${base64Image}`);
//           soket?.emit("log", "File sent successfully");
//         }
//       });
//       soket?.emit("log", " User connected");
//       const { id, name } = soket?.user;
//       var userinfo = id + " " + name;
//       soket?.emit("user", userinfo);
//       break;
//     case "loading":
//       soket?.emit("qrstatus", "../client/assets/loader.gif");
//       soket?.emit("log", "Loading....");
//       break;
//     default:
//       break;
//   }
// };

module.exports = router;
