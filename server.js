// server.js
require('dotenv').config();                 // ✅ load .env

const express = require('express');
const cors = require('cors');
const app = express();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Middlewares
app.use(cors());                            // ✅ allow 5500 -> 4242
app.use(express.json());                    // ✅ parse JSON

app.post('/create-checkout-session', async (req, res) => {
  try {
    // Validate input
    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
    const items = rawItems
      .map(i => ({
        name: String(i.name || '').trim(),
        qty: Math.max(1, Number(i.qty || 0)),
        price: Number(i.price),
      }))
      .filter(i => i.name && i.qty > 0 && Number.isFinite(i.price) && i.price > 0);

    if (!items.length) {
      return res.status(400).json({ error: 'No purchasable items' });
    }

    const line_items = items.map(i => ({
      price_data: {
        currency: 'usd',
        product_data: { name: i.name },
        unit_amount: Math.round(i.price * 100), // cents
      },
      quantity: i.qty,
    }));

    // Match whatever your dev server origin actually is in the browser bar
    const ORIGIN = 'http://127.0.0.1:5500'; // or 'http://localhost:5500'
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items,
      success_url: `${ORIGIN}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${ORIGIN}/cart.html`,
    });

    // Return URL (simplest client flow)
    return res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
// GET /order-details?session_id=cs_test_...
app.get('/order-details', async (req, res) => {
  try {
    const { session_id } = req.query;
    if (!session_id) return res.status(400).json({ error: 'Missing session_id' });

    // 1) session basics
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['payment_intent', 'customer_details']
    });

    // 2) line items
    const li = await stripe.checkout.sessions.listLineItems(session_id, { limit: 100 });

    const payload = {
      id: session.id,
      customer_email: session.customer_details?.email || session.customer_email || null,
      currency: session.currency,
      amount_total: session.amount_total,   // in cents
      payment_status: session.payment_status,
      line_items: li.data.map(x => ({
        description: x.description,
        quantity: x.quantity,
        unit_amount: x.price?.unit_amount ?? null, // cents
        currency: x.price?.currency ?? session.currency
      }))
    };

    res.json(payload);
  } catch (err) {
    console.error('order-details error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});
