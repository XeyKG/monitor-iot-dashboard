const { defineConfig } = require("cypress");

module.exports = defineConfig({
  e2e: {
    baseUrl: "http://127.0.0.1:8080",
    viewportWidth: 1280,
    viewportHeight: 720,
    specPattern: "cypress/e2e/app.cy.js",
    setupNodeEvents(on, config) {
      // node event listeners can be registered here if needed
    },
  },
});
