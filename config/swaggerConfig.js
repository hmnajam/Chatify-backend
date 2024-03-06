// swaggerConfig.js

swaggerJsdoc = require("swagger-jsdoc");
swaggerUi = require("swagger-ui-express");

// Swagger options
const options = {
  definition: {
    openapi: "3.1.0",
    info: {
      title: "Chatterly APIs with Swagger",
      version: "0.1.0",
      description: "Official swagger documentation of Chatterly APIs.",
      license: {
        name: "MIT",
        url: "https://spdx.org/licenses/MIT.html",
      },
      contact: {
        name: "Najam Saeed",
        url: "https://najam.pk/",
        email: "hmnajam@gmail.com",
      },
    },
    servers: [
      {
        url: "http://localhost:8000",
      },
    ],
  },
  apis: ["./appb.js"],
};

const swaggerSpecs = swaggerJsdoc(options);

module.exports = { swaggerUi, swaggerSpecs };
