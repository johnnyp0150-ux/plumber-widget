// Minimal PipePilot widget — Option B (n8n-driven)

(function initPipePilot() {
  if (document.getElementById("pipepilot-bubble")) return;

  const WEBHOOK_URL = "https://johnnyp0150.app.n8n.cloud/webhook/plumber-widget";

  const bubble = document.createElement("div");
  bubble.id = "pipepilot-bubble";
  bubble.textContent = "💬";
  document.body.appendChild(bubble);

  const panel = document.createElement("div");
  panel.id = "pipepilot-panel";
  panel.innerHTML = `
    <div id="pipepilot-header">PipePilot Assistant</div>
    <div id="pipepilot-messages"></div>
    <div id="pipepilot-input">
      <input id="pipepilot-text" placeholder="Type your message…" />
      <button id="pipepilot-send">Send</button>
    </div>
  `;
  document.body.appendChild(panel);

  const msgs = panel.querySelector("#pipepilot-messages");
  const input = panel.querySelector("#pipepilot-text");
  const sendBtn = panel.querySelector("#pipepilot-send");

  // ✅ Conversation memory that we send to n8n each turn
  const history = [];

  bubble.onclick = () => {
    panel.style.display = panel.style.display === "flex" ? "none" : "flex";
    input.focus();
  };

  function addMsg(text, who = "bot") {
    const div = document.createElement("div");
    div.className = `pipepilot-msg pipepilot-${who}`;
    div.textContent = text;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div; // ✅ return DOM node so we can remove placeholders safely
  }

  async function handleSend() {
    const q = input.value.trim();
    if (!q) return;

    // Clear input + show user message
    input.value = "";
    addMsg(q, "user");

    // ✅ Store user turn in memory
    history.push({ role: "user", content: q });

    // ✅ Add a real placeholder we can remove reliably
    const placeholder = addMsg("Thinking…", "bot");

    try {
      const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // ✅ Send message + full history each turn
        body: JSON.stringify({ message: q, history })
      });

      // If n8n returns non-2xx, show status (helps debugging)
      if (!res.ok) {
        throw new Error(`n8n error (${res.status})`);
      }

      const data = await res.json();

      // ✅ Remove placeholder safely (only if it still exists)
      if (placeholder && placeholder.parentNode) placeholder.remove();

      const reply = (data && data.message) ? data.message : "No response from assistant.";
      addMsg(reply, "bot");

      // ✅ Store assistant turn in memory
      history.push({ role: "assistant", content: reply });
    } catch (err) {
      if (placeholder && placeholder.parentNode) placeholder.remove();
      addMsg(`Error contacting assistant. ${err?.message ? `(${err.message})` : ""}`, "bot");

      // (Optional) store error as assistant turn — I’m NOT doing it by default
      // history.push({ role: "assistant", content: "Error contacting assistant." });
    }
  }

  // ✅ Keep your event listeners (addEventListener is correct)
  sendBtn.addEventListener("click", handleSend);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSend();
  });
})();
