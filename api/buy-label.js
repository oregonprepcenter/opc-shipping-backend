export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const EP_KEY = process.env.EASYPOST_API_KEY;
  if (!EP_KEY) return res.status(500).json({ error: "EasyPost API key not configured" });
  try {
    const { shipment_id, rate_id } = req.body;
    if (!shipment_id || !rate_id) return res.status(400).json({ error: "Missing fields" });
    const response = await fetch("https://api.easypost.com/v2/shipments/" + shipment_id + "/buy", {
      method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + EP_KEY },
      body: JSON.stringify({ rate: { id: rate_id } })
    });
    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message });
    return res.status(200).json({
      success: true, tracking_code: data.tracking_code,
      label_url: data.postage_label ? data.postage_label.label_url : null,
      carrier: data.selected_rate ? data.selected_rate.carrier : "",
      service: data.selected_rate ? data.selected_rate.service : "",
      rate: data.selected_rate ? data.selected_rate.rate : ""
    });
  } catch (err) { return res.status(500).json({ error: err.message }); }
}
