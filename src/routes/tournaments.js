/**
 * Tournament Routes
 * GET /arena/tournaments — List tournaments
 * GET /arena/tournaments/:id — Tournament details + bracket
 * POST /arena/tournaments — Create tournament (admin)
 * POST /arena/tournaments/:id/register — Register team
 * POST /arena/tournaments/:id/start — Start tournament (admin)
 * GET /arena/tournaments/:id/scores — Live scores
 * GET /arena/tournaments/:id/bracket — Bracket data
 */

const { Router } = require('express');
const { query } = require('../db/index');

const router = Router();

// List tournaments
router.get('/', async (req, res) => {
  try {
    const { status, tier } = req.query;
    let sql = `SELECT t.*,
      (SELECT COUNT(*) FROM arena_registrations r WHERE r.tournament_id = t.id) as team_count
      FROM arena_tournaments t WHERE 1=1`;
    const params = [];

    if (status) {
      params.push(status);
      sql += ` AND t.status = $${params.length}`;
    }
    if (tier) {
      params.push(tier);
      sql += ` AND t.tier = $${params.length}`;
    }
    sql += ` ORDER BY t.created_at DESC LIMIT 50`;

    const result = await query(sql, params);
    res.json({ success: true, tournaments: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get tournament details
router.get('/:id', async (req, res) => {
  try {
    const tournRes = await query('SELECT * FROM arena_tournaments WHERE id = $1', [req.params.id]);
    if (tournRes.rows.length === 0) return res.status(404).json({ error: 'Tournament not found' });

    const tournament = tournRes.rows[0];

    // Get registered teams
    const teamsRes = await query(`
      SELECT r.*, t.name as team_name, t.captain_wallet, t.arena_rank,
        (SELECT COUNT(*) FROM arena_members m WHERE m.team_id = t.id AND m.status = 'active') as member_count
      FROM arena_registrations r
      JOIN arena_teams t ON r.team_id = t.id
      WHERE r.tournament_id = $1
      ORDER BY r.seed NULLS LAST, r.group_score DESC
    `, [tournament.id]);

    res.json({ success: true, tournament, teams: teamsRes.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create tournament (admin)
router.post('/', async (req, res) => {
  try {
    const { name, tier, maxTeams, minTeams, prizePool, entryFee, registrationStart, registrationEnd, tournamentStart, config } = req.body;

    if (!name || !tier || !registrationStart || !registrationEnd || !tournamentStart) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await query(`
      INSERT INTO arena_tournaments (name, tier, max_teams, min_teams, prize_pool_usdc, entry_fee_usdc,
        registration_start, registration_end, tournament_start, config)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *
    `, [name, tier, maxTeams || 64, minTeams || 4, prizePool || 0, entryFee || 0,
        registrationStart, registrationEnd, tournamentStart, JSON.stringify(config || {})]);

    res.status(201).json({ success: true, tournament: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Register team for tournament
router.post('/:id/register', async (req, res) => {
  try {
    const { teamId, captainWallet } = req.body;
    if (!teamId || !captainWallet) return res.status(400).json({ error: 'teamId and captainWallet required' });

    // Verify captain
    const teamRes = await query('SELECT * FROM arena_teams WHERE id = $1', [teamId]);
    if (teamRes.rows.length === 0) return res.status(404).json({ error: 'Team not found' });
    if (teamRes.rows[0].captain_wallet !== captainWallet) {
      return res.status(403).json({ error: 'Only captain can register the team' });
    }

    // Verify tournament accepting registrations
    const tournRes = await query('SELECT * FROM arena_tournaments WHERE id = $1', [req.params.id]);
    if (tournRes.rows.length === 0) return res.status(404).json({ error: 'Tournament not found' });
    const tournament = tournRes.rows[0];

    if (tournament.status !== 'registration') {
      return res.status(400).json({ error: 'Tournament is not accepting registrations' });
    }

    const now = new Date();
    if (now < new Date(tournament.registration_start) || now > new Date(tournament.registration_end)) {
      return res.status(400).json({ error: 'Registration window is closed' });
    }

    // Check team has minimum 3 members
    const memberCount = await query(
      `SELECT COUNT(*) FROM arena_members WHERE team_id = $1 AND status = 'active'`, [teamId]
    );
    if (parseInt(memberCount.rows[0].count) < 3) {
      return res.status(400).json({ error: 'Team needs at least 3 active members to register' });
    }

    // Check tournament not full
    const regCount = await query(
      `SELECT COUNT(*) FROM arena_registrations WHERE tournament_id = $1`, [req.params.id]
    );
    if (parseInt(regCount.rows[0].count) >= tournament.max_teams) {
      return res.status(409).json({ error: 'Tournament is full' });
    }

    // Check tier match
    if (tournament.tier !== 'open' && teamRes.rows[0].tier !== tournament.tier) {
      return res.status(400).json({ error: `Team tier (${teamRes.rows[0].tier}) does not match tournament tier (${tournament.tier})` });
    }

    await query(
      `INSERT INTO arena_registrations (tournament_id, team_id) VALUES ($1, $2)
       ON CONFLICT (tournament_id, team_id) DO NOTHING`,
      [req.params.id, teamId]
    );

    res.json({ success: true, message: `Team "${teamRes.rows[0].name}" registered for "${tournament.name}"` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start tournament — create group stage matches (admin)
router.post('/:id/start', async (req, res) => {
  try {
    const tournRes = await query('SELECT * FROM arena_tournaments WHERE id = $1', [req.params.id]);
    if (tournRes.rows.length === 0) return res.status(404).json({ error: 'Tournament not found' });

    const tournament = tournRes.rows[0];
    if (tournament.status !== 'registration') {
      return res.status(400).json({ error: 'Tournament already started' });
    }

    // Get registered teams
    const regsRes = await query(
      `SELECT r.*, t.arena_rank FROM arena_registrations r JOIN arena_teams t ON r.team_id = t.id
       WHERE r.tournament_id = $1 ORDER BY t.arena_rank DESC`,
      [req.params.id]
    );

    const teams = regsRes.rows;
    if (teams.length < tournament.min_teams) {
      return res.status(400).json({ error: `Need at least ${tournament.min_teams} teams, have ${teams.length}` });
    }

    // Seed teams by arena rank
    for (let i = 0; i < teams.length; i++) {
      await query(`UPDATE arena_registrations SET seed = $1 WHERE id = $2`, [i + 1, teams[i].id]);
    }

    // Create group stage — all teams compete simultaneously
    const groupStart = new Date(tournament.tournament_start);
    const groupEnd = new Date(groupStart.getTime() + 3 * 24 * 3600000); // 3 days

    // Create a "group" match for scoring (all vs all)
    await query(`
      INSERT INTO arena_matches (tournament_id, round, round_number, team_a_id, team_b_id, round_start, round_end, status)
      VALUES ($1, 'group', 1, NULL, NULL, $2, $3, 'active')
    `, [req.params.id, groupStart, groupEnd]);

    // Create individual group matches for each pair (for bracket tracking)
    let matchNum = 1;
    for (let i = 0; i < teams.length; i += 2) {
      if (i + 1 < teams.length) {
        await query(`
          INSERT INTO arena_matches (tournament_id, round, round_number, team_a_id, team_b_id, round_start, round_end, status)
          VALUES ($1, 'group', $2, $3, $4, $5, $6, 'active')
        `, [req.params.id, ++matchNum, teams[i].team_id, teams[i + 1].team_id, groupStart, groupEnd]);
      }
    }

    // Update tournament status
    await query(`UPDATE arena_tournaments SET status = 'group_stage' WHERE id = $1`, [req.params.id]);
    await query(`UPDATE arena_registrations SET status = 'active' WHERE tournament_id = $1`, [req.params.id]);

    res.json({ success: true, message: `Tournament "${tournament.name}" started with ${teams.length} teams`, groupEnd });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get live scores
router.get('/:id/scores', async (req, res) => {
  try {
    const matchesRes = await query(`
      SELECT m.*, ta.name as team_a_name, tb.name as team_b_name
      FROM arena_matches m
      LEFT JOIN arena_teams ta ON m.team_a_id = ta.id
      LEFT JOIN arena_teams tb ON m.team_b_id = tb.id
      WHERE m.tournament_id = $1 AND m.status IN ('active', 'completed')
      ORDER BY m.round, m.round_number
    `, [req.params.id]);

    res.json({ success: true, matches: matchesRes.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get bracket
router.get('/:id/bracket', async (req, res) => {
  try {
    const matchesRes = await query(`
      SELECT m.id, m.round, m.round_number, m.status,
        m.team_a_id, ta.name as team_a_name, m.team_a_score,
        m.team_b_id, tb.name as team_b_name, m.team_b_score,
        m.winner_id, m.round_start, m.round_end
      FROM arena_matches m
      LEFT JOIN arena_teams ta ON m.team_a_id = ta.id
      LEFT JOIN arena_teams tb ON m.team_b_id = tb.id
      WHERE m.tournament_id = $1
      ORDER BY
        CASE m.round
          WHEN 'group' THEN 1 WHEN 'r32' THEN 2 WHEN 'r16' THEN 3
          WHEN 'quarter' THEN 4 WHEN 'semi' THEN 5 WHEN 'final' THEN 6
        END,
        m.round_number
    `, [req.params.id]);

    res.json({ success: true, bracket: matchesRes.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
