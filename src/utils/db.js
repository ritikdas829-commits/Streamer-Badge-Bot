'use strict';

const mongoose = require('mongoose');

async function connectDB() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI environment variable is not defined!');
    }

    await mongoose.connect(mongoUri);
    console.log('[Database] Connected to MongoDB successfully.');
  } catch (err) {
    console.error('[Database] MongoDB connection failed:', err.message);
    throw err;
  }
}

module.exports = { connectDB };
