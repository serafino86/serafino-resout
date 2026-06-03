"use strict";

const path = require("node:path");
const dotenv = require("dotenv");

function loadEnv(rootDir) {
  const baseDir = rootDir || path.resolve(__dirname, "..");
  const envPath = path.join(baseDir, ".env");
  const productionPath = path.join(baseDir, ".env.production");

  dotenv.config({ path: productionPath, override: false });
  dotenv.config({ path: envPath, override: true });

  return {
    envPath,
    productionPath,
  };
}

module.exports = {
  loadEnv,
};
