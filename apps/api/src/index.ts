import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env, validateEnv } from './config/env.js';
import { connectDB } from './db.js';
import { sessionMiddleware, errorHandler } from './middleware/index.js';
import { configurePassport, passport } from './services/oauth.js';
import { authRouter } from './routes/auth.js';
import { bracketRouter } from './routes/bracket.js';
import { apiRouter } from './routes/admin.js';

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: env.webUrl, credentials: true }));
app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());
app.use(sessionMiddleware);

configurePassport();
app.use(passport.initialize());

app.get('/health', (_req, res) => res.json({ ok: true, env: env.nodeEnv }));
app.use('/auth', authRouter);
app.use('/api', bracketRouter);
app.use('/api', apiRouter);

app.use(errorHandler);

async function start() {
  const warnings = validateEnv();
  if (warnings.length) { console.log('\n  Config notes:'); warnings.forEach((w) => console.log('   • ' + w)); console.log(''); }
  await connectDB();
  app.listen(env.port, () => {
    console.log(`  BanglaBracket API → ${env.apiUrl} (port ${env.port})`);
    console.log(`  Web origin (CORS): ${env.webUrl}`);
  });
}

start().catch((e) => { console.error('Fatal startup error:', e); process.exit(1); });
