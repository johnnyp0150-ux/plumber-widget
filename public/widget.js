// Minimal PipePilot widget — Option B (n8n-driven) — with 1st-open greeting + stable sessionId

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

  // ---- Stable session id (persists across page reloads) ----
  const SESSION_KEY = "pipepilot_session_id";

  function getOrCreateSessionId() {
    let id = localStorage.getItem(SESSION_KEY);
    if (id) return id;

    // Prefer crypto.randomUUID if available
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      id = window.crypto.randomUUID();
    } else {
      // Fallback: reasonably-unique id
      id = "pp_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2);
    }

    localStorage.setItem(SESSION_KEY, id);
    return id;
  }

  const sessionId = getOrCreateSessionId();

  function addMsg(text, who = "bot") {
    const div = document.cr
