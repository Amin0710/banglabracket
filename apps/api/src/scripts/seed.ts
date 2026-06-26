import 'dotenv/config';
import { connectDB } from '../db.js';
import { Tournament } from '../models/index.js';
import { env } from '../config/env.js';
import { GROUP_KEYS, WIN_SLOT, RUN_SLOT, rankGroup } from '@banglabracket/shared';
import mongoose from 'mongoose';

// Snapshot ~26 Jun 2026. row = [name, abbr, P, W, D, L, GF, GA]
const RAW: Record<string, [string, string, number, number, number, number, number, number][]> = {
  A: [['Mexico','MEX',3,3,0,0,6,0],['South Africa','RSA',3,1,1,1,2,3],['Korea Republic','KOR',3,1,0,2,2,3],['Czechia','CZE',3,0,1,2,2,6]],
  B: [['Switzerland','SUI',3,2,1,0,7,3],['Canada','CAN',3,1,1,1,8,3],['Bosnia & Herz.','BIH',3,1,1,1,5,6],['Qatar','QAT',3,0,1,2,2,10]],
  C: [['Brazil','BRA',3,2,1,0,7,1],['Morocco','MAR',3,2,1,0,6,3],['Scotland','SCO',3,1,0,2,1,4],['Haiti','HAI',3,0,0,3,2,8]],
  D: [['USA','USA',2,2,0,0,6,1],['Australia','AUS',2,1,0,1,2,2],['Paraguay','PAR',2,1,0,1,2,4],['Türkiye','TUR',2,0,0,2,0,3]],
  E: [['Germany','GER',2,2,0,0,9,2],['Ivory Coast','CIV',2,1,0,1,2,2],['Ecuador','ECU',2,0,1,1,0,1],['Curaçao','CUW',2,0,1,1,1,7]],
  F: [['Netherlands','NED',2,1,1,0,7,3],['Japan','JPN',2,1,1,0,6,2],['Sweden','SWE',2,1,0,1,6,6],['Tunisia','TUN',2,0,0,2,1,9]],
  G: [['Egypt','EGY',2,1,1,0,4,2],['IR Iran','IRN',2,0,2,0,2,2],['Belgium','BEL',2,0,2,0,1,1],['New Zealand','NZL',2,0,1,1,3,5]],
  H: [['Spain','ESP',2,1,1,0,4,0],['Uruguay','URU',2,0,2,0,3,3],['Cape Verde','CPV',2,0,2,0,2,2],['Saudi Arabia','KSA',2,0,1,1,1,5]],
  I: [['France','FRA',2,2,0,0,6,1],['Norway','NOR',2,2,0,0,7,3],['Senegal','SEN',2,0,0,2,3,6],['Iraq','IRQ',2,0,0,2,1,7]],
  J: [['Argentina','ARG',2,2,0,0,5,0],['Austria','AUT',2,1,0,1,3,3],['Algeria','DZA',2,1,0,1,2,4],['Jordan','JOR',2,0,0,2,2,5]],
  K: [['Colombia','COL',2,2,0,0,4,1],['Portugal','POR',2,1,1,0,6,1],['Congo DR','COD',2,0,1,1,1,2],['Uzbekistan','UZB',2,0,0,2,1,8]],
  L: [['England','ENG',2,1,1,0,4,2],['Ghana','GHA',2,1,1,0,1,0],['Croatia','CRO',2,1,0,1,3,4],['Panama','PAN',2,0,0,2,0,2]],
};

const REMAINING: Record<string, [string, string][]> = {
  D: [['TUR','USA'],['PAR','AUS']], E: [['ECU','GER'],['CUW','CIV']], F: [['TUN','NED'],['JPN','SWE']],
  G: [['NZL','BEL'],['EGY','IRN']], H: [['CPV','KSA'],['URU','ESP']], I: [['NOR','FRA'],['SEN','IRQ']],
  J: [['JOR','ARG'],['DZA','AUT']], K: [['COL','POR'],['COD','UZB']], L: [['PAN','ENG'],['CRO','GHA']],
};

function toRows(g: string) {
  return RAW[g].map((r) => ({ name: r[0], abbr: r[1], P: r[2], W: r[3], D: r[4], L: r[5], GF: r[6], GA: r[7] }));
}

async function main() {
  await connectDB();
  const base: any = {}; for (const g of GROUP_KEYS) base[g] = toRows(g);

  // Pre-confirm R32 slots for completed groups (A,B,C) with a PAST timestamp,
  // so they count as "already known" (no early-bird bonus), matching reality.
  const past = '2026-06-25T00:00:00.000Z';
  const r32: any = {};
  for (const g of GROUP_KEYS) {
    if (base[g].every((r: any) => r.P >= 3)) {
      const t = rankGroup(g, base, REMAINING as any, {});
      const [wm, ws] = WIN_SLOT[g]; const [rm, rs] = RUN_SLOT[g];
      r32[wm] = r32[wm] || { A: { team: null, confirmedAt: null }, B: { team: null, confirmedAt: null } };
      r32[rm] = r32[rm] || { A: { team: null, confirmedAt: null }, B: { team: null, confirmedAt: null } };
      r32[wm][ws] = { team: t[0].name, confirmedAt: past };
      r32[rm][rs] = { team: t[1].name, confirmedAt: past };
    }
  }

  await Tournament.findOneAndUpdate(
    { key: env.tournamentKey },
    {
      $set: {
        key: env.tournamentKey,
        name: '2026 FIFA World Cup',
        tagline: 'BanglaBracket — Brings World Cup 2026',
        lockAt: new Date('2026-06-28T19:00:00.000Z'), // 12:00 UTC−7
        base, remaining: REMAINING, r32,
      },
      $setOnInsert: { results: {} },
    },
    { upsert: true, new: true },
  );

  console.log('  ✓ Seeded tournament', env.tournamentKey, '— lock at 2026-06-28T19:00:00Z');
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
