# Adrena Arena Mode — Competition Design Document

## 1. Executive Summary

**Arena Mode** is a team-based trading competition module for Adrena that introduces squad-based bracket tournaments alongside the existing solo Mutagen leaderboard. It transforms perpetual futures trading from an individual activity into a collaborative, social experience — something no competing perp DEX on Solana currently offers.

**Key innovation:** Teams of 3–5 traders compete in time-boxed bracket tournaments scored by percentage-based PnL, leveling the playing field between small and large traders while driving engagement, volume, and retention.

---

## 2. Competition Format

### 2.1 Overview

Arena Mode runs as **weekly bracket tournaments** with the following structure:

- **Registration Phase** (48h): Teams form and register
- **Group Stage** (3 days): All teams trade simultaneously, top teams advance
- **Elimination Rounds** (2 days): Head-to-head bracket matches
- **Finals** (1 day): Final teams compete for the championship

### 2.2 Team Structure

| Parameter | Value |
|-----------|-------|
| Team size | 3–5 traders |
| Team name | Custom (unique per tournament) |
| Captain | Creator of the team; manages roster |
| Roster lock | Locked once tournament begins |
| Max teams per tournament | 64 (scalable) |

**Roles:**
- **Captain**: Creates team, invites members, sets team strategy (optional asset focus)
- **Members**: Trade on Adrena during competition windows; all positions count toward team score

### 2.3 Tournament Bracket Structure

```
Round of 64 → Round of 32 → Round of 16 → Quarterfinals → Semifinals → Finals
```

**Group Stage (Day 1–3):**
- All 64 teams trade simultaneously
- Teams ranked by combined team PnL %
- Top 32 teams advance to elimination bracket
- Bottom 32 eliminated (receive participation rewards)

**Elimination Rounds (Day 4–5):**
- Single-elimination bracket
- Each round is a 12-hour trading window
- Higher-seeded team (from group stage ranking) gets a minor scoring bonus (+0.5% PnL)
- Winner advances, loser eliminated

**Finals (Day 6):**
- Top 2 teams compete in a 24-hour final trading session
- No seeding bonus — pure skill
- Winner crowned Arena Champion

### 2.4 Tournament Tiers

To ensure fair competition, tournaments are tiered by team's average wallet size:

| Tier | Avg Collateral per Member | Entry Requirement |
|------|--------------------------|-------------------|
| Bronze | < $500 | None |
| Silver | $500 – $5,000 | 1 completed Bronze tournament |
| Gold | $5,000 – $50,000 | 3 completed Silver tournaments |
| Diamond | $50,000+ | 5 completed Gold tournaments |

Each tier runs its own bracket. This prevents whales from dominating small-trader tournaments.

---

## 3. Scoring Mechanics

### 3.1 Core Scoring: Percentage-Based PnL

The fundamental scoring metric is **portfolio return percentage**, not absolute dollar PnL.

```
Individual Score = (Realized PnL + Unrealized PnL) / Total Collateral Deployed × 100
```

**Team Score** = Weighted average of all members' individual scores:

```
Team Score = Σ(Member Score × Member Weight) / Σ(Member Weights)
```

Where `Member Weight = 1.0` for all members (equal weighting ensures every member matters).

### 3.2 Bonus Multipliers

Teams earn multipliers for specific achievements during a round:

| Achievement | Multiplier | Description |
|-------------|-----------|-------------|
| Full Squad Active | 1.1x | All members opened ≥1 position in the round |
| Diversified | 1.05x | Team traded ≥3 different assets |
| Streak Bonus | 1.02x per streak day | Team maintained positive PnL for consecutive days |
| Volume Bonus | 1.03x | Team total volume exceeds tier median |

**Final Team Score** = Base Team Score × Product of all earned multipliers

### 3.3 Tiebreaker Rules

If two teams have identical scores:
1. Higher total trading volume wins
2. If still tied, more total trades wins
3. If still tied, earlier registration timestamp wins

### 3.4 Minimum Activity Requirements

To prevent "ghost teams" from advancing by not trading:

- Each member must open **at least 1 position** per round
- Each member must have **minimum $10 collateral deployed** per round
- Teams failing minimums receive a **-5% score penalty** per inactive member
- Teams with 0 activity are automatically disqualified

---

## 4. Reward Structure

### 4.1 Tournament Rewards

Rewards come from two sources:
1. **Protocol allocation**: Adrena allocates ADX/USDC from fee revenue
2. **Entry pool**: Optional team entry fees (redistributed to winners)

