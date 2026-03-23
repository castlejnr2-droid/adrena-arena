/**
 * Adrena Public API Client
 * Wraps the datapi.adrena.trade endpoints
 */

const BASE = process.env.ADRENA_API_BASE || 'https://datapi.adrena.trade';

async function fetchJSON(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`Adrena API ${path}: ${res.status}`);
  return res.json();
}

/** Get open positions for a wallet */
async function getPositions(wallet, limit = 50) {
  const data = await fetchJSON(`/position?user_wallet=${wallet}&limit=${limit}`);
  if (!data.success) throw new Error(data.error || 'Failed to fetch positions');
  return data.data || [];
}

/** Get pool high-level stats (volume, fees) */
async function getPoolStats() {
  const data = await fetchJSON('/pool-high-level-stats');
  if (!data.success) throw new Error(data.error || 'Failed to fetch pool stats');
  return data.data;
}

/** Get liquidity info */
async function getLiquidityInfo() {
  const data = await fetchJSON('/liquidity-info');
  if (!data.success) throw new Error(data.error || 'Failed to fetch liquidity info');
  return data.data;
}

/** Get APR data */
async function getAPR() {
  const data = await fetchJSON('/apr');
  if (!data.success) throw new Error(data.error || 'Failed to fetch APR');
  return data.data;
}

module.exports = { getPositions, getPoolStats, getLiquidityInfo, getAPR };
