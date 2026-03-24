/**
 * Adrena Public API Client
 * Wraps the datapi.adrena.trade endpoints
 * 
 * API Docs: https://documenter.getpostman.com/view/46802900/2sBXcKBdYH
 * 
 * Available endpoints:
 *   Trading: /add-liquidity, /remove-liquidity, /open-long, /open-short,
 *            /close-long, /close-short, /open-limit-long, /open-limit-short
 *   Positions: /position?user_wallet=&limit=
 *   Pool: /pool-high-level-stats
 *   Liquidity: /liquidity-info
 *   APR: /apr
 * 
 * Position response fields:
 *   position_id, symbol, side (long/short), status (open/close),
 *   entry_price, exit_price, entry_size, exit_size, pnl,
 *   entry_leverage, entry_date, exit_date, fees, borrow_fees,
 *   entry_collateral_amount, collateral_amount, volume, duration,
 *   closed_by_sl_tp, total_points
 */

const BASE = process.env.ADRENA_API_BASE || 'https://datapi.adrena.trade';

async function fetchJSON(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`Adrena API ${path}: ${res.status}`);
  return res.json();
}

/** Get positions for a wallet (open + closed) */
async function getPositions(wallet, limit = 50) {
  const data = await fetchJSON(`/position?user_wallet=${wallet}&limit=${limit}`);
  if (!data.success) throw new Error(data.error || 'Failed to fetch positions');
  return data.data || [];
}

/** Get pool high-level stats (daily/total volume and fees) */
async function getPoolStats() {
  const data = await fetchJSON('/pool-high-level-stats');
  if (!data.success) throw new Error(data.error || 'Failed to fetch pool stats');
  return data.data;
}

/** Get liquidity info (AUM, ALP price, custodies) */
async function getLiquidityInfo() {
  const data = await fetchJSON('/liquidity-info');
  if (!data.success) throw new Error(data.error || 'Failed to fetch liquidity info');
  return data.data;
}

/** Get APR data (staking rates by lock period) */
async function getAPR() {
  const data = await fetchJSON('/apr');
  if (!data.success) throw new Error(data.error || 'Failed to fetch APR');
  return data.data;
}

module.exports = { getPositions, getPoolStats, getLiquidityInfo, getAPR };
