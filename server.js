import express from 'express';
import fetch from 'node-fetch';
import cheerio from 'cheerio';

const app = express();
app.use(express.json());
app.use(express.static("."));

/**
 * List of partner websites with placeholder URLs. These URLs should be
 * replaced with the real search endpoints for each partner. Some websites may
 * require additional query parameters or authentication.
 */
const partners = [
  { code: 'DL', name: 'Delta Air Lines', url: 'https://example.com/delta-search' },
  { code: 'AF', name: 'Air France', url: 'https://example.com/airfrance-search' },
  // ... add other partners here
];

/**
 * Basic scraper that performs a GET request to the partner website and
 * extracts award data from the HTML. The CSS selectors used here are
 * placeholders and should be updated to match each website's structure.
 */
async function scrapePartner(partner, params) {
  const searchUrl = `${partner.url}?origin=${params.origin}&destination=${params.destination}&date=${params.date}`;
  const response = await fetch(searchUrl);
  if (!response.ok) {
    throw new Error(`Request to ${partner.name} failed: ${response.status}`);
  }
  const html = await response.text();
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
