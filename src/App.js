import { useState, useEffect, useRef, createContext, useContext, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════
// 🎨 THEME CONTEXT
// ═══════════════════════════════════════════════════════════════
const ThemeCtx = createContext({ mode: "dark", toggle: () => {} });
const useTheme = () => useContext(ThemeCtx);

// ═══════════════════════════════════════════════════════════════
// 🔔 NOTIFICATION CONTEXT
// ═══════════════════════════════════════════════════════════════
const NotifCtx = createContext({ permission: "default", request: async () => {}, send: () => {} });
const useNotif = () => useContext(NotifCtx);

// ═══════════════════════════════════════════════════════════════
// ⚙️ GLOBAL STYLES
// ═══════════════════════════════════════════════════════════════
const GS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  [data-theme="dark"] {
    --bg: #07090f; --bg2: #0d1117; --bg3: #111827;
    --surface: rgba(255,255,255,0.04); --surface2: rgba(255,255,255,0.07);
    --border: rgba(255,255,255,0.09); --border2: rgba(255,255,255,0.16);
    --text: #f1f5f9; --text2: #94a3b8; --text3: #64748b;
    --input-bg: rgba(255,255,255,0.05); --scrollbar: rgba(255,255,255,0.09);
  }
  [data-theme="light"] {
    --bg: #f8fafc; --bg2: #ffffff; --bg3: #f1f5f9;
    --surface: rgba(0,0,0,0.03); --surface2: rgba(0,0,0,0.06);
    --border: rgba(0,0,0,0.09); --border2: rgba(0,0,0,0.18);
    --text: #0f172a; --text2: #475569; --text3: #94a3b8;
    --input-bg: rgba(0,0,0,0.04); --scrollbar: rgba(0,0,0,0.12);
  }

  body { background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; min-height: 100vh; overflow-x: hidden; transition: background 0.25s, color 0.25s; }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-thumb { background: var(--scrollbar); border-radius: 999px; }
  ::selection { background: #6366f144; }

  @keyframes spin    { to { transform: rotate(360deg); } }
  @keyframes fade-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  @keyframes float   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
  @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.4} }

  textarea { resize: vertical; }
  select option { background: var(--bg2); color: var(--text); }

  .bottom-nav { display:none; position:fixed; bottom:0; left:0; right:0; background:var(--bg2); border-top:1px solid var(--border); z-index:100; padding:6px 0 10px; }
  .bottom-nav-inner { display:flex; justify-content:space-around; align-items:center; }
  .bottom-nav-item { display:flex; flex-direction:column; align-items:center; gap:3px; padding:6px 10px; border-radius:10px; cursor:pointer; border:none; background:transparent; font-family:inherit; transition:all 0.18s; }
  .bottom-nav-item span { font-size:10px; font-weight:500; }
  .desktop-sidebar { display:flex; }

  @media (max-width: 768px) {
    .desktop-sidebar { display:none !important; }
    .bottom-nav { display:block; }
    .main-content { padding-bottom:80px !important; }
    .page-padding { padding:20px 16px !important; }
    .stats-grid { grid-template-columns:1fr 1fr !important; }
    .hero-btns { flex-direction:column !important; align-items:center !important; }
    .hero-pills { display:none !important; }
  }
`;

// ═══════════════════════════════════════════════════════════════
// CONSTANTS & HELPERS
// ═══════════════════════════════════════════════════════════════
const glass  = (r=14) => ({ background:"var(--surface)", border:"1px solid var(--border)", backdropFilter:"blur(18px)", borderRadius:r });
const btn    = { cursor:"pointer", border:"none", outline:"none", fontFamily:"inherit", fontWeight:500, transition:"all 0.18s" };
const FILE_COLORS = { pdf:"#f87171", docx:"#60a5fa", doc:"#60a5fa", pptx:"#fb923c", txt:"#4ade80" };
const fileClr = (n="") => FILE_COLORS[n.split(".").pop()?.toLowerCase()] || "#6366f1";
const fmtSize = b => b < 1048576 ? `${(b/1024).toFixed(1)} KB` : `${(b/1048576).toFixed(1)} MB`;
const fmtDate = ts => new Date(ts).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
const fmtTime = d => new Date(d).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});

// ═══════════════════════════════════════════════════════════════
// STORAGE
// ═══════════════════════════════════════════════════════════════
const DOCS_KEY  = "learngpt:docs:v1";
const USERS_KEY = "learngpt:users:v1";

async function storageSave(key, value) {
  try {
    await fetch("/.netlify/functions/storage", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ action:"set", key, value: JSON.stringify(value) })
    });
  } catch(e) { console.warn("save error:", e); }
}
async function storageLoad(key, fallback) {
  try {
    const r = await fetch("/.netlify/functions/storage", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ action:"get", key })
    });
    const d = await r.json();
    return d.value ? JSON.parse(d.value) : fallback;
  } catch { return fallback; }
}
async function saveProgress(email, data) {
  try {
    await fetch("/.netlify/functions/progress", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ action:"save", email, data })
    });
  } catch(e) { console.warn("progress save:", e); }
}
async function loadAllProgress() {
  try {
    const r = await fetch("/.netlify/functions/progress", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ action:"getAll" })
    });
    const d = await r.json();
    return d.progress || {};
  } catch { return {}; }
}

// ═══════════════════════════════════════════════════════════════
// RATE LIMIT TRACKING
// ═══════════════════════════════════════════════════════════════
const RL = { calls:0, windowStart:Date.now(), limited:false, until:0, listeners:[] };
const RATE_MAX    = 15;
const RATE_WINDOW = 60000;

function rlSubscribe(fn) { RL.listeners.push(fn); return () => { RL.listeners = RL.listeners.filter(x=>x!==fn); }; }
function rlNotify()      { RL.listeners.forEach(fn => fn({...RL})); }
function rlTrack() {
  const now = Date.now();
  if (now - RL.windowStart > RATE_WINDOW) { RL.calls=0; RL.windowStart=now; RL.limited=false; }
  RL.calls++;
  if (RL.calls >= RATE_MAX) { RL.limited=true; RL.until=RL.windowStart+RATE_WINDOW; }
  rlNotify();
}
function rlCanCall() {
  if (!RL.limited) return true;
  if (Date.now() > RL.until) { RL.limited=false; RL.calls=0; RL.windowStart=Date.now(); rlNotify(); return true; }
  return false;
}

// ═══════════════════════════════════════════════════════════════
// 🔥 STREAK SYSTEM
// ═══════════════════════════════════════════════════════════════
const streakKey = email => `learngpt:streak:${email}`;
function getOrUpdateStreak(email) {
  try {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now()-86400000).toDateString();
    const raw = localStorage.getItem(streakKey(email));
    const data = raw ? JSON.parse(raw) : {streak:0,lastDate:null,longest:0};
    if (data.lastDate===today) return data;
    const newStreak = data.lastDate===yesterday ? data.streak+1 : 1;
    const updated = {streak:newStreak, lastDate:today, longest:Math.max(newStreak,data.longest||0)};
    localStorage.setItem(streakKey(email), JSON.stringify(updated));
    return updated;
  } catch { return {streak:1,lastDate:new Date().toDateString(),longest:1}; }
}
function readStreak(email) {
  try { return JSON.parse(localStorage.getItem(streakKey(email))||'{"streak":0,"longest":0}'); }
  catch { return {streak:0,longest:0}; }
}

// ═══════════════════════════════════════════════════════════════
// 🏅 ACHIEVEMENTS
// ═══════════════════════════════════════════════════════════════
const ACHIEVEMENTS_DEF = [
  {id:"first_quiz",   icon:"🎯", title:"Quiz Starter",  desc:"Complete your first quiz",       check:s=>s.quizzesTaken>=1},
  {id:"perfect",      icon:"💯", title:"Perfect Score", desc:"Score 100% on any quiz",          check:s=>s.bestScore>=100},
  {id:"curious",      icon:"💬", title:"Curious Mind",  desc:"Ask 10 AI questions",             check:s=>s.questionsAsked>=10},
  {id:"flash_master", icon:"⚡", title:"Flash Master",  desc:"Master 8+ flashcards",            check:s=>s.flashcardsMastered>=8},
  {id:"quiz_5",       icon:"📝", title:"Quiz Regular",  desc:"Complete 5 quizzes",              check:s=>s.quizzesTaken>=5},
  {id:"streak_3",     icon:"🔥", title:"On Fire",       desc:"3-day study streak",              check:s=>s.streak>=3},
  {id:"streak_7",     icon:"🏆", title:"Week Warrior",  desc:"7-day study streak",              check:s=>s.streak>=7},
  {id:"high_scorer",  icon:"⭐", title:"High Scorer",   desc:"80%+ average over 3 quizzes",    check:s=>s.avgScore>=80&&s.quizzesTaken>=3},
  {id:"scholar",      icon:"🎓", title:"Scholar",       desc:"Complete 10 quizzes",             check:s=>s.quizzesTaken>=10},
  {id:"chatterbox",   icon:"🗣️", title:"Chatterbox",   desc:"Ask 50 AI questions",             check:s=>s.questionsAsked>=50},
];
const achvKey = email => `learngpt:achievements:${email}`;
function getUnlocked(email) {
  try { return JSON.parse(localStorage.getItem(achvKey(email))||'[]'); } catch { return []; }
}
function checkAndUnlock(email, stats) {
  try {
    const unlocked = getUnlocked(email);
    const newOnes = [];
    ACHIEVEMENTS_DEF.forEach(a => { if (!unlocked.includes(a.id) && a.check(stats)) { unlocked.push(a.id); newOnes.push(a); } });
    if (newOnes.length) localStorage.setItem(achvKey(email), JSON.stringify(unlocked));
    return newOnes;
  } catch { return []; }
}

// ═══════════════════════════════════════════════════════════════
// 📅 ACTIVITY TRACKER (for heatmap)
// ═══════════════════════════════════════════════════════════════
const activityKey = email => `learngpt:activity:${email}`;
function logActivity(email, n=1) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const raw = localStorage.getItem(activityKey(email));
    const data = raw ? JSON.parse(raw) : {};
    data[today] = (data[today]||0) + n;
    localStorage.setItem(activityKey(email), JSON.stringify(data));
  } catch {}
}
function getActivity(email) {
  try { return JSON.parse(localStorage.getItem(activityKey(email))||'{}'); } catch { return {}; }
}

// AI SUMMARY cache key
const summaryKey = docId => `learngpt:summary:${docId}`;

// ═══════════════════════════════════════════════════════════════
// AI FUNCTION
// ═══════════════════════════════════════════════════════════════
async function claude(messages, system="", retries=3) {
  rlTrack();
  for (let i=0; i<retries; i++) {
    try {
      const r = await fetch("/.netlify/functions/chat", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ model:"llama-3.1-8b-instant", max_tokens:1000, system, messages })
      });
      if (!r.ok) {
        const err = await r.json().catch(()=>({}));
        if (r.status===429 && i<retries-1) { await new Promise(res=>setTimeout(res,2000*(i+1))); continue; }
        return `Error ${r.status}: ${err.error?.message||r.statusText}`;
      }
      const d = await r.json();
      return d.content?.[0]?.text || d.choices?.[0]?.message?.content || "No response received";
    } catch(e) {
      if (i===retries-1) return `Error: ${e.message}`;
      await new Promise(res=>setTimeout(res,1500));
    }
  }
  return "Failed after multiple attempts. Please try again.";
}

// ═══════════════════════════════════════════════════════════════
// FILE TEXT EXTRACTION
// ═══════════════════════════════════════════════════════════════
async function loadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; resolve(window.pdfjsLib); };
    s.onerror = reject;
    document.head.appendChild(s);
  });
}
async function loadMammoth() {
  if (window.mammoth) return window.mammoth;
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js";
    s.onload = () => resolve(window.mammoth);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}
async function extractText(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  try {
    if (ext==="txt") return await new Promise(res=>{const r=new FileReader();r.onload=e=>res(e.target.result.slice(0,16000));r.onerror=()=>res(`[File: ${file.name}]`);r.readAsText(file);});
    if (ext==="pdf") {
      const lib=await loadPdfJs(); const buf=await file.arrayBuffer();
      const pdf=await lib.getDocument({data:buf}).promise; let text="";
      for(let i=1;i<=Math.min(pdf.numPages,40);i++){const pg=await pdf.getPage(i);const ct=await pg.getTextContent();text+=`\n[Page ${i}]\n`+ct.items.map(x=>x.str).join(" ");}
      return text.slice(0,16000);
    }
    if (ext==="docx"||ext==="doc") {
      try { const mammoth=await loadMammoth(); const buf=await file.arrayBuffer(); const result=await mammoth.extractRawText({arrayBuffer:buf}); if(result.value&&result.value.length>50) return result.value.slice(0,16000); } catch(e){console.warn("mammoth failed",e);}
      return await new Promise(res=>{const r=new FileReader();r.onload=e=>{const bytes=new Uint8Array(e.target.result);let text="",run="";for(let i=0;i<bytes.length;i++){const c=bytes[i];if(c>=32&&c<127){run+=String.fromCharCode(c);}else{if(run.length>4)text+=run+" ";run="";}}if(run.length>4)text+=run;const cleaned=text.replace(/<[^>]{0,200}>/g," ").replace(/\w+:\w+="[^"]*"/g," ").replace(/[a-zA-Z]{25,}/g," ").replace(/\s{2,}/g," ").trim();const words=cleaned.split(" ").filter(w=>w.length>=2&&w.length<=25&&/[a-zA-Z]/.test(w)).join(" ").slice(0,16000);res(words.length>100?words:`[Document: "${file.name}" — please convert to PDF for better results]`);};r.onerror=()=>res(`[File: ${file.name}]`);r.readAsArrayBuffer(file);});
    }
    if (ext==="pptx") {
      return await new Promise(res=>{const r=new FileReader();r.onload=e=>{const bytes=new Uint8Array(e.target.result);let text="",run="";for(let i=0;i<bytes.length;i++){const c=bytes[i];if(c>=32&&c<127){run+=String.fromCharCode(c);}else{if(run.length>3)text+=run+" ";run="";}}const cleaned=text.replace(/<[^>]{0,120}>/g," ").replace(/\s{3,}/g," ").trim().slice(0,16000);res(cleaned.length>100?cleaned:`[PPTX: ${file.name}]`);};r.onerror=()=>res(`[File: ${file.name}]`);r.readAsArrayBuffer(file);});
    }
  } catch(e) { console.warn("extraction failed",e); }
  return `[Document: "${file.name}" (${fmtSize(file.size)}) — could not extract text.]`;
}

// ═══════════════════════════════════════════════════════════════
// MARKDOWN RENDERER
// ═══════════════════════════════════════════════════════════════
function renderMarkdown(text) {
  if (!text) return null;
  return text.split("\n").map((line,i) => {
    if (line.startsWith("[Source:")) return <div key={i} style={{marginTop:8,padding:"5px 10px",background:"#6366f118",border:"1px solid #6366f133",borderRadius:6,fontSize:12,color:"#818cf8"}}>{line}</div>;
    if (line.startsWith("## "))  return <div key={i} style={{fontWeight:700,fontSize:16,marginTop:14,marginBottom:4,color:"var(--text)"}}>{parseBold(line.slice(3))}</div>;
    if (line.startsWith("### ")) return <div key={i} style={{fontWeight:600,fontSize:14,marginTop:10,marginBottom:3,color:"var(--text)"}}>{parseBold(line.slice(4))}</div>;
    if (line.match(/^[\*\-\+] /)) return <div key={i} style={{paddingLeft:16,marginTop:3,display:"flex",gap:8}}><span style={{color:"#6366f1",flexShrink:0}}>•</span><span>{parseBold(line.slice(2))}</span></div>;
    if (line.match(/^\d+\. /)) { const num=line.match(/^(\d+)\. /)[1]; return <div key={i} style={{paddingLeft:16,marginTop:3,display:"flex",gap:8}}><span style={{color:"#6366f1",flexShrink:0,minWidth:18}}>{num}.</span><span>{parseBold(line.slice(num.length+2))}</span></div>; }
    if (line.trim()==="") return <div key={i} style={{height:6}}/>;
    return <div key={i} style={{marginTop:2,lineHeight:1.7}}>{parseBold(line)}</div>;
  });
}
function parseBold(text) {
  if (!text.includes("**")&&!text.includes("`")) return text;
  const parts=[]; let i=0;
  while(i<text.length){
    if(text[i]==="*"&&text[i+1]==="*"){const end=text.indexOf("**",i+2);if(end!==-1){parts.push(<strong key={i} style={{color:"var(--text)",fontWeight:600}}>{text.slice(i+2,end)}</strong>);i=end+2;continue;}}
    if(text[i]==="`"){const end=text.indexOf("`",i+1);if(end!==-1){parts.push(<code key={i} style={{background:"var(--surface2)",padding:"1px 5px",borderRadius:4,fontSize:"0.9em",fontFamily:"'JetBrains Mono',monospace"}}>{text.slice(i+1,end)}</code>);i=end+1;continue;}}
    let j=i;while(j<text.length&&!(text[j]==="*"&&text[j+1]==="*")&&text[j]!=="`")j++;
    if(j>i)parts.push(text.slice(i,j));i=j;
  }
  return parts.length>0?parts:text;
}

// ═══════════════════════════════════════════════════════════════
// UI ATOMS
// ═══════════════════════════════════════════════════════════════
const Spinner = ({size=18}) => (
  <div style={{width:size,height:size,border:"2px solid var(--border)",borderTopColor:"#6366f1",borderRadius:"50%",animation:"spin 0.65s linear infinite",flexShrink:0}}/>
);

const PATHS = {
  home:"M3 12L12 3l9 9M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9",
  book:"M4 19.5A2.5 2.5 0 016.5 17H20M4 4h16v13H6.5A2.5 2.5 0 004 19.5V4z",
  chat:"M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
  quiz:"M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01",
  flash:"M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  chart:"M18 20V10M12 20V4M6 20v-6",
  upload:"M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12",
  logout:"M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
  send:"M22 2L11 13M22 2L15 22 11 13 2 9l20-7z",
  check:"M20 6L9 17 4 12",
  brain:"M12 2C8 2 5 5 5 9c0 2 1 4 2 5l1 1v3h8v-3l1-1c1-1 2-3 2-5 0-4-3-7-7-7z",
  sparkle:"M12 3l1.5 4.5H18l-3.75 2.75 1.5 4.5L12 12.5l-3.75 2.25 1.5-4.5L6 7.5h4.5L12 3z",
  search:"M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  menu:"M4 6h16M4 12h16M4 18h16",
  trash:"M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z",
  file:"M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 2v6h6",
  alert:"M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01",
  arrow:"M5 12h14M12 5l7 7-7 7",
  back:"M19 12H5M12 19l-7-7 7-7",
  lock:"M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4",
  shield:"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  users:"M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
  eye:"M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 100 6 3 3 0 000-6z",
  eyeoff:"M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22",
  x:"M18 6L6 18M6 6l12 12",
  sun:"M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M12 5a7 7 0 100 14A7 7 0 0012 5z",
  moon:"M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z",
  bell:"M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0",
  notes:"M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  trophy:"M8 21h8M12 17v4M17 3H7l-2 7c0 3.87 2.24 7 5 7h4c2.76 0 5-3.13 5-7l-2-7zM5 10H3M21 10h-2",
  star:"M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  mgmt:"M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2",
};

