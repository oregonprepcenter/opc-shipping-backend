export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
 
  const CLIENT_ID = process.env.FEDEX_CLIENT_ID;
  const CLIENT_SECRET = process.env.FEDEX_CLIENT_SECRET;
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(500).json({ error: "FedEx API credentials not configured" });
  }
 
  try {
    const { tracking_code } = req.body;
 
    if (!tracking_code) {
      return res.status(400).json({ error: "Missing tracking_code" });
    }
 
    // Step 1: Get OAuth token
    const tokenRes = await fetch("https://apis.fedex.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials&client_id=" + encodeURIComponent(CLIENT_ID) + "&client_secret=" + encodeURIComponent(CLIENT_SECRET)
    });
 
    const tokenData = await tokenRes.json();
 
    if (!tokenData.access_token) {
      return res.status(400).json({ error: "FedEx auth failed: " + (tokenData.errors ? tokenData.errors[0].message : "Unknown error") });
    }
 
    // Step 2: Track package
    const trackRes = await fetch("https://apis.fedex.com/track/v1/trackingnumbers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + tokenData.access_token,
        "X-locale": "en_US"
      },
      body: JSON.stringify({
        includeDetailedScans: true,
        trackingInfo: [{
          trackingNumberInfo: {
            trackingNumber: tracking_code
          }
        }]
      })
    });
 
    const trackData = await trackRes.json();
 
    if (trackData.errors && trackData.errors.length > 0) {
      return res.status(400).json({ error: trackData.errors[0].message || "FedEx tracking error" });
    }
 
    const results = trackData.output && trackData.output.completeTrackResults;
    if (!results || results.length === 0 || !results[0].trackResults || results[0].trackResults.length === 0) {
      return res.status(400).json({ error: "No tracking results found" });
    }
 
    const track = results[0].trackResults[0];
 
    if (track.error && track.error.message) {
      return res.status(400).json({ error: track.error.message });
    }
 
    const latestStatus = track.latestStatusDetail || {};
    const statusCode = (latestStatus.code || "").toUpperCase();
    var mappedStatus = "unknown";
    if (statusCode === "DL" || statusCode === "DE") mappedStatus = "delivered";
    else if (statusCode === "IT" || statusCode === "IX" || statusCode === "AR" || statusCode === "DP" || statusCode === "OC") mappedStatus = "in_transit";
    else if (statusCode === "OD") mappedStatus = "out_for_delivery";
    else if (statusCode === "PU" || statusCode === "PX") mappedStatus = "in_transit";
    else if (statusCode === "SE" || statusCode === "CA" || statusCode === "RS") mappedStatus = "return_to_sender";
    else if (latestStatus.description) mappedStatus = latestStatus.description;
 
    const events = (track.scanEvents || []).map(function(e) {
      var loc = e.scanLocation || {};
      return {
        status: e.eventType || "",
        message: e.eventDescription || e.derivedStatus || "",
        datetime: e.date || "",
        city: loc.city || "",
        state: loc.stateOrProvinceCode || ""
      };
    });
 
    var eta = null;
    if (track.estimatedDeliveryTimeWindow && track.estimatedDeliveryTimeWindow.window) {
      eta = track.estimatedDeliveryTimeWindow.window.ends || track.estimatedDeliveryTimeWindow.window.begins || null;
    } else if (track.standardTransitTimeWindow && track.standardTransitTimeWindow.window) {
      eta = track.standardTransitTimeWindow.window.ends || null;
    }
 
    var detail = latestStatus.description || "";
    if (latestStatus.ancillaryDetails && latestStatus.ancillaryDetails.length > 0) {
      detail = latestStatus.ancillaryDetails[0].reasonDescription || detail;
    }
 
    return res.status(200).json({
      success: true,
      carrier: "FedEx",
      status: mappedStatus,
      est_delivery_date: eta,
      tracking_code: tracking_code,
      detail: detail,
      events: events
    });
 
  } catch (err) {
    return res.status(500).json({ error: "Server error: " + err.message });
  }
}
