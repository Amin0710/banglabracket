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
// CORS: allow the apex + any banglabracket.com subdomain (www, app, etc.) and
// localhost for dev. Robust to www/apex/trailing-slash differences.
function isAllowedOrigin(origin?: string): boolean {
  if (!origin) return true; // non-browser / same-origin
  try {
    const host = new URL(origin).hostname;
    if (host === 'localhost' || host === '127.0.0.1') return true;
    if (host === 'banglabracket.com' || host.endsWith('.banglabracket.com')) return true;
    // also honor an explicitly configured WEB_URL host
    if (env.webUrl) { const wh = new URL(env.webUrl).hostname; if (host === wh) return true; }
  } catch { /* ignore */ }
  return false;
}
const corsOptions: cors.CorsOptions = {
  origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
  credentials: true,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // answer all preflight requests
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
