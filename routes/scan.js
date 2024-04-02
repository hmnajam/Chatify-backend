const express = require('express');
const router = express.Router();
const path = require('path');

const qrcode = require('qrcode');

// Scan Page
router.get('/scan', (req, res) => {
  const indexPath = path.join(__dirname, '../client/index.html');
  res.sendFile(indexPath);
});

module.exports = router;
