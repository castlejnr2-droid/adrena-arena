# Adrena Arena Mode

**Team-based trading competition module for [Adrena](https://adrena.xyz)**

Arena Mode introduces squad-based bracket tournaments to Adrena's perpetual DEX, transforming individual trading into a collaborative, social competition. No other perp DEX on Solana offers team-based competitions.

## Features

- **Team Management** — Create squads of 3-5 traders, invite via code
- **Bracket Tournaments** — Group stage → elimination → finals
- **Fair Scoring** — PnL percentage-based (not absolute $), with tier-based matchmaking
- **Live Scores** — Real-time score updates via WebSocket
- **Anti-Abuse** — Wash trade detection, sybil prevention, late-position weighting
- **Reward Distribution** — Automatic prize pool splits with captain bonus
- **Mutagen Integration** — 2x Mutagen points for Arena participants

## Architecture

```
Frontend (Dashboard)  ←→  Backend (Express + WS)  ←→  Adrena API + PostgreSQL
```

- **Backend**: Node.js/Express with WebSocket for live updates
- **Score Engine**: Polls Adrena `/position` API every 60s, calculates team PnL %
- **Database**: PostgreSQL (teams, tournaments, matches, scores, rewards)
- **Frontend**: Single-page dashboard with live bracket viewer

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set environment variables
cp .env.example .env
# Edit .env with your DATABASE_URL

# 3. Run database migration
npm run db:migrate

# 4. Start server
npm start
```

Server runs on `http://localhost:3000` with WebSocket at `ws://localhost:3000/ws`.

## API Endpoints

### Teams
- `POST /arena/teams` — Create team
- `GET /arena/teams` — List teams
- `GET /arena/teams/:id` — Team details
- `POST /arena/teams/:id/join` — Join team (invite code required)
- `POST /arena/teams/:id/bench/:wallet` — Bench/unbench member
- `DELETE /arena/teams/:id/members/:wallet` — Remove member

### Tournaments
- `GET /arena/tournaments` — List tournaments
- `GET /arena/tournaments/:id` — Tournament details
- `POST /arena/tournaments` — Create tournament
- `POST /arena/tournaments/:id/register` — Register team
- `POST /arena/tournaments/:id/start` — Start tournament
- `GET /arena/tournaments/:id/scores` — Live scores
- `GET /arena/tournaments/:id/bracket` — Bracket data

### Profile & Leaderboard
- `GET /arena/profile/:wallet` — Player stats & history
- `GET /arena/leaderboard` — Global team rankings
- `GET /arena/history` — Past tournament results

## Adrena API Integration

Arena Mode uses Adrena's public API (`datapi.adrena.trade`):
- `GET /position` — Track member positions and PnL
- `GET /pool-high-level-stats` — Volume data for bonus calculations
- `GET /liquidity-info` — Pool context
- `GET /apr` — Current yields

## Scoring

```
Individual Score = (Realized PnL + Unrealized PnL) / Total Collateral × 100
Team Score = Average of Member Scores × Multipliers
```

**Multipliers:**
- Full Squad Active (all members traded): 1.1x
- Diversified (≥3 assets): 1.05x
- Volume Bonus: 1.03x
- Inactive Penalty: -5% per inactive member

## Design Document

See [DESIGN.md](./DESIGN.md) for the full competition design document including:
- Tournament format and bracket structure
- Detailed scoring mechanics
- Reward distribution model
- Edge cases and abuse prevention
- Integration with Adrena's existing systems
- Competitive analysis vs other DEXs

## License

MIT
