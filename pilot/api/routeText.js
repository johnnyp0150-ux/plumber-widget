// api/routeText.js
import OpenAI from "openai";

const hasKey = !!process.env.OPENAI_API_KEY;
const client = hasKey ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const ALLOWED = new Set([
  "plumbing:water_heaters","plumbing:toilet_repair_install","plumbing:leak_detection",
  "plumbing:garbage_disposal","plumbing:faucet_fixture","plumbing:whole_house_repiping",
  "plumbing:gas_line","plumbing:hose_bib","plumbing:water_shutoff_valve","plumbing:pumps",
  "plumbing:emergency","sewer_drains:drain_cleaning","sewer_drains:video_camera_inspection",
  "sewer_drains:trenchless_repairs","sewer_drains:line_repairs","electrical:general",
  "appliances:repair","other"
]);

const normalizeCategory = (raw="")=>{
  const s = String(raw).toLowerCase().trim();
  if (ALLOWED.has(s)) return s;
  const map = {
    toilet: "plumbing:toilet_repair_install",
    toilet_repair: "plumbing:toilet_repair_install",
    water_heater: "plumbing:water_heaters",
    no_hot_water: "plumbing:water_heaters",
    drain_cleaning: "sewer_drains:drain_cleaning",
    camera_inspection: "sewer_drains:video_camera_inspection",
    emergency: "plumbing:emergency",
  };
  if (map[s]) return map[s];
  for (const cat of ALLOWED) if (s.includes(cat.split(":")[1])) return cat;
  return "other";
};

export default async function handler(req, res){
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    const { text = "", history = [] } = req.body || {};
    const userText = String(text).slice(0,1000);
    if (!userText.trim()) return res.status(200).json({ category:"other", followup:"" });

    if (!hasKey) {
      // No key? Soft-answer so the frontend uses regex fallback.
      return res.status(200).json({ category:"other", followup:"" });
    }

    const system = `You are a router for a plumbing company.
Return JSON: {"category":"<one-of-whitelist>", "followup":"<short question or empty>"}
Whitelist: ${[...ALLOWED].join(", ")}.
Rules: toilets→plumbing:toilet_repair_install; no hot water/water heater→plumbing:water_heaters; clogs/backups/hydro-jet→sewer_drains:drain_cleaning; sewer camera→sewer_drains:video_camera_inspection; flooding now→plumbing:emergency.`;

    const user = `Text: ${userText}\nHistory: ${JSON.stringify(history).slice(0,1500)}\nOutput JSON only.`;

    const out = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [{ role:"system", content:system }, { role:"user", content:user }]
    });

    const raw = out.output_text ?? "{}";
    let parsed = {}; try { parsed = JSON.parse(raw); } catch {}
    let category = normalizeCategory(parsed.category);
    if (!ALLOWED.has(category)) category = "other";
    const followup = typeof parsed.followup === "string" ? parsed.followup.slice(0,180) : "";
    res.status(200).json({ category, followup });
  } catch {
    res.status(200).json({ category:"other", followup:"" });
  }
}
