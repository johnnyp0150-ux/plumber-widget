// PipePilot widget — n8n-driven — stable + sessionId + TEST/PROD switch via ?n8n=test
(function initPipePilot() {
  try {
    if (document.getElementById("pipepilot-bubble")) return;

    // ---------- CONFIG ----------
    const PROD_WEBHOOK = "https://johnnyp0150.app.n8n.cloud/webhook/plumber-widget";
    const TEST_WEBHOOK = "https://johnnyp0150.app.n8n.cloud/webhook-test/plumber-widget";

    // Add ?n8n=test to your page URL to hit the webhook-test endpoint
    const params = new URLSearchParams(window.location.search);
    const USE_TEST_WEBHOOK = params.get("n8n") === "test";

    const WEBHOOK_URL = USE_TEST_WEBHOOK ? TEST_WEBHOOK : PROD_WEBHOOK;

    // Optional: show which mode you're in (tiny debug label in header)
    const SHOW_MODE_BADGE = true;

    // Greeting shown ONCE per page load (your n8n/system prompt rules may override behavior later)
    const GREETING_TEXT = "Hi! I’m PipePilot. How can we help today?";
    // ----------------------------

    const bubble = document.createElement("div");
    bubble.id = "pipepilot-bubble";
    bubble.textContent = "💬";
    document.body.appendChild(bubble);

    const panel = document.createElement("div");
    panel.id = "pipepilot-panel";
    panel.innerHTML = `
      <div id="pipepilot-header">
        PipePilot Assistant
        ${SHOW_MODE_BADGE ? `<span id="pipepilot-mode-badge" style="margin-left:8px;font-size:12px;opacity:.8;"></span>` : ""}
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
    const modeBadge = panel.querySelector("#pipepilot-mode-badge");

    if (modeBadge) {
      modeBadge.textContent = USE_TEST_WEBHOOK ? "TEST" : "LIVE";
      modeBadge.title = WEBHOOK_URL;
    }

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

    // greet only once per page load
    let hasGreeted = false;
    function ensureGreeting() {
      if (hasGreeted) return;
      hasGreeted = true;
      addMsg(GREETING_TEXT, "bot");
    }

    function togglePanel() {
      const isOpen = panel.style.display === "flex";
      if (isOpen) {
        panel.style.display = "none";
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
        const res = await fetch(WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: q,
            sessionId,
            // helpful debugging for n8n:
            client: "pipepilot-widget",
            mode: USE_TEST_WEBHOOK ? "test" : "live",
            pageUrl: window.location.href
          })
        });

        if (!res.ok) {
          pending.remove();

          // Common gotchas explained inline
          if (USE_TEST_WEBHOOK && (res.status === 404 || res.status === 410)) {
            addMsg(
              "Test webhook isn’t listening in n8n. Open the Webhook node and click “Listen for test event”, then try again.",
              "bot"
            );
            return;
          }

          addMsg(`Server error (${res.status}).`, "bot");
          return;
        }

        const data = await res.json();
        pending.remove();

        const reply =
          (data && (data.message || data.reply || data.text || data.output)) ||
          "No response from assistant.";

        addMsg(reply, "bot");
      } catch (err) {
        pending.remove();
        addMsg("Error contacting assistant.", "bot");
        // optional console debug
        console.error("PipePilot fetch error:", err);
      }
    }

    sendBtn.addEventListener("click", handleSend);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleSend();
    });
  } catch (e) {
    console.error("PipePilot widget failed to initialize:", e);
  }
})();
