// Load environment variables before initializing the app and connecting.
require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');

const PORT = process.env.PORT || 5000;

async function start() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is missing from backend/.env');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected');
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

start().catch(error => {
  console.error('Server startup failed:', error.message);
  process.exit(1);
});