| Placement | Share of Prize Pool |
|-----------|-------------------|
| 🥇 1st Place | 35% |
| 🥈 2nd Place | 20% |
| 🥉 3rd–4th | 10% each |
| 5th–8th | 4% each |
| 9th–16th | 1% each (participation) |

### 4.2 Individual Rewards within Teams

Prize distribution within a winning team:
- **50%** split equally among all members
- **30%** proportional to individual PnL contribution
- **20%** to the Captain (leadership bonus)

### 4.3 Integration with Existing Reward Systems

**Mutagen Points:**
- Arena participation earns 2x Mutagen points vs. regular trading
- Tournament winners earn a Mutagen multiplier for the following week (1.5x)
- This incentivizes Arena participation without replacing the solo leaderboard

**Quests:**
- New quest category: "Arena Quests"
  - "Join your first team" → 500 Mutagen
  - "Win a Group Stage round" → 1,000 Mutagen
  - "Reach Elimination bracket" → 2,500 Mutagen
  - "Win a tournament" → 10,000 Mutagen
  - "Win 3 tournaments" → 50,000 Mutagen + exclusive NFT badge

**Streaks:**
- Arena streaks tracked separately: consecutive tournaments with positive team PnL
- Streak rewards compound (similar to existing streak system)
- 3-tournament streak → Bronze Arena badge
- 5-tournament streak → Silver Arena badge
- 10-tournament streak → Gold Arena badge

**Raffles:**
- Arena participants get raffle tickets proportional to their tournament activity
- Tournament winners get bonus raffle entries
- This maintains the existing raffle engagement loop

### 4.4 Non-Monetary Rewards

- **Arena Badges**: On-chain NFT badges for achievements (displayed on profile)
- **Team Banners**: Custom team visual identity (unlocked through wins)
- **Arena Rank**: Persistent ELO-style rating across tournaments
- **Hall of Fame**: Historical record of tournament champions

---

## 5. Integration with Adrena Infrastructure

### 5.1 Data Flow

