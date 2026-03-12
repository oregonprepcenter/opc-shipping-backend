export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
 
  const EP_KEY = process.env.EASYPOST_API_KEY;
  if (!EP_KEY) {
    return res.status(500).json({ error: "EasyPost API key not configured" });
  }
 
  try {
    const { from_address, to_address, parcel } = req.body;
 
    if (!from_address || !to_address || !parcel) {
      return res.status(400).json({ error: "Missing from_address, to_address, or parcel" });
    }
 
    // Create shipment on EasyPost to get rates
    const response = await fetch("https://api.easypost.com/v2/shipments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic " + Buffer.from(EP_KEY + ":").toString("base64")
      },
      body: JSON.stringify({
        shipment: {
          from_address: from_address,
          to_address: to_address,
          parcel: parcel
        }
      })
    });
 
    const data = await response.json();
 
    if (data.error) {
      return res.status(400).json({ error: data.error.message || "EasyPost error" });
    }
 
    // Return shipment ID (needed to buy label) and rates
    const rates = (data.rates || []).map(function(r) {
      return {
        id: r.id,
        carrier: r.carrier,
        service: r.service,
        rate: r.rate,
        currency: r.currency,
        delivery_days: r.est_delivery_days || r.delivery_days,
        delivery_date: r.delivery_date,
        retail_rate: r.retail_rate
      };
    }).sort(function(a, b) {
      return parseFloat(a.rate) - parseFloat(b.rate);
    });
 
    return res.status(200).json({
      success: true,
      shipment_id: data.id,
      rates: rates
    });
 
  } catch (err) {
    return res.status(500).json({ error: "Server error: " + err.message });
  }
}
