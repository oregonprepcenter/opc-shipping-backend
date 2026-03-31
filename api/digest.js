module.exports = async function handler(req, res) {
  var sgKey = process.env.SENDGRID_API_KEY;
  var fromEmail = process.env.OPC_FROM_EMAIL || "contact@oregonprepcenter.com";
  var supabaseUrl = process.env.SUPABASE_URL;
  var supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  
module.exports = async function handler(req, res) {
  var supabaseUrl = process.env.SUPABASE_URL;
  var supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Missing SUPABASE env vars", hasUrl: !!supabaseUrl, hasKey: !!supabaseKey });
  }

  var result = { step: "start", supabaseUrl: supabaseUrl.substring(0, 30) + "..." };

  try {
    var fetchUrl = supabaseUrl + "/rest/v1/portal_data?key=eq.opc-wms-shared&select=key,value";
    result.step = "fetching";
    result.fetchUrl = fetchUrl;
    
    var dataRes = await fetch(fetchUrl, {
      headers: {
        "apikey": supabaseKey,
        "Authorization": "Bearer " + supabaseKey,
        "Content-Type": "application/json"
      }
    });

    result.step = "fetched";
    result.httpStatus = dataRes.status;

    if (!dataRes.ok) {
      result.error = await dataRes.text();
      return res.status(200).json(result);
    }

    var rows = await dataRes.json();
    result.step = "parsed";
    result.rowCount = rows ? rows.length : 0;

    if (!rows || rows.length === 0) {
      result.error = "No rows found";
      return res.status(200).json(result);
    }

    var data = JSON.parse(rows[0].value);
    result.step = "dataParsed";
    result.keys = Object.keys(data).filter(function(k) { return k.indexOf("qb") === 0; });
    result.qbConnected = data.qbConnected || false;
    result.hasAccessToken = !!(data.qbAccessToken);
    result.tokenLength = (data.qbAccessToken || "").length;
    result.realmId = data.qbRealmId || "NOT SET";
    result.billCount = (data.bills || []).length;

    var qbAccessToken = data.qbAccessToken || "";
    var qbRealmId = data.qbRealmId || "";

    if (!qbAccessToken || !qbRealmId) {
      result.status = "QB not connected";
      return res.status(200).json(result);
    }

    var bills = data.bills || [];
    var pendingInPortal = bills.filter(function(b) {
      return (b.st === "Synced" || b.st === "Pending") && b.qbInvoiceId;
    });

    result.status = "QB connected";
    result.pendingToCheck = pendingInPortal.length;

    if (pendingInPortal.length === 0) {
      result.message = "No invoices with qbInvoiceId to check";
      return res.status(200).json(result);
    }

    var updated = 0;
    for (var i = 0; i < pendingInPortal.length; i++) {
      var bill = pendingInPortal[i];
      try {
        var qbRes = await fetch(
          "https://quickbooks.api.intuit.com/v3/company/" + qbRealmId + "/invoice/" + bill.qbInvoiceId + "?minorversion=65",
          { headers: { "Authorization": "Bearer " + qbAccessToken, "Accept": "application/json" } }
        );
        if (qbRes.ok) {
          var qbData = await qbRes.json();
          if (qbData.Invoice && qbData.Invoice.Balance === 0 && qbData.Invoice.TotalAmt > 0) {
            bill.st = "Paid";
            bill.paidDate = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
            bill.paidVia = "QuickBooks Auto-Sync";
            updated++;
          }
        }
      } catch (e) {}
    }

    if (updated > 0) {
      data.bills = bills;
      data._rev = Date.now();
      await fetch(supabaseUrl + "/rest/v1/portal_data?key=eq.opc-wms-shared", {
        method: "PATCH",
        headers: { "apikey": supabaseKey, "Authorization": "Bearer " + supabaseKey, "Content-Type": "application/json" },
        body: JSON.stringify({ value: JSON.stringify(data) })
      });
    }

    result.checked = pendingInPortal.length;
    result.updated = updated;
    return res.status(200).json(result);
  } catch (error) {
    result.error = error.message;
    return res.status(200).json(result);
  }
}; 
  
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Missing SUPABASE env vars" });
  }
  if (!sgKey) {
    return res.status(500).json({ error: "Missing SENDGRID_API_KEY" });
  }
 
  var headers = {
    "apikey": supabaseKey,
    "Authorization": "Bearer " + supabaseKey,
    "Content-Type": "application/json"
  };
 
  try {
    var dataRes = await fetch(supabaseUrl + "/rest/v1/portal_data?key=eq.opc-wms-shared&select=key,value", {
      headers: headers
    });
    if (!dataRes.ok) return res.status(500).json({ error: "Could not read portal data" });
 
    var rows = await dataRes.json();
    if (!rows || rows.length === 0) return res.status(200).json({ error: "No portal data" });
 
    var data = JSON.parse(rows[0].value);
    var orders = data.orders || [];
    var inventory = data.inventory || [];
    var bills = data.bills || [];
    var batches = data.batches || [];
    var clients = data.clients || [];
 
    var now = new Date();
    var today = now.toISOString().slice(0, 10);
    var receivedToday = inventory.filter(function(i) { return i.dr === today; }).length;
    var pendingOrders = orders.filter(function(o) { return o.st !== "Shipped" && o.st !== "Completed"; }).length;
    var overdueInvoices = bills.filter(function(b) { return b.st === "Overdue"; }).length;
    var totalRevenue = bills.filter(function(b) { return b.st !== "Void"; }).reduce(function(a, b) { return a + (b.am || 0); }, 0);
    var queuedBatches = batches.filter(function(b) { return b.st === "Queued"; }).length;
 
    var html = "<h2>OPC Daily Digest - " + today + "</h2>" +
      "<p><strong>Received Today:</strong> " + receivedToday + " items</p>" +
      "<p><strong>Pending Orders:</strong> " + pendingOrders + "</p>" +
      "<p><strong>Queued Batches:</strong> " + queuedBatches + "</p>" +
      "<p><strong>Overdue Invoices:</strong> " + overdueInvoices + "</p>" +
      "<p><strong>Total Revenue:</strong> $" + totalRevenue.toFixed(2) + "</p>" +
      "<p><strong>Active Clients:</strong> " + clients.length + "</p>" +
      "<hr><p style='color:#666;font-size:12px'>Oregon Prep Center | oregonprepcenter.com</p>";
 
    var sgRes = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + sgKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: fromEmail }] }],
        from: { email: fromEmail, name: "Oregon Prep Center" },
        subject: "OPC Daily Digest - " + today,
        content: [{ type: "text/html", value: html }]
      })
    });
 
    return res.status(200).json({
      success: sgRes.ok,
      digest: { receivedToday: receivedToday, pendingOrders: pendingOrders, queuedBatches: queuedBatches, overdueInvoices: overdueInvoices, revenue: totalRevenue.toFixed(2), clients: clients.length }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
 
