// /api/rag.js
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
    if (!fs.existsSync(dataPath)) {
      return res.status(500).json({ error: "data/embeddings.json not found" });
    }
    const docs = JSON.parse(fs.readFileSync(dataPath, "utf-8")); // [{id,text,embedding:number[]}]

    // 2) Make query embedding
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY not set" });

    const qResp = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: "text-embedding-3-small", input: question }),
    });
    if (!qResp.ok) {
      const e = await qResp.text();
      return res.status(500).json({ error: "embedding failed", detail: e });
    }
    const qVec = (await qResp.json()).data[0].embedding;

    // 3) Score with cosine similarity
    function dot(a,b){let s=0; for(let i=0;i<a.length;i++) s+=a[i]*b[i]; return s;}
    function norm(a){return Math.sqrt(dot(a,a));}
    function cos(a,b){return dot(a,b)/(norm(a)*norm(b));}

    const ranked = docs
      .map(d => ({ ...d, score: cos(qVec, d.embedding) }))
      .sort((a,b)=>b.score-a.score)
      .slice(0, 5);

    // 4) Make an answer with the top snippets as context
    const system = `You are an assistant for a plumbing company.
Use the provided CONTEXT snippets only. If the answer is not in the context, say you don't have that info. Be concise and helpful.`;

    const context = ranked.map((r,i)=>`[${i+1}] ${r.text}`).join("\n\n");

    const chatResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":"application/json",
        "Authorization":`Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: `CONTEXT:\n${context}\n\nQUESTION: ${question}` }
        ],
        temperature: 0.2,
      })
    });
    if (!chatResp.ok) {
      const e = await chatResp.text();
      return res.status(500).json({ error: "chat failed", detail: e });
    }
    const answer = (await chatResp.json()).choices[0].message.content;

    return res.status(200).json({
      answer,
      sources: ranked.map(r => ({ id: r.id, score: +r.score.toFixed(4) })),
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "server error", detail: String(e) });
  }
}
