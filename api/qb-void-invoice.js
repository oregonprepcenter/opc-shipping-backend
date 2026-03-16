export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
 
  const { access_token, realm_id, invoice_id } = req.body;
 
  if (!access_token || !realm_id || !invoice_id) {
    return res.status(400).json({ error: "Missing access_token, realm_id, or invoice_id" });
  }
 
  const baseUrl = "https://quickbooks.api.intuit.com/v3/company/" + realm_id;
  const headers = {
    "Authorization": "Bearer " + access_token,
    "Content-Type": "application/json",
    "Accept": "application/json"
  };
 
  try {
    // Step 1: Read the invoice to get its SyncToken
    const readRes = await fetch(
      baseUrl + "/invoice/" + invoice_id,
      { headers }
    );
    const readData = await readRes.json();
 
    if (!readData.Invoice) {
      return res.status(400).json({
        error: "Could not find invoice",
        detail: JSON.stringify(readData)
      });
    }
 
    const syncToken = readData.Invoice.SyncToken;
 
    // Step 2: Void the invoice
    const voidRes = await fetch(
      baseUrl + "/invoice?operation=void",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          Id: invoice_id,
          SyncToken: syncToken,
          sparse: true
        })
      }
    );
    const voidData = await voidRes.json();
 
    if (voidData.Invoice) {
      return res.status(200).json({
        success: true,
        invoice_id: voidData.Invoice.Id,
        status: "Voided"
      });
    } else {
      return res.status(400).json({
        error: "Failed to void invoice",
        detail: JSON.stringify(voidData)
      });
    }
 
  } catch (err) {
    return res.status(500).json({ error: "Server error: " + err.message });
  }
}
 
