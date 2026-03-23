-- Adrena Arena Mode Database Schema

CREATE TABLE IF NOT EXISTS arena_teams (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  captain_wallet TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  tier TEXT DEFAULT 'bronze' CHECK(tier IN ('bronze','silver','gold','diamond')),
  arena_rank INTEGER DEFAULT 1000,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS arena_members (
  id SERIAL PRIMARY KEY,
  team_id INTEGER REFERENCES arena_teams(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  display_name TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active','benched','removed')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, wallet_address)
);

CREATE TABLE IF NOT EXISTS arena_tournaments (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  tier TEXT NOT NULL CHECK(tier IN ('bronze','silver','gold','diamond','open')),
  status TEXT DEFAULT 'registration' CHECK(status IN ('registration','group_stage','elimination','finals','completed','cancelled')),
  max_teams INTEGER DEFAULT 64,
  min_teams INTEGER DEFAULT 4,
  prize_pool_usdc DOUBLE PRECISION DEFAULT 0,
  entry_fee_usdc DOUBLE PRECISION DEFAULT 0,
  registration_start TIMESTAMPTZ NOT NULL,
  registration_end TIMESTAMPTZ NOT NULL,
  tournament_start TIMESTAMPTZ NOT NULL,
  tournament_end TIMESTAMPTZ,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS arena_registrations (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER REFERENCES arena_tournaments(id) ON DELETE CASCADE,
  team_id INTEGER REFERENCES arena_teams(id) ON DELETE CASCADE,
  seed INTEGER,
  group_score DOUBLE PRECISION DEFAULT 0,
  status TEXT DEFAULT 'registered' CHECK(status IN ('registered','active','eliminated','champion')),
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tournament_id, team_id)
);

CREATE TABLE IF NOT EXISTS arena_matches (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER REFERENCES arena_tournaments(id) ON DELETE CASCADE,
  round TEXT NOT NULL,
  round_number INTEGER DEFAULT 1,
  team_a_id INTEGER REFERENCES arena_teams(id),
  team_b_id INTEGER REFERENCES arena_teams(id),
  team_a_score DOUBLE PRECISION DEFAULT 0,
  team_b_score DOUBLE PRECISION DEFAULT 0,
  team_a_multipliers JSONB DEFAULT '{}',
  team_b_multipliers JSONB DEFAULT '{}',
  winner_id INTEGER REFERENCES arena_teams(id),
  round_start TIMESTAMPTZ,
  round_end TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','active','completed','cancelled'))
);

CREATE TABLE IF NOT EXISTS arena_scores (
  id SERIAL PRIMARY KEY,
  match_id INTEGER REFERENCES arena_matches(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  team_id INTEGER REFERENCES arena_teams(id),
  pnl_usd DOUBLE PRECISION DEFAULT 0,
  pnl_percentage DOUBLE PRECISION DEFAULT 0,
  collateral_deployed DOUBLE PRECISION DEFAULT 0,
  positions_opened INTEGER DEFAULT 0,
  volume_usd DOUBLE PRECISION DEFAULT 0,
  multipliers JSONB DEFAULT '{}',
  final_score DOUBLE PRECISION DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  snapshot_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS arena_rewards (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER REFERENCES arena_tournaments(id),
  team_id INTEGER REFERENCES arena_teams(id),
  wallet_address TEXT,
  placement INTEGER,
  reward_usdc DOUBLE PRECISION DEFAULT 0,
  reward_adx DOUBLE PRECISION DEFAULT 0,
  mutagen_bonus INTEGER DEFAULT 0,
  distributed BOOLEAN DEFAULT false,
  distributed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS arena_abuse_flags (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER REFERENCES arena_tournaments(id),
  match_id INTEGER REFERENCES arena_matches(id),
  wallet_address TEXT,
  team_id INTEGER REFERENCES arena_teams(id),
  flag_type TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_members_wallet ON arena_members(wallet_address);
CREATE INDEX IF NOT EXISTS idx_members_team ON arena_members(team_id);
CREATE INDEX IF NOT EXISTS idx_matches_tournament ON arena_matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON arena_matches(status);
CREATE INDEX IF NOT EXISTS idx_scores_match ON arena_scores(match_id);
CREATE INDEX IF NOT EXISTS idx_scores_wallet ON arena_scores(wallet_address);
CREATE INDEX IF NOT EXISTS idx_registrations_tournament ON arena_registrations(tournament_id);
CREATE INDEX IF NOT EXISTS idx_registrations_team ON arena_registrations(team_id);
CREATE INDEX IF NOT EXISTS idx_rewards_tournament ON arena_rewards(tournament_id);
