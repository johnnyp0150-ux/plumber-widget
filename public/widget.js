// PipePilot widget — Option B (n8n-driven) — stable + greeting + sessionId + TEST/PROD switch
(function initPipePilot() {
  try {
    if (document.getElementById("pipepilot-bubble")) return;

    // ---- Config ----
    const WEBHOOK_PROD = "https://johnnyp0150.app.n8n.cloud/webhook/plumber-widget";
    const WEBHOOK_TEST = "https://johnnyp0150.app.n8n.cloud/webhook-test/plumber-widget";

    // If your page URL includes ?n8n=test, use test webhook
    const params = new URLSearchParams(window.location.search);
    const IS_TEST = (params.get("n8n") || "").toLowerCase() === "test";
    const WEBHOOK_URL = IS_TEST ? WEBHOOK_TEST : WEBHOOK_PROD;

    // ---- UI ----
    const bubble = document.createElement("div");
    bubble.id = "pipepilot-bubble";
    bubble.textContent = "💬";
    document.body.appendChild(bubble);

    const panel = document.createElement("div");
    panel.id = "pipepilot-panel";
    panel.innerHTML = `
      <div id="pipepilot-header">
        <span>PipePilot Assistant</span>
        <span id="pipepilot-mode" style="
          margin-left: 8px;
          font-size: 12px;
          padding: 2px 8px;
          border-radius: 999px;
          background: rgba(255,255,255,0.25);
        ">${IS_TEST ? "TEST" : "LIVE"}</span>
      </div>
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

    // ---- Greeting ----
    const GREETING_TEXT = "Hi! I’m PipePilot. How can we help today?";
    let hasGreeted = false;
    const RESET_GREETING_ON_CLOSE = false;

    // ---- Stable session id ----
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
        console.log("[PipePilot] POST ->", WEBHOOK_URL, { message: q, sessionId, mode: IS_TEST ? "test" : "prod" });

        const res = await fetch(WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: q,
            sessionId,
            // optional: helps debugging in n8n logs if you want it
            source: "widget",
            mode: IS_TEST ? "test" : "prod"
          })
        });

        if (!res.ok) {
          pending.remove();
          addMsg(`Server error (${res.status}).`, "bot");
          return;
        }

        const data = await res.json();
        console.log("[PipePilot] response <-", data);

        pending.remove();

        const reply =
          (data && (data.message || data.reply || data.text)) ||
          "No response from assistant.";

        addMsg(reply, "bot");
      } catch (err) {
        console.error("[PipePilot] fetch failed:", err);
        pending.remove();
        addMsg("Error contacting assistant.", "bot");
      }
    }

    sendBtn.addEventListener("click", handleSend);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleSend();
    });

    // Optional: open automatically if you want
    // togglePanel();
  } catch (e) {
    console.error("PipePilot widget failed to initialize:", e);
  }
})();
