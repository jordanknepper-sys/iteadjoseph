"use strict";
// Ite ad Joseph — offline-first 90-day program for Catholic fathers.
// All progress stays on this phone (localStorage). No accounts, no server.

const KEY = "iaj-v1";
const AUDIO_CACHE = "iaj-audio-v1";
let C = null;              // content.json
let S = load();            // saved state
const audio = document.getElementById("audio");
const view = document.getElementById("view");

function load() {
  try { return Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY) || "{}")); }
  catch { return defaults(); }
}
function defaults() { return { start: null, time: "08:00", kids: ["", ""], sacrifice: "", marks: {}, yells: {}, done: {}, rate: 1 }; }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} }

// ---------- dates ----------
const pad = n => String(n).padStart(2, "0");
function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function parse(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function addDays(s, k) { const d = parse(s); d.setDate(d.getDate() + k); return d; }
function dayDate(n) { return addDays(S.start, n - 1); }
function fmtDate(d) { return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }); }
function todayN() {
  if (!S.start) return 1;
  const diff = Math.round((parse(iso(new Date())) - parse(S.start)) / 86400000);
  return Math.min(91, Math.max(1, diff + 1));
}
function daysUntilStart() { return S.start ? Math.round((parse(S.start) - parse(iso(new Date()))) / 86400000) : 0; }

// ---------- tiny DOM helper ----------
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, "");
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
}
const paras = t => (t || "").split("\n\n").map(p => h("p", null, p));
const icon = playing => playing
  ? '<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>'
  : '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
const fmtT = t => isFinite(t) ? Math.floor(t / 60) + ":" + pad(Math.floor(t % 60)) : "–:––";

