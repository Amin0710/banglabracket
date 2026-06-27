import mongoose, { Schema, InferSchemaType } from 'mongoose';

// ---------------- User ----------------
const userSchema = new Schema({
  // identity / login
  googleId: { type: String, unique: true, sparse: true },
  facebookId: { type: String, unique: true, sparse: true },
  email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  name: { type: String, trim: true },
  avatar: { type: String },

  // contact (collected at signup; phone required & unique)
  phone: { type: String, unique: true, sparse: true, trim: true },
  bkash: { type: String, trim: true }, // optional

  // overseas soft-signal (geolocation is advisory only, never proof)
  overseas: { type: Boolean, default: false },
  location: { lat: Number, lng: Number, capturedAt: Date },
  ipCountry: { type: String },

  // verification (manual, post-launch). We store only flags + encrypted ID — no images.
  verificationCode: { type: String, unique: true, sparse: true },
  verified: { type: Boolean, default: false },
  verifiedAt: Date,
  verifiedBy: String,
  prizeEligible: { type: Boolean, default: false }, // verified && Bangladeshi nationality
  nidEnc: { type: String },        // AES-256-GCM encrypted ID number (set at verification)
  nidHmac: { type: String, unique: true, sparse: true }, // one ID = one account
  dobEnc: { type: String },        // encrypted date of birth

  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };
export const User = mongoose.model('User', userSchema);

// ---------------- Bracket Entry ----------------
const entrySchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  tournamentKey: { type: String, required: true, index: true },

  prediction: {
    groups: { type: Schema.Types.Mixed, default: {} },   // raw group score predictions
    winners: { type: Schema.Types.Mixed, default: {} },  // match -> team
    manner: { type: Schema.Types.Mixed, default: {} },   // match -> FT|ET|PEN
    finalScore: { a: Number, b: Number },
  },

  rePicked: { type: Boolean, default: false }, // used the free R32 re-pick (zeroes bonus)
  bonusEligibleAt: { type: Date },             // timestamp used for early-bird comparison
  scorePredAt: { type: Schema.Types.Mixed, default: {} }, // server-set FCFS timestamps per match (cash game)
  lockedSnapshot: { type: Schema.Types.Mixed },// frozen at lock time (audit)
}, { timestamps: true });

export type EntryDoc = InferSchemaType<typeof entrySchema> & { _id: mongoose.Types.ObjectId };
export const Entry = mongoose.model('Entry', entrySchema);

// ---------------- Tournament (single doc per competition; namespaced) ----------------
const tournamentSchema = new Schema({
  key: { type: String, required: true, unique: true }, // 'wc2026'
  name: String,
  tagline: String,
  lockAt: { type: Date, required: true },              // bracket lock (first R32 kickoff)

  base: { type: Schema.Types.Mixed, default: {} },     // GroupBase aggregates
  remaining: { type: Schema.Types.Mixed, default: {} },// RemainingFixtures
  r32: { type: Schema.Types.Mixed, default: {} },      // truth slots {match:{A:{team,confirmedAt},B}}
  results: { type: Schema.Types.Mixed, default: {} },  // {match:{winner,manner,scoreA,scoreB,confirmedAt}}

  scoringConfig: { type: Schema.Types.Mixed },         // optional override of defaults
}, { timestamps: true });

export type TournamentDoc = InferSchemaType<typeof tournamentSchema> & { _id: mongoose.Types.ObjectId };
export const Tournament = mongoose.model('Tournament', tournamentSchema);

// ---------------- Login codes (passwordless email) ----------------
const loginCodeSchema = new Schema({
  email: { type: String, required: true, lowercase: true, index: true },
  codeHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});
export const LoginCode = mongoose.model('LoginCode', loginCodeSchema);

// ---------------- Audit log (admin actions) ----------------
const auditSchema = new Schema({
  actor: String,        // admin email / id
  action: String,       // e.g. 'confirm_result'
  target: String,       // match number / user id
  meta: Schema.Types.Mixed,
  at: { type: Date, default: Date.now },
});
export const AuditLog = mongoose.model('AuditLog', auditSchema);
