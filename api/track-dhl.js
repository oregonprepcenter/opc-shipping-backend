export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
 
  const DHL_KEY = process.env.DHL_API_KEY;
  if (!DHL_KEY) {
    return res.status(500).json({ error: "DHL API key not configured" });
  }
 
  try {
    const { tracking_code } = req.body;
 
    if (!tracking_code) {
      return res.status(400).json({ error: "Missing tracking_code" });
    }
 
    const response = await fetch(
      "https://api-eu.dhl.com/track/shipments?trackingNumber=" + encodeURIComponent(tracking_code),
      {
        method: "GET",
        headers: {
          "DHL-API-Key": DHL_KEY,
          "Accept": "application/json"
        }
      }
    );
 
    const data = await response.json();
 
    if (!data.shipments || data.shipments.length === 0) {
      return res.status(400).json({ error: "No shipment found for this tracking number" });
    }
 
    const shipment = data.shipments[0];
    const status = shipment.status || {};
    const events = (shipment.events || []).map(function(e) {
      return {
        status: e.statusCode || "",
        message: e.description || e.status || "",
        datetime: e.timestamp || "",
        city: e.location && e.location.address ? e.location.address.addressLocality || "" : "",
        state: ""
      };
    });
 
    // Map DHL status to standard statuses
    var statusCode = (status.statusCode || "").toLowerCase();
    var mappedStatus = "unknown";
    if (statusCode === "delivered") mappedStatus = "delivered";
    else if (statusCode === "transit") mappedStatus = "in_transit";
    else if (statusCode === "out-for-delivery") mappedStatus = "out_for_delivery";
    else if (statusCode === "pre-transit" || statusCode === "informationreceived") mappedStatus = "pre_transit";
    else if (statusCode === "failure" || statusCode === "exception") mappedStatus = "return_to_sender";
    else if (status.status) mappedStatus = status.status;
 
    return res.status(200).json({
      success: true,
      carrier: "DHL",
      status: mappedStatus,
      est_delivery_date: shipment.estimatedTimeOfDelivery || null,
      tracking_code: tracking_code,
      detail: status.description || status.status || "",
      events: events
    });
 
  } catch (err) {
    return res.status(500).json({ error: "Server error: " + err.message });
  }
}
