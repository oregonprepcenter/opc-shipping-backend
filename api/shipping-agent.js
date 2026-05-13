// /api/shipping-agent.js — Vercel Serverless Function
// AI shipping assistant powered by Claude with web search.
// Accepts a natural-language shipping question (rates guidance, carrier
// comparison, customs, label troubleshooting, transit times, etc.) and
// returns a structured answer. The API key never touches the browser.
//
// SETUP: Add ANTHROPIC_API_KEY to Vercel environment variables.
//
// Request body:
//   {
//     "question": "Cheapest way to ship a 5lb package from Oregon to NY?",
//     "context": { "origin": "OR", "destination": "NY", "weightLb": 5 }, // optional
//     "history": [ { "role": "user"|"assistant", "content": "..." } ]    // optional
//   }
//
// Response:
//   {
//     "answer": "...",            // plain-text reply suitable for chat UI
//     "citations": [ ... ],       // web search citations (if any)
//     "raw": { ... }              // full Anthropic response, for debugging
//   }

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured on server" });
  }

  try {
    var body = req.body || {};
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch (_) { body = {}; }
    }

    var question = (body.question || "").toString().trim();
    if (!question || question.length < 3) {
      return res.status(400).json({ error: "Missing or too-short 'question'" });
    }
    if (question.length > 4000) {
      return res.status(400).json({ error: "Question is too long (max 4000 chars)" });
    }

    var context = body.context && typeof body.context === "object" ? body.context : null;
    var history = Array.isArray(body.history) ? body.history : [];

    var systemPrompt =
      "You are the OPC Shipping Assistant, an expert on US domestic and " +
      "international parcel shipping (UPS, FedEx, USPS, DHL, Amazon, " +
      "regional carriers, freight). You help Oregon Prep Center staff and " +
      "customers with: comparing carriers and service levels, estimating " +
      "transit times, troubleshooting labels and tracking, customs and " +
      "duties for international shipments, packaging best practices, and " +
      "current carrier surcharges or service alerts. Be concise, accurate, " +
      "and practical. If a question depends on live rates, current service " +
      "advisories, or carrier policy updates, use the web_search tool to " +
      "verify before answering. Never invent tracking numbers, prices, or " +
      "policies. If you are not sure, say so and suggest the next step.";

    var messages = [];
    for (var i = 0; i < history.length && i < 20; i++) {
      var turn = history[i];
      if (!turn || typeof turn.content !== "string") continue;
      if (turn.role !== "user" && turn.role !== "assistant") continue;
      messages.push({ role: turn.role, content: turn.content });
    }

    var userContent = question;
    if (context) {
      try {
        userContent += "\n\nStructured context (JSON):\n" + JSON.stringify(context);
      } catch (_) { /* ignore non-serializable context */ }
    }
    messages.push({ role: "user", content: userContent });

    var response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: messages
      })
    });

    var data = await response.json();
    if (!response.ok) {
      console.error("[Shipping Agent] Anthropic error:", data);
      return res.status(response.status).json({
        error: (data && data.error && data.error.message) || "Anthropic API error",
        raw: data
      });
    }

    var answer = "";
    var citations = [];
    if (Array.isArray(data.content)) {
      for (var j = 0; j < data.content.length; j++) {
        var block = data.content[j];
        if (block && block.type === "text" && typeof block.text === "string") {
          answer += (answer ? "\n" : "") + block.text;
          if (Array.isArray(block.citations)) {
            for (var k = 0; k < block.citations.length; k++) {
              citations.push(block.citations[k]);
            }
          }
        }
      }
    }

    return res.status(200).json({
      answer: answer || "(no answer returned)",
      citations: citations,
      raw: data
    });
  } catch (error) {
    console.error("[Shipping Agent] Error:", (error && error.message) || error);
    return res.status(500).json({
      error: "Shipping agent failed: " + ((error && error.message) || "Unknown error")
    });
  }
};
