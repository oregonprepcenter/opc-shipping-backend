export default async function handler(req, res) {
  const clientId = process.env.QB_CLIENT_ID;
  const redirectUri = "https://opc-shipping-backend.vercel.app/api/qb-callback";
  const scope = "com.intuit.quickbooks.accounting";
 
  // portal_url param tells callback where to redirect after auth
  const portalUrl = req.query.portal_url || "https://portal.oregonprepcenter.com";
  const state = Buffer.from(JSON.stringify({ portal_url: portalUrl })).toString("base64");
 
  const authUrl =
    "https://appcenter.intuit.com/connect/oauth2" +
    "?client_id=" + encodeURIComponent(clientId) +
    "&response_type=code" +
    "&scope=" + encodeURIComponent(scope) +
    "&redirect_uri=" + encodeURIComponent(redirectUri) +
    "&state=" + encodeURIComponent(state);
 
  res.redirect(302, authUrl);
}
 
