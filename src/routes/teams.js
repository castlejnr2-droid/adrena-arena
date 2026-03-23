/**
 * Team Management Routes
 * POST /arena/teams — Create team
 * GET /arena/teams/:id — Get team details
 * POST /arena/teams/:id/join — Join team with invite code
 * POST /arena/teams/:id/bench/:wallet — Bench/unbench member
 * DELETE /arena/teams/:id/members/:wallet — Remove member
 * GET /arena/teams — List all teams
 */

const { Router } = require('express');
const { query } = require('../db/index');
const crypto = require('crypto');

const router = Router();

// Create team
router.post('/', async (req, res) => {
  try {
    const { name, captainWallet, displayName } = req.body;
    if (!name || !captainWallet) {
      return res.status(400).json({ error: 'name and captainWallet required' });
    }

    // Check team name uniqueness
    const existing = await query('SELECT id FROM arena_teams WHERE name = $1', [name]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Team name already taken' });
    }

    // Check captain isn't already in a team
    const memberCheck = await query(
      `SELECT t.name FROM arena_members m JOIN arena_teams t ON m.team_id = t.id
       WHERE m.wallet_address = $1 AND m.status = 'active'`, [captainWallet]
    );
    if (memberCheck.rows.length > 0) {
      return res.status(409).json({ error: `Already a member of team "${memberCheck.rows[0].name}"` });
    }

    const inviteCode = crypto.randomBytes(4).toString('hex');

    const teamRes = await query(
      `INSERT INTO arena_teams (name, captain_wallet, invite_code) VALUES ($1, $2, $3) RETURNING *`,
      [name, captainWallet, inviteCode]
    );
    const team = teamRes.rows[0];

    // Add captain as member
    await query(
      `INSERT INTO arena_members (team_id, wallet_address, display_name) VALUES ($1, $2, $3)`,
      [team.id, captainWallet, displayName || null]
    );

    res.status(201).json({ success: true, team: { ...team, members: [{ wallet: captainWallet, displayName, role: 'captain' }] } });
  } catch (err) {
    console.error('[TEAMS] Create error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// List teams
router.get('/', async (req, res) => {
  try {
    const { tier, limit = 50 } = req.query;
    let sql = `SELECT t.*, COUNT(m.id) as member_count
      FROM arena_teams t LEFT JOIN arena_members m ON m.team_id = t.id AND m.status = 'active'`;
    const params = [];

    if (tier) {
      sql += ` WHERE t.tier = $1`;
      params.push(tier);
    }
    sql += ` GROUP BY t.id ORDER BY t.arena_rank DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));

    const result = await query(sql, params);
    res.json({ success: true, teams: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get team details
router.get('/:id', async (req, res) => {
  try {
    const teamRes = await query('SELECT * FROM arena_teams WHERE id = $1', [req.params.id]);
    if (teamRes.rows.length === 0) return res.status(404).json({ error: 'Team not found' });

    const team = teamRes.rows[0];
    const membersRes = await query(
      `SELECT wallet_address, display_name, status, joined_at FROM arena_members WHERE team_id = $1 ORDER BY joined_at`,
      [team.id]
    );

    // Recent match history
    const matchesRes = await query(`
      SELECT m.*, ta.name as team_a_name, tb.name as team_b_name, t.name as tournament_name
      FROM arena_matches m
      JOIN arena_teams ta ON m.team_a_id = ta.id
      LEFT JOIN arena_teams tb ON m.team_b_id = tb.id
      JOIN arena_tournaments t ON m.tournament_id = t.id
      WHERE (m.team_a_id = $1 OR m.team_b_id = $1) AND m.status = 'completed'
      ORDER BY m.round_end DESC LIMIT 10
    `, [team.id]);

    res.json({
      success: true,
      team: {
        ...team,
        members: membersRes.rows.map(m => ({
          ...m,
          role: m.wallet_address === team.captain_wallet ? 'captain' : 'member'
        })),
        recentMatches: matchesRes.rows
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Join team
router.post('/:id/join', async (req, res) => {
  try {
    const { wallet, inviteCode, displayName } = req.body;
    if (!wallet || !inviteCode) return res.status(400).json({ error: 'wallet and inviteCode required' });

    const teamRes = await query('SELECT * FROM arena_teams WHERE id = $1', [req.params.id]);
    if (teamRes.rows.length === 0) return res.status(404).json({ error: 'Team not found' });

    const team = teamRes.rows[0];
    if (team.invite_code !== inviteCode) return res.status(403).json({ error: 'Invalid invite code' });

    // Check max 5 members
    const countRes = await query(
      `SELECT COUNT(*) FROM arena_members WHERE team_id = $1 AND status = 'active'`, [team.id]
    );
    if (parseInt(countRes.rows[0].count) >= 5) {
      return res.status(409).json({ error: 'Team is full (max 5 members)' });
    }

    // Check not already in another team
    const existingRes = await query(
      `SELECT t.name FROM arena_members m JOIN arena_teams t ON m.team_id = t.id
       WHERE m.wallet_address = $1 AND m.status = 'active'`, [wallet]
    );
    if (existingRes.rows.length > 0) {
      return res.status(409).json({ error: `Already in team "${existingRes.rows[0].name}"` });
    }

    await query(
      `INSERT INTO arena_members (team_id, wallet_address, display_name) VALUES ($1, $2, $3)
       ON CONFLICT (team_id, wallet_address) DO UPDATE SET status = 'active'`,
      [team.id, wallet, displayName || null]
    );

    res.json({ success: true, message: `Joined team "${team.name}"` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bench/unbench member (captain only)
router.post('/:id/bench/:wallet', async (req, res) => {
  try {
    const { captainWallet } = req.body;
    const teamRes = await query('SELECT * FROM arena_teams WHERE id = $1', [req.params.id]);
    if (teamRes.rows.length === 0) return res.status(404).json({ error: 'Team not found' });
    if (teamRes.rows[0].captain_wallet !== captainWallet) return res.status(403).json({ error: 'Only captain can bench members' });

    const memberRes = await query(
      `SELECT status FROM arena_members WHERE team_id = $1 AND wallet_address = $2`,
      [req.params.id, req.params.wallet]
    );
    if (memberRes.rows.length === 0) return res.status(404).json({ error: 'Member not found' });

    const newStatus = memberRes.rows[0].status === 'benched' ? 'active' : 'benched';
    await query(
      `UPDATE arena_members SET status = $1 WHERE team_id = $2 AND wallet_address = $3`,
      [newStatus, req.params.id, req.params.wallet]
    );

    res.json({ success: true, status: newStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove member (captain only)
router.delete('/:id/members/:wallet', async (req, res) => {
  try {
    const { captainWallet } = req.body;
    const teamRes = await query('SELECT * FROM arena_teams WHERE id = $1', [req.params.id]);
    if (teamRes.rows.length === 0) return res.status(404).json({ error: 'Team not found' });
    if (teamRes.rows[0].captain_wallet !== captainWallet) return res.status(403).json({ error: 'Only captain can remove members' });
    if (req.params.wallet === captainWallet) return res.status(400).json({ error: 'Captain cannot remove themselves' });

    await query(
      `UPDATE arena_members SET status = 'removed' WHERE team_id = $1 AND wallet_address = $2`,
      [req.params.id, req.params.wallet]
    );

    res.json({ success: true, message: 'Member removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