// ---------- routing ----------
function route() {
  const hsh = location.hash;
  let m;
  if (!S.start && !hsh.startsWith("#settings")) return renderWelcome();
  if ((m = /^#day(?:\/|)(\d{1,2})$/.exec(hsh))) return renderDay(Math.min(91, Math.max(1, +m[1])));
  if (hsh === "#progress") return renderProgress();
  if (hsh === "#prayers") return renderPrayers();
  if (hsh === "#settings") return renderSettings();
  return renderDay(todayN(), true);
}
function setTab(name) { document.querySelectorAll(".tab").forEach(b => b.dataset.tab === name ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current")); }
document.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => {
  location.hash = b.dataset.tab === "today" ? "" : "#" + b.dataset.tab;
  if (b.dataset.tab === "today") route();
}));
addEventListener("hashchange", () => { route(); scrollTo(0, 0); });

// ---------- welcome ----------
function renderWelcome() {
  setTab("settings");
  const startIn = h("input", { type: "date", id: "start", value: iso(new Date()) });
  view.replaceChildren(
    h("div", { class: "card welcome" },
      h("div", { class: "brand" }, "Ite ad ", h("span", null, "Joseph")),
      h("h1", null, "Go to Joseph."),
      h("p", { class: "lead" }, "Ninety days to lead your home with calm authority instead of volume."),
      h("p", null, "Each morning: an opening prayer to St. Joseph, the week's Scripture, about five minutes of teaching, one concrete thing to do that day with instructions, the evening examen, and the Litany of St. Joseph. About ten minutes."),
      h("label", { class: "field" }, "Your Day 1", startIn),
      h("p", { class: "note" }, "Most fathers start today. The sessions were written for a fall start, so a few mention feasts like All Saints, Advent, and Christmas on the 2026 calendar."),
      h("button", { class: "primary", onclick: () => { S.start = startIn.value || iso(new Date()); save(); location.hash = ""; route(); } }, "Begin"),
      h("p", { class: "note" }, "Your progress stays on this phone. Nothing is sent anywhere.")
    )
  );
}

// ---------- day ----------
function renderDay(n, isToday) {
  setTab(isToday ? "today" : "progress");
  const d = C.days[n - 1];
  const until = daysUntilStart();
  const marks = S.marks[n] || {};
  const header = h("header", { class: "top" },
    h("div", { class: "brand" }, "Ite ad ", h("span", null, "Joseph")),
    h("div", { class: "meta" }, until > 0 ? `Starts in ${until} day${until > 1 ? "s" : ""}` : `Day ${todayN()} of 90`));

  // player
  const playBtn = h("button", { class: "play", "aria-label": "Play session" }); playBtn.innerHTML = icon(false);
  const fill = h("i"); const bar = h("div", { class: "bar", role: "slider", "aria-label": "Seek", tabindex: "0" }, fill);
  const cur = h("span", null, "0:00"), dur = h("span", null, "–:––");
  const speed = h("button", { class: "small", "aria-label": "Playback speed" }, S.rate + "×");
  const dl = h("button", { class: "small" }, "Save offline");
  audio.pause();
  if (audio.dataset.n !== String(n)) { audio.src = d.audio; audio.dataset.n = n; }
  audio.playbackRate = S.rate;
  playBtn.onclick = () => audio.paused ? audio.play().catch(() => {}) : audio.pause();
  audio.onplay = () => playBtn.innerHTML = icon(true);
  audio.onpause = audio.onended = () => playBtn.innerHTML = icon(false);
  audio.onloadedmetadata = () => dur.textContent = fmtT(audio.duration);
  audio.ontimeupdate = () => { cur.textContent = fmtT(audio.currentTime); if (audio.duration) fill.style.width = (100 * audio.currentTime / audio.duration) + "%"; };
  audio.onended = () => { playBtn.innerHTML = icon(false); S.done[n] = true; save(); doneBtn.replaceWith(doneBadge()); };
  bar.onclick = e => { if (audio.duration) { const r = bar.getBoundingClientRect(); audio.currentTime = audio.duration * (e.clientX - r.left) / r.width; } };
  bar.onkeydown = e => { if (e.key === "ArrowRight") audio.currentTime += 15; if (e.key === "ArrowLeft") audio.currentTime -= 15; };
  speed.onclick = () => { const R = [1, 1.15, 1.3, 1.5]; S.rate = R[(R.indexOf(S.rate) + 1) % R.length]; audio.playbackRate = S.rate; speed.textContent = S.rate + "×"; save(); };
  isCached(d.audio).then(ok => { if (ok) dl.textContent = "Saved offline ✓"; });
  dl.onclick = async () => { dl.textContent = "Saving…"; try { await cacheAudio([d.audio]); dl.textContent = "Saved offline ✓"; } catch { dl.textContent = "Couldn't save. Try again on Wi-Fi."; } };

  const doneBadge = () => h("span", { class: "small", style: "color:var(--ok);border-color:var(--ok)" }, "Session complete ✓");
  const doneBtn = S.done[n] ? doneBadge() : h("button", { class: "small", onclick: () => { S.done[n] = true; save(); doneBtn.replaceWith(doneBadge()); } }, "Mark listened");

  // daily marks
  const kidRows = S.kids.map((k, i) => ["kid" + i, `One-on-one: ${k || "child " + (i + 1)}`, "10–15 min. The child leads. No phone, no teaching, no correcting."]);
  const MARKS = [
    ["session", "Morning session", "Listened and prayed."],
    ...kidRows,
    ["praise", "Praise 5+ each child", "Specific: name the behavior."],
    ["calm", "Calm voice", "Zero yelling. If you slipped, count it below and repair."],
    ["repair", "Repair (if needed)", "Within the hour: own it, no 'but you,' restate the rule."],
    ["askonce", "Ask once", "Statement, up close, 10-second wait, calm consequence."],
    ["phone", "Phone down", "Away at dinner and bedtime."],
    ["sacrifice", "My sacrifice", S.sacrifice || "Set yours in Setup."],
    ["examen", "Evening examen", "Five minutes before bed."],
  ];
  const markList = h("div", { class: "marks" }, MARKS.map(([k, t, sub]) => {
    const cb = h("input", { type: "checkbox", id: "m-" + k, checked: !!marks[k] });
    cb.onchange = () => { (S.marks[n] = S.marks[n] || {})[k] = cb.checked; save(); };
    return h("label", { class: "mark", for: "m-" + k }, cb, h("span", null, t, h("small", null, sub)));
  }));
  const yOut = h("output", null, String(S.yells[n] || 0));
  const bump = k => { S.yells[n] = Math.max(0, (S.yells[n] || 0) + k); yOut.textContent = S.yells[n]; save(); };

  view.replaceChildren(
    header,
    h("article", { class: "card" },
      h("div", { class: "eyebrow" }, h("span", { class: "daytag" }, "Day " + n), h("span", null, fmtDate(dayDate(n))), h("span", null, `Week ${d.week} · ${d.phase}`)),
      h("h1", null, d.title),
      h("div", { class: "player" }, playBtn, h("div", { class: "track" }, bar, h("div", { class: "time" }, cur, dur)), speed),
      h("div", { class: "row" }, dl, doneBtn),
      h("div", { class: "verse" }, h("b", null, d.ref), d.verse),
      h("p", { style: "margin:0" }, d.teach),
      h("details", null, h("summary", null, "Read the full teaching"), h("div", { class: "prose" }, paras(d.talk))),
      h("div", { class: "box" }, h("span", { class: "label" }, "Your one thing today"), d.do,
        h("details", null, h("summary", null, "How to do it"), h("div", { class: "prose" }, paras(d.assign)))),
      h("div", { class: "box" }, h("span", { class: "label" }, "Tonight's examen"), d.ask,
        h("details", null, h("summary", null, "How to pray the examen"), examenList())),
      h("div", null, h("span", { class: "label" }, "From Scripture, on fatherhood"), h("p", { style: "margin:.3em 0 0" }, d.fact)),
      h("div", { class: "row", style: "justify-content:space-between" },
        h("button", { class: "ghost", disabled: n === 1, onclick: () => location.hash = "#day/" + (n - 1) }, "← Previous"),
        isToday ? null : h("button", { class: "ghost", onclick: () => { location.hash = ""; route(); } }, "Today"),
        h("button", { class: "ghost", disabled: n === 91, onclick: () => location.hash = "#day/" + (n + 1) }, "Next →"))
    ),
    h("section", { class: "card" },
      h("h2", null, "Today's marks"),
      markList,
      h("div", { class: "counter" }, h("span", { style: "flex:1;font-weight:600" }, "Times I yelled today"),
        h("button", { "aria-label": "One less", onclick: () => bump(-1) }, "−"), yOut, h("button", { "aria-label": "One more", onclick: () => bump(1) }, "+")),
      h("p", { class: "note" }, "Honest marks, not perfect marks. A missed day isn't failure. Two in a row: call your accountability brother.")
    )
  );
}
function examenList() {
  return h("div", { class: "prose" },
    h("p", null, "A five-minute evening prayer from St. Ignatius of Loyola."),
    ["Stillness: remember that God is with you.",
     "Gratitude: thank God for one specific good moment with your family today.",
     "Review: replay the day with your children, morning to night. Where were you patient? Where weren't you?",
     "Sorrow: tell God plainly where you fell short. If you owe a child an apology, plan when you'll make it.",
     "Resolve: choose one small thing to do better tomorrow. Then answer the day's question."].map((t, i) => h("p", null, `${i + 1}. ${t}`)));
}

// ---------- progress ----------
function renderProgress() {
  setTab("progress");
  const t = todayN();
  const clean = Object.keys(S.done).filter(n => S.done[n] && !(S.yells[n] > 0)).length;
  const listened = Object.values(S.done).filter(Boolean).length;
  let streak = 0; for (let n = t; n >= 1; n--) { if (S.done[n] && !(S.yells[n] > 0)) streak++; else if (n !== t) break; }
  const grid = h("div", { class: "grid90" });
  for (let w = 0; w < 13; w++) {
    const cells = h("div", { class: "cells" });
    for (let k = 0; k < 7; k++) {
      const n = w * 7 + k + 1;
      cells.append(h("button", { class: "chip" + (S.done[n] ? " done" : "") + (n === t ? " today" : "") + (n > t ? " future" : ""),
        title: `${fmtDate(dayDate(n))}: ${C.days[n - 1].title}`, "aria-label": `Day ${n}, ${C.days[n - 1].title}`,
        onclick: () => location.hash = "#day/" + n }, String(n)));
    }
    grid.append(h("div", { class: "wk" }, h("span", null, "Wk " + (w + 1)), cells));
  }
  view.replaceChildren(
    h("header", { class: "top" }, h("div", { class: "brand" }, "Ite ad ", h("span", null, "Joseph")), h("div", { class: "meta" }, `Day ${t} of 90`)),
    h("section", { class: "card" }, h("h2", null, "Your 90 days"),
      h("div", { class: "stats" },
        h("div", { class: "stat" }, h("b", null, String(listened)), h("span", null, "Sessions")),
        h("div", { class: "stat" }, h("b", null, String(clean)), h("span", null, "Calm days")),
        h("div", { class: "stat" }, h("b", null, String(streak)), h("span", null, "Current streak"))),
      grid,
      h("p", { class: "note" }, "Filled squares are sessions you've completed. A calm day means you completed the session and logged no yelling. Tap any day to open it.")),
  );
}

// ---------- prayers ----------
function renderPrayers() {
  setTab("prayers");
  view.replaceChildren(
    h("header", { class: "top" }, h("div", { class: "brand" }, "Ite ad ", h("span", null, "Joseph")), h("div", { class: "meta" }, "Prayers & tools")),
    h("section", { class: "card" }, h("h2", null, "Morning prayer to St. Joseph"), h("div", { class: "prose" }, paras(C.openPrayer))),
    h("section", { class: "card" }, h("h2", null, "The evening examen"), examenList()),
    h("section", { class: "card" }, h("h2", null, "Litany of St. Joseph (excerpt) and closing"), h("div", { class: "prose" }, paras(C.closePrayer.replace(/\n(?!\n)/g, "\n\n")))),
    h("section", { class: "card" }, h("h2", null, "The exit plan"),
      h("div", { class: "prose" }, paras("1. Notice your signal: tight jaw, heat, rising voice.\n\n2. Make sure your children are safe first. Put a baby in the crib, hand a young child to your wife or another adult, send older children to their rooms.\n\n3. Say your exit line: I'm too frustrated to handle this well right now. I'm going to step out, and we'll talk in ten minutes.\n\n4. Step into another room, the porch or the garage, staying within earshot of young children. Breathe. Pray a Hail Mary.\n\n5. Come back when you said you would. Apply the agreed consequence calmly, with no lecture.\n\nThis program never uses physical punishment. The research shows it makes behavior worse.\n\nIf you feel close to hurting a child: put the child somewhere safe or with another adult, step away, and call the Childhelp National Child Abuse Hotline, 1-800-422-4453. It takes calls from parents at their limit.\n\nEmergency: 911. If you are thinking about harming yourself: call or text 988. If anger at home involves your wife or partner: National Domestic Violence Hotline, 1-800-799-7233."))),
    h("section", { class: "card" }, h("h2", null, "Day 1 tool: the alignment conversation"),
      h("div", { class: "prose" }, paras(C.days[0].assign)))
  );
}

// ---------- settings ----------
function renderSettings() {
  setTab("settings");
  const start = h("input", { type: "date", id: "set-start", value: S.start || iso(new Date()) });
  const time = h("input", { type: "time", id: "set-time", value: S.time });
  const sac = h("input", { type: "text", id: "set-sac", value: S.sacrifice, placeholder: "e.g. no alcohol Sunday–Thursday" });
  const kidsWrap = h("div", { style: "display:grid;gap:8px" });
  const drawKids = () => kidsWrap.replaceChildren(...S.kids.map((k, i) => {
    const inp = h("input", { type: "text", id: "kid-" + i, value: k, placeholder: `Child ${i + 1} (first name, stays on this phone)` });
    inp.oninput = () => { S.kids[i] = inp.value; save(); };
    return h("label", { class: "field" }, `Child ${i + 1}`, inp);
  }));
  drawKids();
  const status = h("p", { class: "note", role: "status" });
  view.replaceChildren(
    h("header", { class: "top" }, h("div", { class: "brand" }, "Ite ad ", h("span", null, "Joseph")), h("div", { class: "meta" }, "Setup")),
    h("section", { class: "card" }, h("h2", null, "Your program"),
      h("label", { class: "field" }, "Day 1", start),
      h("label", { class: "field" }, "Daily reminder time", time),
      h("label", { class: "field" }, "My sacrifice for the 90 days", sac),
      h("button", { class: "primary", onclick: () => { S.start = start.value; S.time = time.value || "08:00"; S.sacrifice = sac.value; save(); status.textContent = "Saved."; } }, "Save")),
    h("section", { class: "card" }, h("h2", null, "Children"), kidsWrap,
      h("div", { class: "row" },
        h("button", { class: "ghost", onclick: () => { if (S.kids.length < 6) { S.kids.push(""); save(); drawKids(); } } }, "Add a child"),
        h("button", { class: "ghost", onclick: () => { if (S.kids.length > 1) { S.kids.pop(); save(); drawKids(); } } }, "Remove last"))),
    h("section", { class: "card" }, h("h2", null, "Daily reminders"),
      h("p", null, "Adds all 91 sessions to your phone's calendar at your reminder time. Each event links straight to that day."),
      h("button", { class: "primary", onclick: () => { S.start = start.value; S.time = time.value || "08:00"; save(); downloadICS(); status.textContent = "Calendar file created. Open it and choose Add All."; } }, "Add to my calendar")),
    h("section", { class: "card" }, h("h2", null, "Listen without signal"),
      h("p", null, "Save the next seven sessions to this phone, about 25 MB."),
      h("button", { class: "ghost", onclick: async e => { e.target.textContent = "Saving…"; const t = todayN(); const list = []; for (let n = t; n < Math.min(92, t + 7); n++) list.push(C.days[n - 1].audio); try { await cacheAudio(list); e.target.textContent = "Saved ✓"; } catch { e.target.textContent = "Couldn't save. Try again on Wi-Fi."; } } }, "Save this week")),
    h("section", { class: "card" }, h("h2", null, "Install on your phone"),
      h("p", null, "iPhone: open this page in Safari, tap Share, then Add to Home Screen. Android: tap the menu, then Install app.")),
    status
  );
}

// ---------- reminders (.ics) ----------
function downloadICS() {
  const base = location.href.split("#")[0];
  const [hh, mm] = (S.time || "08:00").split(":");
  const esc = s => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Ite ad Joseph//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Ite ad Joseph"];
  C.days.forEach(d => {
    const day = dayDate(d.n); const ymd = iso(day).replace(/-/g, "");
    const end = new Date(day); end.setHours(+hh, +mm + 10);
    lines.push("BEGIN:VEVENT", `UID:iaj-${S.start}-${d.n}@iteadjoseph`, `DTSTAMP:${stamp}`,
      `DTSTART:${ymd}T${hh}${mm}00`, `DTEND:${iso(end).replace(/-/g, "")}T${pad(end.getHours())}${pad(end.getMinutes())}00`,
      `SUMMARY:${esc(`Ite ad Joseph · Day ${d.n}: ${d.title}`)}`,
      `DESCRIPTION:${esc(`${base}#day/${d.n}\n\nYour one thing today: ${d.do}\nTonight's examen: ${d.ask}`)}`,
      `URL:${base}#day/${d.n}`, "BEGIN:VALARM", "ACTION:DISPLAY", "TRIGGER:PT0M", `DESCRIPTION:${esc("Ite ad Joseph · Day " + d.n)}`, "END:VALARM", "END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  const fold = l => l.length <= 74 ? l : l.match(/.{1,73}/g).join("\r\n ");
  const blob = new Blob([lines.map(fold).join("\r\n")], { type: "text/calendar" });
  const a = h("a", { href: URL.createObjectURL(blob), download: "ite-ad-joseph.ics" }); document.body.append(a); a.click(); a.remove();
}

// ---------- offline audio ----------
async function cacheAudio(list) { const c = await caches.open(AUDIO_CACHE); await c.addAll(list); }
async function isCached(p) { try { const c = await caches.open(AUDIO_CACHE); return !!(await c.match(p)); } catch { return false; } }

// ---------- boot ----------
fetch("content.json").then(r => r.json()).then(j => { C = j; route(); })
  .catch(() => view.replaceChildren(h("div", { class: "card" }, "Couldn't load the program. Check your connection and reopen the app.")));
if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
