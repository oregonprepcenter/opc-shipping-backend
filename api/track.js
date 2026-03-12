export const config = {
  maxDuration: 30
};
 
export default async function handler(req, res) {
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
 
  const authHeader = "Basic " + Buffer.from(EP_KEY + ":").toString("base64");
 
  try {
    const { tracking_code, carrier } = req.body;
 
    if (!tracking_code) {
      return res.status(400).json({ error: "Missing tracking_code" });
    }
 
    // Create tracker
    const body = { tracker: { tracking_code: tracking_code } };
    if (carrier) body.tracker.carrier = carrier;
 
    const createRes = await fetch("https://api.easypost.com/v2/trackers", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": authHeader },
      body: JSON.stringify(body)
    });
 
    let data = await createRes.json();
 
    if (data.error) {
      return res.status(400).json({ error: data.error.message || "EasyPost error" });
    }
 
    // If status is unknown, poll up to 8 times with 3s delays (24s max)
    if (data.status === "unknown" && data.id) {
      for (let i = 0; i < 8; i++) {
        await new Promise(r => setTimeout(r, 3000));
        const pollRes = await fetch("https://api.easypost.com/v2/trackers/" + data.id, {
          method: "GET",
          headers: { "Authorization": authHeader }
        });
        const pollData = await pollRes.json();
        if (pollData.status && pollData.status !== "unknown") {
          data = pollData;
          break;
        }
      }
    }
 
    const events = (data.tracking_details || []).map(function(e) {
      return {
        status: e.status,
        message: e.message,
        datetime: e.datetime,
        city: e.tracking_location ? e.tracking_location.city : "",
        state: e.tracking_location ? e.tracking_location.state : ""
      };
    });
 
    return res.status(200).json({
      success: true,
      carrier: data.carrier,
      status: data.status,
      est_delivery_date: data.est_delivery_date,
      tracking_code: data.tracking_code,
      events: events
    });
 
  } catch (err) {
    return res.status(500).json({ error: "Server error: " + err.message });
  }
}
