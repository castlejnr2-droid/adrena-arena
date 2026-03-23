/**
 * Arena Score Engine
 * Polls Adrena positions and calculates team scores during active matches
 */

const { query } = require('../db/index');
const adrena = require('./adrena-api');

const POLL_INTERVAL = parseInt(process.env.SCORE_POLL_INTERVAL_MS) || 60000;
const LATE_WINDOW_MIN = 30;
const LATE_WEIGHT = 0.5;

let pollTimer = null;
let wsServer = null;

function setWebSocketServer(wss) {
  wsServer = wss;
}

/** Broadcast score update to all connected WebSocket clients */
function broadcast(type, data) {
  if (!wsServer) return;
  const msg = JSON.stringify({ type, data, timestamp: Date.now() });
  wsServer.clients.forEach(client => {
    if (client.readyState === 1) client.send(msg);
  });
}

/** Start the score polling loop */
function startEngine() {
  console.log(`⚡ Score engine started (polling every ${POLL_INTERVAL / 1000}s)`);
  pollTimer = setInterval(pollActiveMatches, POLL_INTERVAL);
  pollActiveMatches(); // run immediately
}

function stopEngine() {
  if (pollTimer) clearInterval(pollTimer);
  console.log('⏹ Score engine stopped');
}

/** Poll all active matches and update scores */
async function pollActiveMatches() {
  try {
    const res = await query(`
      SELECT m.*, t.name as tournament_name, t.tier
      FROM arena_matches m
      JOIN arena_tournaments t ON m.tournament_id = t.id
      WHERE m.status = 'active'
    `);

    for (const match of res.rows) {
      await updateMatchScores(match);
    }
  } catch (err) {
    console.error('[SCORE ENGINE] Poll error:', err.message);
  }
}

/** Update scores for a single match */
async function updateMatchScores(match) {
  const teamIds = [match.team_a_id, match.team_b_id].filter(Boolean);

  for (const teamId of teamIds) {
    try {
      const teamScore = await calculateTeamScore(teamId, match);

      // Update match score
      const scoreCol = teamId === match.team_a_id ? 'team_a_score' : 'team_b_score';
      const multCol = teamId === match.team_a_id ? 'team_a_multipliers' : 'team_b_multipliers';
      await query(
        `UPDATE arena_matches SET ${scoreCol} = $1, ${multCol} = $2 WHERE id = $3`,
        [teamScore.finalScore, JSON.stringify(teamScore.multipliers), match.id]
      );

      broadcast('score_update', {
        matchId: match.id,
        teamId,
        score: teamScore.finalScore,
        multipliers: teamScore.multipliers,
        members: teamScore.memberScores
      });
    } catch (err) {
      console.error(`[SCORE ENGINE] Team ${teamId} match ${match.id} error:`, err.message);
    }
  }

  // Check if match round has ended
  if (match.round_end && new Date(match.round_end) <= new Date()) {
    await finalizeMatch(match);
  }
}

