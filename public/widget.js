// Minimal PipePilot widget — Option B (n8n-driven) — with 1st-open greeting

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

  // ---- Greeting config ----
  const GREETING_TEXT =
    "Hi! I’m PipePilot. What can we help with today—clog, leak, water heater, or something else?";

  let hasGreeted = false;

  // If you want the greeting to show every time the user re-opens the widget,
  // set this to true. Default false = greet only once per page load.
  const RESET_GREETING_ON_CLOSE = false;

  function addMsg(text, who = "bot") {
    const div = document.createElement("div");
    div.className = `pipepilot-msg pipepilot-${who}`;
    div.textContent = text;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div; // so we can remove the exact message later
  }

  function ensureGreeting() {
    if (hasGreeted) return;
    hasGreeted = true;
    addMsg(GREETING_TEXT, "bot");
  }

  function togglePanel() {
    const isOpen = panel.style.display === "flex";
    if (isOpen) {
      panel.style.display = "none";
      if (RESET_GREETING_ON_CLOSE) hasGreeted = false;
      return;
    }

    panel.style.display = "flex";
    ensureGreeting();
    input.focus();
  }

  bubble.onclick = togglePanel;

  async function handleSend() {
    const q = input.value.trim();
    if (!q) return;

    input.value = "";
    addMsg(q, "user");

    const pending = addMsg("…", "bot");

    try {
      const res = await fetch("https://johnnyp0150.app.n8n.cloud/webhook/plumber-widget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q })
      });

      if (!res.ok) {
        pending.remove();
        addMsg(`Server error (${res.status}).`, "bot");
        return;
      }

      const data = await res.json();
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
