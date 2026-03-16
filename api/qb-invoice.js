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
    const searchRes = await fetch(
      baseUrl + "/query?query=" + encodeURIComponent("SELECT * FROM Customer WHERE DisplayName = '" + customer_name.replace(/'/g, "\\'") + "'"),
      { headers }
    );
    const searchData = await searchRes.json();
 
    if (searchData.QueryResponse && searchData.QueryResponse.Customer && searchData.QueryResponse.Customer.length > 0) {
      customerId = searchData.QueryResponse.Customer[0].Id;
    } else {
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
 
    // Step 2: Fetch all existing items/products from QuickBooks
    let allItems = [];
    let startPos = 1;
    let hasMore = true;
    while (hasMore) {
      const itemRes = await fetch(
        baseUrl + "/query?query=" + encodeURIComponent("SELECT * FROM Item STARTPOSITION " + startPos + " MAXRESULTS 100"),
        { headers }
      );
      const itemData = await itemRes.json();
      if (itemData.QueryResponse && itemData.QueryResponse.Item) {
        allItems = allItems.concat(itemData.QueryResponse.Item);
        if (itemData.QueryResponse.Item.length < 100) hasMore = false;
        else startPos += 100;
      } else {
        hasMore = false;
      }
    }
 
    // Step 3: Build a lookup map (lowercase name -> item)
    const itemMap = {};
    allItems.forEach(function(item) {
      itemMap[item.Name.toLowerCase()] = item;
    });
 
    // Step 4: Match line items to QB products using keyword scoring
    function findQBItem(description) {
      var desc = (description || "").toLowerCase();
 
      // Try exact match first
      if (itemMap[desc]) return itemMap[desc];
 
      var bestMatch = null;
      var bestScore = 0;
 
      allItems.forEach(function(item) {
        var name = item.Name.toLowerCase();
        var score = 0;
 
        // Standard Unit Processing / Amazon Prep tier matching
        if (desc.indexOf("standard unit processing") >= 0 || desc.indexOf("unit processing") >= 0) {
          if (name.indexOf("prep") >= 0) {
            score += 3;
            if ((desc.indexOf("$1.70") >= 0 || desc.indexOf("$1.65") >= 0 || desc.indexOf("@ $1.7") >= 0) && (name.indexOf("less than 200") >= 0 || name.indexOf("<200") >= 0 || name.indexOf("1-200") >= 0)) score += 10;
            if ((desc.indexOf("$1.40") >= 0 || desc.indexOf("@ $1.4") >= 0) && (name.indexOf("200-1,000") >= 0 || name.indexOf("200-1000") >= 0)) score += 10;
            if ((desc.indexOf("$1.25") >= 0 || desc.indexOf("$1.20") >= 0 || desc.indexOf("@ $1.2") >= 0) && (name.indexOf("1,001") >= 0 || name.indexOf("1001") >= 0)) score += 10;
            if ((desc.indexOf("$1.05") >= 0 || desc.indexOf("$1.00") >= 0 || desc.indexOf("@ $1.0") >= 0) && (name.indexOf("2,001") >= 0 || name.indexOf("2001") >= 0)) score += 10;
            if (desc.indexOf("3500") >= 0 || desc.indexOf("3,500") >= 0) { if (name.indexOf("3,500") >= 0 || name.indexOf("3500") >= 0) score += 10; }
          }
        }
 
        // FBM/DTC Fulfillment
        if (desc.indexOf("fbm") >= 0 || desc.indexOf("dtc") >= 0) { if (name.indexOf("fbm") >= 0 || name.indexOf("dtc") >= 0 || name.indexOf("fulfillment") >= 0) score += 10; }
 
        // Hazmat
        if (desc.indexOf("hazmat") >= 0) { if (name.indexOf("hazmat") >= 0) score += 10; }
 
        // Large items / shoes
        if (desc.indexOf("large items") >= 0 || desc.indexOf("shoes") >= 0) { if (name.indexOf("large") >= 0 && (name.indexOf("shoes") >= 0 || name.indexOf("unit") >= 0)) score += 10; }
 
        // Oversized
        if (desc.indexOf("oversized") >= 0 || desc.indexOf("oversize") >= 0) { if (name.indexOf("oversize") >= 0) score += 10; }
 
        // Bundling
        if (desc.indexOf("bundl") >= 0) { if (name.indexOf("bundl") >= 0) score += 10; }
 
        // Small Outbound Box
        if (desc.indexOf("small") >= 0 && desc.indexOf("box") >= 0) { if (name.indexOf("small") >= 0 && (name.indexOf("box") >= 0 || name.indexOf("outbound") >= 0)) score += 10; }
 
        // Medium Outbound Box
        if (desc.indexOf("medium") >= 0 && desc.indexOf("box") >= 0) { if (name.indexOf("medium") >= 0 && (name.indexOf("box") >= 0 || name.indexOf("outbound") >= 0)) score += 10; }
 
        // Large Outbound Box (not extra large)
        if (desc.indexOf("large") >= 0 && desc.indexOf("box") >= 0 && desc.indexOf("extra") < 0 && desc.indexOf("xl") < 0) { if (name.indexOf("large") >= 0 && name.indexOf("extra") < 0 && name.indexOf("xl") < 0 && (name.indexOf("box") >= 0 || name.indexOf("outbound") >= 0)) score += 10; }
 
        // Extra Large Box
        if ((desc.indexOf("extra large") >= 0 || desc.indexOf("xl") >= 0) && desc.indexOf("box") >= 0) { if ((name.indexOf("extra large") >= 0 || name.indexOf("xl") >= 0) && name.indexOf("box") >= 0) score += 10; }
 
        // Bubble Wrap
        if (desc.indexOf("bubble") >= 0) { if (name.indexOf("bubble") >= 0) score += 10; }
 
        // XL Poly Bag
        if (desc.indexOf("poly") >= 0) { if (name.indexOf("poly") >= 0) score += 10; }
 
        // Anti Static Bag
        if (desc.indexOf("anti static") >= 0 || desc.indexOf("antistatic") >= 0) { if (name.indexOf("anti static") >= 0 || name.indexOf("antistatic") >= 0) score += 10; }
 
        // Palletizing
        if (desc.indexOf("palletiz") >= 0) { if (name.indexOf("palletiz") >= 0) score += 10; }
 
        // New Pallet
        if (desc.indexOf("new pallet") >= 0) { if (name.indexOf("new pallet") >= 0 || name.indexOf("pallet") >= 0) score += 10; }
 
        // Pallet Receiving
        if (desc.indexOf("pallet receiv") >= 0) { if (name.indexOf("pallet") >= 0 && name.indexOf("receiv") >= 0) score += 10; }
 
        // Container
        if (desc.indexOf("container") >= 0) {
          if (name.indexOf("container") >= 0) {
            score += 5;
            if (desc.indexOf("20ft") >= 0 && name.indexOf("20") >= 0) score += 5;
            if (desc.indexOf("40ft") >= 0 && name.indexOf("40") >= 0) score += 5;
          }
        }
 
        // Storage
        if (desc.indexOf("storage") >= 0) { if (name.indexOf("storage") >= 0) score += 10; }
 
        // Account Credit
        if (desc.indexOf("credit") >= 0) { if (name.indexOf("credit") >= 0) score += 10; }
 
        // Cardboard sleeve / protective sleeve
        if (desc.indexOf("cardboard") >= 0 || desc.indexOf("sleeve") >= 0) { if (name.indexOf("cardboard") >= 0 || name.indexOf("sleeve") >= 0) score += 10; }
 
        if (score > bestScore) {
          bestScore = score;
          bestMatch = item;
        }
      });
 
      return bestScore >= 5 ? bestMatch : null;
    }
 
    // Step 5: Build invoice lines with matched item refs
    var qbLines = (line_items || []).map(function(item, idx) {
      var matched = findQBItem(item.description || item.name || "");
      var line = {
        LineNum: idx + 1,
        Amount: item.amount || (item.qty * item.price),
        DetailType: "SalesItemLineDetail",
        Description: item.description || item.name,
        SalesItemLineDetail: {
          Qty: item.qty,
          UnitPrice: item.price
        }
      };
      if (matched) {
        line.SalesItemLineDetail.ItemRef = { value: matched.Id, name: matched.Name };
      }
      return line;
    });
 
    // Step 6: Map terms
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
 
    // Step 7: Create the invoice
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
        total: invoiceData.Invoice.TotalAmt,
        matched_items: qbLines.map(function(l) {
          return {
            description: l.Description,
            matched: l.SalesItemLineDetail.ItemRef ? l.SalesItemLineDetail.ItemRef.name : "Services (no match)"
          };
        })
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
