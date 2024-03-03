const express = require("express");
const router = express.Router();
const path = require("path");

/**
 * @swagger
 * paths:
 *   /scan:
 *     get:
 *       summary: Serve index.html for scanning
 *       responses:
 *         '200':
 *           description: User logged in successfully
 *       x-swagger-router-controller: scan
 *       operationId: index
 *       tags:
 *         - scan
 */
// Scan Page
router.get("/scan", (req, res) => {
  const indexPath = path.join(__dirname, "../client/index.html");
  res.sendFile(indexPath);
});

module.exports = router;
