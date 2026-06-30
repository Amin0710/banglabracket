import dotenv from "dotenv";
dotenv.config();

const bool = (v: string | undefined, d = false) =>
	v === undefined ? d : ["1", "true", "yes", "on"].includes(v.toLowerCase());

export const env = {
	nodeEnv: process.env.NODE_ENV || "development",
	port: parseInt(process.env.PORT || "4000", 10),
	apiUrl: process.env.API_URL || "http://localhost:4000",
	webUrl: process.env.WEB_URL || "http://localhost:5173",
	// app is served under this path (e.g. /wc2026/app); used for OAuth redirects
	webAppPath: process.env.WEB_APP_PATH || "/wc2026/app",

	mongoUri:
		process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/banglabracket",

	// 64 hex chars (32 bytes). Used for sessions + as base for field encryption.
	jwtSecret: process.env.JWT_SECRET || "",
	// 64 hex chars (32 bytes) — AES-256 key for encrypting NID/DOB at rest.
	encKey: process.env.ENCRYPTION_KEY || "",
	cookieName: process.env.COOKIE_NAME || "bb_session",
	cookieSecure: bool(
		process.env.COOKIE_SECURE,
		process.env.NODE_ENV === "production",
	),
	cookieDomain: process.env.COOKIE_DOMAIN || undefined,
	sessionTtlDays: parseInt(process.env.SESSION_TTL_DAYS || "60", 10),

	adminEmails: (process.env.ADMIN_EMAILS || "")
		.split(",")
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean),

	google: {
		id: process.env.GOOGLE_CLIENT_ID || "",
		secret: process.env.GOOGLE_CLIENT_SECRET || "",
		get enabled() {
			return !!(this.id && this.secret);
		},
	},
	facebook: {
		id: process.env.FACEBOOK_CLIENT_ID || "",
		secret: process.env.FACEBOOK_CLIENT_SECRET || "",
		enabledFlag: bool(process.env.FACEBOOK_ENABLED, false), // gate so slow approval can't block launch
		get enabled() {
			return this.enabledFlag && !!(this.id && this.secret);
		},
	},

	resend: {
		key: process.env.RESEND_API_KEY || "",
		from: process.env.MAIL_FROM || "BanglaBracket <noreply@banglabracket.com>",
		get enabled() {
			return !!this.key;
		},
	},
	emailCodeTtlMin: parseInt(process.env.EMAIL_CODE_TTL_MIN || "10", 10),

	tournamentKey: process.env.TOURNAMENT_KEY || "wc2026",

	// ---- Live scores (API-Football) ----
	// Key is server-side only and never sent to the client. League id is
	// discovered at runtime (GET /leagues?search=World Cup) when left blank.
	apiFootball: {
		key: process.env.API_FOOTBALL_KEY || "",
		// 1 = "World Cup" (men's). Left configurable; 0/blank => discover at runtime.
		leagueId: parseInt(process.env.API_FOOTBALL_LEAGUE_ID || "0", 10) || 0,
		season: parseInt(process.env.API_FOOTBALL_SEASON || "2026", 10),
		get enabled() {
			return !!this.key;
		},
	},
	// Set to true to let the API process run the background score poller
	// (one instance only — keep it false on extra web replicas).
	scoresPoller: bool(process.env.SCORES_POLLER, false),
};

export function validateEnv(): string[] {
	const warn: string[] = [];
	if (!/^[0-9a-fA-F]{64}$/.test(env.jwtSecret))
		warn.push(
			"JWT_SECRET must be 64 hex chars (openssl rand -hex 32). Sessions are insecure without it.",
		);
	if (!/^[0-9a-fA-F]{64}$/.test(env.encKey))
		warn.push(
			"ENCRYPTION_KEY must be 64 hex chars (openssl rand -hex 32). ID encryption is disabled without it.",
		);
	if (!env.adminEmails.length)
		warn.push("ADMIN_EMAILS not set — no one can access the admin panel.");
	if (!env.google.enabled)
		warn.push("Google login disabled (GOOGLE_CLIENT_ID/SECRET).");
	if (!env.facebook.enabled)
		warn.push(
			"Facebook login disabled (set FACEBOOK_ENABLED=true once your app is approved).",
		);
	if (!env.resend.enabled)
		warn.push(
			"Resend not configured — email login codes will print to the server console.",
		);
	if (!env.apiFootball.enabled)
		warn.push(
			"API_FOOTBALL_KEY not set — live score sync (npm run sync) is disabled; seed remains the data source.",
		);
	return warn;
}
