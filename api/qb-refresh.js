export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
 
  const clientId = process.env.QB_CLIENT_ID;
  const clientSecret = process.env.QB_CLIENT_SECRET;
  const { refresh_token } = req.body;
 
  if (!refresh_token) {
    return res.status(400).json({ error: "Missing refresh_token" });
  }
 
  try {
    const basic = Buffer.from(clientId + ":" + clientSecret).toString("base64");
    const tokenRes = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
      method: "POST",
      headers: {
        "Authorization": "Basic " + basic,
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json"
      },
      body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(refresh_token)
    });
 
    const tokenData = await tokenRes.json();
 
    if (tokenData.error) {
      return res.status(401).json({
        error: "Token refresh failed",
        detail: tokenData.error_description || tokenData.error,
        reconnect: true
      });
    }
 
    return res.status(200).json({
      success: true,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in
    });
 
  } catch (err) {
    return res.status(500).json({ error: "Server error: " + err.message });
  }
}
 