const Ic = ({name,size=18,color="currentColor"}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d={PATHS[name]||PATHS.sparkle}/>
  </svg>
);
const Badge = ({children,color="#6366f1"}) => (
  <span style={{background:color+"22",color,border:`1px solid ${color}44`,borderRadius:999,padding:"2px 9px",fontSize:11,fontWeight:600}}>{children}</span>
);
const EmptyState = ({icon,title,sub,action,onAction}) => (
  <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"56px 24px",textAlign:"center",animation:"fade-in 0.4s ease"}}>
    <div style={{width:60,height:60,borderRadius:15,background:"#6366f118",border:"1px solid #6366f133",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:18}}>
      <Ic name={icon} size={26} color="#6366f1"/>
    </div>
    <div style={{fontSize:17,fontWeight:600,marginBottom:7,color:"var(--text)"}}>{title}</div>
    <div style={{fontSize:13.5,color:"var(--text3)",maxWidth:300,lineHeight:1.65,marginBottom:action?22:0}}>{sub}</div>
    {action&&<button onClick={onAction} style={{...btn,background:"linear-gradient(135deg,#6366f1,#818cf8)",color:"#fff",padding:"10px 22px",borderRadius:10,fontSize:13.5}}>{action}</button>}
  </div>
);

// ═══════════════════════════════════════════════════════════════
// RATE LIMIT BAR
// ═══════════════════════════════════════════════════════════════
const RateLimitBar = () => {
  const [rl, setRl] = useState({calls:0,limited:false,until:0});
  const [countdown, setCountdown] = useState(0);
  useEffect(()=>{ const unsub=rlSubscribe(s=>setRl({...s})); return unsub; },[]);
  useEffect(()=>{
    if(!rl.limited){setCountdown(0);return;}
    const t=setInterval(()=>{
      const rem=Math.ceil((rl.until-Date.now())/1000);
      if(rem<=0){setCountdown(0);clearInterval(t);}else setCountdown(rem);
    },1000);
    return ()=>clearInterval(t);
  },[rl.limited,rl.until]);
  const pct = Math.min((rl.calls/RATE_MAX)*100,100);
  const col = pct<50?"#4ade80":pct<80?"#fb923c":"#f87171";
  return (
    <div style={{padding:"6px 14px 2px"}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--text3)",marginBottom:3}}>
        <span>AI Usage {rl.limited?"⏸ Limited":""}</span>
        <span style={{color:col}}>{rl.calls}/{RATE_MAX}{rl.limited&&countdown>0?` (${countdown}s)`:""}</span>
      </div>
      <div style={{height:3,background:"var(--border)",borderRadius:999,overflow:"hidden",marginBottom:6}}>
        <div style={{height:"100%",width:`${pct}%`,background:col,borderRadius:999,transition:"width 0.4s ease"}}/>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// SVG CHART COMPONENTS
// ═══════════════════════════════════════════════════════════════
const LineChart = ({data, color="#6366f1", height=100}) => {
  if (!data||data.length<2) return <div style={{height,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--text3)",fontSize:12}}>Not enough data yet</div>;
  const max=Math.max(...data,100); const min=Math.min(...data,0); const range=max-min||1;
  const W=300; const H=height;
  const pts=data.map((v,i)=>`${(i/(data.length-1))*W},${H-((v-min)/range)*H*0.85-H*0.05}`).join(" ");
  const fillPts=`0,${H} ${pts} ${W},${H}`;
  const gid=`lg${color.replace("#","")}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height}} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polygon points={fillPts} fill={`url(#${gid})`}/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {data.map((v,i)=>(
        <circle key={i} cx={(i/(data.length-1))*W} cy={H-((v-min)/range)*H*0.85-H*0.05} r="3.5" fill={color} stroke="var(--bg2)" strokeWidth="1.5"/>
      ))}
    </svg>
  );
};

const BarChart = ({data, color="#6366f1", height=80}) => {
  if (!data||data.length===0) return null;
  const max=Math.max(...data.map(d=>d.v),1);
  return (
    <div style={{display:"flex",alignItems:"flex-end",gap:4,height,padding:"0 2px"}}>
      {data.map((d,i)=>(
        <div key={i} title={`${d.label}: ${d.v}`} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,height:"100%",justifyContent:"flex-end"}}>
          <div style={{width:"100%",background:`linear-gradient(to top,${color},${color}88)`,borderRadius:"3px 3px 0 0",height:`${(d.v/max)*85}%`,minHeight:2,transition:"height 0.5s ease"}}/>
          <span style={{fontSize:9,color:"var(--text3)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"100%",textAlign:"center"}}>{d.label}</span>
        </div>
      ))}
    </div>
  );
};