Arena Mode uses Adrena's existing public API endpoints:

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Adrena API  │────▶│  Arena Backend    │────▶│  Arena Frontend  │
│              │     │  (Competition     │     │  (Dashboard)     │
│ /position    │     │   Engine)         │     │                  │
│ /pool-stats  │     │                   │     │ Team management  │
│ /open-long   │     │ Score calculation │     │ Live scores      │
│ /close-long  │     │ Bracket mgmt     │     │ Bracket view     │
│ /liquidity   │     │ Reward tracking  │     │ History          │
└─────────────┘     └──────────────────┘     └─────────────────┘
```

**API endpoints used:**
- `GET /position?user_wallet=` — Track each team member's positions and PnL
- `GET /pool-high-level-stats` — Volume data for bonus calculations
- `GET /liquidity-info` — Pool context for UI display
- `GET /apr` — Display current yields alongside competition

**Polling strategy:**
- Position data polled every 60 seconds per active team member during rounds
- Scores recalculated every 5 minutes
- Leaderboard updated in real-time via WebSocket to frontend

### 5.2 Existing Leaderboard Integration

Arena Mode adds a new tab to the existing leaderboard page:

```
[Solo Leaderboard] [Arena Mode] [Quests] [Streaks]
```

- Solo leaderboard remains unchanged
- Arena tab shows: active tournaments, team standings, bracket view
- Cross-promotion: solo leaderboard shows "Join Arena for 2x Mutagen!" banner

### 5.3 Wallet Integration

- Teams are identified by member wallet addresses
- No additional authentication needed — same wallet connection as regular trading
- Team creation/joining handled via signed messages (wallet signature = proof of membership)

---

## 6. Why This Is More Engaging Than Alternatives

### 6.1 Competitive Analysis

| Feature | Adrena (Current) | dYdX | GMX | Drift | **Adrena Arena** |
|---------|-----------------|------|-----|-------|-------------------|
| Solo PnL leaderboard | ✅ | ✅ | ✅ | ✅ | ✅ |
| Team competitions | ❌ | ❌ | ❌ | ❌ | ✅ |
| Bracket tournaments | ❌ | ❌ | ❌ | ❌ | ✅ |
| % PnL scoring | ❌ | Partial | ❌ | ✅ | ✅ |
| Tiered by capital | ❌ | ❌ | ❌ | ❌ | ✅ |
| Social/squad features | ❌ | ❌ | ❌ | ❌ | ✅ |
| On-chain badges | ❌ | ❌ | ❌ | ❌ | ✅ |

### 6.2 Engagement Drivers

1. **Social obligation**: Team members show up daily because teammates depend on them
2. **Lower barrier**: Small traders contribute meaningfully to team score via % PnL
3. **Daily cadence**: Bracket rounds create daily engagement (not just end-of-season check)
4. **Identity**: Team names, badges, and rankings create emotional investment
5. **Viral loop**: "Invite friends to join my team" → organic user acquisition
6. **Progression**: Tier system + Arena Rank gives long-term goals beyond single tournaments

### 6.3 Projected Impact

Based on industry benchmarks from team-based competitive gaming:
- **2–3x daily active engagement** vs. solo leaderboards
- **40–60% higher retention** at 30 days (social bonds)
- **25–40% volume increase** during tournament periods (team members trade more)
- **15–20% new user acquisition** through team invitations

---

## 7. Edge Cases and Abuse Prevention

### 7.1 Wash Trading

**Risk:** Team members trade against each other to inflate volume/PnL.

**Prevention:**
- Positions between wallets in the same team are flagged and excluded from scoring
- Volume bonus only counts trades against the wider market
- Minimum position hold time of 60 seconds (prevents rapid open/close cycles)

### 7.2 Sybil Attacks (Fake Teams)

**Risk:** One person creates multiple wallets to form a "team" and manipulates brackets.

**Prevention:**
- Minimum wallet age requirement (wallet must have >7 days of on-chain history)
- Minimum previous Adrena trading activity (≥5 historical trades on platform)
- IP/fingerprint correlation analysis (flag suspiciously similar wallets)
- Captain must hold minimum ADX stake (e.g., 100 ADX) to create a team

### 7.3 Collusion Between Teams

**Risk:** Two teams agree to take opposite sides of the same trade.

**Prevention:**
- Bracket matchups are randomized (teams don't know opponents until round starts)
- Statistical anomaly detection: flag matched opposite positions between competing teams
- Report system: teams can flag suspicious opponents for manual review

### 7.4 Sandbagging (Intentionally Losing)

**Risk:** Strong traders intentionally perform poorly in group stage to get easier bracket matchups.

**Prevention:**
- Higher seeds get scoring bonus in elimination rounds (incentivizes group stage performance)
- Minimum score threshold to advance (can't advance with negative PnL below -10%)
- Historical Arena Rank influences tier placement (can't hide true skill level)

### 7.5 Last-Minute Score Manipulation

**Risk:** Opening massive positions in final minutes of a round to swing scores.

**Prevention:**
- Positions opened in the last 30 minutes of a round are weighted at 50% for scoring
- Final score calculated at a random timestamp within the last 15 minutes (unknown to participants)
- This prevents "buzzer-beater" manipulation while still allowing legitimate trading

### 7.6 Team Member Goes Inactive

**Risk:** A team member stops trading mid-tournament, handicapping the team.

**Prevention:**
- Inactive member penalty (-5% per inactive member per round)
- Captain can "bench" an inactive member (their score excluded, but no penalty)
- Minimum 3 active members required; below that, team is disqualified
- Benched members don't receive prize share

### 7.7 Market Manipulation via Illiquid Assets

**Risk:** Teams trade illiquid assets to move prices and generate artificial PnL.

**Prevention:**
- Only assets with sufficient pool depth count for scoring
- PnL from assets with <$100K pool depth weighted at 25%
- Adrena's existing pool structure naturally limits this (only major assets supported)

---

## 8. Technical Architecture

### 8.1 System Components

```
┌─────────────────────────────────────────────────┐
│                  Arena Frontend                   │
│          (React/Next.js Dashboard)                │
│                                                   │
│  ┌──────────┐ ┌──────────┐ ┌───────────────────┐│
│  │Team Mgmt │ │Bracket   │ │Live Scores        ││
│  │Create    │ │Viewer    │ │Position Tracker   ││
│  │Join      │ │Match     │ │Multiplier Display ││
│  │Invite    │ │History   │ │Reward Estimate    ││
│  └──────────┘ └──────────┘ └───────────────────┘│
└─────────────────────┬───────────────────────────┘
                      │ REST + WebSocket