/** Calculate a team's score for a match */
async function calculateTeamScore(teamId, match) {
  // Get active team members
  const membersRes = await query(
    `SELECT wallet_address, display_name FROM arena_members WHERE team_id = $1 AND status = 'active'`,
    [teamId]
  );
  const members = membersRes.rows;

  const memberScores = [];
  let totalPnlPct = 0;
  let allActive = true;
  const assetsTraded = new Set();
  let totalVolume = 0;
  let activeCount = 0;

  for (const member of members) {
    try {
      const positions = await adrena.getPositions(member.wallet_address);

      // Filter positions opened during this match
      const matchPositions = positions.filter(p => {
        const openTime = new Date(p.openedAt || p.created_at || 0);
        return openTime >= new Date(match.round_start);
      });

      // Calculate PnL %
      let totalCollateral = 0;
      let totalPnl = 0;
      let positionsOpened = matchPositions.length;
      let memberVolume = 0;

      for (const pos of positions) {
        const collateral = Number(pos.collateralUsd || pos.collateral_usd || 0);
        const pnl = Number(pos.pnlUsd || pos.pnl_usd || pos.unrealizedPnl || 0);
        const size = Number(pos.sizeUsd || pos.size_usd || 0);

        totalCollateral += collateral;
        totalPnl += pnl;
        memberVolume += size;

        if (pos.tokenSymbol || pos.token_symbol) {
          assetsTraded.add(pos.tokenSymbol || pos.token_symbol);
        }

        // Late position weighting
        if (match.round_end) {
          const roundEnd = new Date(match.round_end);
          const posOpen = new Date(pos.openedAt || pos.created_at || 0);
          const minutesBefore = (roundEnd - posOpen) / 60000;
          if (minutesBefore < LATE_WINDOW_MIN && minutesBefore >= 0) {
            // Weight late positions at 50%
            totalPnl -= pnl * (1 - LATE_WEIGHT);
          }
        }
      }

      const pnlPct = totalCollateral > 0 ? (totalPnl / totalCollateral) * 100 : 0;
      const isActive = positionsOpened > 0 && totalCollateral >= 10;

      if (!isActive) allActive = false;
      else activeCount++;

      totalPnlPct += pnlPct;
      totalVolume += memberVolume;

      const memberScore = {
        wallet: member.wallet_address,
        name: member.display_name || member.wallet_address.slice(0, 8) + '...',
        pnlPct: Math.round(pnlPct * 100) / 100,
        pnlUsd: Math.round(totalPnl * 100) / 100,
        collateral: Math.round(totalCollateral * 100) / 100,
        volume: Math.round(memberVolume * 100) / 100,
        positions: positionsOpened,
        isActive
      };

      memberScores.push(memberScore);

      // Save score snapshot
      await query(`
        INSERT INTO arena_scores (match_id, wallet_address, team_id, pnl_usd, pnl_percentage,
          collateral_deployed, positions_opened, volume_usd, is_active, final_score, snapshot_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT DO NOTHING
      `, [match.id, member.wallet_address, teamId, totalPnl, pnlPct,
          totalCollateral, positionsOpened, memberVolume, isActive, pnlPct]);
    } catch (err) {
      console.error(`[SCORE] Member ${member.wallet_address} error:`, err.message);
      memberScores.push({
        wallet: member.wallet_address,
        name: member.display_name || member.wallet_address.slice(0, 8) + '...',
        pnlPct: 0, pnlUsd: 0, collateral: 0, volume: 0, positions: 0, isActive: false
      });
      allActive = false;
    }
  }

  // Calculate team base score (equal-weighted average)
  const baseScore = activeCount > 0 ? totalPnlPct / members.length : 0;

  // Calculate multipliers
  const multipliers = {};
  let multiplierProduct = 1;

  // Full Squad Active: all members opened ≥1 position
  if (allActive && members.length >= 3) {
    multipliers.fullSquad = 1.1;
    multiplierProduct *= 1.1;
  }

  // Diversified: ≥3 different assets
  if (assetsTraded.size >= 3) {
    multipliers.diversified = 1.05;
    multiplierProduct *= 1.05;
  }

  // Volume bonus: above minimum threshold
  if (totalVolume > 1000) {
    multipliers.volume = 1.03;
    multiplierProduct *= 1.03;
  }

  // Inactive member penalty
  const inactiveCount = members.length - activeCount;
  if (inactiveCount > 0) {
    const penalty = 1 - (inactiveCount * 0.05);
    multipliers.inactivePenalty = Math.max(penalty, 0.8);
    multiplierProduct *= multipliers.inactivePenalty;
  }

  const finalScore = Math.round(baseScore * multiplierProduct * 100) / 100;

  return { baseScore, finalScore, multipliers, memberScores, totalVolume };
}

/** Finalize a completed match — determine winner */
async function finalizeMatch(match) {
  try {
    const winnerId = match.team_a_score >= match.team_b_score ? match.team_a_id : match.team_b_id;
    const loserId = winnerId === match.team_a_id ? match.team_b_id : match.team_a_id;

    await query(
      `UPDATE arena_matches SET status = 'completed', winner_id = $1 WHERE id = $2`,
      [winnerId, match.id]
    );

    // Update team stats
    await query(`UPDATE arena_teams SET wins = wins + 1 WHERE id = $1`, [winnerId]);
    await query(`UPDATE arena_teams SET losses = losses + 1 WHERE id = $1`, [loserId]);

    // Update registration status
    await query(
      `UPDATE arena_registrations SET status = 'eliminated' WHERE tournament_id = $1 AND team_id = $2`,
      [match.tournament_id, loserId]
    );

    // If this was the finals, mark champion
    if (match.round === 'final') {
      await query(
        `UPDATE arena_registrations SET status = 'champion' WHERE tournament_id = $1 AND team_id = $2`,
        [match.tournament_id, winnerId]
      );
      await query(
        `UPDATE arena_tournaments SET status = 'completed', tournament_end = NOW() WHERE id = $1`,
        [match.tournament_id]
      );
      await distributeRewards(match.tournament_id);
    }

    // Create next round match if elimination
    if (['r32', 'r16', 'quarter', 'semi'].includes(match.round)) {
      await advanceBracket(match.tournament_id, match);
    }

    broadcast('match_complete', { matchId: match.id, winnerId, loserId });
    console.log(`[MATCH] Match ${match.id} completed. Winner: team ${winnerId}`);
  } catch (err) {
    console.error(`[MATCH] Finalize error:`, err.message);
  }
}

