const path = require("path");

module.exports = {
  configureWebpack: {
    resolve: {
      alias: {
        "@": path.join(__dirname, "exemples")
      }
    },
    entry: {
      app: path.join(__dirname, "exemples", "main.ts")
    }
  }
};
