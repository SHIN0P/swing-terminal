import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const client = axios.create({ baseURL: BASE, timeout: 30000 })

const safe = async (fn, fallback) => {
  try { const r = await fn(); return r.data }
  catch (e) { console.error('API Error:', e.message); return fallback }
}

export const getMarketPulse = () =>
  safe(() => client.get('/api/market-pulse'), {
    nifty50: 0, nifty50_change: 0, sensex: 0, sensex_change: 0,
    india_vix: 0, nifty_bank: 0, nifty_bank_change: 0,
    market_signal: 'LOADING', signal_color: '#8B949E',
    market_signal_text: 'Fetching data...', fii_today: 0, dii_today: 0,
  })

export const getFiiDii = (days = 30) =>
  safe(() => client.get(`/api/fii-dii?days=${days}`), {
    daily_data: [], cumulative_10d: 0, cumulative_dii_10d: 0,
    scenario_label: '', scenario_desc: '',
    sector_flows: [], fii_today: 0, dii_today: 0, bulk_deals: [],
  })

export const getSectors = () =>
  safe(() => client.get('/api/sectors'), [])

export const getScanner = (minScore = 0, sector = 'all', limit = 50) =>
  safe(() => client.get(`/api/scanner?min_score=${minScore}&sector=${sector}&limit=${limit}`), [])

export const getOpportunities = () =>
  safe(() => client.get('/api/opportunities'), [])

export const getBulkDeals = (days = 7) =>
  safe(() => client.get(`/api/bulk-deals?days=${days}`), [])

export const getPortfolio = () =>
  safe(() => client.get('/api/portfolio'), { positions: [], summary: {} })

export const addPosition = (data) =>
  safe(() => client.post('/api/portfolio', data), null)

export const deletePosition = (id) =>
  safe(() => client.delete(`/api/portfolio/${id}`), null)

export const triggerRefresh = () =>
  safe(() => client.get('/api/refresh'), null)
