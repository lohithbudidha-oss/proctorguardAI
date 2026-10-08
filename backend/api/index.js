const app = require('../dist/app').default;
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aptitude_portal';

if (mongoose.connection.readyState === 0) {
  mongoose.connect(MONGODB_URI).then(() => console.log('Connected to MongoDB via Vercel Serverless'));
}

module.exports = app;