┌─────────────────────▼───────────────────────────┐
│              Arena Backend Service                │
│            (Node.js / TypeScript)                  │
│                                                   │
│  ┌──────────────┐ ┌──────────────┐ ┌───────────┐│
│  │Competition   │ │Score Engine  │ │Reward     ││
│  │Manager       │ │              │ │Calculator ││
│  │              │ │Poll positions│ │           ││
│  │Create/start  │ │Calculate PnL%│ │Prize pool ││
│  │tournaments   │ │Apply bonuses │ │splits     ││
│  │Bracket logic │ │Detect abuse  │ │Distribute ││
│  └──────────────┘ └──────────────┘ └───────────┘│
│                                                   │
│  ┌──────────────┐ ┌──────────────┐               │
│  │Team Manager  │ │Anti-Abuse    │               │
│  │              │ │Engine        │               │
│  │CRUD teams    │ │              │               │
│  │Roster mgmt   │ │Wash trade    │               │
│  │Wallet verify │ │Sybil detect  │               │
│  └──────────────┘ └──────────────┘               │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│              Data Layer                           │
│                                                   │
│  ┌──────────────┐ ┌──────────────────────────┐   │
│  │PostgreSQL    │ │Adrena Public API         │   │
│  │              │ │                          │   │
│  │Teams         │ │GET /position             │   │
│  │Tournaments   │ │GET /pool-high-level-stats│   │
│  │Scores        │ │GET /liquidity-info       │   │
│  │Rewards       │ │GET /apr                  │   │
│  │History       │ │                          │   │
│  └──────────────┘ └──────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

### 8.2 Database Schema (PostgreSQL)

```sql
-- Teams
CREATE TABLE arena_teams (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  captain_wallet TEXT NOT NULL,
  tier TEXT DEFAULT 'bronze',
  arena_rank INTEGER DEFAULT 1000,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team members
CREATE TABLE arena_members (
  id SERIAL PRIMARY KEY,
  team_id INTEGER REFERENCES arena_teams(id),
  wallet_address TEXT NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'active', -- active, benched, removed
  UNIQUE(team_id, wallet_address)
);

-- Tournaments
CREATE TABLE arena_tournaments (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  tier TEXT NOT NULL,
  status TEXT DEFAULT 'registration', -- registration, group_stage, elimination, finals, completed
  max_teams INTEGER DEFAULT 64,
  prize_pool_usdc DOUBLE PRECISION DEFAULT 0,
  registration_start TIMESTAMPTZ,
  registration_end TIMESTAMPTZ,
  tournament_start TIMESTAMPTZ,
  tournament_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tournament registrations
CREATE TABLE arena_registrations (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER REFERENCES arena_tournaments(id),
  team_id INTEGER REFERENCES arena_teams(id),
  seed INTEGER,
  status TEXT DEFAULT 'registered', -- registered, active, eliminated, champion
  UNIQUE(tournament_id, team_id)
);

-- Bracket matches
CREATE TABLE arena_matches (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER REFERENCES arena_tournaments(id),
  round TEXT NOT NULL, -- 'group', 'r32', 'r16', 'quarter', 'semi', 'final'
  team_a_id INTEGER REFERENCES arena_teams(id),
  team_b_id INTEGER REFERENCES arena_teams(id),
  team_a_score DOUBLE PRECISION,
  team_b_score DOUBLE PRECISION,
  winner_id INTEGER REFERENCES arena_teams(id),
  round_start TIMESTAMPTZ,
  round_end TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' -- pending, active, completed
);

-- Score snapshots (per member per round)
CREATE TABLE arena_scores (
  id SERIAL PRIMARY KEY,
  match_id INTEGER REFERENCES arena_matches(id),
  wallet_address TEXT NOT NULL,
  team_id INTEGER REFERENCES arena_teams(id),
  pnl_percentage DOUBLE PRECISION DEFAULT 0,
  collateral_deployed DOUBLE PRECISION DEFAULT 0,
  positions_opened INTEGER DEFAULT 0,
  volume_usd DOUBLE PRECISION DEFAULT 0,
  multipliers JSONB DEFAULT '{}',
  final_score DOUBLE PRECISION DEFAULT 0,
  snapshot_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reward history
CREATE TABLE arena_rewards (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER REFERENCES arena_tournaments(id),
  team_id INTEGER REFERENCES arena_teams(id),
  wallet_address TEXT,
  placement INTEGER,
  reward_usdc DOUBLE PRECISION DEFAULT 0,
  reward_adx DOUBLE PRECISION DEFAULT 0,
  mutagen_bonus INTEGER DEFAULT 0,
  distributed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_members_wallet ON arena_members(wallet_address);
CREATE INDEX idx_members_team ON arena_members(team_id);
CREATE INDEX idx_matches_tournament ON arena_matches(tournament_id);
CREATE INDEX idx_scores_match ON arena_scores(match_id);
CREATE INDEX idx_scores_wallet ON arena_scores(wallet_address);
CREATE INDEX idx_registrations_tournament ON arena_registrations(tournament_id);
```

