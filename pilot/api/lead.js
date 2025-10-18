// api/lead.js
export default async function handler(req, res){
  if (req.method === "OPTIONS"){
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }
  if (req.method !== "POST") return res.status(405).json({ error:"Method not allowed" });

  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    const lead = req.body || {};
    const payload = {
      name: String(lead.name||"").slice(0,120),
      phone: String(lead.phone||"").slice(0,40),
      email: String(lead.email||"").slice(0,160),
      zip: String(lead.zip||"").slice(0,10),
      city: String(lead.city||"").slice(0,80),
      service_category: String(lead.service_category||"other"),
      user_message: String(lead.user_message||"").slice(0,1000),
      followup_notes: String(lead.followup_notes||"").slice(0,1000),
      source_page: String(lead.source_page||""),
      ts: new Date().toISOString(),
    };

    // Slack notify (optional)
    const slackUrl = process.env.SLACK_WEBHOOK_URL;
    if (slackUrl){
      const text =
`🧰 *New Lead*
• Name: ${payload.name || "(missing)"}
• Phone: ${payload.phone || "(missing)"}
• Email: ${payload.email || "(missing)"}
• Location: ${payload.city || payload.zip || "(unknown)"}
• Category: ${payload.service_category}
• Msg: ${payload.user_message || "(none)"}
${payload.followup_notes ? "• Follow-up: " + payload.followup_notes + "\n" : ""}${payload.source_page ? "• Source: " + payload.source_page + "\n" : ""}`;
      try {
        await fetch(slackUrl, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ text }) });
      } catch {}
    }

    return res.status(200).json({ ok:true });
  } catch {
    return res.status(500).json({ ok:false });
  }
}
