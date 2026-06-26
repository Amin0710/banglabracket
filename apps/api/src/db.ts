import mongoose from 'mongoose';
import { env } from './config/env.js';

export async function connectDB() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 8000 });
  console.log('  ✓ MongoDB connected');
}
