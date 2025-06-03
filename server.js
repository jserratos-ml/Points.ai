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
  const { origin, destination, date, cabin = 'economy', partnerCode } = req.body;
  const searchPartners = partnerCode
    ? partners.filter(p => p.code === partnerCode)
    : partners;

  const results = [];

  for (const partner of searchPartners) {
    try {
      const flights = await scrapePartner(partner, { origin, destination, date, cabin });
      results.push(...flights);
    } catch (err) {
      console.error(`Failed to scrape ${partner.name}:`, err.message);
    }
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
