export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
 
  const { access_token, realm_id, invoice_ids } = req.body;
 
  if (!access_token || !realm_id || !invoice_ids || !invoice_ids.length) {
    return res.status(400).json({ error: "Missing access_token, realm_id, or invoice_ids" });
  }
 
  const baseUrl = "https://quickbooks.api.intuit.com/v3/company/" + realm_id;
  const headers = {
    "Authorization": "Bearer " + access_token,
    "Content-Type": "application/json",
    "Accept": "application/json"
  };
 
  try {
    var results = [];
 
    for (var i = 0; i < invoice_ids.length; i++) {
      var id = invoice_ids[i];
      try {
        var readRes = await fetch(baseUrl + "/invoice/" + id, { headers });
        var readData = await readRes.json();
 
        if (readData.Invoice) {
          var inv = readData.Invoice;
          var balance = inv.Balance;
          var total = inv.TotalAmt;
          var status = "Pending";
 
          if (balance === 0 && total > 0) {
            status = "Paid";
          } else if (balance < total && balance > 0) {
            status = "Partial";
          } else if (inv.DueDate) {
            var due = new Date(inv.DueDate);
            if (due < new Date()) {
              status = "Overdue";
            }
          }
 
          results.push({
            qb_invoice_id: id,
            doc_number: inv.DocNumber,
            status: status,
            balance: balance,
            total: total
          });
        }
      } catch (e) {
        results.push({ qb_invoice_id: id, status: "Error", error: e.message });
      }
    }
 
    return res.status(200).json({ success: true, invoices: results });
 
  } catch (err) {
    return res.status(500).json({ error: "Server error: " + err.message });
  }
}
 
