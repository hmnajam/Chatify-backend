swaggerJsdoc = require('swagger-jsdoc');
swaggerUi = require('swagger-ui-express');

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

// Swagger options
const options = {
  definition: {
    openapi: '3.1.0',
    info: {
      title: 'Chatterly APIs with Swagger',
      version: '0.1.0',
      description: 'Official swagger documentation of Chatterly APIs.',
      license: {
        name: 'MIT',
        url: 'https://spdx.org/licenses/MIT.html'
      },
      contact: {
        name: 'Najam Saeed',
        url: 'https://najam.pk/',
        email: 'hmnajam@gmail.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:8000'
      }
    ]
  },
  apis: ['./routes/api-docs.js']
};

const swaggerSpecs = swaggerJsdoc(options);

module.exports = { swaggerUi, swaggerSpecs };
