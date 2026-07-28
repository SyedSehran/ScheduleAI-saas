const mongoose = require("mongoose");

let connectionPromise;

function getMongoUri() {
  return process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/scheduleai";
}

async function connectDb() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(getMongoUri(), {
      serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 5000),
    });
  }

  await connectionPromise;
  return mongoose.connection;
}

module.exports = { connectDb, getMongoUri };
