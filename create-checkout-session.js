// Vercel serverless function
import Stripe from "stripe";

export default async function handler(req, res) {
  // Allow only POST
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const { items, success_url, cancel_url } = req.body || {};

    // items: [{ name, price, qty, image }]
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: "No items provided" });
    }

    const line_items = items.map((i) => ({
      price_data: {
        currency: "usd",
        product_data: {
          name: i.name || "Square Bidness Item",
          images: i.image ? [i.image] : []
        },
        // Stripe uses cents
        unit_amount: Math.round(Number(i.price || 0) * 100)
      },
      quantity: Math.max(1, Number(i.qty || 1))
    }));

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items,
      success_url: success_url || "https://your-site.com/success.html?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: cancel_url || "https://your-site.com/cart.html"
    });

    return res.status(200).json({ id: session.id, url: session.url });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}
