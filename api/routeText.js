// api/routeText.js
import OpenAI from "openai"; // openai@^4 default export

const hasKey = !!process.env.OPENAI_API_KEY;
const client = hasKey ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
console.log("routeText hasKey:", hasKey);

const ALLOWED = new Set([
  "plumbing:water_heaters","plumbing:toilet_repair_install","plumbing:leak_detection",
  "plumbing:garbage_disposal","plumbing:faucet_fixture","plumbing:whole_house_repiping",
  "plumbing:gas_line","plumbing:hose_bib","plumbing:water_shutoff_valve","plumbing:pumps",
  "plumbing:emergency","sewer_drains:drain_cleaning","sewer_drains:video_camera_inspection",
  "sewer_drains:trenchless_repairs","sewer_drains:line_repairs","electrical:general",
  "appliances:repair","other"
]);

function normalizeCategory(raw = "") {
  const s = String(raw).toLowerCase().trim();

  if (ALLOWED.has(s)) return s; // exact allow-list pass

  // common synonyms
  const map = {
    toilet: "plumbing:toilet_repair_install",
    toilet_repair: "plumbing:toilet_repair_install",
    toilet_install: "plumbing:toilet_repair_install",

    water_heater: "plumbing:water_heaters",
    "water heater": "plumbing:water_heaters",
    no_hot_water: "plumbing:water_heaters",
    "no hot water": "plumbing:water_heaters",

    leak_detection: "plumbing:leak_detection",
    drain_cleaning: "sewer_drains:drain_cleaning",
    camera_inspection: "sewer_drains:video_camera_inspection",
    emergency: "plumbing:emergency",
  };
  if (map[s]) return map[s];

  // keyword heuristics
  if (/(water\s*heater|no\s*hot\s*water)/.test(s)) return "plumbing:water_heaters";
  if (/(toilet|wc)/.test(s)) return "plumbing:toilet_repair_install";
  if (/(leak|detect)/.test(s)) return "plumbing:leak_detection";
  if (/(drain|clog|backup|hydro[-\s]?jet)/.test(s)) return "sewer_drains:drain_cleaning";
  if (/camera/.test(s)) return "sewer_drains:video_camera_inspection";
  if (/(flood|burst|urgent|emergency)/.test(s)) return "plumbing:emergency";

  // final fallback: substring against allow-list tails
  for (const cat of ALLOWED) {
    const tail = cat.split(":")[1];
    if (s.includes(tail)) return cat;
  }
  return "other";
}

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const { text = "", history = [] } = req.body || {};
    const userText = String(text).slice(0, 1000);
    if (!userText.trim()) {
      return res.status(200).json({ category: "other", followup: "" });
    }

    // No API key? Return safe fallback; frontend can still route with regex.
    if (!hasKey) {
      return res.status(200).json({ category: "other", followup: "" });
    }

    const system = `You are a router for a plumbing company.
Return ONLY a JSON object with this exact shape:
{"category":"<one-of-whitelist>","followup":"<short question or empty string>"}
Whitelist: ${[...ALLOWED].join(", ")}.
Rules:
- toilets → plumbing:toilet_repair_install
- no hot water / water heater → plumbing:water_heaters
- clogs / backups / hydro-jet → sewer_drains:drain_cleaning
- sewer camera → sewer_drains:video_camera_inspection
- flooding now → plumbing:emergency
Output JSON only. No markdown, no prose.`;

    const user = `Text: ${userText}
History: ${JSON.stringify(history).slice(0, 1500)}
Output JSON only.`;

    // ---- CALL OPENAI (Responses API) ----
    console.log("routeText: calling OpenAI");
    const out = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: system },
        { role: "user",   content: user }
      ],
    });

    // ---- Extract the JSON string safely ----
    let raw = (out.output_text || out.choices?.[0]?.message?.content || "").trim() || "{}";
    if (raw[0] !== "{") {
      const match = raw.match(/\{[\s\S]*\}/);
      raw = match ? match[0] : "{}";
    }
    console.log("routeText raw:", raw.slice(0, 300)); // sanity log for Vercel Logs

    // ---- Parse and normalize ----
    let parsed = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    let category = normalizeCategory(parsed.category);
    if (!ALLOWED.has(category)) category = "other";
    const followup = typeof parsed.followup === "string" ? parsed.followup.slice(0, 180) : "";

    return res.status(200).json({ category, followup });
  } catch (err) {
    console.log("routeText error:", err?.message || err);
    // Soft-fail so UX doesn’t break
    return res.status(200).json({ category: "other", followup: "" });
  }
}
