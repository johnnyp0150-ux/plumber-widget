// api/routeText.js
import { OpenAI } from "openai";


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

const normalizeCategory = (raw = "") => {
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

export default async function handler(req, res) {
  // Handle CORS preflight quickly
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
    if (!userText.trim()) return res.status(200).json({ category: "other", followup: "" });

    // If no API key, return safe fallback (frontend can still do regex routing)
    if (!hasKey) {
      return res.status(200).json({ category: "other", followup: "" });
    }

    const system = `You are a router for a plumbing company.
Return JSON only: {"category":"<one-of-whitelist>", "followup":"<short question or empty>"}.
Whitelist: ${[...ALLOWED].join(", ")}.
Rules: toilets→plumbing:toilet_repair_install; no hot water/water heater→plumbing:water_heaters; clogs/backups/hydro-jet→sewer_drains:drain_cleaning; sewer camera→sewer_drains:video_camera_inspection; flooding now→plumbing:emergency.`;

    const user = `Text: ${userText}
History: ${JSON.stringify(history).slice(0, 1500)}
Output JSON only.`;

    // Use Chat Completions (stable) and read the string result
    const out = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    });

    const raw = out.choices?.[0]?.message?.content?.trim() ?? "{}";

    let parsed = {};
    try { parsed = JSON.parse(raw); } catch (_) { /* ignore parse failure */ }

    let category = normalizeCategory(parsed.category);
    if (!ALLOWED.has(category)) category = "other";
    const followup = typeof parsed.followup === "string" ? parsed.followup.slice(0, 180) : "";

    return res.status(200).json({ category, followup });
  } catch (err) {
    // Soft-fail so UX doesn’t break
    return res.status(200).json({ category: "other", followup: "" });
  }
}
