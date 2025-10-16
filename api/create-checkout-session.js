// /api/create-checkout-session.js
export const config = { runtime: "nodejs" }; // ✅ not "nodejs18.x"
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });
const SITE_URL = process.env.SITE_URL || "https://www.squarebidness.com";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { items } = req.body || {};
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: "No items provided" });
    }

    const line_items = items.map(i => ({
      price_data: {
        currency: "usd",
        product_data: {
          name: String(i?.name || "Square Bidness Item").slice(0, 200),
          ...(i?.image ? { images: [i.image] } : {})
        },
        unit_amount: Math.round(Math.max(0, Number(i?.price || 0)) * 100)
      },
      quantity: Math.max(1, Math.floor(Number(i?.qty || 1)))
    }));

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items,
      success_url: `${SITE_URL}/success/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${SITE_URL}/cart/`,
      allow_promotion_codes: true
    });

    return res.status(200).json({ id: session.id, url: session.url });
  } catch (e) {
    console.error("Stripe session error:", e);
    return res.status(500).json({ error: "Server error" });
  }
}
