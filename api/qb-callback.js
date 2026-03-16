export default async function handler(req, res) {
  const clientId = process.env.QB_CLIENT_ID;
  const clientSecret = process.env.QB_CLIENT_SECRET;
  const redirectUri = "https://opc-shipping-backend.vercel.app/api/qb-callback";
 
  const code = req.query.code;
  const realmId = req.query.realmId;
  const stateParam = req.query.state || "";
 
  if (!code || !realmId) {
    return res.status(400).send("Missing code or realmId from QuickBooks");
  }
 
  // Decode portal URL from state
  let portalUrl = "https://portal.oregonprepcenter.com";
  try {
    const stateData = JSON.parse(Buffer.from(stateParam, "base64").toString());
    if (stateData.portal_url) portalUrl = stateData.portal_url;
  } catch (e) {}
 
  try {
    // Exchange authorization code for tokens
    const basic = Buffer.from(clientId + ":" + clientSecret).toString("base64");
    const tokenRes = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
      method: "POST",
      headers: {
        "Authorization": "Basic " + basic,
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json"
      },
      body: "grant_type=authorization_code&code=" + encodeURIComponent(code) + "&redirect_uri=" + encodeURIComponent(redirectUri)
    });
 
    const tokenData = await tokenRes.json();
 
    if (tokenData.error) {
      return res.status(400).send("Token error: " + (tokenData.error_description || tokenData.error));
    }
 
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
 
    // Redirect back to portal with tokens as URL params
    const params = new URLSearchParams({
      qb_connected: "true",
      qb_access_token: accessToken,
      qb_refresh_token: refreshToken,
      qb_realm_id: realmId
    });
 
    res.redirect(302, portalUrl + "?" + params.toString());
 
  } catch (err) {
    res.status(500).send("OAuth error: " + err.message);
  }
}