/** Advance bracket — create next round match when both feeder matches are done */
async function advanceBracket(tournamentId, completedMatch) {
  const nextRounds = { r32: 'r16', r16: 'quarter', quarter: 'semi', semi: 'final' };
  const nextRound = nextRounds[completedMatch.round];
  if (!nextRound) return;

  // Check if the paired match is also complete
  const nextMatchNum = Math.ceil(completedMatch.round_number / 2);
  const pairNum = completedMatch.round_number % 2 === 1
    ? completedMatch.round_number + 1
    : completedMatch.round_number - 1;

  const pairRes = await query(
    `SELECT * FROM arena_matches WHERE tournament_id = $1 AND round = $2 AND round_number = $3`,
    [tournamentId, completedMatch.round, pairNum]
  );

  if (pairRes.rows.length > 0 && pairRes.rows[0].status === 'completed') {
    const pair = pairRes.rows[0];
    const roundStart = new Date();
    const roundEnd = new Date(roundStart.getTime() + 12 * 3600000); // 12h rounds

    await query(`
      INSERT INTO arena_matches (tournament_id, round, round_number, team_a_id, team_b_id, round_start, round_end, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
    `, [tournamentId, nextRound, nextMatchNum, completedMatch.winner_id, pair.winner_id, roundStart, roundEnd]);

    console.log(`[BRACKET] Created ${nextRound} match: team ${completedMatch.winner_id} vs ${pair.winner_id}`);
  }
}

/** Distribute rewards at tournament end */
async function distributeRewards(tournamentId) {
  try {
    const tournRes = await query(`SELECT * FROM arena_tournaments WHERE id = $1`, [tournamentId]);
    const tournament = tournRes.rows[0];
    if (!tournament) return;

    const prizePool = tournament.prize_pool_usdc;
    const shares = { 1: 0.35, 2: 0.20, 3: 0.10, 4: 0.10, 5: 0.04, 6: 0.04, 7: 0.04, 8: 0.04 };

    // Get final placements from completed matches
    const matchesRes = await query(
      `SELECT * FROM arena_matches WHERE tournament_id = $1 ORDER BY round DESC, round_number`,
      [tournamentId]
    );

    // Champion
    const final = matchesRes.rows.find(m => m.round === 'final' && m.status === 'completed');
    if (!final) return;

    const placements = [
      { teamId: final.winner_id, place: 1 },
      { teamId: final.winner_id === final.team_a_id ? final.team_b_id : final.team_a_id, place: 2 }
    ];

    // Semi losers = 3rd/4th
    const semis = matchesRes.rows.filter(m => m.round === 'semi' && m.status === 'completed');
    let place = 3;
    for (const semi of semis) {
      const loser = semi.winner_id === semi.team_a_id ? semi.team_b_id : semi.team_a_id;
      if (!placements.find(p => p.teamId === loser)) {
        placements.push({ teamId: loser, place: place++ });
      }
    }

    for (const { teamId, place } of placements) {
      const share = shares[place] || 0;
      const reward = prizePool * share;

      // Get team members for individual distribution
      const membersRes = await query(
        `SELECT wallet_address FROM arena_members WHERE team_id = $1 AND status = 'active'`,
        [teamId]
      );

      const memberCount = membersRes.rows.length;
      const equalShare = reward * 0.5 / memberCount;
      const captainBonus = reward * 0.2;

      const captainRes = await query(`SELECT captain_wallet FROM arena_teams WHERE id = $1`, [teamId]);
      const captainWallet = captainRes.rows[0]?.captain_wallet;

      for (const member of membersRes.rows) {
        let memberReward = equalShare;
        if (member.wallet_address === captainWallet) memberReward += captainBonus;
        // Remaining 30% would be proportional to PnL contribution (simplified here)
        memberReward += (reward * 0.3) / memberCount;

        await query(`
          INSERT INTO arena_rewards (tournament_id, team_id, wallet_address, placement, reward_usdc, mutagen_bonus)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [tournamentId, teamId, member.wallet_address, place, memberReward, place <= 3 ? 10000 : 2500]);
      }
    }

    console.log(`[REWARDS] Distributed rewards for tournament ${tournamentId}`);
    broadcast('tournament_complete', { tournamentId, placements });
  } catch (err) {
    console.error('[REWARDS] Distribution error:', err.message);
  }
}

module.exports = { startEngine, stopEngine, setWebSocketServer, calculateTeamScore, pollActiveMatches };
