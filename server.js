import express from 'express';
import cheerio from 'cheerio';
import { exec as _exec } from 'child_process';
import { promisify } from 'util';

const exec = promisify(_exec);

const app = express();
app.use(express.json());

/**
 * List of partner websites with placeholder URLs. These URLs should be
 * replaced with the real search endpoints for each partner. Some websites may
 * require additional query parameters or authentication.
 */
const partners = [
  {
    code: 'DL',
    name: 'Delta Air Lines',
    url: 'https://www.delta.com/flight-search/book-a-flight',
    buildQuery: p => `?fromCity=${p.origin}&toCity=${p.destination}&departureDate=${p.date}`,
  },
  {
    code: 'AF',
    name: 'Air France',
    url: 'https://wwws.airfrance.us/booking/search-flight',
    buildQuery: p => `?origin=${p.origin}&destination=${p.destination}&departureDate=${p.date}`,
  },
  {
    code: 'BA',
    name: 'British Airways',
    url: 'https://www.britishairways.com/travel/booking',
    buildQuery: p => `?source=${p.origin}&destination=${p.destination}&depDate=${p.date}`,
  },
];

/**
 * Basic scraper that performs a GET request to the partner website and
 * extracts award data from the HTML. The CSS selectors used here are
 * placeholders and should be updated to match each website's structure.
 */
async function scrapePartner(partner, params) {
  const query = partner.buildQuery ? partner.buildQuery(params) : `?origin=${params.origin}&destination=${params.destination}&date=${params.date}`;
  const searchUrl = `${partner.url}${query}`;
  // Use curl via child_process as direct network access for fetch may be blocked
  const command = `curl -LsA "Mozilla/5.0" "${searchUrl}"`;
  const { stdout } = await exec(command, { maxBuffer: 10_000_000 });
  const html = stdout;
  const $ = cheerio.load(html);

  const flights = [];
  $('.flight').each((_, el) => {
    flights.push({
      partner: partner.name,
      cabin: $(el).find('.cabin').text().trim(),
      points: parseInt($(el).find('.points').text().replace(/\D/g, ''), 10),
      // add other fields as needed
    });
  });
  return flights;
}

app.post('/search', async (req, res) => {
  const { origin, destination, date, partnerCode } = req.body;
  const searchPartners = partnerCode
    ? partners.filter(p => p.code === partnerCode)
    : partners;

  const results = [];
  for (const partner of searchPartners) {
    try {
      const flights = await scrapePartner(partner, { origin, destination, date });
      results.push(...flights);
    } catch (err) {
      console.error(`Failed to scrape ${partner.name}:`, err.message);
    }
  }
  res.json({ results });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