### 8.3 Arena Backend API Endpoints

```
POST   /arena/teams                    — Create a team
GET    /arena/teams/:id                — Get team details
POST   /arena/teams/:id/invite         — Invite member (captain only)
POST   /arena/teams/:id/join           — Join team (with invite code)
DELETE /arena/teams/:id/members/:wallet — Remove member (captain only)
POST   /arena/teams/:id/bench/:wallet  — Bench/unbench member

GET    /arena/tournaments              — List tournaments (active + upcoming)
GET    /arena/tournaments/:id          — Tournament details + bracket
POST   /arena/tournaments/:id/register — Register team for tournament
GET    /arena/tournaments/:id/scores   — Live scores for all teams
GET    /arena/tournaments/:id/bracket  — Bracket visualization data

GET    /arena/matches/:id              — Match details + scores
GET    /arena/matches/:id/live         — WebSocket: live score updates

GET    /arena/profile/:wallet          — Player arena stats (rank, history, badges)
GET    /arena/leaderboard              — Global arena team rankings
GET    /arena/history                  — Past tournament results
```

### 8.4 Score Engine (Polling Loop)

```typescript
// Runs every 60 seconds during active rounds
async function updateScores(match: Match) {
  for (const team of [match.teamA, match.teamB]) {
    for (const member of team.activeMembers) {
      // 1. Fetch positions from Adrena API
      const positions = await adrenaAPI.getPositions(member.wallet);

      // 2. Calculate PnL %
      const pnlPct = calculatePnlPercentage(positions);

      // 3. Check activity requirements
      const positionsOpened = countNewPositions(positions, match.roundStart);

      // 4. Save snapshot
      await saveScoreSnapshot(match.id, member.wallet, team.id, {
        pnlPct, positionsOpened, collateral, volume
      });
    }

    // 5. Calculate team score with multipliers
    const teamScore = calculateTeamScore(team, match);

    // 6. Run abuse detection
    await detectAbusePatterns(team, match);

    // 7. Broadcast update via WebSocket
    broadcastScoreUpdate(match.id, team.id, teamScore);
  }
}
```

---

## 9. Deployment & Configuration

### 9.1 Infrastructure Requirements

- **Backend**: Node.js 18+ server (Railway, Render, or VPS)
- **Database**: PostgreSQL 14+ (Railway PostgreSQL or Supabase)
- **Frontend**: Static deployment (Netlify, Vercel)
- **WebSocket**: Built into backend server (Socket.io or ws)

### 9.2 Environment Variables

```env
DATABASE_URL=postgresql://...
ADRENA_API_BASE=https://datapi.adrena.trade
SCORE_POLL_INTERVAL_MS=60000
SCORE_RECALC_INTERVAL_MS=300000
MIN_WALLET_AGE_DAYS=7
MIN_HISTORICAL_TRADES=5
MIN_ADX_STAKE_CAPTAIN=100
LATE_POSITION_WINDOW_MINUTES=30
LATE_POSITION_WEIGHT=0.5
```

### 9.3 Deployment Steps

1. Clone repository
2. Set environment variables
3. Run `npm install`
4. Run `npm run db:migrate` (creates PostgreSQL tables)
5. Run `npm run start` (starts backend + score engine)
6. Deploy frontend to Netlify/Vercel
7. Configure first tournament via admin API

---

## 10. Future Enhancements

1. **Copy Trading Integration**: Follow top Arena performers' trades
2. **Spectator Mode**: Watch live matches with commentary
3. **Seasonal Rankings**: Season-long points across multiple tournaments
4. **Cross-Protocol Tournaments**: Compete against teams from other DEXs
5. **DAO Governance**: ADX holders vote on tournament parameters and prize pools
6. **Mobile App**: Push notifications for team activity and round results
7. **Telegram Bot**: Team management and score alerts via Telegram

---

## 11. Summary

Arena Mode transforms Adrena's competition infrastructure from a standard solo leaderboard (identical to every other perps DEX) into a unique team-based competitive platform. By leveraging social dynamics, tiered fair play, and bracket tournament excitement, it creates engagement loops that drive daily active usage, increase trading volume, and improve long-term retention.

The module integrates seamlessly with Adrena's existing systems (Mutagen points, quests, streaks, raffles) while adding entirely new dimensions of competition that no other Solana perp DEX currently offers.
