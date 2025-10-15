// /api/create-checkout-session.js  (Vercel serverless function)
import Stripe from "stripe";

// Optional: keep this if your stack might default to edge somewhere
export const config = { runtime: "nodejs18.x" };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16"
});

// Trusted site URL for redirects
const SITE_URL = process.env.SITE_URL || "https://www.squarebidness.com";

// Optional: restrict which origins can call this endpoint
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || "https://www.squarebidness.com";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  setCors(res);

  // Preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { items } = req.body || {};

    // items: [{ name, price, qty, image }]
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "No items provided" });
    }

    // sanitize & validate
    const line_items = items.map((i, idx) => {
      const name  = String(i?.name || "Square Bidness Item").slice(0, 200);
      const price = Math.max(0, Number(i?.price || 0));
      const qty   = Math.max(1, Math.floor(Number(i?.qty || 1)));
      const image = i?.image && typeof i.image === "string" ? i.image : null;

      if (!Number.isFinite(price)) {
        throw new Error(`Invalid price at index ${idx}`);
      }

      return {
        price_data: {
          currency: "usd",
          product_data: {
            name,
            ...(image ? { images: [image] } : {})
          },
          unit_amount: Math.round(price * 100) // cents
        },
        quantity: qty
      };
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items,

      // ✅ Build trusted redirect URLs on the server
      success_url: `${SITE_URL}/success/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${SITE_URL}/cart/`,

      // Nice-to-haves (toggle as you like)
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      phone_number_collection: { enabled: false },

      // If you enable this in Stripe and set tax settings:
      // automatic_tax: { enabled: true },

      // Keep a bit of context
      metadata: {
        site: "squarebidness.com",
        env: process.env.VERCEL_ENV || "production"
      }
    });

    return res.status(200).json({ id: session.id, url: session.url });
  } catch (err) {
    console.error("Stripe session error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
