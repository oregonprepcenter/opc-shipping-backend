export default async function handler(req, res) {
  // Revoke token if provided
  const accessToken = req.query.token || req.body?.token;
  
  if (accessToken) {
    const clientId = process.env.QB_CLIENT_ID;
    const clientSecret = process.env.QB_CLIENT_SECRET;
    const basic = Buffer.from(clientId + ":" + clientSecret).toString("base64");
 
    try {
      await fetch("https://developer.api.intuit.com/v2/oauth2/tokens/revoke", {
        method: "POST",
        headers: {
          "Authorization": "Basic " + basic,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ token: accessToken })
      });
    } catch (e) {}
  }
 
  res.status(200).json({ success: true, message: "Disconnected from QuickBooks" });
}
 
