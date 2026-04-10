const toggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".site-nav");

if (toggle && nav) {
  toggle.addEventListener("click", () => {
    const open = document.body.classList.toggle("nav-open");
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      document.body.classList.remove("nav-open");
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });

  document.addEventListener("click", (event) => {
    if (!document.body.classList.contains("nav-open")) return;
    if (nav.contains(event.target) || toggle.contains(event.target)) return;
    document.body.classList.remove("nav-open");
    nav.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
  });
}

// ── Bot floating widget ───────────────────────────────────────────────────
const botFab   = document.getElementById("botFab");
const botPopup = document.getElementById("botPopup");
const botScrim = document.getElementById("botScrim");
const botFrame = document.getElementById("botFrame");
const botClose = document.getElementById("botClose");
const botHint  = document.getElementById("botHint");
const BOT_URL  = "https://serafino-bot.vercel.app";

let botOpen   = false;
let botLoaded = false;

// Show hint bubble after 3s, hide once bot is opened
setTimeout(() => { if (!botOpen && botHint) botHint.classList.add("is-visible"); }, 3000);

function openBot() {
  if (!botLoaded) {
    botFrame.src = BOT_URL;
    botLoaded = true;
  }
  botOpen = true;
  if (botHint) botHint.classList.remove("is-visible");
  botPopup.classList.add("is-open");
  botScrim.classList.add("is-open");
  botFab.setAttribute("aria-expanded", "true");
  botPopup.setAttribute("aria-hidden", "false");
}

function closeBot() {
  botOpen = false;
  botPopup.classList.remove("is-open");
  botScrim.classList.remove("is-open");
  botFab.setAttribute("aria-expanded", "false");
  botPopup.setAttribute("aria-hidden", "true");
}

if (botFab) {
  botFab.addEventListener("click", () => botOpen ? closeBot() : openBot());
}

if (botScrim) {
  botScrim.addEventListener("click", closeBot);
}

if (botClose) {
  botClose.addEventListener("click", closeBot);
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && botOpen) closeBot();
});

// ── Flip cards — click per mobile e tastiera
document.querySelectorAll(".flip-card").forEach((card) => {
  card.addEventListener("click", () => {
    card.classList.toggle("is-flipped");
  });
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      card.classList.toggle("is-flipped");
    }
  });
});
