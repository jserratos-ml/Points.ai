// server.js  ────────────────────────────────────────────────────────────────
import express from 'express';
// Modules for the old scraping approach (left for reference)
import * as cheerio from 'cheerio';
import { exec as _exec } from 'child_process';
import { promisify } from 'util';

// ⬇️ NEW: path helpers so we can send files in an ES-module
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
// ───────────────────────────────────────────────────────────────────────────

const exec = promisify(_exec);

const app = express();
app.use(express.json());

// ⬇️ NEW: serve any static file (HTML/CSS/JS) in the same folder
app.use(express.static(__dirname));

/**
 * List of partner websites with placeholder URLs. Replace with the
 * real search endpoints or add any extra query parameters you need.
 */
const partners = [
  {
    code: 'DL',
    name: 'Delta Air Lines',
    url: 'https://www.delta.com/flight-search/book-a-flight',
    buildQuery: p =>
      `?fromCity=${p.origin}&toCity=${p.destination}&departureDate=${p.date}`,
  },
  {
    code: 'AF',
    name: 'Air France',
    url: 'https://wwws.airfrance.us/booking/search-flight',
    buildQuery: p =>
      `?origin=${p.origin}&destination=${p.destination}&departureDate=${p.date}`,
  },
  {
    code: 'BA',
    name: 'British Airways',
    url: 'https://www.britishairways.com/travel/booking',
    buildQuery: p =>
      `?source=${p.origin}&destination=${p.destination}&depDate=${p.date}`,
  },
];

// Simplified dynamic result generator used in place of real scraping
function calculateRouteDistance(origin, destination) {
  const domesticCodes = ['LAX','JFK','ORD','DFW','ATL','SFO','MIA','SEA','BOS','DEN'];
  const europeCodes = ['LHR','CDG','FRA','AMS','MAD','FCO','MUC','ZRH'];
  const asiaCodes   = ['NRT','HKG','SIN','ICN','PVG','BKK','DEL'];

  if (domesticCodes.includes(origin) && domesticCodes.includes(destination)) {
    return Math.floor(Math.random() * 2000) + 500;
  }
  if ((domesticCodes.includes(origin) && europeCodes.includes(destination)) ||
      (europeCodes.includes(origin) && domesticCodes.includes(destination))) {
    return Math.floor(Math.random() * 2000) + 3000;
  }
  if ((domesticCodes.includes(origin) && asiaCodes.includes(destination)) ||
      (asiaCodes.includes(origin) && domesticCodes.includes(destination))) {
    return Math.floor(Math.random() * 3000) + 5000;
  }
  return Math.floor(Math.random() * 4000) + 1000;
}

function generateDynamicResults(partner, origin, destination, cabin) {
  const distance = calculateRouteDistance(origin, destination);
  const basePoints = {
    economy: Math.round(distance * 5 + 5000),
    business: Math.round(distance * 12 + 20000),
    first: Math.round(distance * 20 + 40000)
  };

  const multiplier = 1;
  const points = Math.round(basePoints[cabin] * multiplier);
  const adjusted = partner.ratio === '1.25:1' ? Math.round(points * 0.8) : points;

  const options = Math.floor(Math.random() * 3) + 1;
  const results = [];
  for (let i = 0; i < options; i++) {
    const stops = distance < 1000 ? 0 : Math.floor(Math.random() * 2);
    results.push({
      partner: partner.name,
      partnerCode: partner.code,
      cabin: cabin.charAt(0).toUpperCase() + cabin.slice(1),
      points: adjusted + i * 5000,
      stops,
      availability: 'Good',
      aircraft: distance < 1500 ? 'A320/B737' : (distance < 3500 ? 'A330/B787' : 'A350/B777'),
      duration: `${Math.floor(distance/500 + stops*2)}h ${Math.round(((distance/500 + stops*2)%1)*60)}m`
    });
  }
  return results;
}

/**
 * Basic scraper that curls the partner site and extracts data.
 * The CSS selectors here are placeholders—update them for each airline.
 */
async function scrapePartner(partner, params) {
  const query = partner.buildQuery
    ? partner.buildQuery(params)
    : `?origin=${params.origin}&destination=${params.destination}&date=${params.date}`;

  const searchUrl = `${partner.url}${query}`;

  // Use curl—handy when fetch is blocked or TLS quirks exist.
  const command = `curl -LsA "Mozilla/5.0" "${searchUrl}"`;
  const { stdout } = await exec(command, { maxBuffer: 10_000_000 });

  const $ = cheerio.load(stdout);
  const flights = [];

  $('.flight').each((_, el) => {
    flights.push({
      partner: partner.name,
      cabin:  $(el).find('.cabin').text().trim(),
      points: parseInt($(el).find('.points').text().replace(/\D/g, ''), 10),
      // add more fields as needed
    });
  });

  return flights;
}

// ── API endpoint ───────────────────────────────────────────────────────────
app.post('/search', async (req, res) => {
  const { origin, destination, cabin = 'economy', partnerCode } = req.body;
  const searchPartners = partnerCode
    ? partners.filter(p => p.code === partnerCode)
    : partners;

  const results = [];

  for (const partner of searchPartners) {
    const flights = generateDynamicResults(partner, origin, destination, cabin);
    results.push(...flights);
  }

  res.json({ results });
});

// Redirect the root to the landing page
app.get('/', (_, res) => res.redirect('/index.html'));

// ── Launch server ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
