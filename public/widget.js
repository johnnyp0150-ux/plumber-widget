// PipePilot widget — Option B (n8n-driven) — stable + greeting + sessionId
(function initPipePilot() {
  try {
    if (document.getElementById("pipepilot-bubble")) return;

    /**
     * ✅ IMPORTANT (testing in n8n editor):
     * When your Webhook node is in “Listening for test event”, you MUST post to the URL that contains:
     *   /webhook-test/
     * Example:
     *   https://johnnyp0150.app.n8n.cloud/webhook-test/plumber-widget
     *
     * ✅ Production (published workflow) usually uses:
     *   /webhook/
     *
     * This script lets you switch without editing code:
     * - If you set: window.PIPEPILOT_WEBHOOK_URL = "https://.../webhook-test/..."
     *   it will use that.
     * - Otherwise it will fall back to DEFAULT_WEBHOOK_URL below.
     */
    const DEFAULT_WEBHOOK_URL = "https://johnnyp0150.app.n8n.cloud/webhook-test/plumber-widget
";
    const WEBHOOK_URL =
      (typeof window !== "undefined" && window.PIPEPILOT_WEBHOOK_URL) || DEFAULT_WEBHOOK_URL;

    // Basic UI
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
        <button id="pipepilot-send" type="button">Send</button>
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

      // pending indicator
      const pending = addMsg("…", "bot");

      try {
        const res = await fetch(WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Keep payload simple + consistent
          body: JSON.stringify({
            message: q,
            sessionId
          })
        });

        let data = null;
        const contentType = res.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
          data = await res.json().catch(() => null);
        } else {
          // Fallback: if your Respond to Webhook returns plain text
          const text = await res.text().catch(() => "");
          data = { message: text };
        }

        pending.remove();

        if (!res.ok) {
          const msg =
            (data && (data.message || data.error || data.reply || data.text)) ||
            `Server error (${res.status}).`;
          addMsg(msg, "bot");
          return;
        }

        const reply =
          (data && (data.message || data.reply || data.text || data.output)) ||
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

    // Optional: expose for quick debugging in console
    window.PIPEPILOT_DEBUG = {
      sessionId,
      webhookUrl: WEBHOOK_URL
    };
  } catch (e) {
    console.error("PipePilot widget failed to initialize:", e);
  }
})();