const DonutChart = ({data, size=100}) => {
  const total=data.reduce((s,d)=>s+d.v,0)||1;
  const R=40; const cx=50; const cy=50; let offset=-Math.PI/2;
  const slices=data.map(d=>{
    const angle=(d.v/total)*Math.PI*2;
    const x1=cx+R*Math.cos(offset); const y1=cy+R*Math.sin(offset);
    offset+=angle;
    const x2=cx+R*Math.cos(offset); const y2=cy+R*Math.sin(offset);
    const large=angle>Math.PI?1:0;
    return {path:`M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`,color:d.color,label:d.label,v:d.v};
  });
  return (
    <div style={{display:"flex",alignItems:"center",gap:16}}>
      <svg viewBox="0 0 100 100" width={size} height={size} style={{flexShrink:0}}>
        {slices.map((s,i)=><path key={i} d={s.path} fill={s.color} opacity="0.85"/>)}
        <circle cx={cx} cy={cy} r={22} fill="var(--bg2)"/>
        <text x={cx} y={cy+1} textAnchor="middle" dominantBaseline="middle" fill="var(--text)" fontSize="10" fontWeight="600">{total}</text>
      </svg>
      <div style={{display:"flex",flexDirection:"column",gap:5}}>
        {slices.map((s,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:6,fontSize:12}}>
            <div style={{width:8,height:8,borderRadius:2,background:s.color,flexShrink:0}}/>
            <span style={{color:"var(--text2)"}}>{s.label}</span>
            <span style={{color:"var(--text3)",marginLeft:"auto",paddingLeft:8}}>{Math.round((s.v/total)*100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// 🏅 ACHIEVEMENT TOAST
// ═══════════════════════════════════════════════════════════════
const AchievementToast = ({achievements, onDismiss}) => {
  const [idx,setIdx] = useState(0);
  if (!achievements?.length) return null;
  const a = achievements[idx];
  return (
    <div style={{position:"fixed",bottom:90,right:24,zIndex:9999,background:"linear-gradient(135deg,#6366f1,#22d3ee)",borderRadius:16,padding:"16px 20px",minWidth:265,boxShadow:"0 20px 60px rgba(99,102,241,0.45)",animation:"fade-in 0.4s ease",color:"#fff",display:"flex",alignItems:"center",gap:12}}>
      <div style={{fontSize:34,lineHeight:1,flexShrink:0}}>{a.icon}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:10.5,opacity:0.85,marginBottom:3,fontWeight:700,letterSpacing:"0.07em"}}>ACHIEVEMENT UNLOCKED 🎉</div>
        <div style={{fontSize:15,fontWeight:700,marginBottom:1}}>{a.title}</div>
        <div style={{fontSize:12,opacity:0.85}}>{a.desc}</div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:5,flexShrink:0}}>
        {idx<achievements.length-1&&<button onClick={()=>setIdx(idx+1)} style={{...btn,background:"rgba(255,255,255,0.22)",color:"#fff",padding:"4px 8px",borderRadius:6,fontSize:11,fontWeight:600}}>Next</button>}
        <button onClick={onDismiss} style={{...btn,background:"rgba(255,255,255,0.22)",color:"#fff",padding:"4px 8px",borderRadius:6,fontSize:11}}>✕ Close</button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// ⏱ STUDY TIMER (Pomodoro)
// ═══════════════════════════════════════════════════════════════
const StudyTimer = ({onStudyComplete}) => {
  const [open,setOpen]       = useState(false);
  const [mode,setMode]       = useState("focus");
  const [secs,setSecs]       = useState(25*60);
  const [running,setRunning] = useState(false);
  const [sessions,setSessions] = useState(0);
  const {send} = useNotif();
  const FOCUS=25*60, BREAK=5*60;
  const total = mode==="focus"?FOCUS:BREAK;
  const pct   = ((total-secs)/total)*100;
  const R=48; const C=2*Math.PI*R;
  const dashOffset = C-(pct/100)*C;

  useEffect(()=>{
    if(!running) return;
    const t=setInterval(()=>{
      setSecs(s=>{
        if(s<=1){
          clearInterval(t); setRunning(false);
          if(mode==="focus"){
            setSessions(n=>n+1); onStudyComplete?.();
            send("Focus session done! 🎯","Time for a 5-minute break.");
            setMode("break"); setSecs(BREAK);
          } else {
            send("Break over! 📚","Ready for another focus session?");
            setMode("focus"); setSecs(FOCUS);
          }
          return 0;
        }
        return s-1;
      });
    },1000);
    return ()=>clearInterval(t);
  },[running,mode]); // eslint-disable-line

  const fmt = s=>`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
  const reset=()=>{setRunning(false);setSecs(mode==="focus"?FOCUS:BREAK);};
  const ringColor = mode==="focus"?"#6366f1":"#4ade80";

  return (
    <>
      <button onClick={()=>setOpen(!open)} title="Study Timer" style={{...btn,position:"fixed",bottom:open?370:24,right:24,zIndex:8000,width:50,height:50,borderRadius:"50%",background:running?`linear-gradient(135deg,${ringColor},#22d3ee)`:"linear-gradient(135deg,#6366f1,#818cf8)",color:"#fff",fontSize:18,boxShadow:"0 4px 24px rgba(99,102,241,0.45)",transition:"all 0.3s",display:"flex",alignItems:"center",justifyContent:"center"}}>
        {running?"⏸":"⏱"}
      </button>
      {open&&(
        <div style={{position:"fixed",bottom:86,right:24,zIndex:8000,background:"var(--bg2)",border:"1px solid var(--border2)",borderRadius:20,padding:22,width:220,boxShadow:"0 20px 60px rgba(0,0,0,0.35)",animation:"fade-in 0.2s ease"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <span style={{fontSize:13,fontWeight:700,color:"var(--text)"}}>Pomodoro Timer</span>
            <div style={{display:"flex",gap:5}}>
              {[["focus","🎯"],["break","☕"]].map(([m,em])=>(
                <button key={m} onClick={()=>{setMode(m);setRunning(false);setSecs(m==="focus"?FOCUS:BREAK);}}
                  style={{...btn,padding:"3px 8px",borderRadius:6,fontSize:10.5,fontWeight:600,background:mode===m?"#6366f133":"transparent",border:`1px solid ${mode===m?"#6366f166":"var(--border)"}`,color:mode===m?"#818cf8":"var(--text3)"}}>
                  {em} {m}
                </button>
              ))}
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"center",margin:"8px 0 14px"}}>
            <svg width={120} height={120} viewBox="0 0 120 120">
              <circle cx={60} cy={60} r={R} fill="none" stroke="var(--border)" strokeWidth={8}/>
              <circle cx={60} cy={60} r={R} fill="none" stroke={ringColor} strokeWidth={8}
                strokeDasharray={C} strokeDashoffset={dashOffset}
                strokeLinecap="round" transform="rotate(-90 60 60)"
                style={{transition:"stroke-dashoffset 1s linear"}}/>
              <text x={60} y={55} textAnchor="middle" fill="var(--text)" fontSize="20" fontWeight="700" fontFamily="JetBrains Mono,monospace">{fmt(secs)}</text>
              <text x={60} y={72} textAnchor="middle" fill="var(--text3)" fontSize="9" fontWeight="600">{mode.toUpperCase()}</text>
            </svg>
          </div>
          <div style={{display:"flex",gap:7,justifyContent:"center",marginBottom:10}}>
            <button onClick={()=>setRunning(!running)} style={{...btn,background:`linear-gradient(135deg,${ringColor},#22d3ee)`,color:"#fff",padding:"8px 20px",borderRadius:10,fontSize:13,fontWeight:600}}>{running?"Pause":"Start"}</button>
            <button onClick={reset} style={{...btn,...glass(9),padding:"8px 11px",fontSize:13,color:"var(--text3)"}}>↺</button>
          </div>
          <div style={{textAlign:"center",fontSize:11.5,color:"var(--text3)"}}>🎯 {sessions} session{sessions!==1?"s":""} done today</div>
        </div>
      )}
    </>
  );
};

// ═══════════════════════════════════════════════════════════════
// 📅 STUDY HEATMAP
// ═══════════════════════════════════════════════════════════════
const StudyHeatmap = ({email}) => {
  const activity = getActivity(email);
  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr = today.toISOString().split('T')[0];
  const start = new Date(today); start.setDate(start.getDate()-14*7-start.getDay());
  const weeks = Array.from({length:15},(_,w)=>Array.from({length:7},(_,d)=>{
    const date=new Date(start); date.setDate(start.getDate()+w*7+d);
    const key=date.toISOString().split('T')[0];
    return {key,count:activity[key]||0,future:date>today,isToday:key===todayStr,month:date.getMonth()};
  }));
  const totalActions = Object.values(activity).reduce((s,v)=>s+v,0);
  const activeDays = Object.keys(activity).filter(k=>activity[k]>0).length;
  const getCol=(c,future)=>future?"transparent":c===0?"var(--surface2)":c<=2?"#6366f140":c<=5?"#6366f188":"#6366f1";
  const DAYS=["S","M","T","W","T","F","S"];
  return (
    <div style={{...glass(),padding:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <h3 style={{fontWeight:600,fontSize:15,color:"var(--text)"}}>Study Activity</h3>
        <div style={{display:"flex",gap:12,fontSize:12,color:"var(--text3)"}}>
          <span>📅 {activeDays} days active</span>
          <span>⚡ {totalActions} total actions</span>
        </div>
      </div>
      <div style={{display:"flex",gap:3,overflowX:"auto",paddingBottom:4}}>
        <div style={{display:"flex",flexDirection:"column",gap:2.5,marginRight:4,paddingTop:0}}>
          {DAYS.map((d,i)=>(<div key={i} style={{height:11,fontSize:9,color:"var(--text3)",lineHeight:"11px",textAlign:"right",minWidth:8}}>{i%2===0?d:""}</div>))}
        </div>
        {weeks.map((week,wi)=>(
          <div key={wi} style={{display:"flex",flexDirection:"column",gap:2.5}}>
            {week.map((day,di)=>(
              <div key={di} title={`${day.key}: ${day.count} action${day.count!==1?"s":""}`}
                style={{width:11,height:11,borderRadius:2,background:getCol(day.count,day.future),border:day.isToday?"1.5px solid #6366f1":"none",flexShrink:0,cursor:"default"}}/>
            ))}
          </div>
        ))}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:4,marginTop:10,justifyContent:"flex-end"}}>
        <span style={{fontSize:10,color:"var(--text3)"}}>Less</span>
        {[0,2,4,7].map(v=>(<div key={v} style={{width:10,height:10,borderRadius:2,background:getCol(v,false)}}/>))}
        <span style={{fontSize:10,color:"var(--text3)"}}>More</span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// 🧠 WEAK TOPICS ANALYZER
// ═══════════════════════════════════════════════════════════════
const WeakTopicsBox = ({questions, answers, doc}) => {
  const [topics,setTopics] = useState(null);
  const [loading,setLoading] = useState(false);
  const wrongQs = questions.filter((q,i)=>answers[i]!==q.ans);
  const analyze = async () => {
    if(!wrongQs.length) return;
    setLoading(true);
    if(!rlCanCall()){setLoading(false);return;}
    const wrongText=wrongQs.map(q=>`Q: ${q.q}\nCorrect: ${q.opts[q.ans]}\nStudent chose: ${q.opts[answers[questions.indexOf(q)]]||"nothing"}`).join('\n\n');
    const res=await claude([{role:"user",content:`Based on wrong quiz answers for "${doc}", identify 2-3 specific topics to review. Return ONLY JSON:\n[{"topic":"name","tip":"one study tip"}]\n\nWrong answers:\n${wrongText}`}],"Return ONLY valid JSON array, no markdown.");
    try{const clean=res.replace(/```json|```/g,'').trim();setTopics(JSON.parse(clean));}catch{setTopics([]);}
    setLoading(false);
  };
  if(!wrongQs.length) return <div style={{marginTop:10,padding:"9px 12px",background:"#4ade8011",border:"1px solid #4ade8033",borderRadius:8,fontSize:13,color:"#4ade80",display:"flex",alignItems:"center",gap:7}}><span>🎉</span> No weak areas — excellent work!</div>;
  return (
    <div style={{marginTop:12}}>
      {!topics&&!loading&&(<button onClick={analyze} style={{...btn,width:"100%",background:"#6366f118",border:"1px solid #6366f133",color:"#818cf8",padding:"9px",borderRadius:9,fontSize:13,fontWeight:500,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Ic name="brain" size={13} color="#818cf8"/>Analyze My Weak Topics</button>)}
      {loading&&<div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",fontSize:13,color:"var(--text3)"}}><Spinner size={13}/>Analyzing your answers…</div>}
      {topics&&topics.length>0&&(
        <div style={{background:"#fb923c0d",border:"1px solid #fb923c33",borderRadius:9,padding:14}}>
          <div style={{fontSize:13,fontWeight:600,color:"#fb923c",marginBottom:10,display:"flex",alignItems:"center",gap:6}}><span>📚</span> Topics to Review</div>
          {topics.map((t,i)=>(
            <div key={i} style={{marginBottom:8,paddingBottom:8,borderBottom:i<topics.length-1?"1px solid #fb923c22":"none"}}>
              <div style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>{t.topic}</div>
              <div style={{fontSize:12,color:"var(--text2)",marginTop:2}}>💡 {t.tip}</div>
            </div>
          ))}
        </div>
      )}
      {topics&&topics.length===0&&<div style={{fontSize:13,color:"var(--text3)",padding:"8px 0"}}>Could not analyze — try again later.</div>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// 📄 AI DOCUMENT SUMMARY
// ═══════════════════════════════════════════════════════════════
const DocSummary = ({doc}) => {
  const [summary,setSummary] = useState(()=>{try{const s=localStorage.getItem(summaryKey(doc.id));return s?JSON.parse(s):null;}catch{return null;}});
  const [loading,setLoading] = useState(false);
  const [expanded,setExpanded] = useState(false);
  const generate = async () => {
    setLoading(true);
    if(!rlCanCall()){setLoading(false);alert("Rate limit reached. Please wait.");return;}
    const res=await claude([{role:"user",content:`Create a structured educational summary of this document:\n1) **Overview** (2-3 sentences)\n2) **Key Topics** (5-6 bullet points)\n3) **Important Terms** (3-4 definitions)\n\nDocument: "${doc.name}"\nContent:\n${doc.text.slice(0,10000)}`}],"You are an educational summarizer. Use markdown formatting: ## headings, **bold**, - bullets.");
    setSummary(res);
    try{localStorage.setItem(summaryKey(doc.id),JSON.stringify(res));}catch{}
    setLoading(false); setExpanded(true);
  };
  return (
    <div style={{marginTop:10}}>
      {!summary&&!loading&&(<button onClick={generate} style={{...btn,...glass(8),padding:"6px 13px",fontSize:12,color:"#22d3ee",display:"flex",alignItems:"center",gap:5}}><Ic name="sparkle" size={12} color="#22d3ee"/>AI Summary</button>)}
      {loading&&<div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:"var(--text3)",padding:"6px 0"}}><Spinner size={12}/>Generating summary…</div>}
      {summary&&(
        <div>
          <button onClick={()=>setExpanded(!expanded)} style={{...btn,...glass(8),padding:"5px 11px",fontSize:12,color:"#22d3ee",display:"flex",alignItems:"center",gap:5}}>
            <Ic name={expanded?"x":"eye"} size={11} color="#22d3ee"/>{expanded?"Hide":"Show"} AI Summary
          </button>
          {expanded&&(<div style={{...glass(10),padding:14,marginTop:8,fontSize:13,color:"var(--text2)",lineHeight:1.75}}>{renderMarkdown(summary)}</div>)}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// ONBOARDING TOUR
// ═══════════════════════════════════════════════════════════════
const TOUR_STUDENT = [
  {title:"Welcome to LearnGPT! 🎉", body:"Your AI-powered study platform. This quick tour shows the key features — takes under a minute!"},
  {title:"📚 Document Library", body:"Browse all study materials your admin uploaded. Click any doc to open it in the AI Tutor."},
  {title:"🤖 AI Tutor", body:"Ask questions about your study materials. The AI answers ONLY from uploaded documents — no hallucinations!"},
  {title:"📝 My Notes", body:"Write private notes for each document. Only you can see them — saved securely in your browser."},
  {title:"⚡ Flashcards", body:"Generate AI flashcards from any document. Flip cards and mark what you've mastered."},
  {title:"🎯 Quiz", body:"Test yourself with AI-generated MCQs. Choose Easy / Medium / Hard. Results feed into your Progress."},
  {title:"🏆 Leaderboard", body:"See how you rank against other students. Earn points by taking quizzes and asking questions!"},
  {title:"You're all set! 🚀", body:"Start in the Document Library, then chat with a doc. Good luck studying — you've got this!"},
];
const TOUR_ADMIN = [
  {title:"Welcome, Admin! 👑", body:"You're in charge of LearnGPT. Here's a quick walkthrough of your tools."},
  {title:"📤 Upload Documents", body:"Upload PDFs, DOCX, PPTX, or TXT files. Text is extracted, chunked, and indexed for AI instantly."},
  {title:"📊 Analytics", body:"Real-time charts: quiz score trends, document chunk sizes, and activity breakdown."},
  {title:"🗂 Quiz Management", body:"See every quiz attempt across all students. Filter by doc or difficulty, view score distributions."},
  {title:"👥 Student Progress", body:"Track every student's questions asked, quizzes taken, average scores, and last active time."},
  {title:"You're all set! 🚀", body:"Upload your first document and share the link with students. They'll be learning in minutes!"},
];

const OnboardingTour = ({onComplete, isAdmin}) => {
  const [step, setStep] = useState(0);
  const steps = isAdmin ? TOUR_ADMIN : TOUR_STUDENT;
  const cur = steps[step];
  return (
    <div style={{position:"fixed",inset:0,zIndex:9000,pointerEvents:"none"}}>
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",pointerEvents:"all"}}/>
      <div style={{position:"fixed",bottom:28,right:28,zIndex:9001,background:"var(--bg2)",border:"1px solid var(--border2)",borderRadius:16,padding:24,width:310,boxShadow:"0 20px 60px rgba(0,0,0,0.45)",animation:"fade-in 0.3s ease",pointerEvents:"all"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
          <div style={{width:38,height:38,borderRadius:10,background:"linear-gradient(135deg,#6366f1,#22d3ee)",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <Ic name="brain" size={17} color="#fff"/>
          </div>
          <button onClick={onComplete} style={{...btn,background:"none",color:"var(--text3)",padding:3}}>
            <Ic name="x" size={16}/>
          </button>
        </div>
        <h3 style={{fontSize:15,fontWeight:700,marginBottom:7,lineHeight:1.3,color:"var(--text)"}}>{cur.title}</h3>
        <p style={{fontSize:13,color:"var(--text2)",lineHeight:1.65,marginBottom:20}}>{cur.body}</p>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",gap:4}}>
            {steps.map((_,i)=>(
              <div key={i} style={{width:i===step?18:6,height:6,borderRadius:3,background:i===step?"#6366f1":"var(--border)",transition:"all 0.3s"}}/>
            ))}
          </div>
          <div style={{display:"flex",gap:7}}>
            {step>0&&<button onClick={()=>setStep(step-1)} style={{...btn,background:"var(--surface)",border:"1px solid var(--border)",color:"var(--text2)",padding:"7px 13px",borderRadius:8,fontSize:13}}>Back</button>}
            <button onClick={()=>step<steps.length-1?setStep(step+1):onComplete()} style={{...btn,background:"linear-gradient(135deg,#6366f1,#22d3ee)",color:"#fff",padding:"7px 16px",borderRadius:8,fontSize:13,fontWeight:600}}>
              {step<steps.length-1?"Next →":"Done ✓"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// LANDING
// ═══════════════════════════════════════════════════════════════
const Landing = ({onNav}) => {
  const [tick,setTick]=useState(0);
  useEffect(()=>{const t=setInterval(()=>setTick(x=>x+1),80);return()=>clearInterval(t);},[]);
  const ns=Array.from({length:10},(_,i)=>({x:50+38*Math.cos(2*Math.PI*i/10),y:50+38*Math.sin(2*Math.PI*i/10)}));
  const words=["PDF Notes","DOCX Files","PPTX Slides","Text Files"];
  const word=words[Math.floor(tick/35)%words.length];
  return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",background:"var(--bg)"}}>
      <nav style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 48px",borderBottom:"1px solid var(--border)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,background:"linear-gradient(135deg,#6366f1,#22d3ee)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center"}}><Ic name="brain" size={16} color="#fff"/></div>
          <span style={{fontWeight:700,fontSize:18,letterSpacing:"-0.02em",color:"var(--text)"}}>LearnGPT</span>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>onNav("login")} style={{...btn,...glass(8),color:"var(--text2)",padding:"8px 18px",fontSize:14}}>Sign In</button>
          <button onClick={()=>onNav("register")} style={{...btn,background:"linear-gradient(135deg,#6366f1,#818cf8)",color:"#fff",padding:"8px 20px",borderRadius:8,fontSize:14}}>Get Started</button>
        </div>
      </nav>
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"80px 24px",textAlign:"center",position:"relative"}}>
        <div style={{position:"absolute",top:"15%",left:"50%",transform:"translateX(-50%)",width:500,height:500,background:"radial-gradient(ellipse,#6366f114 0%,transparent 70%)",pointerEvents:"none"}}/>
        <div style={{width:160,height:160,marginBottom:34,animation:"float 4s ease-in-out infinite"}}>
          <svg viewBox="0 0 100 100" style={{width:"100%",height:"100%"}}>
            {ns.map((n,i)=>ns.filter((_,j)=>j!==i&&j<i+3).map((m,k)=>(<line key={`${i}-${k}`} x1={n.x} y1={n.y} x2={m.x} y2={m.y} stroke="#6366f128" strokeWidth="0.6"/>)))}
            {ns.map((n,i)=>(<circle key={i} cx={n.x} cy={n.y} r={3+(i%3)} fill={i%2===0?"#6366f1":"#22d3ee"} opacity={0.6+0.4*Math.sin(tick*0.05+i)}/>))}
            <circle cx="50" cy="50" r="9" fill="#6366f1"/><circle cx="50" cy="50" r="4" fill="#fff"/>
          </svg>
        </div>
        <div style={{display:"inline-flex",alignItems:"center",gap:7,background:"#6366f118",border:"1px solid #6366f144",borderRadius:999,padding:"5px 14px",marginBottom:18,fontSize:12,color:"#818cf8"}}>
          <Ic name="sparkle" size={12} color="#818cf8"/> RAG-powered AI tutor
        </div>
        <h1 style={{fontSize:"clamp(30px,5.5vw,62px)",fontWeight:800,letterSpacing:"-0.04em",lineHeight:1.1,marginBottom:14,maxWidth:720,color:"var(--text)"}}>
          Chat with your <span style={{background:"linear-gradient(135deg,#6366f1,#22d3ee)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{word}</span>
          <br/>using AI
        </h1>
        <p style={{fontSize:16,color:"var(--text2)",maxWidth:460,lineHeight:1.75,marginBottom:32}}>Upload your study materials. Ask questions. Get AI-generated flashcards, quizzes, and summaries — grounded in <em>your</em> documents only.</p>
        <div className="hero-btns" style={{display:"flex",gap:12,flexWrap:"wrap",justifyContent:"center"}}>
          <button onClick={()=>onNav("register")} style={{...btn,background:"linear-gradient(135deg,#6366f1,#22d3ee)",color:"#fff",padding:"13px 30px",borderRadius:12,fontSize:15,fontWeight:600,boxShadow:"0 0 28px #6366f144"}}>Start Learning Free</button>
          <button onClick={()=>onNav("login")} style={{...btn,...glass(12),color:"var(--text)",padding:"13px 26px",fontSize:15}}>Sign In</button>
        </div>
        <div className="hero-pills" style={{display:"flex",gap:9,marginTop:38,flexWrap:"wrap",justifyContent:"center"}}>
          {["PDF/DOCX/PPTX/TXT","RAG Chatbot","AI Flashcards","AI Quiz","Chat History","My Notes","Leaderboard","Dark Mode"].map(f=>(
            <span key={f} style={{...glass(999),padding:"5px 13px",fontSize:12,color:"var(--text3)"}}><span style={{color:"#4ade80",marginRight:5}}>✓</span>{f}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════
const AuthPage = ({mode,onNav,onLogin}) => {
  const [form,setForm]=useState({name:"",email:"",password:""});
  const [show,setShow]=useState(false);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  const submit=async()=>{
    setErr("");setLoading(true);
    await new Promise(r=>setTimeout(r,600));
    if(!form.email||!form.password){setErr("Please fill all fields.");setLoading(false);return;}
    if(mode==="login"){
      const adminCheck=await fetch("/.netlify/functions/admin-login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:form.email,password:form.password})});
      const adminResult=await adminCheck.json();
      if(adminResult.success){onLogin({name:"Admin",email:form.email,role:"admin"});setLoading(false);return;}
      const users=await storageLoad(USERS_KEY,{});
      const u=users[form.email.toLowerCase()];
      if(!u){setErr("No account found. Please register first.");setLoading(false);return;}
      if(u.password!==form.password){setErr("Incorrect password.");setLoading(false);return;}
      onLogin({name:u.name,email:form.email.toLowerCase(),role:"student"});
    } else {
      if(!form.name.trim()){setErr("Please enter your name.");setLoading(false);return;}
      const users=await storageLoad(USERS_KEY,{});
      if(users[form.email.toLowerCase()]){setErr("Email already registered. Sign in instead.");setLoading(false);return;}
      users[form.email.toLowerCase()]={name:form.name.trim(),password:form.password};
      await storageSave(USERS_KEY,users);
      onLogin({name:form.name.trim(),email:form.email.toLowerCase(),role:"student"});
    }
    setLoading(false);
  };
  const field=(label,key,type="text",ph="")=>(
    <div style={{marginBottom:15}}>
      <label style={{fontSize:13,color:"var(--text2)",display:"block",marginBottom:6}}>{label}</label>
      <div style={{position:"relative"}}>
        <input type={key==="password"?(show?"text":"password"):type} value={form[key]}
          onChange={e=>setForm({...form,[key]:e.target.value})} placeholder={ph}
          onKeyDown={e=>e.key==="Enter"&&submit()}
          style={{width:"100%",background:"var(--input-bg)",border:"1px solid var(--border)",borderRadius:10,padding:key==="password"?"10px 40px 10px 13px":"10px 13px",color:"var(--text)",fontSize:14,outline:"none",fontFamily:"inherit"}}/>
        {key==="password"&&<button onClick={()=>setShow(!show)} style={{...btn,position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",color:"var(--text3)",padding:3}}><Ic name={show?"eyeoff":"eye"} size={15}/></button>}
      </div>
    </div>
  );
  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:24,background:"var(--bg)"}}>
      <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 30% 50%,#6366f10d 0%,transparent 60%)",pointerEvents:"none"}}/>
      <div style={{...glass(),padding:38,width:"100%",maxWidth:410,animation:"fade-in 0.4s ease"}}>
        <button onClick={()=>onNav("landing")} style={{...btn,background:"none",color:"var(--text3)",fontSize:13,marginBottom:22,display:"flex",alignItems:"center",gap:6}}><Ic name="back" size={14}/> Back</button>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:22}}>
          <div style={{width:40,height:40,borderRadius:10,background:"linear-gradient(135deg,#6366f1,#22d3ee)",display:"flex",alignItems:"center",justifyContent:"center"}}><Ic name={mode==="login"?"lock":"brain"} size={18} color="#fff"/></div>
          <div>
            <h2 style={{fontSize:21,fontWeight:700,lineHeight:1,color:"var(--text)"}}>{mode==="login"?"Welcome back":"Create account"}</h2>
            <p style={{color:"var(--text3)",fontSize:13,marginTop:3}}>{mode==="login"?"Sign in to continue":"Free forever — no credit card"}</p>
          </div>
        </div>
        {mode==="register"&&field("Full Name","name","text","Your name")}
        {field("Email","email","email","you@example.com")}
        {field("Password","password","password","••••••••")}
        {err&&<div style={{color:"#f87171",fontSize:13,marginBottom:13,display:"flex",alignItems:"center",gap:6,padding:"8px 12px",background:"#f8717111",borderRadius:8,border:"1px solid #f8717133"}}><Ic name="alert" size={13} color="#f87171"/>{err}</div>}
        <button onClick={submit} disabled={loading} style={{...btn,width:"100%",background:"linear-gradient(135deg,#6366f1,#22d3ee)",color:"#fff",padding:"11px",borderRadius:10,fontSize:14.5,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:loading?0.8:1}}>
          {loading?<Spinner size={16}/>:mode==="login"?"Sign In →":"Create Account →"}
        </button>
        <div style={{textAlign:"center",marginTop:16,fontSize:13.5,color:"var(--text3)"}}>
          {mode==="login"?<>No account? <button onClick={()=>onNav("register")} style={{...btn,background:"none",color:"#818cf8",padding:0}}>Register free</button></>:<>Have an account? <button onClick={()=>onNav("login")} style={{...btn,background:"none",color:"#818cf8",padding:0}}>Sign In</button></>}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// LAYOUT
// ═══════════════════════════════════════════════════════════════
const NAV_STUDENT = [
  {id:"dashboard",  label:"Dashboard",  icon:"home"},
  {id:"documents",  label:"Library",    icon:"book"},
  {id:"chat",       label:"AI Tutor",   icon:"chat"},
  {id:"notes",      label:"My Notes",   icon:"notes"},
  {id:"flashcards", label:"Flashcards", icon:"flash"},
  {id:"quiz",       label:"Quiz",       icon:"quiz"},
  {id:"leaderboard",label:"Leaderboard",icon:"trophy"},
  {id:"progress",   label:"Progress",   icon:"chart"},
];
const NAV_ADMIN = [
  {id:"dashboard", label:"Dashboard", icon:"home"},
  {id:"upload",    label:"Upload",    icon:"upload"},
  {id:"documents", label:"Documents", icon:"book"},
  {id:"analytics", label:"Analytics", icon:"chart"},
  {id:"quiz-mgmt", label:"Quiz Mgmt", icon:"mgmt"},
  {id:"users",     label:"Students",  icon:"users"},
];

const Layout = ({user,page,setPage,onLogout,children,onStartTour}) => {
  const nav = user.role==="admin" ? NAV_ADMIN : NAV_STUDENT;
  const {mode,toggle} = useTheme();
  const {permission,request,send} = useNotif();
  const [col,setCol]     = useState(false);
  const [notifDot,setNotifDot] = useState(permission==="default");

  const handleNotifClick = async () => {
    const granted = await request();
    setNotifDot(false);
    if (granted) send("LearnGPT 🎉","Notifications enabled! You'll get alerts for quiz results.");
  };

  return (
    <div style={{display:"flex",minHeight:"100vh",background:"var(--bg)"}}>
      <aside className="desktop-sidebar" style={{width:col?58:222,flexShrink:0,borderRight:"1px solid var(--border)",flexDirection:"column",transition:"width 0.22s",overflow:"hidden",position:"sticky",top:0,height:"100vh",background:"var(--bg2)"}}>
        {/* Header */}
        <div style={{padding:col?"14px 10px":"14px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:9,overflow:"hidden"}}>
            <div style={{width:30,height:30,background:"linear-gradient(135deg,#6366f1,#22d3ee)",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Ic name="brain" size={14} color="#fff"/></div>
            {!col&&<span style={{fontWeight:700,fontSize:15,letterSpacing:"-0.02em",whiteSpace:"nowrap",color:"var(--text)"}}>LearnGPT</span>}
          </div>
          <button onClick={()=>setCol(!col)} style={{...btn,background:"none",color:"var(--text3)",padding:3,flexShrink:0}}><Ic name="menu" size={15}/></button>
        </div>

        {/* Rate limit */}
        {!col && <RateLimitBar/>}

        {/* Nav */}
        <nav style={{flex:1,padding:"8px 6px",overflowY:"auto"}}>
          {nav.map(item=>(
            <button key={item.id} onClick={()=>setPage(item.id)}
              style={{...btn,width:"100%",display:"flex",alignItems:"center",gap:10,padding:col?"10px 11px":"10px 12px",borderRadius:9,marginBottom:2,background:page===item.id?"#6366f122":"transparent",justifyContent:col?"center":"flex-start"}}>
              <Ic name={item.icon} size={16} color={page===item.id?"#818cf8":"var(--text3)"}/>
              {!col&&<span style={{fontSize:13.5,fontWeight:page===item.id?600:400,whiteSpace:"nowrap",color:page===item.id?"#818cf8":"var(--text2)"}}>{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div style={{padding:"8px 6px",borderTop:"1px solid var(--border)"}}>
          {/* Icon bar */}
          {!col&&(
            <div style={{display:"flex",gap:5,padding:"4px 6px 8px",justifyContent:"flex-start"}}>
              <button onClick={toggle} title={mode==="dark"?"Light mode":"Dark mode"}
                style={{...btn,width:28,height:28,borderRadius:7,background:"var(--surface)",border:"1px solid var(--border)",color:"var(--text2)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <Ic name={mode==="dark"?"sun":"moon"} size={13}/>
              </button>
              <button onClick={handleNotifClick} title={permission==="granted"?"Notifications on":"Enable notifications"}
                style={{...btn,width:28,height:28,borderRadius:7,background:permission==="granted"?"#6366f122":"var(--surface)",border:`1px solid ${permission==="granted"?"#6366f144":"var(--border)"}`,color:permission==="granted"?"#818cf8":"var(--text2)",display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
                <Ic name="bell" size={13} color={permission==="granted"?"#818cf8":undefined}/>
                {notifDot&&<div style={{position:"absolute",top:4,right:4,width:5,height:5,borderRadius:"50%",background:"#f87171"}}/>}
              </button>
              <button onClick={onStartTour} title="Start tour"
                style={{...btn,width:28,height:28,borderRadius:7,background:"var(--surface)",border:"1px solid var(--border)",color:"var(--text2)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <Ic name="sparkle" size={13}/>
              </button>
            </div>
          )}
          {col&&(
            <button onClick={toggle} style={{...btn,width:"100%",display:"flex",alignItems:"center",justifyContent:"center",padding:"8px",borderRadius:9,background:"transparent",color:"var(--text3)",marginBottom:4}}>
              <Ic name={mode==="dark"?"sun":"moon"} size={15}/>
            </button>
          )}
          {/* User info */}
          {!col&&(
            <div style={{padding:"7px 10px",marginBottom:5,display:"flex",alignItems:"center",gap:9}}>
              <div style={{width:28,height:28,borderRadius:7,background:user.role==="admin"?"#fb923c33":"#6366f133",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:user.role==="admin"?"#fb923c":"#818cf8",fontSize:12,flexShrink:0}}>{user.name[0].toUpperCase()}</div>
              <div style={{overflow:"hidden"}}>
                <div style={{fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"var(--text)"}}>{user.name}</div>
                <Badge color={user.role==="admin"?"#fb923c":"#6366f1"}>{user.role}</Badge>
              </div>
            </div>
          )}
          <button onClick={onLogout} style={{...btn,width:"100%",display:"flex",alignItems:"center",gap:9,padding:col?"10px 11px":"10px 12px",borderRadius:9,background:"transparent",color:"var(--text3)",justifyContent:col?"center":"flex-start"}}>
            <Ic name="logout" size={15} color="var(--text3)"/>
            {!col&&<span style={{fontSize:13.5,color:"var(--text2)"}}>Sign Out</span>}
          </button>
        </div>
      </aside>

      <main className="main-content" style={{flex:1,overflow:"auto",minWidth:0,background:"var(--bg)"}}>
        {children}
      </main>

      {/* Mobile bottom nav */}
      <div className="bottom-nav">
        <div className="bottom-nav-inner">
          {nav.slice(0,5).map(item=>(
            <button key={item.id} className="bottom-nav-item" onClick={()=>setPage(item.id)}
              style={{color:page===item.id?"#818cf8":"var(--text3)",background:page===item.id?"#6366f122":"transparent"}}>
              <Ic name={item.icon} size={20} color={page===item.id?"#818cf8":"var(--text3)"}/>
              <span style={{color:page===item.id?"#818cf8":"var(--text3)"}}>{item.label}</span>
            </button>
          ))}
          <button className="bottom-nav-item" onClick={toggle} style={{color:"var(--text3)"}}>
            <Ic name={mode==="dark"?"sun":"moon"} size={20} color="var(--text3)"/>
            <span>Theme</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════
const Dashboard = ({user,docs,chatHistory,quizResults,flashcardStats,setPage,streak}) => {
  const isAdmin = user.role==="admin";
  const totalChunks = docs.reduce((s,d)=>s+(d.chunks||0),0);
  const avgQuiz = quizResults.length ? Math.round(quizResults.reduce((s,r)=>s+r.pct,0)/quizResults.length) : null;
  const unlocked = user.role==="student" ? getUnlocked(user.email) : [];
  const unlockedDefs = ACHIEVEMENTS_DEF.filter(a=>unlocked.includes(a.id));
  const stats = isAdmin
    ? [{icon:"book",label:"Documents",value:docs.length,sub:totalChunks?`${totalChunks.toLocaleString()} chunks`:"-",color:"#6366f1"},{icon:"chat",label:"Questions Asked",value:chatHistory.length,sub:"This session",color:"#22d3ee"},{icon:"quiz",label:"Quizzes Taken",value:quizResults.length,sub:avgQuiz!==null?`Avg ${avgQuiz}%`:"None yet",color:"#4ade80"},{icon:"flash",label:"Flashcard Sets",value:docs.filter(d=>d.flashcards?.length>0).length,sub:"Generated",color:"#fb923c"}]
    : [{icon:"book",label:"Docs Available",value:docs.length,sub:totalChunks?`${totalChunks.toLocaleString()} chunks`:"-",color:"#6366f1"},{icon:"chat",label:"Questions Asked",value:chatHistory.length,sub:chatHistory.length?"This session":"Ask the AI tutor!",color:"#22d3ee"},{icon:"quiz",label:"Quizzes Taken",value:quizResults.length,sub:avgQuiz!==null?`Avg ${avgQuiz}%`:"None yet",color:"#4ade80"},{icon:"flash",label:"Cards Mastered",value:`${flashcardStats.known}/${flashcardStats.total}`,sub:flashcardStats.total?"Keep going!":"Generate flashcards first",color:"#fb923c"}];
  return (
    <div className="page-padding" style={{padding:"32px 36px",maxWidth:1050,margin:"0 auto"}}>
      <div style={{marginBottom:26}}>
        <h1 style={{fontSize:25,fontWeight:700,marginBottom:4,color:"var(--text)"}}>
          {new Date().getHours()<12?"Good morning":new Date().getHours()<17?"Good afternoon":"Good evening"}, {user.name.split(" ")[0]} {isAdmin?"👑":"👋"}
        </h1>
        <p style={{color:"var(--text3)",fontSize:14}}>{isAdmin?"Admin — only you can upload documents.":"What are you learning today?"}</p>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))",gap:13,marginBottom:20}}>
        {stats.map((s,i)=>(
          <div key={i} style={{...glass(),padding:18,animation:"fade-in 0.4s ease both",animationDelay:`${i*55}ms`}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <div style={{width:35,height:35,borderRadius:8,background:s.color+"22",display:"flex",alignItems:"center",justifyContent:"center"}}><Ic name={s.icon} size={16} color={s.color}/></div>
              <span style={{fontSize:12.5,color:"var(--text2)",fontWeight:500}}>{s.label}</span>
            </div>
            <div style={{fontSize:26,fontWeight:700,color:"var(--text)"}}>{s.value}</div>
            <div style={{fontSize:12,color:"var(--text3)",marginTop:3}}>{s.sub}</div>
          </div>
        ))}
      </div>
      {/* Streak + Achievements row (students only) */}
      {!isAdmin&&(
        <div style={{display:"grid",gridTemplateColumns:"auto 1fr",gap:13,marginBottom:14}}>
          {/* Streak card */}
          <div style={{...glass(),padding:"14px 20px",display:"flex",alignItems:"center",gap:14,minWidth:180}}>
            <div style={{fontSize:36,lineHeight:1}}>{streak>=7?"🏆":streak>=3?"🔥":"⚡"}</div>
            <div>
              <div style={{fontSize:26,fontWeight:800,color:"var(--text)",lineHeight:1}}>{streak}<span style={{fontSize:14,fontWeight:500,color:"var(--text3)",marginLeft:3}}>day{streak!==1?"s":""}</span></div>
              <div style={{fontSize:12,color:"var(--text3)",marginTop:2}}>{streak===0?"Start your streak today!":streak>=7?"You're unstoppable! 🎯":"Keep it going!"}</div>
            </div>
          </div>
          {/* Achievements preview */}
          <div style={{...glass(),padding:"14px 16px",overflow:"hidden"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <span style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>Achievements</span>
              <span style={{fontSize:12,color:"var(--text3)"}}>{unlocked.length}/{ACHIEVEMENTS_DEF.length}</span>
            </div>
            <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
              {ACHIEVEMENTS_DEF.map(a=>(
                <div key={a.id} title={`${a.title}: ${a.desc}`}
                  style={{width:34,height:34,borderRadius:8,background:unlocked.includes(a.id)?"#6366f122":"var(--surface2)",border:`1px solid ${unlocked.includes(a.id)?"#6366f144":"var(--border)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,filter:unlocked.includes(a.id)?"none":"grayscale(1) opacity(0.3)",transition:"all 0.2s"}}>
                  {a.icon}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

          ?<EmptyState icon={isAdmin?"upload":"book"} title={isAdmin?"No documents yet":"Library is empty"}
              sub={isAdmin?"Upload your first document. Students can then chat with it, take quizzes, and create flashcards.":"The admin hasn't uploaded any documents yet."}
              action={isAdmin?"Upload First Document":null} onAction={()=>setPage("upload")}/>
          :<div style={{padding:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <h3 style={{fontSize:15,fontWeight:600,color:"var(--text)"}}>Recent Documents</h3>
              <button onClick={()=>setPage("documents")} style={{...btn,background:"none",color:"#818cf8",fontSize:13,display:"flex",alignItems:"center",gap:4}}>View all <Ic name="arrow" size={12} color="#818cf8"/></button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {[...docs].reverse().slice(0,4).map(doc=>(
                <div key={doc.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",borderRadius:9,background:"var(--surface2)",border:"1px solid var(--border)"}}>
                  <div style={{width:33,height:33,borderRadius:7,background:fileClr(doc.filename)+"22",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Ic name="file" size={14} color={fileClr(doc.filename)}/></div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13.5,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"var(--text)"}}>{doc.name}</div>
                    <div style={{fontSize:12,color:"var(--text3)"}}>{fmtSize(doc.size)} · {doc.chunks} chunks · {fmtDate(doc.uploadedAt)}</div>
                  </div>
                  <Badge color={fileClr(doc.filename)}>{doc.type.toUpperCase()}</Badge>
                </div>
              ))}
            </div>
            {!isAdmin&&(
              <div style={{display:"flex",gap:9,marginTop:14,flexWrap:"wrap"}}>
                {[{l:"Ask AI Tutor",i:"chat",p:"chat",c:"#6366f1"},{l:"Take a Quiz",i:"quiz",p:"quiz",c:"#fb923c"},{l:"Flashcards",i:"flash",p:"flashcards",c:"#4ade80"},{l:"Leaderboard",i:"trophy",p:"leaderboard",c:"#f59e0b"}].map(a=>(
                  <button key={a.p} onClick={()=>setPage(a.p)} style={{...btn,...glass(9),display:"flex",alignItems:"center",gap:7,padding:"8px 14px",color:"var(--text)",fontSize:13}}><Ic name={a.i} size={13} color={a.c}/>{a.l}</button>
                ))}
              </div>
            )}
          </div>}
      </div>
      {quizResults.length>=2&&(
        <div style={{...glass(),padding:20,marginTop:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <h3 style={{fontSize:15,fontWeight:600,color:"var(--text)"}}>Quiz Score Trend</h3>
            {avgQuiz!==null&&<Badge color={avgQuiz>=70?"#4ade80":"#fb923c"}>{avgQuiz}% avg</Badge>}
          </div>
          <LineChart data={quizResults.map(r=>r.pct)} color="#6366f1" height={80}/>
        </div>
      )}
      {!isAdmin&&<div style={{marginTop:14}}><StudyHeatmap email={user.email}/></div>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// UPLOAD
// ═══════════════════════════════════════════════════════════════
const Upload = ({onUpload}) => {
  const [dragging,setDragging]=useState(false);
  const [processing,setProcessing]=useState(false);
  const [stages,setStages]=useState([]);
  const [done,setDone]=useState(null);
  const inputRef=useRef(null);
  const {send}=useNotif();
  const processFile=async(file)=>{
    if(!file) return;
    const ext=file.name.split(".").pop().toLowerCase();
    if(!["pdf","docx","doc","pptx","txt"].includes(ext)){alert("Unsupported type. Upload PDF, DOCX, PPTX, or TXT.");return;}
    setProcessing(true);setStages([]);setDone(null);
    const stageList=[ext==="pdf"?"Parsing PDF pages…":ext==="docx"||ext==="doc"?"Parsing DOCX content…":ext==="pptx"?"Parsing PPTX slides…":"Reading file…","Extracting text…","Chunking document…","Generating embeddings…","Indexing in vector store…"];
    for(const s of stageList){
      setStages(prev=>[...prev,{label:s,active:true,done:false}]);
      await new Promise(r=>setTimeout(r,650+Math.random()*450));
      setStages(prev=>prev.map(x=>x.label===s?{...x,active:false,done:true}:x));
    }
    const text=await extractText(file);
    const chunks=Math.max(10,Math.floor(text.replace(/\s+/g," ").length/220));
    const doc={id:Date.now(),name:file.name.replace(/\.[^.]+$/,""),filename:file.name,size:file.size,type:ext,uploadedAt:Date.now(),chunks,text,flashcards:[]};
    setDone(doc);onUpload(doc);setProcessing(false);
    send("Document Uploaded ✅",`"${doc.name}" is now live for all students!`);
  };
  return (
    <div className="page-padding" style={{padding:"32px 36px",maxWidth:580,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:6}}>
        <div style={{width:36,height:36,borderRadius:9,background:"#fb923c22",display:"flex",alignItems:"center",justifyContent:"center"}}><Ic name="shield" size={16} color="#fb923c"/></div>
        <div>
          <h1 style={{fontSize:25,fontWeight:700,lineHeight:1,color:"var(--text)"}}>Upload Document</h1>
          <p style={{fontSize:12,color:"#fb923c",marginTop:3}}>Admin only</p>
        </div>
      </div>
      <p style={{color:"var(--text3)",fontSize:13.5,marginBottom:22,marginTop:10}}>Supports PDF, DOCX, PPTX, TXT. Shared with all students automatically.</p>
      <div onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)}
        onDrop={e=>{e.preventDefault();setDragging(false);processFile(e.dataTransfer.files[0]);}}
        onClick={()=>!processing&&inputRef.current?.click()}
        style={{...glass(),border:`2px dashed ${dragging?"#6366f1":"var(--border)"}`,borderRadius:13,padding:"44px 28px",textAlign:"center",cursor:processing?"default":"pointer",background:dragging?"#6366f10a":"var(--surface)",transition:"all 0.2s",marginBottom:18}}>
        <input ref={inputRef} type="file" accept=".pdf,.docx,.doc,.pptx,.txt" onChange={e=>processFile(e.target.files[0])} style={{display:"none"}}/>
        <div style={{width:50,height:50,borderRadius:12,background:"#6366f122",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 13px"}}><Ic name="upload" size={22} color="#6366f1"/></div>
        <p style={{fontWeight:600,marginBottom:5,fontSize:15,color:"var(--text)"}}>{processing?"Processing…":"Drag & drop or click to upload"}</p>
        <p style={{color:"var(--text3)",fontSize:13}}>PDF · DOCX · PPTX · TXT · Max 50 MB</p>
      </div>
      {stages.length>0&&(
        <div style={{...glass(),padding:20}}>
          {done&&(
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,padding:"9px 11px",background:"var(--surface2)",borderRadius:8}}>
              <div style={{width:32,height:32,borderRadius:7,background:fileClr(done.filename)+"22",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Ic name="file" size={14} color={fileClr(done.filename)}/></div>
              <div><div style={{fontSize:13.5,fontWeight:500,color:"var(--text)"}}>{done.filename}</div><div style={{fontSize:12,color:"var(--text3)"}}>{fmtSize(done.size)} · {done.chunks} chunks</div></div>
            </div>
          )}
          {stages.map((s,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:i<stages.length-1?"1px solid var(--border)":"none"}}>
              <div style={{width:20,height:20,borderRadius:"50%",background:s.done?"#4ade8033":s.active?"#6366f133":"var(--surface)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {s.done?<Ic name="check" size={10} color="#4ade80"/>:s.active?<Spinner size={11}/>:null}
              </div>
              <span style={{fontSize:13,color:s.done?"#4ade80":s.active?"var(--text)":"var(--text3)"}}>{s.label}</span>
            </div>
          ))}
          {done&&!processing&&<div style={{marginTop:13,padding:"10px 12px",background:"#4ade8011",border:"1px solid #4ade8033",borderRadius:8,display:"flex",alignItems:"center",gap:8,color:"#4ade80",fontSize:13}}><Ic name="check" size={14} color="#4ade80"/>"{done.name}" is live — students can now chat with it!</div>}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// DOCUMENTS
// ═══════════════════════════════════════════════════════════════
const Documents = ({user,docs,onDelete,setPage,setChatDoc}) => {
  const [search,setSearch]=useState("");
  const [confirm,setConfirm]=useState(null);
  const filtered=docs.filter(d=>d.name.toLowerCase().includes(search.toLowerCase())||d.filename.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="page-padding" style={{padding:"32px 36px",maxWidth:880,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
        <div>
          <h1 style={{fontSize:25,fontWeight:700,marginBottom:4,color:"var(--text)"}}>Document Library</h1>
          <p style={{color:"var(--text3)",fontSize:13.5}}>{docs.length===0?"No documents yet":`${docs.length} doc${docs.length!==1?"s":""} · ${docs.reduce((s,d)=>s+d.chunks,0).toLocaleString()} indexed chunks`}</p>
        </div>
        {user.role==="admin"&&<button onClick={()=>setPage("upload")} style={{...btn,background:"linear-gradient(135deg,#6366f1,#818cf8)",color:"#fff",padding:"9px 17px",borderRadius:9,fontSize:13.5,display:"flex",alignItems:"center",gap:6}}><Ic name="upload" size={14} color="#fff"/> Upload</button>}
      </div>
      {docs.length===0
        ?<EmptyState icon="book" title="No documents uploaded yet" sub={user.role==="admin"?"Upload a PDF, DOCX, PPTX, or TXT file.":"The admin hasn't uploaded any study materials yet."} action={user.role==="admin"?"Upload Document":null} onAction={()=>setPage("upload")}/>
        :<>
          <div style={{position:"relative",marginBottom:14}}>
            <div style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)"}}><Ic name="search" size={14} color="var(--text3)"/></div>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search documents…"
              style={{width:"100%",background:"var(--input-bg)",border:"1px solid var(--border)",borderRadius:9,padding:"8px 13px 8px 36px",color:"var(--text)",fontSize:13.5,outline:"none",fontFamily:"inherit"}}/>
          </div>
          {filtered.length===0?<div style={{textAlign:"center",padding:36,color:"var(--text3)"}}>No documents match "{search}"</div>
            :<div style={{display:"flex",flexDirection:"column",gap:8}}>
              {filtered.map(doc=>(
                <div key={doc.id} style={{...glass(),padding:"14px 17px",display:"flex",alignItems:"center",gap:13,animation:"fade-in 0.3s ease"}}>
                  <div style={{width:40,height:40,borderRadius:9,background:fileClr(doc.filename)+"22",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Ic name="file" size={18} color={fileClr(doc.filename)}/></div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:3}}>
                      <span style={{fontWeight:600,fontSize:14,color:"var(--text)"}}>{doc.name}</span>
                      <Badge color={fileClr(doc.filename)}>{doc.type.toUpperCase()}</Badge>
                    </div>
                    <div style={{fontSize:12,color:"var(--text3)"}}>{doc.filename} · {fmtSize(doc.size)} · {doc.chunks} chunks · {fmtDate(doc.uploadedAt)}</div>
                  </div>
                  <div style={{display:"flex",gap:6,flexShrink:0}}>
                    <button onClick={()=>{setChatDoc(doc);setPage("chat");}} style={{...btn,...glass(8),padding:"6px 12px",fontSize:12.5,color:"#818cf8",display:"flex",alignItems:"center",gap:5}}><Ic name="chat" size={12} color="#818cf8"/> Chat</button>
                    {user.role==="admin"&&<button onClick={()=>setConfirm(doc)} style={{...btn,background:"#f8717118",border:"1px solid #f8717133",padding:"6px 9px",borderRadius:8}}><Ic name="trash" size={13} color="#f87171"/></button>}
                  </div>
                </div>
                {user.role==="student"&&<DocSummary doc={doc}/>}
              ))}
            </div>}
        </>}
      {confirm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999}}>
          <div style={{...glass(),padding:26,maxWidth:330,textAlign:"center"}}>
            <Ic name="alert" size={28} color="#f87171"/>
            <h3 style={{marginTop:11,marginBottom:6,fontSize:17,color:"var(--text)"}}>Delete "{confirm.name}"?</h3>
            <p style={{color:"var(--text3)",fontSize:13,marginBottom:18,lineHeight:1.55}}>Removes permanently. Students lose access immediately.</p>
            <div style={{display:"flex",gap:9,justifyContent:"center"}}>
              <button onClick={()=>setConfirm(null)} style={{...btn,...glass(8),padding:"8px 17px",fontSize:13.5,color:"var(--text)"}}>Cancel</button>
              <button onClick={()=>{onDelete(confirm.id);setConfirm(null);}} style={{...btn,background:"#f87171",color:"#fff",padding:"8px 17px",borderRadius:8,fontSize:13.5}}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// CHAT — with history persistence
// ═══════════════════════════════════════════════════════════════
const chatHistKey = (email,docId) => `learngpt:chat:${email}:${docId||"all"}`;

const Chat = ({user,docs,chatDoc,onMessage}) => {
  const {send} = useNotif();
  const initMsg = () => ({role:"assistant",content:docs.length===0?"No documents uploaded yet. The admin will upload study materials soon.":chatDoc?`Ready! Ask me anything about "${chatDoc.name}" — I'll only answer from its content.`:`Hello ${user.name.split(" ")[0]}! I have ${docs.length} document${docs.length>1?"s":""} loaded. Ask me anything.`,ts:new Date()});
  const [selDocId,setSelDocId] = useState(chatDoc?.id?.toString()||"");
  const [messages,setMessages] = useState([initMsg()]);
  const [input,setInput] = useState("");
  const [loading,setLoading] = useState(false);
  const [histLoaded,setHistLoaded] = useState(false);
  const bottomRef = useRef(null);

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages]);

  // Load history from localStorage when doc changes
  useEffect(()=>{
    const key = chatHistKey(user.email, selDocId);
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.length>0) { setMessages(parsed.map(m=>({...m,ts:new Date(m.ts)}))); }
        else setMessages([initMsg()]);
      } else { setMessages([initMsg()]); }
    } catch { setMessages([initMsg()]); }
    setHistLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[user.email,selDocId]);

  // Save history
  useEffect(()=>{
    if (!histLoaded||messages.length<=1) return;
    const key = chatHistKey(user.email,selDocId);
    try { localStorage.setItem(key,JSON.stringify(messages.slice(-60))); } catch{}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[messages,histLoaded]);

  const clearHistory = () => {
    try { localStorage.removeItem(chatHistKey(user.email,selDocId)); } catch{}
    setMessages([initMsg()]);
  };

  const sendMsg = async () => {
    if (!input.trim()||loading||docs.length===0) return;
    if (!rlCanCall()) { alert("Rate limit reached. Please wait a moment."); return; }
    const q = input.trim(); setInput("");
    setMessages(p=>[...p,{role:"user",content:q,ts:new Date()}]);
    setLoading(true); onMessage(q);
    try {
      const selDoc = docs.find(d=>d.id===+selDocId)||null;
      const ctxText = selDoc
        ? `Document: "${selDoc.name}" (${selDoc.filename})\n\nContent:\n${selDoc.text}`
        : docs.map(d=>`Document: "${d.name}"\nContent:\n${d.text}`).join("\n\n---\n\n");
      const system = `You are an AI tutor. Answer questions using ONLY the document content below. Do not use outside knowledge.\nFormat clearly with **bold**, ## headings, numbered lists, bullets.\nAlways cite: [Source: "Document Name"] at the end.\nIf not found say: "I couldn't find that in the uploaded documents."\n\n${ctxText.slice(0,12000)}`;
      const history = messages.slice(-6).map(m=>({role:m.role,content:m.content}));
      const ans = await claude([...history,{role:"user",content:q}],system);
      setMessages(p=>[...p,{role:"assistant",content:ans,ts:new Date()}]);
    } catch(e) { setMessages(p=>[...p,{role:"assistant",content:`Error: ${e.message}`,ts:new Date()}]); }
    setLoading(false);
  };

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100vh",background:"var(--bg)"}}>
      {/* Header */}
      <div style={{padding:"13px 20px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:11,flexWrap:"wrap",background:"var(--bg2)"}}>
        <div style={{width:33,height:33,borderRadius:8,background:"linear-gradient(135deg,#6366f144,#22d3ee44)",display:"flex",alignItems:"center",justifyContent:"center"}}><Ic name="brain" size={16} color="#22d3ee"/></div>
        <div>
          <div style={{fontWeight:600,fontSize:14,color:"var(--text)"}}>AI Tutor</div>
          <div style={{fontSize:11.5,color:docs.length>0?"#4ade80":"var(--text3)",display:"flex",alignItems:"center",gap:4}}>
            {docs.length>0?<><span style={{width:5,height:5,borderRadius:"50%",background:"#4ade80",display:"inline-block"}}/>{docs.reduce((s,d)=>s+d.chunks,0).toLocaleString()} chunks indexed</>:"No documents"}
          </div>
        </div>
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
          <select value={selDocId} onChange={e=>setSelDocId(e.target.value)}
            style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:7,padding:"5px 10px",color:"var(--text)",fontSize:13,outline:"none",fontFamily:"inherit"}}>
            <option value="">All Documents</option>
            {docs.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <button onClick={clearHistory} title="Clear history"
            style={{...btn,...glass(7),padding:"5px 10px",fontSize:12,color:"var(--text3)",display:"flex",alignItems:"center",gap:4}}>
            <Ic name="trash" size={11}/> Clear
          </button>
        </div>
      </div>
      {/* Messages */}
      <div style={{flex:1,overflowY:"auto",padding:"20px",display:"flex",flexDirection:"column",gap:16}}>
        {messages.length>1&&(
          <div style={{textAlign:"center",fontSize:11,color:"var(--text3)",padding:"4px 0",borderBottom:"1px solid var(--border)",marginBottom:4}}>
            {messages.length-1} message{messages.length!==2?"s":""} · Chat history loaded
          </div>
        )}
        {messages.map((msg,i)=>(
          <div key={i} style={{display:"flex",gap:11,animation:"fade-in 0.3s ease",flexDirection:msg.role==="user"?"row-reverse":"row"}}>
            <div style={{width:29,height:29,borderRadius:7,flexShrink:0,background:msg.role==="user"?"#6366f144":"linear-gradient(135deg,#6366f144,#22d3ee44)",display:"flex",alignItems:"center",justifyContent:"center"}}>
              {msg.role==="user"?<span style={{fontSize:12.5,fontWeight:700,color:"#818cf8"}}>{user.name[0]}</span>:<Ic name="brain" size={12} color="#22d3ee"/>}
            </div>
            <div style={{maxWidth:"78%",display:"flex",flexDirection:"column",alignItems:msg.role==="user"?"flex-end":"flex-start"}}>
              <div style={{padding:"11px 14px",borderRadius:10,background:msg.role==="user"?"#6366f133":"var(--surface)",border:`1px solid ${msg.role==="user"?"#6366f144":"var(--border)"}`,fontSize:13.5,lineHeight:1.7,color:"var(--text)"}}>
                {msg.role==="assistant"?renderMarkdown(msg.content):msg.content}
              </div>
              <span style={{fontSize:11,color:"var(--text3)",marginTop:3}}>{fmtTime(msg.ts)}</span>
            </div>
          </div>
        ))}
        {loading&&(
          <div style={{display:"flex",gap:11}}>
            <div style={{width:29,height:29,borderRadius:7,background:"linear-gradient(135deg,#6366f144,#22d3ee44)",display:"flex",alignItems:"center",justifyContent:"center"}}><Ic name="brain" size={12} color="#22d3ee"/></div>
            <div style={{padding:"11px 14px",...glass(10),display:"flex",alignItems:"center",gap:8}}><Spinner size={14}/><span style={{fontSize:13,color:"var(--text3)"}}>Thinking…</span></div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>
      {/* Quick prompts */}
      {docs.length>0&&messages.length===1&&(
        <div style={{padding:"0 20px 10px",display:"flex",gap:6,flexWrap:"wrap"}}>
          {["Summarize this document","What are the key concepts?","List important definitions","What are the main topics?"].map(q=>(
            <button key={q} onClick={()=>setInput(q)} style={{...btn,...glass(999),padding:"5px 12px",fontSize:12,color:"var(--text2)"}}>{q}</button>
          ))}
        </div>
      )}
      {/* Input */}
      <div style={{padding:"13px 20px",borderTop:"1px solid var(--border)",display:"flex",gap:9,background:"var(--bg2)"}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendMsg()}
          placeholder={docs.length===0?"No documents uploaded yet…":"Ask anything about your study materials…"} disabled={docs.length===0}
          style={{flex:1,background:"var(--input-bg)",border:"1px solid var(--border)",borderRadius:10,padding:"10px 13px",color:"var(--text)",fontSize:13.5,outline:"none",fontFamily:"inherit",opacity:docs.length===0?0.5:1}}/>
        <button onClick={sendMsg} disabled={!input.trim()||loading||docs.length===0}
          style={{...btn,width:40,height:40,borderRadius:10,background:input.trim()&&!loading&&docs.length>0?"linear-gradient(135deg,#6366f1,#22d3ee)":"var(--surface)",border:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <Ic name="send" size={15} color={input.trim()&&!loading&&docs.length>0?"#fff":"var(--text3)"}/>
        </button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// NOTES — student private notes per document
// ═══════════════════════════════════════════════════════════════
const notesKey = email => `learngpt:notes:${email}`;

const Notes = ({user,docs}) => {
  const [notes,setNotes]   = useState({});
  const [selDocId,setSel]  = useState("");
  const [content,setContent] = useState("");
  const [saved,setSaved]   = useState(false);
  const [search,setSearch] = useState("");

  useEffect(()=>{
    try { const s=localStorage.getItem(notesKey(user.email)); if(s) setNotes(JSON.parse(s)); } catch{}
  },[user.email]);

  useEffect(()=>{
    setContent(selDocId&&notes[selDocId]?notes[selDocId].content:"");
  },[selDocId,notes]);

  const saveNote = () => {
    const updated = {...notes,[selDocId]:{content,updatedAt:Date.now()}};
    setNotes(updated);
    try { localStorage.setItem(notesKey(user.email),JSON.stringify(updated)); } catch{}
    setSaved(true); setTimeout(()=>setSaved(false),2000);
  };
  const deleteNote = () => {
    const updated={...notes}; delete updated[selDocId];
    setNotes(updated);
    try { localStorage.setItem(notesKey(user.email),JSON.stringify(updated)); } catch{}
    setContent("");
  };

  const notesList = Object.entries(notes)
    .filter(([id])=>docs.find(d=>d.id===+id))
    .map(([id,n])=>({id,doc:docs.find(d=>d.id===+id),note:n}))
    .filter(({doc,note})=>doc&&(!search||(doc.name.toLowerCase().includes(search.toLowerCase())||note.content.toLowerCase().includes(search.toLowerCase()))));

  return (
    <div className="page-padding" style={{padding:"32px 36px",maxWidth:960,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:22}}>
        <div style={{width:36,height:36,borderRadius:9,background:"#4ade8022",display:"flex",alignItems:"center",justifyContent:"center"}}><Ic name="notes" size={17} color="#4ade80"/></div>
        <div>
          <h1 style={{fontSize:25,fontWeight:700,lineHeight:1,color:"var(--text)"}}>My Notes</h1>
          <p style={{fontSize:13,color:"var(--text3)",marginTop:3}}>Private — only you can see these notes</p>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"250px 1fr",gap:14}}>
        {/* Sidebar */}
        <div>
          <select value={selDocId} onChange={e=>setSel(e.target.value)}
            style={{width:"100%",background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:9,padding:"9px 12px",color:selDocId?"var(--text)":"var(--text3)",fontSize:13.5,outline:"none",fontFamily:"inherit",marginBottom:10}}>
            <option value="">— Select document —</option>
            {docs.map(d=><option key={d.id} value={d.id}>{d.name}{notes[d.id]?" ✎":""}</option>)}
          </select>
          <div style={{position:"relative",marginBottom:10}}>
            <div style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)"}}><Ic name="search" size={12} color="var(--text3)"/></div>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search notes…"
              style={{width:"100%",background:"var(--input-bg)",border:"1px solid var(--border)",borderRadius:8,padding:"6px 10px 6px 28px",color:"var(--text)",fontSize:12.5,outline:"none",fontFamily:"inherit"}}/>
          </div>
          {notesList.length===0
            ?<div style={{textAlign:"center",padding:"20px 8px",color:"var(--text3)",fontSize:12.5,lineHeight:1.7}}>No notes yet.<br/>Select a doc to start!</div>
            :<div style={{display:"flex",flexDirection:"column",gap:5}}>
              {notesList.map(({id,doc,note})=>(
                <div key={id} onClick={()=>setSel(id)} style={{...glass(9),padding:"10px 12px",cursor:"pointer",border:`1px solid ${selDocId===id?"#6366f155":"var(--border)"}`,background:selDocId===id?"#6366f10d":"var(--surface)"}}>
                  <div style={{fontSize:13,fontWeight:500,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:2}}>{doc.name}</div>
                  <div style={{fontSize:11.5,color:"var(--text3)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{note.content.slice(0,55)||"(empty)"}</div>
                  <div style={{fontSize:10.5,color:"var(--text3)",marginTop:3}}>{fmtDate(note.updatedAt)}</div>
                </div>
              ))}
            </div>}
        </div>
        {/* Editor */}
        <div>
          {!selDocId
            ?<div style={{...glass(),minHeight:350,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12,color:"var(--text3)"}}>
                <Ic name="notes" size={34} color="var(--text3)"/><p style={{fontSize:14}}>Select a document to write notes</p>
              </div>
            :<div style={{...glass(),overflow:"hidden",display:"flex",flexDirection:"column",minHeight:350}}>
              <div style={{padding:"11px 16px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span style={{fontSize:14,fontWeight:600,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"60%"}}>{docs.find(d=>d.id===+selDocId)?.name}</span>
                <div style={{display:"flex",gap:7,alignItems:"center",flexShrink:0}}>
                  {notes[selDocId]&&<button onClick={deleteNote} style={{...btn,background:"#f8717118",border:"1px solid #f8717133",padding:"5px 9px",borderRadius:7,color:"#f87171",fontSize:12,display:"flex",alignItems:"center",gap:4}}><Ic name="trash" size={11} color="#f87171"/>Delete</button>}
                  <button onClick={saveNote} style={{...btn,background:saved?"#4ade8022":"linear-gradient(135deg,#6366f1,#818cf8)",border:saved?"1px solid #4ade8055":"none",color:saved?"#4ade80":"#fff",padding:"5px 14px",borderRadius:7,fontSize:12.5,display:"flex",alignItems:"center",gap:5}}>
                    {saved?<><Ic name="check" size={12} color="#4ade80"/>Saved!</>:"Save Notes"}
                  </button>
                </div>
              </div>
              <textarea value={content} onChange={e=>setContent(e.target.value)}
                placeholder={"Write your notes here...\n\nMarkdown supported:\n**bold**, # Heading, - bullet, 1. numbered"}
                style={{flex:1,width:"100%",padding:"16px",background:"transparent",border:"none",outline:"none",color:"var(--text)",fontSize:13.5,lineHeight:1.8,fontFamily:"inherit",minHeight:300}}
                onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key==="s"){e.preventDefault();saveNote();}}}/>
              <div style={{padding:"7px 16px",borderTop:"1px solid var(--border)",fontSize:11,color:"var(--text3)",display:"flex",justifyContent:"space-between"}}>
                <span>{content.length} chars · {content.split(/\s+/).filter(Boolean).length} words</span>
                <span>Ctrl+S to save</span>
              </div>
            </div>}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// FLASHCARDS
// ═══════════════════════════════════════════════════════════════
const Flashcards = ({docs,onUpdateDoc,onFlashcardStats}) => {
  const [selDocId,setSelDocId]=useState("");
  const [generating,setGenerating]=useState(false);
  const [idx,setIdx]=useState(0);
  const [flipped,setFlipped]=useState(false);
  const [known,setKnown]=useState(new Set());
  const {send}=useNotif();
  const selDoc=docs.find(d=>d.id===+selDocId);
  const cards=selDoc?.flashcards||[];
  useEffect(()=>{ const total=docs.reduce((s,d)=>s+(d.flashcards?.length||0),0); onFlashcardStats({known:known.size,total}); },[known,docs]); // eslint-disable-line
  const generate=async()=>{
    if(!selDoc) return; setGenerating(true);
    if(!rlCanCall()){alert("Rate limit reached. Please wait.");setGenerating(false);return;}
    try {
      const res=await claude([{role:"user",content:`Generate 8 flashcard Q&A pairs from this document. Return ONLY a JSON array:\n[{"q":"question","a":"answer"}]\n\nDocument: "${selDoc.name}"\nContent:\n${selDoc.text.slice(0,9000)}`}],"Return ONLY valid JSON array. No markdown.");
      const clean=res.replace(/```json|```/g,"").trim();
      const parsed=JSON.parse(clean);
      onUpdateDoc(selDoc.id,{flashcards:parsed});
      setIdx(0);setFlipped(false);setKnown(new Set());
      send("Flashcards Ready! ⚡",`${parsed.length} cards generated for "${selDoc.name}"`);
    } catch(e){alert("Could not generate flashcards: "+e.message);}
    setGenerating(false);
  };
  if(docs.length===0) return <div style={{padding:"32px 36px"}}><h1 style={{fontSize:25,fontWeight:700,marginBottom:20,color:"var(--text)"}}>Flashcards</h1><EmptyState icon="flash" title="No documents available" sub="The admin will upload study materials soon."/></div>;
  return (
    <div className="page-padding" style={{padding:"32px 36px",maxWidth:660,margin:"0 auto"}}>
      <h1 style={{fontSize:25,fontWeight:700,marginBottom:5,color:"var(--text)"}}>Flashcards</h1>
      <p style={{color:"var(--text3)",fontSize:13.5,marginBottom:22}}>Select a document, then generate AI flashcards from its content.</p>
      <div style={{display:"flex",gap:9,marginBottom:22,flexWrap:"wrap"}}>
        <select value={selDocId} onChange={e=>{setSelDocId(e.target.value);setIdx(0);setFlipped(false);setKnown(new Set());}}
          style={{flex:1,minWidth:180,background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:9,padding:"9px 12px",color:selDocId?"var(--text)":"var(--text3)",fontSize:13.5,outline:"none",fontFamily:"inherit"}}>
          <option value="">— Select a document —</option>
          {docs.map(d=><option key={d.id} value={d.id}>{d.name}{d.flashcards?.length?` (${d.flashcards.length} cards)`:""}</option>)}
        </select>
        <button onClick={generate} disabled={!selDocId||generating}
          style={{...btn,background:selDocId&&!generating?"linear-gradient(135deg,#6366f1,#22d3ee)":"var(--surface)",border:"1px solid var(--border)",color:selDocId&&!generating?"#fff":"var(--text3)",padding:"9px 16px",borderRadius:9,fontSize:13.5,display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
          {generating?<><Spinner size={14}/> Generating…</>:<><Ic name="sparkle" size={14} color={selDocId&&!generating?"#fff":"var(--text3)"}/> Generate</>}
        </button>
      </div>
      {!selDocId&&<EmptyState icon="flash" title="Choose a document" sub="Select a document above, then click Generate."/>}
      {selDocId&&cards.length===0&&!generating&&<EmptyState icon="flash" title="No flashcards yet" sub={`Click "Generate" to create AI flashcards from "${selDoc?.name}".`} action="Generate Now" onAction={generate}/>}
      {cards.length>0&&(
        <>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"var(--text2)",marginBottom:8}}><span>Card {idx+1} of {cards.length}</span><span style={{color:"#4ade80"}}>{known.size} mastered</span></div>
          <div style={{height:6,background:"var(--border)",borderRadius:999,marginBottom:20,overflow:"hidden"}}><div style={{height:"100%",width:`${(known.size/cards.length)*100}%`,background:"linear-gradient(90deg,#6366f1,#22d3ee)",borderRadius:999,transition:"width 0.5s"}}/></div>
          <div onClick={()=>setFlipped(!flipped)} style={{cursor:"pointer",height:240,perspective:"1000px"}}>
            <div style={{height:"100%",transformStyle:"preserve-3d",transition:"transform 0.45s",transform:flipped?"rotateY(180deg)":"rotateY(0)"}}>
              <div style={{position:"absolute",inset:0,...glass(),display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:26,textAlign:"center",backfaceVisibility:"hidden"}}>
                <span style={{fontSize:10.5,color:"var(--text3)",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:12}}>Question</span>
                <p style={{fontSize:17,fontWeight:600,lineHeight:1.5,color:"var(--text)"}}>{cards[idx]?.q}</p>
                <span style={{marginTop:14,fontSize:12,color:"var(--text3)"}}>Tap to reveal</span>
              </div>
              <div style={{position:"absolute",inset:0,...glass(),background:"#6366f10e",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:26,textAlign:"center",backfaceVisibility:"hidden",transform:"rotateY(180deg)"}}>
                <span style={{fontSize:10.5,color:"#818cf8",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:12}}>Answer</span>
                <p style={{fontSize:14.5,lineHeight:1.7,color:"var(--text2)"}}>{cards[idx]?.a}</p>
              </div>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"center",gap:9,marginTop:16}}>
            <button onClick={()=>{setIdx(Math.max(0,idx-1));setFlipped(false);}} disabled={idx===0} style={{...btn,...glass(9),padding:"8px 17px",fontSize:13.5,color:idx===0?"var(--text3)":"var(--text)"}}>← Prev</button>
            <button onClick={()=>setKnown(s=>{const n=new Set(s);n.has(idx)?n.delete(idx):n.add(idx);return n;})}
              style={{...btn,padding:"8px 17px",borderRadius:9,fontSize:13.5,background:known.has(idx)?"#4ade8033":"var(--surface)",border:`1px solid ${known.has(idx)?"#4ade8055":"var(--border)"}`,color:known.has(idx)?"#4ade80":"var(--text)",display:"flex",alignItems:"center",gap:5}}>
              {known.has(idx)?<><Ic name="check" size={13} color="#4ade80"/>Known</>:"Mark Known"}
            </button>
            <button onClick={()=>{setIdx(Math.min(cards.length-1,idx+1));setFlipped(false);}} disabled={idx===cards.length-1} style={{...btn,...glass(9),padding:"8px 17px",fontSize:13.5,color:idx===cards.length-1?"var(--text3)":"var(--text)"}}>Next →</button>
          </div>
        </>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// QUIZ
// ═══════════════════════════════════════════════════════════════
const Quiz = ({docs,onResult}) => {
  const [phase,setPhase]=useState("setup");
  const [selDocId,setSelDocId]=useState("");
  const [difficulty,setDifficulty]=useState("medium");
  const [questions,setQuestions]=useState([]);
  const [qIdx,setQIdx]=useState(0);
  const [answers,setAnswers]=useState({});
  const [showExp,setShowExp]=useState(false);
  const [generating,setGenerating]=useState(false);
  const [startTime,setStartTime]=useState(null);
  const [elapsed,setElapsed]=useState(0);
  const [resultSaved,setResultSaved]=useState(false);
  const {send}=useNotif();
  const selDoc=docs.find(d=>d.id===+selDocId);
  useEffect(()=>{if(phase==="quiz"&&startTime){const t=setInterval(()=>setElapsed(Math.floor((Date.now()-startTime)/1000)),1000);return()=>clearInterval(t);}},[phase,startTime]);
  const startQuiz=async()=>{
    if(!selDoc) return; setGenerating(true);
    if(!rlCanCall()){alert("Rate limit reached. Please wait.");setGenerating(false);return;}
    try {
      const res=await claude([{role:"user",content:`Generate exactly 5 ${difficulty} MCQs from this document. Return ONLY a JSON array:\n[{"q":"question","opts":["A","B","C","D"],"ans":0,"exp":"explanation"}]\n\nDocument: "${selDoc.name}"\nContent:\n${selDoc.text.slice(0,9000)}`}],"Return ONLY valid JSON array. No markdown.");
      const clean=res.replace(/```json|```/g,"").trim();
      const qs=JSON.parse(clean);
      setQuestions(qs);setPhase("quiz");setQIdx(0);setAnswers({});setShowExp(false);setStartTime(Date.now());setElapsed(0);setResultSaved(false);
    } catch(e){alert("Failed to generate quiz: "+e.message);}
    setGenerating(false);
  };
  const score=Object.entries(answers).filter(([i,a])=>questions[+i]?.ans===a).length;
  const pct=questions.length?Math.round((score/questions.length)*100):0;
  const q=questions[qIdx];
  useEffect(()=>{
    if(phase==="result"&&!resultSaved&&questions.length>0){
      setResultSaved(true);
      onResult({pct,score,total:questions.length,doc:selDoc?.name,difficulty,time:elapsed});
      send("Quiz Complete! 🎯",`You scored ${pct}% on "${selDoc?.name}"`);
    }
  },[phase]); // eslint-disable-line

  if(docs.length===0) return <div style={{padding:"32px 36px"}}><h1 style={{fontSize:25,fontWeight:700,marginBottom:20,color:"var(--text)"}}>Quiz</h1><EmptyState icon="quiz" title="No documents available" sub="The admin will upload study materials soon."/></div>;

  if(phase==="result") return (
    <div className="page-padding" style={{padding:"32px 36px",maxWidth:500,margin:"0 auto",textAlign:"center"}}>
      <div style={{...glass(),padding:34}}>
        <div style={{width:72,height:72,borderRadius:"50%",background:(pct>=70?"#4ade80":"#fb923c")+"22",border:`3px solid ${pct>=70?"#4ade80":"#fb923c"}`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",fontSize:24,fontWeight:800,color:pct>=70?"#4ade80":"#fb923c"}}>{pct}%</div>
        <h2 style={{fontSize:20,fontWeight:700,marginBottom:5,color:"var(--text)"}}>Quiz Complete!</h2>
        <p style={{color:"var(--text3)",marginBottom:22,fontSize:13.5}}>{pct>=80?"Excellent!":pct>=60?"Good effort!":"Keep studying!"} — "{selDoc?.name}"</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:9,marginBottom:20}}>
          {[{v:score,l:"Correct",c:"#4ade80"},{v:questions.length-score,l:"Wrong",c:"#f87171"},{v:`${Math.floor(elapsed/60)}:${String(elapsed%60).padStart(2,"0")}`,l:"Time",c:"#22d3ee"}].map((s,i)=>(
            <div key={i} style={{...glass(10),padding:11}}><div style={{fontSize:19,fontWeight:700,color:s.c}}>{s.v}</div><div style={{fontSize:12,color:"var(--text3)"}}>{s.l}</div></div>
          ))}
        </div>
        <div style={{textAlign:"left",marginBottom:18}}>
          {questions.map((q,i)=>(
            <div key={i} style={{...glass(8),padding:11,marginBottom:6,borderLeft:`3px solid ${answers[i]===q.ans?"#4ade80":"#f87171"}`}}>
              <div style={{fontSize:13,fontWeight:500,marginBottom:3,color:"var(--text)"}}>{q.q}</div>
              <div style={{fontSize:12,color:"var(--text3)"}}>Your answer: <span style={{color:answers[i]===q.ans?"#4ade80":"#f87171"}}>{q.opts?.[answers[i]]??"—"}</span></div>
              {answers[i]!==q.ans&&<div style={{fontSize:12,color:"#4ade80"}}>Correct: {q.opts?.[q.ans]}</div>}
              <div style={{fontSize:12,color:"var(--text3)",marginTop:3}}>💡 {q.exp}</div>
            </div>
          ))}
          <WeakTopicsBox questions={questions} answers={answers} doc={selDoc?.name||""}/>
        </div>
        <button onClick={()=>{setPhase("setup");setResultSaved(false);}} style={{...btn,...glass(9),padding:"9px 22px",fontSize:13.5,color:"var(--text)"}}>Take Another Quiz</button>
      </div>
    </div>
  );

  if(phase==="quiz") return (
    <div className="page-padding" style={{padding:"32px 36px",maxWidth:560,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:16,fontSize:13,color:"var(--text3)"}}>
        <span>Q{qIdx+1}/{questions.length} — <span style={{color:"var(--text2)"}}>{selDoc?.name}</span></span>
        <span style={{fontFamily:"'JetBrains Mono',monospace",color:"#22d3ee"}}>⏱ {Math.floor(elapsed/60)}:{String(elapsed%60).padStart(2,"0")}</span>
      </div>
      <div style={{height:5,background:"var(--border)",borderRadius:999,marginBottom:20}}><div style={{height:"100%",width:`${((qIdx+(answers[qIdx]!==undefined?1:0))/questions.length)*100}%`,background:"linear-gradient(90deg,#6366f1,#22d3ee)",borderRadius:999,transition:"width 0.3s"}}/></div>
      <div style={{...glass(),padding:24,marginBottom:12}}>
        <p style={{fontSize:16,fontWeight:600,lineHeight:1.5,marginBottom:18,color:"var(--text)"}}>{q?.q}</p>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {q?.opts?.map((opt,i)=>{
            const sel=answers[qIdx]===i,corr=showExp&&i===q.ans,wrong=showExp&&sel&&i!==q.ans;
            return (
              <button key={i} onClick={()=>{if(!showExp){setAnswers(p=>({...p,[qIdx]:i}));setShowExp(true);}}}
                style={{...btn,padding:"10px 13px",borderRadius:8,textAlign:"left",fontSize:13.5,border:`1px solid ${corr?"#4ade8088":wrong?"#f8717188":sel?"#6366f166":"var(--border)"}`,background:corr?"#4ade8018":wrong?"#f8717118":sel?"#6366f118":"var(--surface)",color:"var(--text)",display:"flex",alignItems:"center",gap:9}}>
                <span style={{width:21,height:21,borderRadius:5,border:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,flexShrink:0,background:corr?"#4ade8044":wrong?"#f8717144":"transparent",color:corr?"#4ade80":wrong?"#f87171":"var(--text3)"}}>{["A","B","C","D"][i]}</span>{opt}
              </button>
            );
          })}
        </div>
        {showExp&&<div style={{marginTop:12,padding:"9px 11px",background:"#22d3ee11",border:"1px solid #22d3ee33",borderRadius:7,fontSize:12.5,color:"#22d3ee"}}>💡 {q?.exp}</div>}
      </div>
      {showExp&&<button onClick={()=>{if(qIdx<questions.length-1){setQIdx(qIdx+1);setShowExp(false);}else setPhase("result");}} style={{...btn,width:"100%",background:"linear-gradient(135deg,#6366f1,#22d3ee)",color:"#fff",padding:"12px",borderRadius:10,fontSize:14.5}}>{qIdx<questions.length-1?"Next Question →":"See Results"}</button>}
    </div>
  );

  return (
    <div className="page-padding" style={{padding:"32px 36px",maxWidth:520,margin:"0 auto"}}>
      <h1 style={{fontSize:25,fontWeight:700,marginBottom:5,color:"var(--text)"}}>Quiz Generator</h1>
      <p style={{color:"var(--text3)",fontSize:13.5,marginBottom:26}}>AI generates questions directly from your document's content.</p>
      <div style={{...glass(),padding:22,marginBottom:14}}>
        <label style={{fontSize:13.5,fontWeight:500,display:"block",marginBottom:9,color:"var(--text)"}}>Document</label>
        <select value={selDocId} onChange={e=>setSelDocId(e.target.value)}
          style={{width:"100%",background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:9,padding:"9px 12px",color:selDocId?"var(--text)":"var(--text3)",fontSize:13.5,outline:"none",fontFamily:"inherit",marginBottom:18}}>
          <option value="">— Select a document —</option>
          {docs.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <label style={{fontSize:13.5,fontWeight:500,display:"block",marginBottom:9,color:"var(--text)"}}>Difficulty</label>
        <div style={{display:"flex",gap:8}}>
          {["easy","medium","hard"].map(d=>(
            <button key={d} onClick={()=>setDifficulty(d)}
              style={{...btn,flex:1,padding:"9px",borderRadius:9,background:difficulty===d?"#6366f133":"var(--surface)",border:`1px solid ${difficulty===d?"#6366f166":"var(--border)"}`,color:difficulty===d?"#818cf8":"var(--text3)",fontSize:13.5,textTransform:"capitalize"}}>{d}</button>
          ))}
        </div>
      </div>
      <button onClick={startQuiz} disabled={!selDocId||generating}
        style={{...btn,width:"100%",background:selDocId&&!generating?"linear-gradient(135deg,#6366f1,#22d3ee)":"var(--surface)",border:"1px solid var(--border)",color:selDocId&&!generating?"#fff":"var(--text3)",padding:"12px",borderRadius:10,fontSize:14.5,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
        {generating?<><Spinner size={16}/>Generating questions…</>:<><Ic name="sparkle" size={15} color={selDocId&&!generating?"#fff":"var(--text3)"}/>Generate Quiz</>}
      </button>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// QUIZ MANAGEMENT (Admin)
// ═══════════════════════════════════════════════════════════════
const QuizManagement = ({docs}) => {
  const [allProgress,setAllProgress]=useState({});
  const [loading,setLoading]=useState(true);
  const [filterDoc,setFilterDoc]=useState("");
  const [filterDiff,setFilterDiff]=useState("");
  const [sortBy,setSortBy]=useState("recent");
  useEffect(()=>{ loadAllProgress().then(p=>{setAllProgress(p);setLoading(false);}); },[]);

  const allQuizzes=Object.entries(allProgress).flatMap(([email,data])=>(data.quizHistory||[]).map(q=>({...q,studentEmail:email,studentName:data.name||email})));
  const filtered=allQuizzes.filter(q=>(filterDoc===""||q.doc?.includes(filterDoc))&&(filterDiff===""||q.difficulty===filterDiff));
  const sorted=[...filtered].sort((a,b)=>sortBy==="score"?b.pct-a.pct:sortBy==="score-asc"?a.pct-b.pct:0);
  const avg=filtered.length?Math.round(filtered.reduce((s,q)=>s+q.pct,0)/filtered.length):null;
  const docStats=docs.map(d=>({name:d.name,count:allQuizzes.filter(q=>q.doc===d.name).length,avg:allQuizzes.filter(q=>q.doc===d.name).length?Math.round(allQuizzes.filter(q=>q.doc===d.name).reduce((s,q)=>s+q.pct,0)/allQuizzes.filter(q=>q.doc===d.name).length):null}));

  return (
    <div className="page-padding" style={{padding:"32px 36px",maxWidth:1000,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
        <div style={{width:36,height:36,borderRadius:9,background:"#6366f122",display:"flex",alignItems:"center",justifyContent:"center"}}><Ic name="mgmt" size={17} color="#6366f1"/></div>
        <div>
          <h1 style={{fontSize:25,fontWeight:700,lineHeight:1,color:"var(--text)"}}>Quiz Management</h1>
          <p style={{fontSize:13,color:"var(--text3)",marginTop:3}}>{allQuizzes.length} total quiz attempts across all students</p>
        </div>
      </div>
      {loading?<div style={{display:"flex",justifyContent:"center",padding:50}}><Spinner size={26}/></div>:(
        <>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:13,marginBottom:22}}>
            {[{l:"Total Attempts",v:allQuizzes.length,c:"#6366f1"},{l:"Avg Score",v:avg!==null?`${avg}%`:"—",c:"#4ade80"},{l:"Pass Rate (≥70%)",v:allQuizzes.length?`${Math.round(allQuizzes.filter(q=>q.pct>=70).length/allQuizzes.length*100)}%`:"—",c:"#22d3ee"},{l:"Docs Attempted",v:new Set(allQuizzes.map(q=>q.doc)).size,c:"#fb923c"}].map((s,i)=>(
              <div key={i} style={{...glass(),padding:16}}>
                <div style={{fontSize:22,fontWeight:700,color:s.c}}>{s.v}</div>
                <div style={{fontSize:12,color:"var(--text3)",marginTop:3}}>{s.l}</div>
              </div>
            ))}
          </div>
          {allQuizzes.length>=3&&(
            <div style={{...glass(),padding:20,marginBottom:14}}>
              <h3 style={{fontWeight:600,marginBottom:16,color:"var(--text)"}}>Score Distribution</h3>
              <BarChart data={[{label:"0–39",v:allQuizzes.filter(q=>q.pct<40).length},{label:"40–59",v:allQuizzes.filter(q=>q.pct>=40&&q.pct<60).length},{label:"60–69",v:allQuizzes.filter(q=>q.pct>=60&&q.pct<70).length},{label:"70–79",v:allQuizzes.filter(q=>q.pct>=70&&q.pct<80).length},{label:"80–89",v:allQuizzes.filter(q=>q.pct>=80&&q.pct<90).length},{label:"90–100",v:allQuizzes.filter(q=>q.pct>=90).length}]} color="#6366f1" height={90}/>
            </div>
          )}
          {docStats.filter(d=>d.count>0).length>0&&(
            <div style={{...glass(),padding:20,marginBottom:14}}>
              <h3 style={{fontWeight:600,marginBottom:14,color:"var(--text)"}}>By Document</h3>
              {docStats.filter(d=>d.count>0).map((d,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid var(--border)"}}>
                  <span style={{fontSize:13.5,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"60%"}}>{d.name}</span>
                  <div style={{display:"flex",gap:10,alignItems:"center",flexShrink:0}}>
                    <span style={{fontSize:12,color:"var(--text3)"}}>{d.count} attempt{d.count!==1?"s":""}</span>
                    {d.avg!==null&&<Badge color={d.avg>=70?"#4ade80":"#fb923c"}>{d.avg}% avg</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{...glass(),overflow:"hidden"}}>
            <div style={{padding:"12px 16px",borderBottom:"1px solid var(--border)",display:"flex",gap:9,flexWrap:"wrap",alignItems:"center"}}>
              <h3 style={{fontWeight:600,fontSize:15,color:"var(--text)",flex:1}}>All Attempts</h3>
              <select value={filterDoc} onChange={e=>setFilterDoc(e.target.value)} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:7,padding:"5px 9px",color:"var(--text)",fontSize:12.5,outline:"none",fontFamily:"inherit"}}>
                <option value="">All Docs</option>
                {[...new Set(allQuizzes.map(q=>q.doc))].map(d=><option key={d} value={d}>{d}</option>)}
              </select>
              <select value={filterDiff} onChange={e=>setFilterDiff(e.target.value)} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:7,padding:"5px 9px",color:"var(--text)",fontSize:12.5,outline:"none",fontFamily:"inherit"}}>
                <option value="">All Difficulties</option>
                {["easy","medium","hard"].map(d=><option key={d} value={d}>{d}</option>)}
              </select>
              <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:7,padding:"5px 9px",color:"var(--text)",fontSize:12.5,outline:"none",fontFamily:"inherit"}}>
                <option value="recent">Recent</option>
                <option value="score">Highest Score</option>
                <option value="score-asc">Lowest Score</option>
              </select>
            </div>
            {sorted.length===0?<div style={{textAlign:"center",padding:"28px 0",color:"var(--text3)",fontSize:13.5}}>No quiz attempts yet.</div>
              :sorted.map((q,i)=>(
                <div key={i} style={{padding:"10px 16px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13.5,fontWeight:500,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{q.doc||"Unknown"}</div>
                    <div style={{fontSize:12,color:"var(--text3)"}}>{q.studentName} · <span style={{textTransform:"capitalize"}}>{q.difficulty}</span> · {q.score}/{q.total}</div>
                  </div>
                  <Badge color={q.pct>=70?"#4ade80":"#f87171"}>{q.pct}%</Badge>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// LEADERBOARD
// ═══════════════════════════════════════════════════════════════
const Leaderboard = ({user}) => {
  const [students,setStudents]=useState([]);
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState("overall");
  useEffect(()=>{
    loadAllProgress().then(p=>{
      const list=Object.entries(p).map(([email,data])=>({
        email, name:data.name||email,
        avgScore:data.avgScore||0, bestScore:data.bestScore||0,
        questionsAsked:data.questionsAsked||0, quizzesTaken:data.quizzesTaken||0,
        flashcardsMastered:data.flashcardsMastered||0,
        score:Math.round((data.avgScore||0)*0.45+Math.min((data.questionsAsked||0)*2,30)+Math.min((data.flashcardsMastered||0)*2,25)+Math.min((data.quizzesTaken||0)*3,30))
      }));
      setStudents(list); setLoading(false);
    });
  },[]);
  const sorted=[...students].sort((a,b)=>tab==="quiz"?b.avgScore-a.avgScore:tab==="chat"?b.questionsAsked-a.questionsAsked:tab==="flash"?b.flashcardsMastered-a.flashcardsMastered:b.score-a.score);
  const me=sorted.findIndex(s=>s.email===user.email);
  const medals=["🥇","🥈","🥉"];
  return (
    <div className="page-padding" style={{padding:"32px 36px",maxWidth:700,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
        <div style={{width:36,height:36,borderRadius:9,background:"#f59e0b22",display:"flex",alignItems:"center",justifyContent:"center"}}><Ic name="trophy" size={17} color="#f59e0b"/></div>
        <div>
          <h1 style={{fontSize:25,fontWeight:700,lineHeight:1,color:"var(--text)"}}>Leaderboard</h1>
          <p style={{fontSize:13,color:"var(--text3)",marginTop:3}}>Rankings update after each quiz and study session</p>
        </div>
      </div>
      {me>=0&&!loading&&(
        <div style={{...glass(),padding:"12px 16px",marginBottom:16,border:"1px solid #6366f133",background:"#6366f108",display:"flex",alignItems:"center",gap:12}}>
          <div style={{fontSize:18,fontWeight:700,color:"#818cf8",minWidth:32}}>#{me+1}</div>
          <div style={{width:32,height:32,borderRadius:8,background:"#6366f133",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:"#818cf8",fontSize:14}}>{user.name[0]}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:600,color:"var(--text)"}}>You — {sorted[me]?.score} pts</div>
            <div style={{fontSize:12,color:"var(--text3)"}}>Avg quiz: {sorted[me]?.avgScore}% · {sorted[me]?.questionsAsked} questions</div>
          </div>
          {me===0&&<span style={{fontSize:22}}>🏆</span>}
        </div>
      )}
      <div style={{display:"flex",gap:6,marginBottom:18,flexWrap:"wrap"}}>
        {[["overall","🏆 Overall"],["quiz","📊 Quiz Avg"],["chat","💬 Questions"],["flash","⚡ Flashcards"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)}
            style={{...btn,padding:"6px 13px",borderRadius:8,fontSize:13,background:tab===id?"#6366f133":"var(--surface)",border:`1px solid ${tab===id?"#6366f166":"var(--border)"}`,color:tab===id?"#818cf8":"var(--text3)"}}>
            {label}
          </button>
        ))}
      </div>
      {loading?<div style={{display:"flex",justifyContent:"center",padding:50}}><Spinner size={26}/></div>
        :students.length===0?<EmptyState icon="trophy" title="No students yet" sub="Students who take quizzes and ask questions will appear here!"/>
        :<div style={{...glass(),overflow:"hidden"}}>
          {sorted.map((s,i)=>(
            <div key={s.email} style={{padding:"13px 16px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:12,background:s.email===user.email?"#6366f108":"transparent",animation:"fade-in 0.3s ease both",animationDelay:`${i*25}ms`}}>
              <div style={{width:32,textAlign:"center",fontSize:i<3?20:14,fontWeight:i<3?700:500,color:"var(--text3)",flexShrink:0}}>{i<3?medals[i]:`#${i+1}`}</div>
              <div style={{width:34,height:34,borderRadius:8,background:s.email===user.email?"#6366f133":"var(--surface2)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:s.email===user.email?"#818cf8":"var(--text2)",fontSize:14,flexShrink:0}}>{s.name[0]?.toUpperCase()||"?"}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:500,color:"var(--text)",display:"flex",alignItems:"center",gap:7}}>
                  {s.name}{s.email===user.email&&<Badge color="#6366f1">You</Badge>}
                </div>
                <div style={{fontSize:11.5,color:"var(--text3)"}}>
                  {tab==="overall"&&`${s.quizzesTaken} quizzes · ${s.questionsAsked} questions · ${s.flashcardsMastered} cards`}
                  {tab==="quiz"&&`Best: ${s.bestScore}% · ${s.quizzesTaken} attempts`}
                  {tab==="chat"&&`${s.questionsAsked} questions asked`}
                  {tab==="flash"&&`${s.flashcardsMastered} flashcards mastered`}
                </div>
              </div>
              <div style={{textAlign:"right",flexShrink:0,fontSize:16,fontWeight:700,color:i===0?"#f59e0b":i===1?"#94a3b8":i===2?"#b45309":"var(--text)"}}>
                {tab==="overall"&&`${s.score}pts`}
                {tab==="quiz"&&`${s.avgScore}%`}
                {tab==="chat"&&s.questionsAsked}
                {tab==="flash"&&s.flashcardsMastered}
              </div>
            </div>
          ))}
        </div>}
      <div style={{marginTop:14,...glass(9),padding:"10px 14px",fontSize:12,color:"var(--text3)",lineHeight:1.65}}>
        🏆 Score = Quiz avg (45%) + Questions asked (30%) + Flashcards mastered (25%)
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// PROGRESS
// ═══════════════════════════════════════════════════════════════
const Progress = ({user,docs,chatHistory,quizResults,flashcardStats,streak}) => {
  const avg=quizResults.length?Math.round(quizResults.reduce((s,r)=>s+r.pct,0)/quizResults.length):null;
  const best=quizResults.length?Math.max(...quizResults.map(r=>r.pct)):null;
  const unlocked=getUnlocked(user.email);
  const unlockedDefs=ACHIEVEMENTS_DEF.filter(a=>unlocked.includes(a.id));
  const locked=ACHIEVEMENTS_DEF.filter(a=>!unlocked.includes(a.id));
  return (
    <div className="page-padding" style={{padding:"32px 36px",maxWidth:820,margin:"0 auto"}}>
      <h1 style={{fontSize:25,fontWeight:700,marginBottom:5,color:"var(--text)"}}>Progress</h1>
      <p style={{color:"var(--text3)",fontSize:13.5,marginBottom:24}}>Your learning activity this session.</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:13,marginBottom:22}}>
        {[{icon:"book",label:"Docs Available",value:docs.length,color:"#6366f1"},{icon:"chat",label:"Questions Asked",value:chatHistory.length,color:"#22d3ee"},{icon:"quiz",label:"Quizzes Taken",value:quizResults.length,color:"#4ade80"},{icon:"flash",label:"Cards Mastered",value:`${flashcardStats.known}/${flashcardStats.total}`,color:"#fb923c"}].map((s,i)=>(
          <div key={i} style={{...glass(),padding:17}}>
            <div style={{width:33,height:33,borderRadius:8,background:s.color+"22",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:9}}><Ic name={s.icon} size={15} color={s.color}/></div>
            <div style={{fontSize:24,fontWeight:700,color:"var(--text)"}}>{s.value}</div>
            <div style={{fontSize:12.5,color:"var(--text3)",marginTop:3}}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{...glass(),padding:20,marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <h3 style={{fontWeight:600,color:"var(--text)"}}>Quiz Score History</h3>
          {avg!==null&&<div style={{display:"flex",gap:9}}><Badge color="#6366f1">{avg}% avg</Badge><Badge color="#4ade80">{best}% best</Badge></div>}
        </div>
        {quizResults.length===0?<div style={{textAlign:"center",padding:"22px 0",color:"var(--text3)",fontSize:13.5}}>No quizzes taken yet — head to the Quiz page!</div>:(
          <>
            <LineChart data={quizResults.map(r=>r.pct)} color="#6366f1" height={100}/>
            <div style={{display:"flex",gap:4,marginTop:6,justifyContent:"space-between",paddingBottom:8,borderBottom:"1px solid var(--border)",fontSize:10.5,color:"var(--text3)"}}>
              {quizResults.map((_,i)=><span key={i}>Q{i+1}</span>)}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:0,marginTop:12}}>
              {[...quizResults].reverse().map((r,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid var(--border)",fontSize:13}}>
                  <span style={{color:"var(--text2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"60%"}}>{r.doc}</span>
                  <div style={{display:"flex",gap:10,flexShrink:0}}><Badge color={r.pct>=70?"#4ade80":"#fb923c"}>{r.pct}%</Badge><span style={{fontSize:12,color:"var(--text3)"}}>{r.score}/{r.total}</span></div>
                </div>
              ))}
            </div>
            {avg!==null&&<div style={{marginTop:12,padding:"9px 12px",background:"#6366f10d",border:"1px solid #6366f122",borderRadius:7,fontSize:13,color:"var(--text2)"}}>Session average: <strong style={{color:"#818cf8"}}>{avg}%</strong> across {quizResults.length} quiz{quizResults.length!==1?"zes":""}</div>}
          </>
        )}
      </div>
      <div style={{...glass(),padding:20,marginBottom:14}}>
        <h3 style={{fontWeight:600,marginBottom:13,color:"var(--text)"}}>Available Documents</h3>
        {docs.length===0?<div style={{textAlign:"center",padding:"18px 0",color:"var(--text3)",fontSize:13.5}}>No documents uploaded yet.</div>
          :docs.map(d=>(<div key={d.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:"1px solid var(--border)"}}><Ic name="file" size={13} color={fileClr(d.filename)}/><span style={{flex:1,fontSize:13.5,color:"var(--text)"}}>{d.name}</span><span style={{fontSize:12,color:"var(--text3)"}}>{d.chunks} chunks</span><Badge color={fileClr(d.filename)}>{d.type.toUpperCase()}</Badge></div>))}
      </div>

      {/* Streak + Heatmap */}
      <div style={{display:"grid",gridTemplateColumns:"160px 1fr",gap:14,marginBottom:14}}>
        <div style={{...glass(),padding:18,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center"}}>
          <div style={{fontSize:42,marginBottom:6}}>{streak>=7?"🏆":streak>=3?"🔥":"⚡"}</div>
          <div style={{fontSize:30,fontWeight:800,color:"var(--text)",lineHeight:1}}>{streak}</div>
          <div style={{fontSize:12,color:"var(--text3)",marginTop:4}}>day streak</div>
        </div>
        <StudyHeatmap email={user.email}/>
      </div>

      {/* Achievements */}
      <div style={{...glass(),padding:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <h3 style={{fontWeight:600,color:"var(--text)"}}>Achievements</h3>
          <Badge color="#f59e0b">{unlocked.length}/{ACHIEVEMENTS_DEF.length} unlocked</Badge>
        </div>
        {unlockedDefs.length>0&&(
          <>
            <div style={{fontSize:12,color:"var(--text3)",marginBottom:8,fontWeight:600,letterSpacing:"0.05em"}}>UNLOCKED</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(175px,1fr))",gap:9,marginBottom:16}}>
              {unlockedDefs.map(a=>(
                <div key={a.id} style={{...glass(10),padding:"11px 13px",display:"flex",alignItems:"center",gap:10,border:"1px solid #6366f133",background:"#6366f108"}}>
                  <span style={{fontSize:22}}>{a.icon}</span>
                  <div><div style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>{a.title}</div><div style={{fontSize:11.5,color:"var(--text3)"}}>{a.desc}</div></div>
                </div>
              ))}
            </div>
          </>
        )}
        {locked.length>0&&(
          <>
            <div style={{fontSize:12,color:"var(--text3)",marginBottom:8,fontWeight:600,letterSpacing:"0.05em"}}>LOCKED</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(175px,1fr))",gap:9}}>
              {locked.map(a=>(
                <div key={a.id} style={{...glass(10),padding:"11px 13px",display:"flex",alignItems:"center",gap:10,opacity:0.45}}>
                  <span style={{fontSize:22,filter:"grayscale(1)"}}>{a.icon}</span>
                  <div><div style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>{a.title}</div><div style={{fontSize:11.5,color:"var(--text3)"}}>{a.desc}</div></div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// ANALYTICS (Admin) — with real SVG charts
// ═══════════════════════════════════════════════════════════════
const Analytics = ({docs,chatHistory,quizResults}) => {
  const maxChunks = docs.length ? Math.max(...docs.map(d=>d.chunks)) : 1;
  const avg = quizResults.length ? Math.round(quizResults.reduce((s,r)=>s+r.pct,0)/quizResults.length) : null;
  const actData = [
    {label:"Docs",     v:docs.length,                                   color:"#6366f1"},
    {label:"Questions",v:chatHistory.length,                            color:"#22d3ee"},
    {label:"Quizzes",  v:quizResults.length,                            color:"#4ade80"},
    {label:"Flash sets",v:docs.filter(d=>d.flashcards?.length>0).length,color:"#fb923c"},
  ].filter(d=>d.v>0);
  return (
    <div className="page-padding" style={{padding:"32px 36px",maxWidth:900,margin:"0 auto"}}>
      <h1 style={{fontSize:25,fontWeight:700,marginBottom:5,color:"var(--text)"}}>Analytics</h1>
      <p style={{color:"var(--text3)",fontSize:13.5,marginBottom:22}}>Real-time platform activity.</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(195px,1fr))",gap:13,marginBottom:22}}>
        {[{icon:"book",label:"Documents",value:docs.length,sub:`${docs.reduce((s,d)=>s+d.chunks,0).toLocaleString()} chunks`,color:"#6366f1"},{icon:"chat",label:"Questions",value:chatHistory.length,sub:"This session",color:"#22d3ee"},{icon:"quiz",label:"Quizzes",value:quizResults.length,sub:quizResults.length?`Avg ${avg}%`:"None yet",color:"#4ade80"},{icon:"flash",label:"Flashcard Sets",value:docs.filter(d=>d.flashcards?.length>0).length,color:"#fb923c"}].map((s,i)=>(
          <div key={i} style={{...glass(),padding:17}}>
            <div style={{width:33,height:33,borderRadius:8,background:s.color+"22",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:9}}><Ic name={s.icon} size={15} color={s.color}/></div>
            <div style={{fontSize:24,fontWeight:700,color:"var(--text)"}}>{s.value}</div>
            <div style={{fontSize:12,color:"var(--text3)",marginTop:2}}>{s.sub||s.label}</div>
          </div>
        ))}
      </div>
      {docs.length===0&&chatHistory.length===0&&quizResults.length===0
        ?<EmptyState icon="chart" title="No data yet" sub="Upload documents and let students interact — analytics will populate automatically."/>
        :<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          {quizResults.length>=2&&(
            <div style={{...glass(),padding:20,gridColumn:"1/-1"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <h3 style={{fontWeight:600,color:"var(--text)"}}>Quiz Score Trend</h3>
                {avg!==null&&<Badge color={avg>=70?"#4ade80":"#fb923c"}>{avg}% avg</Badge>}
              </div>
              <LineChart data={quizResults.map(r=>r.pct)} color="#6366f1" height={110}/>
            </div>
          )}
          {actData.length>1&&(
            <div style={{...glass(),padding:20}}>
              <h3 style={{fontWeight:600,marginBottom:18,color:"var(--text)"}}>Activity Breakdown</h3>
              <DonutChart data={actData} size={110}/>
            </div>
          )}
          {docs.length>0&&(
            <div style={{...glass(),padding:20}}>
              <h3 style={{fontWeight:600,marginBottom:16,color:"var(--text)"}}>Document Chunks</h3>
              <BarChart data={docs.map(d=>({label:d.name.slice(0,12),v:d.chunks}))} color="#22d3ee" height={100}/>
            </div>
          )}
          {docs.length>0&&(
            <div style={{...glass(),padding:20,gridColumn:"1/-1"}}>
              <h3 style={{fontWeight:600,marginBottom:16,color:"var(--text)"}}>Documents</h3>
              {docs.map(d=>(
                <div key={d.id} style={{marginBottom:13}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5,fontSize:13}}><span style={{color:"var(--text2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"70%"}}>{d.name}</span><span style={{color:"var(--text3)",flexShrink:0}}>{d.chunks} chunks · {fmtSize(d.size)}</span></div>
                  <div style={{height:5,background:"var(--border)",borderRadius:999}}><div style={{height:"100%",width:`${(d.chunks/maxChunks)*100}%`,background:`linear-gradient(90deg,${fileClr(d.filename)},${fileClr(d.filename)}88)`,borderRadius:999}}/></div>
                </div>
              ))}
            </div>
          )}
          {quizResults.length>0&&(
            <div style={{...glass(),padding:20,gridColumn:"1/-1"}}>
              <h3 style={{fontWeight:600,marginBottom:14,color:"var(--text)"}}>Recent Quizzes</h3>
              {[...quizResults].reverse().map((r,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid var(--border)",fontSize:13}}>
                  <span style={{color:"var(--text2)"}}>{r.doc} <span style={{color:"var(--text3)",textTransform:"capitalize"}}>({r.difficulty})</span></span>
                  <Badge color={r.pct>=70?"#4ade80":"#fb923c"}>{r.pct}%</Badge>
                </div>
              ))}
            </div>
          )}
        </div>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════════════════
const Users = () => {
  const [students,setStudents]=useState({});
  const [users,setUsers]=useState({});
  const [loading,setLoading]=useState(true);
  const [selected,setSelected]=useState(null);
  useEffect(()=>{ Promise.all([storageLoad(USERS_KEY,{}),loadAllProgress()]).then(([u,p])=>{setUsers(u);setStudents(p);setLoading(false);}); },[]);
  const list=Object.entries(users).map(([email,u])=>({email,name:u.name,...(students[email]||{})}));
  const fmtAgo=ts=>{if(!ts)return"Never";const mins=Math.floor((Date.now()-ts)/60000);if(mins<1)return"Just now";if(mins<60)return`${mins}m ago`;const hrs=Math.floor(mins/60);if(hrs<24)return`${hrs}h ago`;return`${Math.floor(hrs/24)}d ago`;};
  return (
    <div className="page-padding" style={{padding:"32px 36px",maxWidth:1000,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
        <div style={{width:36,height:36,borderRadius:9,background:"#6366f122",display:"flex",alignItems:"center",justifyContent:"center"}}><Ic name="users" size={17} color="#6366f1"/></div>
        <div>
          <h1 style={{fontSize:25,fontWeight:700,lineHeight:1,color:"var(--text)"}}>Student Progress</h1>
          <p style={{fontSize:13,color:"var(--text3)",marginTop:3}}>{list.length} registered students</p>
        </div>
      </div>
      {loading?<div style={{display:"flex",justifyContent:"center",padding:50}}><Spinner size={26}/></div>
        :list.length===0?<EmptyState icon="users" title="No students yet" sub="Students who register will appear here with their progress."/>
        :<>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:13,marginBottom:22}}>
            {[{icon:"users",label:"Total Students",value:list.length,color:"#6366f1"},{icon:"quiz",label:"Avg Quiz Score",value:list.filter(s=>s.avgScore).length?Math.round(list.filter(s=>s.avgScore).reduce((a,s)=>a+s.avgScore,0)/list.filter(s=>s.avgScore).length)+"%":"—",color:"#4ade80"},{icon:"chat",label:"Total Questions",value:list.reduce((a,s)=>a+(s.questionsAsked||0),0),color:"#22d3ee"},{icon:"flash",label:"Cards Mastered",value:list.reduce((a,s)=>a+(s.flashcardsMastered||0),0),color:"#fb923c"}].map((s,i)=>(
              <div key={i} style={{...glass(),padding:17}}>
                <div style={{width:33,height:33,borderRadius:8,background:s.color+"22",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:9}}><Ic name={s.icon} size={15} color={s.color}/></div>
                <div style={{fontSize:24,fontWeight:700,color:"var(--text)"}}>{s.value}</div>
                <div style={{fontSize:12.5,color:"var(--text3)",marginTop:3}}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{...glass(),overflow:"hidden",marginBottom:selected?14:0}}>
            <div style={{padding:"10px 16px",borderBottom:"1px solid var(--border)",display:"grid",gridTemplateColumns:"1.5fr 1fr 1fr 1fr 1fr auto",gap:8}}>
              {["Student","Questions","Quizzes","Avg Score","Last Active",""].map(h=>(<span key={h} style={{fontSize:11.5,color:"var(--text3)",fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase"}}>{h}</span>))}
            </div>
            {list.map((s,i)=>(
              <div key={s.email} style={{padding:"12px 16px",borderBottom:i<list.length-1?"1px solid var(--border)":"none",display:"grid",gridTemplateColumns:"1.5fr 1fr 1fr 1fr 1fr auto",gap:8,alignItems:"center",cursor:"pointer",background:selected?.email===s.email?"#6366f108":"transparent"}} onClick={()=>setSelected(selected?.email===s.email?null:s)}>
                <div style={{display:"flex",alignItems:"center",gap:9}}>
                  <div style={{width:30,height:30,borderRadius:7,background:"#6366f133",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:"#818cf8",fontSize:12,flexShrink:0}}>{s.name?.[0]?.toUpperCase()||"?"}</div>
                  <div><div style={{fontSize:13.5,fontWeight:500,color:"var(--text)"}}>{s.name}</div><div style={{fontSize:11,color:"var(--text3)"}}>{s.email}</div></div>
                </div>
                <span style={{fontSize:13,color:"var(--text2)"}}>{s.questionsAsked||0}</span>
                <span style={{fontSize:13,color:"var(--text2)"}}>{s.quizzesTaken||0}</span>
                <span style={{fontSize:13}}>{s.avgScore?<Badge color={s.avgScore>=70?"#4ade80":"#fb923c"}>{s.avgScore}%</Badge>:<span style={{color:"var(--text3)"}}>—</span>}</span>
                <span style={{fontSize:12,color:"var(--text3)"}}>{fmtAgo(s.lastActive)}</span>
                <Ic name="arrow" size={14} color="var(--text3)"/>
              </div>
            ))}
          </div>
          {selected&&(
            <div style={{...glass(),padding:22,animation:"fade-in 0.3s ease"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:40,height:40,borderRadius:10,background:"#6366f133",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:"#818cf8",fontSize:16}}>{selected.name?.[0]?.toUpperCase()||"?"}</div>
                  <div><div style={{fontSize:16,fontWeight:600,color:"var(--text)"}}>{selected.name}</div><div style={{fontSize:12,color:"var(--text3)"}}>{selected.email}</div></div>
                </div>
                <button onClick={()=>setSelected(null)} style={{...btn,background:"none",color:"var(--text3)"}}><Ic name="x" size={18}/></button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10,marginBottom:18}}>
                {[{label:"Questions Asked",value:selected.questionsAsked||0,color:"#22d3ee"},{label:"Quizzes Taken",value:selected.quizzesTaken||0,color:"#6366f1"},{label:"Avg Score",value:selected.avgScore?selected.avgScore+"%":"—",color:"#4ade80"},{label:"Best Score",value:selected.bestScore?selected.bestScore+"%":"—",color:"#fb923c"},{label:"Cards Mastered",value:`${selected.flashcardsMastered||0}/${selected.totalFlashcards||0}`,color:"#a78bfa"}].map((s,i)=>(
                  <div key={i} style={{...glass(10),padding:13}}><div style={{fontSize:18,fontWeight:700,color:s.color}}>{s.value}</div><div style={{fontSize:11.5,color:"var(--text3)",marginTop:2}}>{s.label}</div></div>
                ))}
              </div>
              {selected.quizHistory?.length>0&&(
                <>
                  <h4 style={{fontSize:14,fontWeight:600,marginBottom:10,color:"var(--text)"}}>Quiz History</h4>
                  {selected.quizHistory.slice().reverse().map((q,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid var(--border)",fontSize:13}}>
                      <span style={{color:"var(--text2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"55%"}}>{q.doc}</span>
                      <div style={{display:"flex",gap:10,flexShrink:0}}><Badge color={q.pct>=70?"#4ade80":"#fb923c"}>{q.pct}%</Badge><span style={{color:"var(--text3)",textTransform:"capitalize",fontSize:12}}>{q.difficulty}</span></div>
                    </div>
                  ))}
                </>
              )}
              {!selected.quizzesTaken&&!selected.questionsAsked&&<div style={{textAlign:"center",padding:"18px 0",color:"var(--text3)",fontSize:13.5}}>This student hasn't been active yet.</div>}
            </div>
          )}
        </>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════════════════════════
export default function App() {
  // Theme
  const [themeMode,setThemeMode] = useState(()=>{ try{return localStorage.getItem("learngpt:theme")||"dark";}catch{return"dark";} });
  const toggleTheme = useCallback(()=>{
    setThemeMode(m=>{ const next=m==="dark"?"light":"dark"; try{localStorage.setItem("learngpt:theme",next);}catch{} return next; });
  },[]);

  // Notifications
  const [notifPerm,setNotifPerm] = useState(()=>typeof Notification!=="undefined"?Notification.permission:"default");
  const requestNotif = useCallback(async()=>{
    if(typeof Notification==="undefined") return false;
    const p=await Notification.requestPermission();
    setNotifPerm(p); return p==="granted";
  },[]);
  const sendNotif = useCallback((title,body)=>{
    if(typeof Notification!=="undefined"&&Notification.permission==="granted"){
      try{new Notification(title,{body,icon:"/favicon.ico"});}catch{}
    }
  },[]);

  // App state
  const [route,setRoute]               = useState("landing");
  const [user,setUser]                 = useState(null);
  const [page,setPage]                 = useState("dashboard");
  const [docs,setDocs]                 = useState([]);
  const [loadingDocs,setLoadingDocs]   = useState(true);
  const [chatHistory,setChatHistory]   = useState([]);
  const [quizResults,setQuizResults]   = useState([]);
  const [flashcardStats,setFlashcardStats] = useState({known:0,total:0});
  const [chatDoc,setChatDoc]           = useState(null);
  const [showTour,setShowTour]         = useState(false);
  const [streak,setStreak]             = useState(0);
  const [newAchievements,setNewAchievements] = useState([]);
  const firstRender = useRef(true);

  useEffect(()=>{
    storageLoad(DOCS_KEY,[]).then(saved=>{
      if(Array.isArray(saved)) setDocs(saved);
      setLoadingDocs(false);
    });
  },[]);

  useEffect(()=>{
    if(firstRender.current){firstRender.current=false;return;}
    storageSave(DOCS_KEY,docs);
  },[docs]);

  const handleLogin = u => {
    setUser(u); setPage("dashboard"); setRoute("app");
    if (u.role==="student") {
      const s = getOrUpdateStreak(u.email);
      setStreak(s.streak);
      logActivity(u.email, 1);
      // check achievements on login
      const stats = {
        streak: s.streak,
        quizzesTaken: 0, bestScore: 0, avgScore: 0,
        questionsAsked: 0, flashcardsMastered: 0,
      };
      const newOnes = checkAndUnlock(u.email, stats);
      if (newOnes.length) setNewAchievements(newOnes);
    }
    const tourKey=`learngpt:tour:${u.email}`;
    try{ if(!localStorage.getItem(tourKey)) setShowTour(true); }catch{}
  };

  const handleTourComplete = () => {
    setShowTour(false);
    if(user) try{localStorage.setItem(`learngpt:tour:${user.email}`,"done");}catch{}
  };

  const handleLogout = async () => {
    if(user&&user.role==="student"){
      await saveProgress(user.email,{
        name:user.name,
        questionsAsked:chatHistory.length,
        quizzesTaken:quizResults.length,
        avgScore:quizResults.length?Math.round(quizResults.reduce((s,r)=>s+r.pct,0)/quizResults.length):0,
        bestScore:quizResults.length?Math.max(...quizResults.map(r=>r.pct)):0,
        flashcardsMastered:flashcardStats.known,
        totalFlashcards:flashcardStats.total,
        quizHistory:quizResults.slice(-5),
        lastActive:Date.now(),
      });
    }
    setUser(null);setRoute("landing");setPage("dashboard");
    setChatHistory([]);setQuizResults([]);setShowTour(false);
  };

  const renderPage = () => {
    if(page==="upload"&&user?.role!=="admin"){setPage("dashboard");return null;}
    switch(page){
      case "dashboard":  return <Dashboard user={user} docs={docs} chatHistory={chatHistory} quizResults={quizResults} flashcardStats={flashcardStats} setPage={setPage} streak={streak}/>;
      case "upload":     return <Upload onUpload={doc=>setDocs(p=>[...p,doc])}/>;
      case "documents":  return <Documents user={user} docs={docs} onDelete={id=>setDocs(p=>p.filter(d=>d.id!==id))} setPage={setPage} setChatDoc={setChatDoc}/>;
      case "chat":       return <Chat user={user} docs={docs} chatDoc={chatDoc} onMessage={q=>{setChatHistory(p=>[...p,{q,ts:Date.now()}]);if(user.role==="student")logActivity(user.email,1);}}/>;
      case "notes":      return <Notes user={user} docs={docs}/>;
      case "flashcards": return <Flashcards docs={docs} onUpdateDoc={(id,u)=>setDocs(p=>p.map(d=>d.id===id?{...d,...u}:d))} onFlashcardStats={stats=>{setFlashcardStats(stats);if(user.role==="student"){logActivity(user.email,1);const newOnes=checkAndUnlock(user.email,{streak,...stats,quizzesTaken:quizResults.length,bestScore:quizResults.length?Math.max(...quizResults.map(r=>r.pct)):0,avgScore:quizResults.length?Math.round(quizResults.reduce((s,r)=>s+r.pct,0)/quizResults.length):0,questionsAsked:chatHistory.length});if(newOnes.length)setNewAchievements(newOnes);}}}/>;
      case "quiz":       return <Quiz docs={docs} onResult={async r=>{
        const updated=[...quizResults,r]; setQuizResults(updated);
        if(user.role==="student"){
          logActivity(user.email, 3);
          const progressData = {
            name:user.name,
            questionsAsked:chatHistory.length,
            quizzesTaken:updated.length,
            avgScore:Math.round(updated.reduce((s,x)=>s+x.pct,0)/updated.length),
            bestScore:Math.max(...updated.map(x=>x.pct)),
            flashcardsMastered:flashcardStats.known,
            totalFlashcards:flashcardStats.total,
            quizHistory:updated.slice(-5),
            lastActive:Date.now(),
          };
          await saveProgress(user.email, progressData);
          const newOnes = checkAndUnlock(user.email, {...progressData, streak});
          if (newOnes.length) setNewAchievements(newOnes);
        }
      }}/>;
      case "progress":    return <Progress user={user} docs={docs} chatHistory={chatHistory} quizResults={quizResults} flashcardStats={flashcardStats} streak={streak}/>;
      case "analytics":   return <Analytics docs={docs} chatHistory={chatHistory} quizResults={quizResults}/>;
      case "quiz-mgmt":   return <QuizManagement docs={docs}/>;
      case "leaderboard": return <Leaderboard user={user}/>;
      case "users":       return <Users user={user}/>;
      default:            return <Dashboard user={user} docs={docs} chatHistory={chatHistory} quizResults={quizResults} flashcardStats={flashcardStats} setPage={setPage}/>;
    }
  };

  if(loadingDocs) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16,background:"#07090f"}}>
      <div style={{width:42,height:42,background:"linear-gradient(135deg,#6366f1,#22d3ee)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center"}}><Ic name="brain" size={20} color="#fff"/></div>
      <Spinner size={28}/>
      <p style={{color:"#64748b",fontSize:14}}>Loading LearnGPT…</p>
    </div>
  );

  return (
    <ThemeCtx.Provider value={{mode:themeMode,toggle:toggleTheme}}>
      <NotifCtx.Provider value={{permission:notifPerm,request:requestNotif,send:sendNotif}}>
        <div data-theme={themeMode}>
          <style>{GS}</style>
          {route==="landing"  && <Landing onNav={setRoute}/>}
          {route==="login"    && <AuthPage mode="login"    onNav={setRoute} onLogin={handleLogin}/>}
          {route==="register" && <AuthPage mode="register" onNav={setRoute} onLogin={handleLogin}/>}
          {route==="app" && user && (
            <Layout user={user} page={page} setPage={setPage} onLogout={handleLogout} onStartTour={()=>setShowTour(true)}>
              {renderPage()}
            </Layout>
          )}
          {showTour && user && <OnboardingTour onComplete={handleTourComplete} isAdmin={user.role==="admin"}/>}
          {newAchievements.length>0 && <AchievementToast achievements={newAchievements} onDismiss={()=>setNewAchievements([])}/>}
          {user?.role==="student" && route==="app" && <StudyTimer onStudyComplete={()=>logActivity(user.email,2)}/>}
        </div>
      </NotifCtx.Provider>
    </ThemeCtx.Provider>
  );
}
