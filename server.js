import express from 'express';
import { Duffel } from '@duffel/api';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const duffel = new Duffel({ token: process.env.DUFFEL_ACCESS_TOKEN || '' });

app.post('/api/search', async (req, res) => {
  const { origin, destination, departureDate } = req.body;
  if (!origin || !destination || !departureDate) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    const offerRequest = await duffel.offerRequests.create({
      slices: [
        {
          origin,
          destination,
          departure_date: departureDate,
        },
      ],
      passengers: [{ type: 'adult' }],
      return_offers: false,
    });

    const offers = await duffel.offers.list({
      offer_request_id: offerRequest.data.id,
      limit: 20,
    });

    res.json({ offers: offers.data });
  } catch (err) {
    console.error('Duffel API error', err);
    res.status(500).json({ error: 'Duffel API request failed' });
  }
});

app.get('/', (_, res) => {
  res.sendFile('duffel_search.html', { root: __dirname });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
