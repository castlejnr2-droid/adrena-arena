/**
 * Profile & Leaderboard Routes
 * GET /arena/profile/:wallet — Player arena stats
 * GET /arena/leaderboard — Global team rankings
 * GET /arena/history — Past tournament results
 */

const { Router } = require('express');
const { query } = require('../db/index');

const router = Router();

// Player profile
router.get('/profile/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet;

    // Get team membership
    const teamRes = await query(`
      SELECT t.*, m.status as member_status, m.joined_at
      FROM arena_members m JOIN arena_teams t ON m.team_id = t.id
      WHERE m.wallet_address = $1 AND m.status = 'active'
    `, [wallet]);

    // Get tournament history
    const historyRes = await query(`
      SELECT DISTINCT t.id, t.name, t.tier, t.status,
        r.status as team_status, r.seed,
        tm.name as team_name
      FROM arena_registrations r
      JOIN arena_tournaments t ON r.tournament_id = t.id
      JOIN arena_teams tm ON r.team_id = tm.id
      JOIN arena_members m ON m.team_id = r.team_id
      WHERE m.wallet_address = $1
      ORDER BY t.created_at DESC LIMIT 20
    `, [wallet]);

    // Get rewards
    const rewardsRes = await query(`
      SELECT r.*, t.name as tournament_name
      FROM arena_rewards r
      JOIN arena_tournaments t ON r.tournament_id = t.id
      WHERE r.wallet_address = $1
      ORDER BY r.distributed_at DESC LIMIT 20
    `, [wallet]);

    // Get score stats
    const statsRes = await query(`
      SELECT
        COUNT(*) as total_matches,
        COALESCE(AVG(pnl_percentage), 0) as avg_pnl_pct,
        COALESCE(SUM(volume_usd), 0) as total_volume,
        COALESCE(MAX(pnl_percentage), 0) as best_pnl_pct
      FROM arena_scores WHERE wallet_address = $1
    `, [wallet]);

    res.json({
      success: true,
      profile: {
        wallet,
        team: teamRes.rows[0] || null,
        stats: statsRes.rows[0],
        tournaments: historyRes.rows,
        rewards: rewardsRes.rows,
        totalRewardsUsdc: rewardsRes.rows.reduce((sum, r) => sum + Number(r.reward_usdc || 0), 0)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Global leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const { tier, limit = 50 } = req.query;
    let sql = `
      SELECT t.*, COUNT(DISTINCT m.id) as member_count,
        COALESCE(t.wins, 0) as wins, COALESCE(t.losses, 0) as losses
      FROM arena_teams t
      LEFT JOIN arena_members m ON m.team_id = t.id AND m.status = 'active'
    `;
    const params = [];

    if (tier) {
      sql += ` WHERE t.tier = $1`;
      params.push(tier);
    }

    sql += ` GROUP BY t.id ORDER BY t.arena_rank DESC, t.wins DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));

    const result = await query(sql, params);
    res.json({ success: true, leaderboard: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tournament history
router.get('/history', async (req, res) => {
  try {
    const result = await query(`
      SELECT t.*,
        (SELECT COUNT(*) FROM arena_registrations r WHERE r.tournament_id = t.id) as team_count,
        champ.name as champion_name
      FROM arena_tournaments t
      LEFT JOIN arena_registrations cr ON cr.tournament_id = t.id AND cr.status = 'champion'
      LEFT JOIN arena_teams champ ON cr.team_id = champ.id
      WHERE t.status = 'completed'
      ORDER BY t.tournament_end DESC LIMIT 50
    `);

    res.json({ success: true, history: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
