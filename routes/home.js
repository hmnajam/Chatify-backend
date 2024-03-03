const express = require("express");
const router = express.Router();
const path = require("path");

// Home page
router.get("/", (req, res) => {
  const indexPath = path.join(__dirname, "../index.html");
  res.sendFile(indexPath);
  // Add other logic as needed
});

module.exports = router;
