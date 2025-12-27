// Minimal PipePilot widget — Option B (n8n-driven) — FIXED pending + no disappearing messages

(function initPipePilot() {
  if (document.getElementById("pipepilot-bubble")) return;

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
    return div; // <- IMPORTANT: so we can remove the exact message later
  }

  async function handleSend() {
    const q = input.value.trim();
    if (!q) return;

    input.value = "";
    addMsg(q, "user");

    // Create a predictable "pending" message and keep a reference to it
    const pending = addMsg("…", "bot"); // use "Thinking..." if you prefer

    try {
      const res = await fetch("https://johnnyp0150.app.n8n.cloud/webhook/plumber-widget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q })
      });

      if (!res.ok) {
        // remove pending before showing error
        pending.remove();
        addMsg(`Server error (${res.status}).`, "bot");
        return;
      }

      const data = await res.json();

      // remove pending before showing real response
      pending.remove();

      const reply =
        (data && (data.message || data.reply || data.text)) ||
        "No response from assistant.";

      addMsg(reply, "bot");
    } catch (err) {
      pending.remove();
      addMsg("Error contacting assistant.", "bot");
    }
  }

  sendBtn.addEventListener("click", handleSend);

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSend();
  });
})();
