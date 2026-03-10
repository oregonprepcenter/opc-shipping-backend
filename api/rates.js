export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const EP_KEY = process.env.EASYPOST_API_KEY;
  if (!EP_KEY) return res.status(500).json({ error: "EasyPost API key not configured" });
  try {
    const { from_address, to_address, parcel } = req.body;
    if (!from_address || !to_address || !parcel) return res.status(400).json({ error: "Missing fields" });
    const response = await fetch("https://api.easypost.com/v2/shipments", {
      method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + EP_KEY },
      body: JSON.stringify({ shipment: { from_address, to_address, parcel } })
    });
    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message });
    const rates = (data.rates || []).map(r => ({
      id: r.id, carrier: r.carrier, service: r.service, rate: r.rate, currency: r.currency,
      delivery_days: r.est_delivery_days || r.delivery_days, retail_rate: r.retail_rate
    })).sort((a, b) => parseFloat(a.rate) - parseFloat(b.rate));
    return res.status(200).json({ success: true, shipment_id: data.id, rates });
  } catch (err) { return res.status(500).json({ error: err.message }); }
}
