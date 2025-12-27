// PipePilot widget — Option B (n8n-driven) — stable + greeting + sessionId
(function initPipePilot() {
  try {
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
    const GREETING_TEXT = "Hi! I’m PipePilot. How can we help today?";
    let hasGreeted = false;

    // greet only once per page load
    const RESET_GREETING_ON_CLOSE = false;

    // ---- Stable session id (persists across reloads) ----
    const SESSION_KEY = "pipepilot_session_id";

    function getOrCreateSessionId() {
      let id = null;
      try {
        id = localStorage.getItem(SESSION_KEY);
      } catch (_) {}

      if (id) return id;

      if (window.crypto && typeof window.crypto.randomUUID === "function") {
        id = window.crypto.randomUUID();
      } else {
        id = "pp_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2);
      }

      try {
        localStorage.setItem(SESSION_KEY, id);
      } catch (_) {}

      return id;
    }

    const sessionId = getOrCreateSessionId();

    function addMsg(text, who = "bot") {
      const div = document.createElement("div");
      div.className = `pipepilot-msg pipepilot-${who}`;
      div.textContent = text;
      msgs.appendChild(div);
      msgs.scrollTop = msgs.scrollHeight;
      return div;
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

    bubble.addEventListener("click", togglePanel);

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
          body: JSON.stringify({ message: q, sessionId })
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
  } catch (e) {
    // If something fails, at least log it instead of silently dying.
    console.error("PipePilot widget failed to initialize:", e);
  }
})();
