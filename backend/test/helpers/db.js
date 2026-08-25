/**
 * Shared test-database helper.
 *
 * Spins up an in-memory MongoDB (via mongodb-memory-server) so `npm test`
 * works on any machine with zero external setup. If TEST_MONGODB_URI is
 * provided (e.g. a CI service container), that instance is used instead.
 */
const mongoose = require("mongoose");

process.env.NODE_ENV = process.env.NODE_ENV || "test";

let memoryServer;

async function getTestDbUri() {
  if (process.env.TEST_MONGODB_URI) {
    return process.env.TEST_MONGODB_URI;
  }

  const { MongoMemoryServer } = require("mongodb-memory-server");
  if (!memoryServer) {
    memoryServer = await MongoMemoryServer.create();
  }
  return memoryServer.getUri("scheduleai_test");
}

async function connectTestDb() {
  const uri = await getTestDbUri();
  await mongoose.connect(uri);
  await mongoose.connection.dropDatabase();
  return uri;
}

async function disconnectTestDb() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = undefined;
  }
}

module.exports = { connectTestDb, disconnectTestDb };
