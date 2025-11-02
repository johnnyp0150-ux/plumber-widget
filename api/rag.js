// api/rag.js
import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Use POST" });
    }

    const { question } = req.body || {};
    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "Missing 'question' string" });
    }

    // 1) Load precomputed embeddings (once per cold start)
    const dataPath = path.join(process.cwd(), "data", "embeddings.json");
    const raw = fs.readFileSync(dataPath, "utf-8");
    const docs = JSON.parse(raw); // [{id, text, embedding: number[]}]

    // 2) Make query embedding
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY not set" });

    const embResp = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: question
      })
    }).then(r => r.json());

    if (!embResp?.data?.[0]?.embedding) {
      return res.status(500).json({ error: "Failed to embed query", detail: embResp });
    }
    const q = embResp.data[0].embedding;

    // 3) Cosine similarity
    const sim = (a, b) => {
      let dot = 0, na = 0, nb = 0;
      for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
      }
      return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-12);
    };

    const ranked = docs
      .map(d => ({ ...d, score: sim(q, d.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const context = ranked.map(r => r.text).join("\n---\n");

    // 4) Ask GPT with the context
    const chatResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You answer only from the provided context. If unsure, say you don't know." },
          { role: "user", content: `Context:\n${context}\n\nQuestion: ${question}` }
        ],
        temperature: 0.2
      })
    }).then(r => r.json());

    const answer = chatResp?.choices?.[0]?.message?.content || "Sorry, I’m not sure.";
    res.status(200).json({
      answer,
      sources: ranked.map(r => ({ id: r.id, score: Number(r.score.toFixed(3)) }))
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error", detail: String(e) });
  }
}
