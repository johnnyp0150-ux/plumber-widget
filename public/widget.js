<script>
// Minimal PipePilot widget: chat + intent router + RAG call.

// --- CONFIG ---
const BOOKING_URL = "https://cal.com/yourbiz/consult"; // <-- replace if you have one
const BOOK_INTENTS = [
  /book/i, /schedule/i, /appointment/i, /estimate/i, /quote/i, /today/i,
  /tomorrow/i, /availability/i
];

// --- UI bootstrap (expects widget.css for styling) ---
(function initPipePilot() {
  if (document.getElementById("pipepilot-bubble")) return;

  const bubble = document.createElement("div");
  bubble.id = "pipepilot-bubble";
  bubble.textContent = "💬";
  document.body.appendChild(bubble);

  const panel = document.createElement("div");
  panel.id = "pipepilot-panel";
  panel.innerHTML = `
    <div id="pipepilot-header">PipePilot — Ask about plumbing or book a visit</div>
    <div id="pipepilot-messages"></div>
    <div id="pipepilot-input">
      <input id="pipepilot-text" placeholder="Type your question…" />
      <button id="pipepilot-send">Send</button>
    </div>`;
  document.body.appendChild(panel);

  const msgs = panel.querySelector("#pipepilot-messages");
  const input = panel.querySelector("#pipepilot-text");
  const sendBtn = panel.querySelector("#pipepilot-send");

  const show = () => (panel.style.display = "flex");
  const hide = () => (panel.style.display = "none");
  let open = false;
  bubble.onclick = () => { open = !open; open ? show() : hide(); input.focus(); };

  function addMsg(text, who="bot") {
    const div = document.createElement("div");
    div.className = `pipepilot-msg pipepilot-${who}`;
    div.textContent = text;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  async function handleSend() {
    const q = input.value.trim();
    if (!q) return;
    input.value = "";
    addMsg(q, "user");

    // Intent router: if it's probably a booking question, send them to booking.
    if (BOOK_INTENTS.some(rx => rx.test(q))) {
      const line = BOOKING_URL
        ? `I can help you book now. Opening our booking page…`
        : `I can take your info and get you scheduled. What day/time works best?`;
      addMsg(line);

      if (BOOKING_URL) {
        window.open(BOOKING_URL, "_blank", "noopener");
      }
      return;
    }

    // Otherwise, ask RAG endpoint.
    addMsg("Thinking…");

    try {
      const res = await fetch("/api/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error (${res.status})`);
      }

      const data = await res.json();
      const answer = data.answer || "Sorry, I couldn't find that in our docs.";
      // Optional: use data.sources if you include them in the API response.
      addMsg(answer);
    } catch (e) {
      addMsg(`Error: ${e.message || e}`);
    }
  }

  sendBtn.onclick = handleSend;
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSend();
  });

  // Greeting
  setTimeout(() => addMsg("Hi! Ask me a plumbing question or say 'book' to schedule."), 300);
})();
</script>
