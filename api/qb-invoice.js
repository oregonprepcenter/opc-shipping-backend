export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
 
  const { access_token, realm_id, customer_name, invoice_number, terms, due_date, memo, line_items } = req.body;
 
  if (!access_token || !realm_id) {
    return res.status(400).json({ error: "Missing access_token or realm_id" });
  }
 
  const baseUrl = "https://quickbooks.api.intuit.com/v3/company/" + realm_id;
  const headers = {
    "Authorization": "Bearer " + access_token,
    "Content-Type": "application/json",
    "Accept": "application/json"
  };
 
  try {
    // Step 1: Find or create the customer
    let customerId = null;
 
    // Search for existing customer
    const searchRes = await fetch(
      baseUrl + "/query?query=" + encodeURIComponent("SELECT * FROM Customer WHERE DisplayName = '" + customer_name.replace(/'/g, "\\'") + "'"),
      { headers }
    );
    const searchData = await searchRes.json();
 
    if (searchData.QueryResponse && searchData.QueryResponse.Customer && searchData.QueryResponse.Customer.length > 0) {
      customerId = searchData.QueryResponse.Customer[0].Id;
    } else {
      // Create new customer
      const createRes = await fetch(baseUrl + "/customer", {
        method: "POST",
        headers,
        body: JSON.stringify({ DisplayName: customer_name })
      });
      const createData = await createRes.json();
      if (createData.Customer) {
        customerId = createData.Customer.Id;
      } else {
        return res.status(400).json({ error: "Failed to create customer", detail: JSON.stringify(createData) });
      }
    }
 
    // Step 2: Build invoice lines
    var qbLines = (line_items || []).map(function (item, idx) {
      return {
        LineNum: idx + 1,
        Amount: item.amount || (item.qty * item.price),
        DetailType: "SalesItemLineDetail",
        Description: item.description || item.name,
        SalesItemLineDetail: {
          Qty: item.qty,
          UnitPrice: item.price
        }
      };
    });
 
    // Step 3: Map terms
    var termRef = null;
    var termsMap = {
      "Due on Receipt": "1",
      "Net 15": "2",
      "Net 30": "3",
      "Net 45": "5",
      "Net 60": "4"
    };
    if (terms && termsMap[terms]) {
      termRef = { value: termsMap[terms] };
    }
 
    // Step 4: Create the invoice
    var invoiceBody = {
      CustomerRef: { value: customerId },
      Line: qbLines,
      DocNumber: invoice_number || undefined,
      CustomerMemo: memo ? { value: memo } : undefined,
      DueDate: due_date || undefined
    };
    if (termRef) invoiceBody.SalesTermRef = termRef;
 
    const invoiceRes = await fetch(baseUrl + "/invoice", {
      method: "POST",
      headers,
      body: JSON.stringify(invoiceBody)
    });
    const invoiceData = await invoiceRes.json();
 
    if (invoiceData.Invoice) {
      return res.status(200).json({
        success: true,
        invoice_id: invoiceData.Invoice.Id,
        doc_number: invoiceData.Invoice.DocNumber,
        total: invoiceData.Invoice.TotalAmt
      });
    } else {
      return res.status(400).json({
        error: "Failed to create invoice",
        detail: JSON.stringify(invoiceData)
      });
    }
 
  } catch (err) {
    return res.status(500).json({ error: "Server error: " + err.message });
  }
}
