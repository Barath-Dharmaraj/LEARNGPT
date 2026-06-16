import { useState, useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════════════════
// ⚙️  ADMIN CONFIG
// ═══════════════════════════════════════════════════════════════


const GS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #07090f; color: #f1f5f9; font-family: 'Inter', sans-serif; min-height: 100vh; overflow-x: hidden; }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.09); border-radius: 999px; }
  ::selection { background: #6366f144; }
  @keyframes spin  { to { transform: rotate(360deg); } }
  @keyframes fade-in { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }

  /* ── Mobile bottom nav ── */
  .bottom-nav {
    display: none;
    position: fixed;
    bottom: 0; left: 0; right: 0;
    background: #0d1117;
    border-top: 1px solid rgba(255,255,255,0.09);
    z-index: 100;
    padding: 6px 0 10px;
  }
  .bottom-nav-inner {
    display: flex;
    justify-content: space-around;
    align-items: center;
  }
  .bottom-nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 6px 12px;
    border-radius: 10px;
    cursor: pointer;
    border: none;
    background: transparent;
    font-family: inherit;
    transition: all 0.18s;
  }
  .bottom-nav-item span {
    font-size: 10px;
    font-weight: 500;
  }
  .desktop-sidebar { display: flex; }

  @media (max-width: 768px) {
    .desktop-sidebar { display: none !important; }
    .bottom-nav { display: block; }
    .main-content { padding-bottom: 80px !important; }
    .page-padding { padding: 20px 16px !important; }
    .stats-grid { grid-template-columns: 1fr 1fr !important; }
    .doc-actions { flex-direction: column !important; gap: 6px !important; }
    .chat-header { flex-wrap: wrap !important; gap: 8px !important; }
    .chat-select { width: 100% !important; }
    .quiz-opts { flex-direction: column !important; }
    .hero-btns { flex-direction: column !important; align-items: center !important; }
    .hero-pills { display: none !important; }
    .nav-links { display: none !important; }
  }
`;
const glass = (r=14) => ({ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.09)", backdropFilter:"blur(18px)", borderRadius:r });
const btn   = { cursor:"pointer", border:"none", outline:"none", fontFamily:"inherit", fontWeight:500, transition:"all 0.18s" };
const FILE_COLORS = { pdf:"#f87171", docx:"#60a5fa", doc:"#60a5fa", pptx:"#fb923c", txt:"#4ade80" };
const fileClr = (n="") => FILE_COLORS[n.split(".").pop()?.toLowerCase()] || "#6366f1";
const fmtSize = b => b<1048576 ? `${(b/1024).toFixed(1)} KB` : `${(b/1048576).toFixed(1)} MB`;
const fmtDate = ts => new Date(ts).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
const fmtTime = d  => new Date(d).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});

// ═══════════════════════════════════════════════════════════════
// Storage — uses localStorage for deployed version
// ═══════════════════════════════════════════════════════════════
const DOCS_KEY  = "learngpt:docs:v1";
const USERS_KEY = "learngpt:users:v1";

async function storageSave(key, value) {
  try {
    // Save to server via Netlify function
    await fetch("/.netlify/functions/storage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set", key, value: JSON.stringify(value) })
    });
  } catch(e) { console.warn("save error:", e); }
}

async function storageLoad(key, fallback) {
  try {
    const r = await fetch("/.netlify/functions/storage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get", key })
    });
    const d = await r.json();
    return d.value ? JSON.parse(d.value) : fallback;
  } catch { return fallback; }
}

// ═══════════════════════════════════════════════════════════════
// AI — Groq (free) with retry logic
// ═══════════════════════════════════════════════════════════════
async function claude(messages, system="", retries=3) {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch("/.netlify/functions/chat", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ model:"llama-3.1-8b-instant", max_tokens:1000, system, messages })
      });
      if (!r.ok) {
        const err = await r.json().catch(()=>({}));
        if (r.status === 429 && i < retries-1) {
          await new Promise(res => setTimeout(res, 2000 * (i+1)));
          continue;
        }
        return `Error ${r.status}: ${err.error?.message || r.statusText}`;
      }
      const d = await r.json();
      return d.content?.[0]?.text || d.choices?.[0]?.message?.content || "No response received";
    } catch(e) {
      if (i === retries-1) return `Error: ${e.message}`;
      await new Promise(res => setTimeout(res, 1500));
    }
  }
  return "Failed after multiple attempts. Please try again.";
}

// ═══════════════════════════════════════════════════════════════
// File text extraction
// ═══════════════════════════════════════════════════════════════
async function loadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      resolve(window.pdfjsLib);
    };
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
    if (ext === "txt") {
      return await new Promise(res => {
        const r = new FileReader();
        r.onload = e => res(e.target.result.slice(0, 16000));
        r.onerror = () => res(`[File: ${file.name}]`);
        r.readAsText(file);
      });
    }
    if (ext === "pdf") {
      const lib = await loadPdfJs();
      const buf = await file.arrayBuffer();
      const pdf = await lib.getDocument({ data: buf }).promise;
      let text = "";
      for (let i = 1; i <= Math.min(pdf.numPages, 40); i++) {
        const pg = await pdf.getPage(i);
        const ct = await pg.getTextContent();
        text += `\n[Page ${i}]\n` + ct.items.map(x => x.str).join(" ");
      }
      return text.slice(0, 16000);
    }
    if (ext === "docx" || ext === "doc") {
      try {
        const mammoth = await loadMammoth();
        const buf = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: buf });
        if (result.value && result.value.length > 50) {
          return result.value.slice(0, 16000);
        }
      } catch(e) { console.warn("mammoth failed, using fallback", e); }
      // fallback binary extraction
      return await new Promise(res => {
        const r = new FileReader();
        r.onload = e => {
          const bytes = new Uint8Array(e.target.result);
          let text = "", run = "";
          for (let i = 0; i < bytes.length; i++) {
            const c = bytes[i];
            if (c >= 32 && c < 127) { run += String.fromCharCode(c); }
            else { if (run.length > 4) text += run + " "; run = ""; }
          }
          if (run.length > 4) text += run;
          const cleaned = text
            .replace(/<[^>]{0,200}>/g," ")
            .replace(/\w+:\w+="[^"]*"/g," ")
            .replace(/[a-zA-Z]{25,}/g," ")
            .replace(/\s{2,}/g," ")
            .trim();
          const words = cleaned.split(" ")
            .filter(w => w.length >= 2 && w.length <= 25 && /[a-zA-Z]/.test(w))
            .join(" ").slice(0, 16000);
          res(words.length > 100 ? words : `[Document: "${file.name}" — please convert to PDF for better results]`);
        };
        r.onerror = () => res(`[File: ${file.name}]`);
        r.readAsArrayBuffer(file);
      });
    }
    if (ext === "pptx") {
      return await new Promise(res => {
        const r = new FileReader();
        r.onload = e => {
          const bytes = new Uint8Array(e.target.result);
          let text = "", run = "";
          for (let i = 0; i < bytes.length; i++) {
            const c = bytes[i];
            if (c >= 32 && c < 127) { run += String.fromCharCode(c); }
            else { if (run.length > 3) text += run + " "; run = ""; }
          }
          const cleaned = text.replace(/<[^>]{0,120}>/g," ").replace(/\s{3,}/g," ").trim().slice(0,16000);
          res(cleaned.length > 100 ? cleaned : `[PPTX: ${file.name}]`);
        };
        r.onerror = () => res(`[File: ${file.name}]`);
        r.readAsArrayBuffer(file);
      });
    }
  } catch(e) { console.warn("extraction failed", e); }
  return `[Document: "${file.name}" (${fmtSize(file.size)}) — could not extract text.]`;
}

// ═══════════════════════════════════════════════════════════════
// Markdown renderer — fixes **bold** showing as raw text
// ═══════════════════════════════════════════════════════════════
function renderMarkdown(text) {
  if (!text) return null;
  const lines = text.split("\n");
  return lines.map((line, i) => {
    // Source citation
    if (line.startsWith("[Source:")) {
      return <div key={i} style={{marginTop:8,padding:"5px 10px",background:"#6366f118",border:"1px solid #6366f133",borderRadius:6,fontSize:12,color:"#818cf8"}}>{line}</div>;
    }
    // Heading ##
    if (line.startsWith("## ")) {
      return <div key={i} style={{fontWeight:700,fontSize:16,marginTop:14,marginBottom:4,color:"#f1f5f9"}}>{parseBold(line.slice(3))}</div>;
    }
    // Heading ###
    if (line.startsWith("### ")) {
      return <div key={i} style={{fontWeight:600,fontSize:14,marginTop:10,marginBottom:3,color:"#e2e8f0"}}>{parseBold(line.slice(4))}</div>;
    }
    // Bullet * or -
    if (line.match(/^[\*\-\+] /)) {
      return <div key={i} style={{paddingLeft:16,marginTop:3,display:"flex",gap:8}}><span style={{color:"#6366f1",flexShrink:0}}>•</span><span>{parseBold(line.slice(2))}</span></div>;
    }
    // Numbered list
    if (line.match(/^\d+\. /)) {
      const num = line.match(/^(\d+)\. /)[1];
      return <div key={i} style={{paddingLeft:16,marginTop:3,display:"flex",gap:8}}><span style={{color:"#6366f1",flexShrink:0,minWidth:18}}>{num}.</span><span>{parseBold(line.slice(num.length+2))}</span></div>;
    }
    // Indented bullet
    if (line.match(/^\s+[\*\-\+] /)) {
      return <div key={i} style={{paddingLeft:32,marginTop:2,display:"flex",gap:8,fontSize:13}}><span style={{color:"#818cf8",flexShrink:0}}>◦</span><span style={{color:"#94a3b8"}}>{parseBold(line.replace(/^\s+[\*\-\+] /,""))}</span></div>;
    }
    // Empty line
    if (line.trim() === "") return <div key={i} style={{height:6}}/>;
    // Normal text
    return <div key={i} style={{marginTop:2,lineHeight:1.7}}>{parseBold(line)}</div>;
  });
}

function parseBold(text) {
  if (!text.includes("**") && !text.includes("*") && !text.includes("`")) return text;
  const parts = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === "*" && text[i+1] === "*") {
      const end = text.indexOf("**", i+2);
      if (end !== -1) {
        parts.push(<strong key={i} style={{color:"#f1f5f9",fontWeight:600}}>{text.slice(i+2, end)}</strong>);
        i = end + 2; continue;
      }
    }
    if (text[i] === "`") {
      const end = text.indexOf("`", i+1);
      if (end !== -1) {
        parts.push(<code key={i} style={{background:"rgba(255,255,255,0.1)",padding:"1px 5px",borderRadius:4,fontSize:"0.9em",fontFamily:"'JetBrains Mono',monospace"}}>{text.slice(i+1, end)}</code>);
        i = end + 1; continue;
      }
    }
    // collect normal chars
    let j = i;
    while (j < text.length && !(text[j]==="*"&&text[j+1]==="*") && text[j]!=="`") j++;
    if (j > i) parts.push(text.slice(i, j));
    i = j;
  }
  return parts.length > 0 ? parts : text;
}

// ═══════════════════════════════════════════════════════════════
// UI atoms
// ═══════════════════════════════════════════════════════════════
const Spinner = ({size=18}) => (
  <div style={{width:size,height:size,border:"2px solid rgba(255,255,255,0.09)",borderTopColor:"#6366f1",borderRadius:"50%",animation:"spin 0.65s linear infinite",flexShrink:0}}/>
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
    <div style={{fontSize:17,fontWeight:600,marginBottom:7}}>{title}</div>
    <div style={{fontSize:13.5,color:"#64748b",maxWidth:300,lineHeight:1.65,marginBottom:action?22:0}}>{sub}</div>
    {action&&<button onClick={onAction} style={{...btn,background:"linear-gradient(135deg,#6366f1,#818cf8)",color:"#fff",padding:"10px 22px",borderRadius:10,fontSize:13.5}}>{action}</button>}
  </div>
);

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
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column"}}>
      <nav style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 48px",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,background:"linear-gradient(135deg,#6366f1,#22d3ee)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center"}}><Ic name="brain" size={16} color="#fff"/></div>
          <span style={{fontWeight:700,fontSize:18,letterSpacing:"-0.02em"}}>LearnGPT</span>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>onNav("login")} style={{...btn,...glass(8),color:"#94a3b8",padding:"8px 18px",fontSize:14}}>Sign In</button>
          <button onClick={()=>onNav("register")} style={{...btn,background:"linear-gradient(135deg,#6366f1,#818cf8)",color:"#fff",padding:"8px 20px",borderRadius:8,fontSize:14}}>Get Started</button>
        </div>
      </nav>
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"80px 24px",textAlign:"center",position:"relative"}}>
        <div style={{position:"absolute",top:"15%",left:"50%",transform:"translateX(-50%)",width:500,height:500,background:"radial-gradient(ellipse,#6366f114 0%,transparent 70%)",pointerEvents:"none"}}/>
        <div style={{width:170,height:170,marginBottom:36,animation:"float 4s ease-in-out infinite"}}>
          <svg viewBox="0 0 100 100" style={{width:"100%",height:"100%"}}>
            {ns.map((n,i)=>ns.filter((_,j)=>j!==i&&j<i+3).map((m,k)=>(<line key={`${i}-${k}`} x1={n.x} y1={n.y} x2={m.x} y2={m.y} stroke="#6366f128" strokeWidth="0.6"/>)))}
            {ns.map((n,i)=>(<circle key={i} cx={n.x} cy={n.y} r={3+(i%3)} fill={i%2===0?"#6366f1":"#22d3ee"} opacity={0.6+0.4*Math.sin(tick*0.05+i)}/>))}
            <circle cx="50" cy="50" r="9" fill="#6366f1"/><circle cx="50" cy="50" r="4" fill="#fff"/>
          </svg>
        </div>
        <div style={{display:"inline-flex",alignItems:"center",gap:7,background:"#6366f118",border:"1px solid #6366f144",borderRadius:999,padding:"5px 14px",marginBottom:20,fontSize:12,color:"#818cf8"}}>
          <Ic name="sparkle" size={12} color="#818cf8"/> RAG-powered AI tutor
        </div>
        <h1 style={{fontSize:"clamp(32px,5.5vw,64px)",fontWeight:800,letterSpacing:"-0.04em",lineHeight:1.1,marginBottom:14,maxWidth:720}}>
          Chat with your{" "}
          <span style={{background:"linear-gradient(135deg,#6366f1,#22d3ee)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{word}</span>
          <br/>using AI
        </h1>
        <p style={{fontSize:16.5,color:"#94a3b8",maxWidth:480,lineHeight:1.7,marginBottom:34}}>
          Upload your study materials. Ask questions. Get AI-generated flashcards, quizzes, and summaries — grounded in <em>your</em> documents only.
        </p>
        <div style={{display:"flex",gap:12,flexWrap:"wrap",justifyContent:"center"}}>
          <button onClick={()=>onNav("register")} style={{...btn,background:"linear-gradient(135deg,#6366f1,#22d3ee)",color:"#fff",padding:"13px 30px",borderRadius:12,fontSize:15.5,fontWeight:600,boxShadow:"0 0 28px #6366f144"}}>Start Learning Free</button>
          <button onClick={()=>onNav("login")} style={{...btn,...glass(12),color:"#f1f5f9",padding:"13px 26px",fontSize:15}}>Sign In</button>
        </div>
        <div style={{display:"flex",gap:9,marginTop:40,flexWrap:"wrap",justifyContent:"center"}}>
          {["PDF / DOCX / PPTX / TXT","RAG Chatbot","AI Flashcards","AI Quiz Generator","Progress Tracking"].map(f=>(
            <span key={f} style={{...glass(999),padding:"5px 13px",fontSize:12,color:"#64748b"}}><span style={{color:"#4ade80",marginRight:5}}>✓</span>{f}</span>
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
      // Check admin via secure server function
      const adminCheck = await fetch("/.netlify/functions/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: form.password })
      });
      const adminResult = await adminCheck.json();
      if (adminResult.success) {
        onLogin({ name: "Admin", email: form.email, role: "admin" });
        setLoading(false);
        return;
      }
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
      <label style={{fontSize:13,color:"#94a3b8",display:"block",marginBottom:6}}>{label}</label>
      <div style={{position:"relative"}}>
        <input type={key==="password"?(show?"text":"password"):type} value={form[key]}
          onChange={e=>setForm({...form,[key]:e.target.value})} placeholder={ph}
          onKeyDown={e=>e.key==="Enter"&&submit()}
          style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:10,padding:key==="password"?"10px 40px 10px 13px":"10px 13px",color:"#f1f5f9",fontSize:14,outline:"none",fontFamily:"inherit"}}/>
        {key==="password"&&<button onClick={()=>setShow(!show)} style={{...btn,position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",color:"#64748b",padding:3}}><Ic name={show?"eyeoff":"eye"} size={15}/></button>}
      </div>
    </div>
  );
  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 30% 50%,#6366f10d 0%,transparent 60%)",pointerEvents:"none"}}/>
      <div style={{...glass(),padding:38,width:"100%",maxWidth:410,animation:"fade-in 0.4s ease"}}>
        <button onClick={()=>onNav("landing")} style={{...btn,background:"none",color:"#64748b",fontSize:13,marginBottom:22,display:"flex",alignItems:"center",gap:6}}><Ic name="back" size={14}/> Back</button>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:22}}>
          <div style={{width:40,height:40,borderRadius:10,background:"linear-gradient(135deg,#6366f1,#22d3ee)",display:"flex",alignItems:"center",justifyContent:"center"}}><Ic name={mode==="login"?"lock":"brain"} size={18} color="#fff"/></div>
          <div>
            <h2 style={{fontSize:21,fontWeight:700,lineHeight:1}}>{mode==="login"?"Welcome back":"Create account"}</h2>
            <p style={{color:"#64748b",fontSize:13,marginTop:3}}>{mode==="login"?"Sign in to continue":"Free forever — no credit card"}</p>
          </div>
        </div>
        {mode==="register"&&field("Full Name","name","text","Your name")}
        {field("Email","email","email","you@example.com")}
        {field("Password","password","password","••••••••")}
        {err&&<div style={{color:"#f87171",fontSize:13,marginBottom:13,display:"flex",alignItems:"center",gap:6,padding:"8px 12px",background:"#f8717111",borderRadius:8,border:"1px solid #f8717133"}}><Ic name="alert" size={13} color="#f87171"/>{err}</div>}
        <button onClick={submit} disabled={loading} style={{...btn,width:"100%",background:"linear-gradient(135deg,#6366f1,#22d3ee)",color:"#fff",padding:"11px",borderRadius:10,fontSize:14.5,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:loading?0.8:1}}>
          {loading?<Spinner size={16}/>:mode==="login"?"Sign In →":"Create Account →"}
        </button>
        <div style={{textAlign:"center",marginTop:16,fontSize:13.5,color:"#64748b"}}>
          {mode==="login"?<>No account? <button onClick={()=>onNav("register")} style={{...btn,background:"none",color:"#818cf8",padding:0}}>Register free</button></>:<>Have an account? <button onClick={()=>onNav("login")} style={{...btn,background:"none",color:"#818cf8",padding:0}}>Sign In</button></>}
        </div>
        {mode==="login"&&(
          <div style={{marginTop:18,padding:"10px 12px",background:"#6366f10d",borderRadius:8,border:"1px solid #6366f122",fontSize:12,color:"#64748b",display:"flex",alignItems:"flex-start",gap:8}}>
            <Ic name="shield" size={13} color="#6366f1"/>
            <span>Students: register with any email. Only the admin can upload documents.</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// LAYOUT
// ═══════════════════════════════════════════════════════════════
const NAV_STUDENT=[{id:"dashboard",label:"Dashboard",icon:"home"},{id:"documents",label:"Library",icon:"book"},{id:"chat",label:"AI Tutor",icon:"chat"},{id:"flashcards",label:"Flashcards",icon:"flash"},{id:"quiz",label:"Quiz",icon:"quiz"},{id:"progress",label:"Progress",icon:"chart"}];
const NAV_ADMIN  =[{id:"dashboard",label:"Dashboard",icon:"home"},{id:"upload",label:"Upload",icon:"upload"},{id:"documents",label:"Documents",icon:"book"},{id:"analytics",label:"Analytics",icon:"chart"},{id:"users",label:"Users",icon:"users"}];
const Layout = ({user,page,setPage,onLogout,children}) => {
  const nav=user.role==="admin"?NAV_ADMIN:NAV_STUDENT;
  const [col,setCol]=useState(false);
  return (
    <div style={{display:"flex",minHeight:"100vh"}}>
      {/* Desktop sidebar */}
      <aside className="desktop-sidebar" style={{width:col?58:212,flexShrink:0,borderRight:"1px solid rgba(255,255,255,0.08)",flexDirection:"column",transition:"width 0.22s",overflow:"hidden",position:"sticky",top:0,height:"100vh"}}>
        <div style={{padding:col?"16px 10px":"16px 16px",borderBottom:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:9,overflow:"hidden"}}>
            <div style={{width:30,height:30,background:"linear-gradient(135deg,#6366f1,#22d3ee)",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Ic name="brain" size={14} color="#fff"/></div>
            {!col&&<span style={{fontWeight:700,fontSize:15,letterSpacing:"-0.02em",whiteSpace:"nowrap"}}>LearnGPT</span>}
          </div>
          <button onClick={()=>setCol(!col)} style={{...btn,background:"none",color:"#64748b",padding:3,flexShrink:0}}><Ic name="menu" size={15}/></button>
        </div>
        <nav style={{flex:1,padding:"9px 6px"}}>
          {nav.map(item=>(
            <button key={item.id} onClick={()=>setPage(item.id)}
              style={{...btn,width:"100%",display:"flex",alignItems:"center",gap:10,padding:col?"10px 11px":"10px 12px",borderRadius:9,marginBottom:2,background:page===item.id?"#6366f122":"transparent",color:page===item.id?"#818cf8":"#64748b",justifyContent:col?"center":"flex-start"}}>
              <Ic name={item.icon} size={16} color={page===item.id?"#818cf8":"#64748b"}/>
              {!col&&<span style={{fontSize:13.5,fontWeight:page===item.id?600:400,whiteSpace:"nowrap"}}>{item.label}</span>}
            </button>
          ))}
        </nav>
        <div style={{padding:"9px 6px",borderTop:"1px solid rgba(255,255,255,0.08)"}}>
          {!col&&(
            <div style={{padding:"8px 10px",marginBottom:5,display:"flex",alignItems:"center",gap:9}}>
              <div style={{width:30,height:30,borderRadius:7,background:user.role==="admin"?"#fb923c33":"#6366f133",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:user.role==="admin"?"#fb923c":"#818cf8",fontSize:13,flexShrink:0}}>{user.name[0].toUpperCase()}</div>
              <div style={{overflow:"hidden"}}>
                <div style={{fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name}</div>
                <Badge color={user.role==="admin"?"#fb923c":"#6366f1"}>{user.role}</Badge>
              </div>
            </div>
          )}
          <button onClick={onLogout} style={{...btn,width:"100%",display:"flex",alignItems:"center",gap:9,padding:col?"10px 11px":"10px 12px",borderRadius:9,background:"transparent",color:"#64748b",justifyContent:col?"center":"flex-start"}}>
            <Ic name="logout" size={15} color="#64748b"/>
            {!col&&<span style={{fontSize:13.5}}>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content" style={{flex:1,overflow:"auto",minWidth:0}}>
        {children}
      </main>

      {/* Mobile bottom navigation */}
      <div className="bottom-nav">
        <div className="bottom-nav-inner">
          {nav.slice(0,5).map(item=>(
            <button key={item.id} className="bottom-nav-item" onClick={()=>setPage(item.id)}
              style={{color:page===item.id?"#818cf8":"#64748b",background:page===item.id?"#6366f122":"transparent"}}>
              <Ic name={item.icon} size={20} color={page===item.id?"#818cf8":"#64748b"}/>
              <span style={{color:page===item.id?"#818cf8":"#64748b"}}>{item.label}</span>
            </button>
          ))}
          <button className="bottom-nav-item" onClick={onLogout} style={{color:"#64748b"}}>
            <Ic name="logout" size={20} color="#64748b"/>
            <span>Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════
const Dashboard = ({user,docs,chatHistory,quizResults,flashcardStats,setPage}) => {
  const isAdmin=user.role==="admin";
  const totalChunks=docs.reduce((s,d)=>s+(d.chunks||0),0);
  const avgQuiz=quizResults.length?Math.round(quizResults.reduce((s,r)=>s+r.pct,0)/quizResults.length):null;
  const stats=isAdmin
    ?[{icon:"book",label:"Documents",value:docs.length,sub:totalChunks?`${totalChunks.toLocaleString()} chunks indexed`:"None uploaded yet",color:"#6366f1"},{icon:"chat",label:"Questions Asked",value:chatHistory.length,sub:"This session",color:"#22d3ee"},{icon:"quiz",label:"Quizzes Taken",value:quizResults.length,sub:avgQuiz!==null?`Avg ${avgQuiz}%`:"None yet",color:"#4ade80"},{icon:"flash",label:"Flashcard Sets",value:docs.filter(d=>d.flashcards?.length>0).length,sub:"Generated",color:"#fb923c"}]
    :[{icon:"book",label:"Docs Available",value:docs.length,sub:docs.length?`${totalChunks.toLocaleString()} chunks`:"No docs yet",color:"#6366f1"},{icon:"chat",label:"Questions Asked",value:chatHistory.length,sub:chatHistory.length?"This session":"Ask the AI tutor!",color:"#22d3ee"},{icon:"quiz",label:"Quizzes Taken",value:quizResults.length,sub:avgQuiz!==null?`Avg ${avgQuiz}%`:"None yet",color:"#4ade80"},{icon:"flash",label:"Cards Mastered",value:`${flashcardStats.known}/${flashcardStats.total}`,sub:flashcardStats.total?"Keep going!":"Generate flashcards first",color:"#fb923c"}];
  return (
    <div className="page-padding" style={{padding:"32px 36px",maxWidth:1050,margin:"0 auto"}}>
      <div style={{marginBottom:26}}>
        <h1 style={{fontSize:25,fontWeight:700,marginBottom:4}}>
          {new Date().getHours()<12?"Good morning":new Date().getHours()<17?"Good afternoon":"Good evening"}, {user.name.split(" ")[0]} {isAdmin?"👑":"👋"}
        </h1>
        <p style={{color:"#64748b",fontSize:14}}>{isAdmin?"You're the admin — only you can upload documents.":"What are you learning today?"}</p>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))",gap:13,marginBottom:22}}>
        {stats.map((s,i)=>(
          <div key={i} style={{...glass(),padding:18,animation:"fade-in 0.4s ease both",animationDelay:`${i*55}ms`}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <div style={{width:35,height:35,borderRadius:8,background:s.color+"22",display:"flex",alignItems:"center",justifyContent:"center"}}><Ic name={s.icon} size={16} color={s.color}/></div>
              <span style={{fontSize:12.5,color:"#94a3b8",fontWeight:500}}>{s.label}</span>
            </div>
            <div style={{fontSize:26,fontWeight:700}}>{s.value}</div>
            <div style={{fontSize:12,color:"#64748b",marginTop:3}}>{s.sub}</div>
          </div>
        ))}
      </div>
      <div style={{...glass(),padding:0,overflow:"hidden"}}>
        {docs.length===0?(
          <EmptyState icon={isAdmin?"upload":"book"} title={isAdmin?"No documents yet":"Library is empty"}
            sub={isAdmin?"Upload your first document. Students can then chat with it, take quizzes, and create flashcards.":"The admin hasn't uploaded any documents yet. Check back soon."}
            action={isAdmin?"Upload First Document":null} onAction={()=>setPage("upload")}/>
        ):(
          <div style={{padding:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <h3 style={{fontSize:15,fontWeight:600}}>Recent Documents</h3>
              <button onClick={()=>setPage("documents")} style={{...btn,background:"none",color:"#818cf8",fontSize:13,display:"flex",alignItems:"center",gap:4}}>View all <Ic name="arrow" size={12} color="#818cf8"/></button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {[...docs].reverse().slice(0,4).map(doc=>(
                <div key={doc.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",borderRadius:9,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)"}}>
                  <div style={{width:33,height:33,borderRadius:7,background:fileClr(doc.filename)+"22",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Ic name="file" size={14} color={fileClr(doc.filename)}/></div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13.5,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{doc.name}</div>
                    <div style={{fontSize:12,color:"#64748b"}}>{fmtSize(doc.size)} · {doc.chunks} chunks · {fmtDate(doc.uploadedAt)}</div>
                  </div>
                  <Badge color={fileClr(doc.filename)}>{doc.type.toUpperCase()}</Badge>
                </div>
              ))}
            </div>
            {!isAdmin&&(
              <div style={{display:"flex",gap:9,marginTop:14,flexWrap:"wrap"}}>
                {[{label:"Ask AI Tutor",icon:"chat",p:"chat",c:"#6366f1"},{label:"Take a Quiz",icon:"quiz",p:"quiz",c:"#fb923c"},{label:"Flashcards",icon:"flash",p:"flashcards",c:"#4ade80"}].map(a=>(
                  <button key={a.p} onClick={()=>setPage(a.p)} style={{...btn,...glass(9),display:"flex",alignItems:"center",gap:7,padding:"8px 14px",color:"#f1f5f9",fontSize:13}}><Ic name={a.icon} size={13} color={a.c}/>{a.label}</button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
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
  const processFile=async(file)=>{
    if(!file) return;
    const ext=file.name.split(".").pop().toLowerCase();
    if(!["pdf","docx","doc","pptx","txt"].includes(ext)){alert("Unsupported type. Upload PDF, DOCX, PPTX, or TXT.");return;}
    setProcessing(true);setStages([]);setDone(null);
    const stageList=[
      ext==="pdf"?"Parsing PDF pages…":ext==="docx"||ext==="doc"?"Parsing DOCX content…":ext==="pptx"?"Parsing PPTX slides…":"Reading file…",
      "Extracting text…","Chunking document…","Generating embeddings…","Indexing in vector store…"
    ];
    for(const s of stageList){
      setStages(prev=>[...prev,{label:s,active:true,done:false}]);
      await new Promise(r=>setTimeout(r,650+Math.random()*450));
      setStages(prev=>prev.map(x=>x.label===s?{...x,active:false,done:true}:x));
    }
    const text=await extractText(file);
    const chunks=Math.max(10,Math.floor(text.replace(/\s+/g," ").length/220));
    const doc={id:Date.now(),name:file.name.replace(/\.[^.]+$/,""),filename:file.name,size:file.size,type:ext,uploadedAt:Date.now(),chunks,text,flashcards:[]};
    setDone(doc);onUpload(doc);setProcessing(false);
  };
  return (
    <div className="page-padding" style={{padding:"32px 36px",maxWidth:580,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:6}}>
        <div style={{width:36,height:36,borderRadius:9,background:"#fb923c22",display:"flex",alignItems:"center",justifyContent:"center"}}><Ic name="shield" size={16} color="#fb923c"/></div>
        <div>
          <h1 style={{fontSize:25,fontWeight:700,lineHeight:1}}>Upload Document</h1>
          <p style={{fontSize:12,color:"#fb923c",marginTop:3}}>Admin only — students cannot access this page</p>
        </div>
      </div>
      <p style={{color:"#64748b",fontSize:13.5,marginBottom:24,marginTop:10}}>Supports PDF (page-by-page), DOCX, PPTX, TXT. Documents are persisted and shared with all students automatically.</p>
      <div onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)}
        onDrop={e=>{e.preventDefault();setDragging(false);processFile(e.dataTransfer.files[0]);}}
        onClick={()=>!processing&&inputRef.current?.click()}
        style={{...glass(),border:`2px dashed ${dragging?"#6366f1":"rgba(255,255,255,0.09)"}`,borderRadius:13,padding:"44px 28px",textAlign:"center",cursor:processing?"default":"pointer",background:dragging?"#6366f10a":"rgba(255,255,255,0.04)",transition:"all 0.2s",marginBottom:18}}>
        <input ref={inputRef} type="file" accept=".pdf,.docx,.doc,.pptx,.txt" onChange={e=>processFile(e.target.files[0])} style={{display:"none"}}/>
        <div style={{width:50,height:50,borderRadius:12,background:"#6366f122",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 13px"}}><Ic name="upload" size={22} color="#6366f1"/></div>
        <p style={{fontWeight:600,marginBottom:5,fontSize:15}}>{processing?"Processing…":"Drag & drop or click to upload"}</p>
        <p style={{color:"#64748b",fontSize:13}}>PDF · DOCX · PPTX · TXT · Max 50 MB</p>
      </div>
      {stages.length>0&&(
        <div style={{...glass(),padding:20}}>
          {done&&(
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,padding:"9px 11px",background:"rgba(255,255,255,0.03)",borderRadius:8}}>
              <div style={{width:32,height:32,borderRadius:7,background:fileClr(done.filename)+"22",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Ic name="file" size={14} color={fileClr(done.filename)}/></div>
              <div><div style={{fontSize:13.5,fontWeight:500}}>{done.filename}</div><div style={{fontSize:12,color:"#64748b"}}>{fmtSize(done.size)} · {done.chunks} chunks</div></div>
            </div>
          )}
          {stages.map((s,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:i<stages.length-1?"1px solid rgba(255,255,255,0.08)":"none"}}>
              <div style={{width:20,height:20,borderRadius:"50%",background:s.done?"#4ade8033":s.active?"#6366f133":"rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {s.done?<Ic name="check" size={10} color="#4ade80"/>:s.active?<Spinner size={11}/>:null}
              </div>
              <span style={{fontSize:13,color:s.done?"#4ade80":s.active?"#f1f5f9":"#64748b"}}>{s.label}</span>
            </div>
          ))}
          {done&&!processing&&(
            <div style={{marginTop:13,padding:"10px 12px",background:"#4ade8011",border:"1px solid #4ade8033",borderRadius:8,display:"flex",alignItems:"center",gap:8,color:"#4ade80",fontSize:13}}>
              <Ic name="check" size={14} color="#4ade80"/>"{done.name}" is live — all students can now chat with it!
            </div>
          )}
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
          <h1 style={{fontSize:25,fontWeight:700,marginBottom:4}}>Document Library</h1>
          <p style={{color:"#64748b",fontSize:13.5}}>{docs.length===0?"No documents yet":`${docs.length} document${docs.length!==1?"s":""} · ${docs.reduce((s,d)=>s+d.chunks,0).toLocaleString()} indexed chunks`}</p>
        </div>
        {user.role==="admin"&&(
          <button onClick={()=>setPage("upload")} style={{...btn,background:"linear-gradient(135deg,#6366f1,#818cf8)",color:"#fff",padding:"9px 17px",borderRadius:9,fontSize:13.5,display:"flex",alignItems:"center",gap:6}}><Ic name="upload" size={14} color="#fff"/> Upload</button>
        )}
      </div>
      {docs.length===0?(
        <EmptyState icon="book" title="No documents uploaded yet"
          sub={user.role==="admin"?"Upload a PDF, DOCX, PPTX, or TXT file.":"The admin hasn't uploaded any study materials yet."}
          action={user.role==="admin"?"Upload Document":null} onAction={()=>setPage("upload")}/>
      ):(
        <>
          <div style={{position:"relative",marginBottom:14}}>
            <div style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)"}}><Ic name="search" size={14} color="#64748b"/></div>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search documents…"
              style={{width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:9,padding:"8px 13px 8px 36px",color:"#f1f5f9",fontSize:13.5,outline:"none",fontFamily:"inherit"}}/>
          </div>
          {filtered.length===0?<div style={{textAlign:"center",padding:36,color:"#64748b"}}>No documents match "{search}"</div>
            :<div style={{display:"flex",flexDirection:"column",gap:8}}>
              {filtered.map(doc=>(
                <div key={doc.id} style={{...glass(),padding:"14px 17px",display:"flex",alignItems:"center",gap:13,animation:"fade-in 0.3s ease"}}>
                  <div style={{width:40,height:40,borderRadius:9,background:fileClr(doc.filename)+"22",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Ic name="file" size={18} color={fileClr(doc.filename)}/></div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:3}}>
                      <span style={{fontWeight:600,fontSize:14}}>{doc.name}</span>
                      <Badge color={fileClr(doc.filename)}>{doc.type.toUpperCase()}</Badge>
                    </div>
                    <div style={{fontSize:12,color:"#64748b"}}>{doc.filename} · {fmtSize(doc.size)} · {doc.chunks} chunks · {fmtDate(doc.uploadedAt)}</div>
                  </div>
                  <div style={{display:"flex",gap:6,flexShrink:0}}>
                    <button onClick={()=>{setChatDoc(doc);setPage("chat");}} style={{...btn,...glass(8),padding:"6px 12px",fontSize:12.5,color:"#818cf8",display:"flex",alignItems:"center",gap:5}}><Ic name="chat" size={12} color="#818cf8"/> Chat</button>
                    {user.role==="admin"&&<button onClick={()=>setConfirm(doc)} style={{...btn,background:"#f8717118",border:"1px solid #f8717133",padding:"6px 9px",borderRadius:8}}><Ic name="trash" size={13} color="#f87171"/></button>}
                  </div>
                </div>
              ))}
            </div>}
        </>
      )}
      {confirm&&(
        <div style={{position:"fixed",inset:0,background:"#00000099",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999}}>
          <div style={{...glass(),padding:26,maxWidth:330,textAlign:"center"}}>
            <Ic name="alert" size={28} color="#f87171"/>
            <h3 style={{marginTop:11,marginBottom:6,fontSize:17}}>Delete "{confirm.name}"?</h3>
            <p style={{color:"#64748b",fontSize:13,marginBottom:18,lineHeight:1.55}}>Removes the document permanently. Students lose access immediately.</p>
            <div style={{display:"flex",gap:9,justifyContent:"center"}}>
              <button onClick={()=>setConfirm(null)} style={{...btn,...glass(8),padding:"8px 17px",fontSize:13.5}}>Cancel</button>
              <button onClick={()=>{onDelete(confirm.id);setConfirm(null);}} style={{...btn,background:"#f87171",color:"#fff",padding:"8px 17px",borderRadius:8,fontSize:13.5}}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// CHAT — with markdown rendering + retry
// ═══════════════════════════════════════════════════════════════
const Chat = ({user,docs,chatDoc,onMessage}) => {
  const initMsg=()=>({role:"assistant",content:docs.length===0?"No documents uploaded yet. The admin will upload study materials soon.":chatDoc?`Ready! Ask me anything about "${chatDoc.name}" — I'll only answer from its content.`:`Hello ${user.name.split(" ")[0]}! I have ${docs.length} document${docs.length>1?"s":""} loaded. Ask me anything.`,ts:new Date()});
  const [selDocId,setSelDocId]=useState(chatDoc?.id?.toString()||"");
  const [messages,setMessages]=useState([initMsg()]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const bottomRef=useRef(null);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[messages]);
  const selDoc=docs.find(d=>d.id===+selDocId)||null;

  const send=async()=>{
    if(!input.trim()||loading||docs.length===0) return;
    const q=input.trim();setInput("");
    setMessages(p=>[...p,{role:"user",content:q,ts:new Date()}]);
    setLoading(true);onMessage(q);
    try {
      const ctxText=selDoc
        ?`Document: "${selDoc.name}" (${selDoc.filename})\n\nContent:\n${selDoc.text}`
        :docs.map(d=>`Document: "${d.name}"\nContent:\n${d.text}`).join("\n\n---\n\n");
      const system=`You are an AI tutor. Answer questions using ONLY the document content below. Do not use outside knowledge.
Format your response clearly using:
- **Bold** for important terms
- Numbered lists for steps
- Bullet points for items
- ## Headings for sections
Always cite: [Source: "Document Name"] at the end.
If not found say: "I couldn't find that in the uploaded documents."

${ctxText.slice(0,12000)}`;
      const history=messages.slice(-6).map(m=>({role:m.role,content:m.content}));
      const ans=await claude([...history,{role:"user",content:q}],system);
      setMessages(p=>[...p,{role:"assistant",content:ans,ts:new Date()}]);
    } catch(e) {
      setMessages(p=>[...p,{role:"assistant",content:`Error: ${e.message}. Please try again.`,ts:new Date()}]);
    }
    setLoading(false);
  };

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100vh"}}>
      <div style={{padding:"13px 20px",borderBottom:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",gap:11,flexWrap:"wrap"}}>
        <div style={{width:33,height:33,borderRadius:8,background:"linear-gradient(135deg,#6366f144,#22d3ee44)",display:"flex",alignItems:"center",justifyContent:"center"}}><Ic name="brain" size={16} color="#22d3ee"/></div>
        <div>
          <div style={{fontWeight:600,fontSize:14}}>AI Tutor</div>
          <div style={{fontSize:11.5,color:docs.length>0?"#4ade80":"#64748b",display:"flex",alignItems:"center",gap:4}}>
            {docs.length>0?<><span style={{width:5,height:5,borderRadius:"50%",background:"#4ade80",display:"inline-block"}}/>{docs.reduce((s,d)=>s+d.chunks,0).toLocaleString()} chunks indexed</>:"No documents uploaded"}
          </div>
        </div>
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:7}}>
          <span style={{fontSize:12.5,color:"#64748b"}}>Context:</span>
          <select value={selDocId} onChange={e=>setSelDocId(e.target.value)}
            style={{background:"#0d1117",border:"1px solid rgba(255,255,255,0.09)",borderRadius:7,padding:"5px 10px",color:"#f1f5f9",fontSize:13,outline:"none",fontFamily:"inherit"}}>
            <option value="">All Documents</option>
            {docs.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"20px",display:"flex",flexDirection:"column",gap:16}}>
        {messages.map((msg,i)=>(
          <div key={i} style={{display:"flex",gap:11,animation:"fade-in 0.3s ease",flexDirection:msg.role==="user"?"row-reverse":"row"}}>
            <div style={{width:29,height:29,borderRadius:7,flexShrink:0,background:msg.role==="user"?"#6366f144":"linear-gradient(135deg,#6366f144,#22d3ee44)",display:"flex",alignItems:"center",justifyContent:"center"}}>
              {msg.role==="user"?<span style={{fontSize:12.5,fontWeight:700,color:"#818cf8"}}>{user.name[0]}</span>:<Ic name="brain" size={12} color="#22d3ee"/>}
            </div>
            <div style={{maxWidth:"78%",display:"flex",flexDirection:"column",alignItems:msg.role==="user"?"flex-end":"flex-start"}}>
              <div style={{padding:"11px 14px",borderRadius:10,background:msg.role==="user"?"#6366f133":"rgba(255,255,255,0.04)",border:`1px solid ${msg.role==="user"?"#6366f144":"rgba(255,255,255,0.08)"}`,fontSize:13.5,lineHeight:1.7}}>
                {msg.role==="assistant" ? renderMarkdown(msg.content) : msg.content}
              </div>
              <span style={{fontSize:11,color:"#64748b",marginTop:3}}>{fmtTime(msg.ts)}</span>
            </div>
          </div>
        ))}
        {loading&&(
          <div style={{display:"flex",gap:11}}>
            <div style={{width:29,height:29,borderRadius:7,background:"linear-gradient(135deg,#6366f144,#22d3ee44)",display:"flex",alignItems:"center",justifyContent:"center"}}><Ic name="brain" size={12} color="#22d3ee"/></div>
            <div style={{padding:"11px 14px",...glass(10),display:"flex",alignItems:"center",gap:8}}><Spinner size={14}/><span style={{fontSize:13,color:"#64748b"}}>Thinking…</span></div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>
      {docs.length>0&&messages.length===1&&(
        <div style={{padding:"0 20px 10px",display:"flex",gap:6,flexWrap:"wrap"}}>
          {["Summarize this document","What are the key concepts?","List important definitions","What are the main topics?"].map(q=>(
            <button key={q} onClick={()=>setInput(q)} style={{...btn,...glass(999),padding:"5px 12px",fontSize:12,color:"#94a3b8"}}>{q}</button>
          ))}
        </div>
      )}
      <div style={{padding:"13px 20px",borderTop:"1px solid rgba(255,255,255,0.08)",display:"flex",gap:9}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()}
          placeholder={docs.length===0?"No documents uploaded yet…":"Ask anything about your study materials…"} disabled={docs.length===0}
          style={{flex:1,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:10,padding:"10px 13px",color:"#f1f5f9",fontSize:13.5,outline:"none",fontFamily:"inherit",opacity:docs.length===0?0.5:1}}/>
        <button onClick={send} disabled={!input.trim()||loading||docs.length===0}
          style={{...btn,width:40,height:40,borderRadius:10,background:input.trim()&&!loading&&docs.length>0?"linear-gradient(135deg,#6366f1,#22d3ee)":"rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <Ic name="send" size={15} color={input.trim()&&!loading&&docs.length>0?"#fff":"#64748b"}/>
        </button>
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
  const selDoc=docs.find(d=>d.id===+selDocId);
  const cards=selDoc?.flashcards||[];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{const total=docs.reduce((s,d)=>s+(d.flashcards?.length||0),0);onFlashcardStats({known:known.size,total});},[known,docs]);
  const generate=async()=>{
    if(!selDoc) return;setGenerating(true);
    try {
      const res=await claude([{role:"user",content:`Generate 8 flashcard Q&A pairs from this document. Return ONLY a JSON array:\n[{"q":"question","a":"answer"}]\n\nDocument: "${selDoc.name}"\nContent:\n${selDoc.text.slice(0,9000)}`}],"Return ONLY a valid JSON array. No markdown.");
      const clean=res.replace(/```json|```/g,"").trim();
      const parsed=JSON.parse(clean);
      onUpdateDoc(selDoc.id,{flashcards:parsed});
      setIdx(0);setFlipped(false);setKnown(new Set());
    } catch(e) {alert("Could not generate flashcards. Try again. Error: "+e.message);}
    setGenerating(false);
  };
  if(docs.length===0) return <div style={{padding:"32px 36px"}}><h1 style={{fontSize:25,fontWeight:700,marginBottom:20}}>Flashcards</h1><EmptyState icon="flash" title="No documents available" sub="The admin will upload study materials soon."/></div>;
  return (
    <div className="page-padding" style={{padding:"32px 36px",maxWidth:660,margin:"0 auto"}}>
      <h1 style={{fontSize:25,fontWeight:700,marginBottom:5}}>Flashcards</h1>
      <p style={{color:"#64748b",fontSize:13.5,marginBottom:22}}>Select a document, then generate AI flashcards from its content.</p>
      <div style={{display:"flex",gap:9,marginBottom:22,flexWrap:"wrap"}}>
        <select value={selDocId} onChange={e=>{setSelDocId(e.target.value);setIdx(0);setFlipped(false);setKnown(new Set());}}
          style={{flex:1,minWidth:180,background:"#0d1117",border:"1px solid rgba(255,255,255,0.09)",borderRadius:9,padding:"9px 12px",color:selDocId?"#f1f5f9":"#64748b",fontSize:13.5,outline:"none",fontFamily:"inherit"}}>
          <option value="">— Select a document —</option>
          {docs.map(d=><option key={d.id} value={d.id}>{d.name}{d.flashcards?.length?` (${d.flashcards.length} cards)`:""}</option>)}
        </select>
        <button onClick={generate} disabled={!selDocId||generating}
          style={{...btn,background:selDocId&&!generating?"linear-gradient(135deg,#6366f1,#22d3ee)":"rgba(255,255,255,0.08)",color:selDocId&&!generating?"#fff":"#64748b",padding:"9px 16px",borderRadius:9,fontSize:13.5,display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
          {generating?<><Spinner size={14}/> Generating…</>:<><Ic name="sparkle" size={14} color={selDocId&&!generating?"#fff":"#64748b"}/> Generate Cards</>}
        </button>
      </div>
      {!selDocId&&<EmptyState icon="flash" title="Choose a document" sub="Select a document above, then click Generate Cards."/>}
      {selDocId&&cards.length===0&&!generating&&<EmptyState icon="flash" title="No flashcards yet" sub={`Click "Generate Cards" to create flashcards from "${selDoc?.name}".`} action="Generate Now" onAction={generate}/>}
      {cards.length>0&&(
        <>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#94a3b8",marginBottom:10}}><span>Card {idx+1} of {cards.length}</span><span style={{color:"#4ade80"}}>{known.size} mastered</span></div>
          <div style={{height:7,background:"rgba(255,255,255,0.08)",borderRadius:999,marginBottom:22,overflow:"hidden"}}><div style={{height:"100%",width:`${(known.size/cards.length)*100}%`,background:"linear-gradient(90deg,#6366f1,#22d3ee)",borderRadius:999,transition:"width 0.5s"}}/></div>
          <div onClick={()=>setFlipped(!flipped)} style={{cursor:"pointer",height:250,perspective:"1000px"}}>
            <div style={{height:"100%",transformStyle:"preserve-3d",transition:"transform 0.45s",transform:flipped?"rotateY(180deg)":"rotateY(0)"}}>
              <div style={{position:"absolute",inset:0,...glass(),display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:26,textAlign:"center",backfaceVisibility:"hidden"}}>
                <span style={{fontSize:10.5,color:"#64748b",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:13}}>Question</span>
                <p style={{fontSize:18,fontWeight:600,lineHeight:1.5}}>{cards[idx]?.q}</p>
                <span style={{marginTop:16,fontSize:12,color:"#64748b"}}>Tap to reveal</span>
              </div>
              <div style={{position:"absolute",inset:0,...glass(),background:"#6366f10e",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:26,textAlign:"center",backfaceVisibility:"hidden",transform:"rotateY(180deg)"}}>
                <span style={{fontSize:10.5,color:"#818cf8",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:13}}>Answer</span>
                <p style={{fontSize:15,lineHeight:1.65,color:"#94a3b8"}}>{cards[idx]?.a}</p>
              </div>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"center",gap:9,marginTop:18}}>
            <button onClick={()=>{setIdx(Math.max(0,idx-1));setFlipped(false);}} disabled={idx===0} style={{...btn,...glass(9),padding:"8px 17px",fontSize:13.5,color:idx===0?"#64748b":"#f1f5f9"}}>← Prev</button>
            <button onClick={()=>setKnown(s=>{const n=new Set(s);n.has(idx)?n.delete(idx):n.add(idx);return n;})}
              style={{...btn,padding:"8px 17px",borderRadius:9,fontSize:13.5,background:known.has(idx)?"#4ade8033":"rgba(255,255,255,0.04)",border:`1px solid ${known.has(idx)?"#4ade8055":"rgba(255,255,255,0.08)"}`,color:known.has(idx)?"#4ade80":"#f1f5f9",display:"flex",alignItems:"center",gap:5}}>
              {known.has(idx)?<><Ic name="check" size={13} color="#4ade80"/> Known</>:"Mark Known"}
            </button>
            <button onClick={()=>{setIdx(Math.min(cards.length-1,idx+1));setFlipped(false);}} disabled={idx===cards.length-1} style={{...btn,...glass(9),padding:"8px 17px",fontSize:13.5,color:idx===cards.length-1?"#64748b":"#f1f5f9"}}>Next →</button>
          </div>
        </>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// QUIZ — fixed results bug
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

  useEffect(()=>{if(phase==="quiz"&&startTime){const t=setInterval(()=>setElapsed(Math.floor((Date.now()-startTime)/1000)),1000);return()=>clearInterval(t);}},[phase,startTime]);

  const selDoc=docs.find(d=>d.id===+selDocId);
  const startQuiz=async()=>{
    if(!selDoc) return;setGenerating(true);
    try {
      const res=await claude([{role:"user",content:`Generate exactly 5 ${difficulty} MCQs from this document. Return ONLY a JSON array:\n[{"q":"question","opts":["A","B","C","D"],"ans":0,"exp":"explanation"}]\n\nDocument: "${selDoc.name}"\nContent:\n${selDoc.text.slice(0,9000)}`}],"Return ONLY a valid JSON array. No markdown.");
      const clean=res.replace(/```json|```/g,"").trim();
      const qs=JSON.parse(clean);
      setQuestions(qs);setPhase("quiz");setQIdx(0);setAnswers({});setShowExp(false);setStartTime(Date.now());setElapsed(0);setResultSaved(false);
    } catch(e) {alert("Failed to generate quiz: "+e.message);}
    setGenerating(false);
  };

  const score=Object.entries(answers).filter(([i,a])=>questions[+i]?.ans===a).length;
  const pct=questions.length?Math.round((score/questions.length)*100):0;
  const q=questions[qIdx];

  // Save result only once when result page is shown
  useEffect(()=>{
    if(phase==="result"&&!resultSaved&&questions.length>0){
      setResultSaved(true);
      onResult({pct,score,total:questions.length,doc:selDoc?.name,difficulty,time:elapsed});
    }
  },[phase]);

  if(docs.length===0) return <div style={{padding:"32px 36px"}}><h1 style={{fontSize:25,fontWeight:700,marginBottom:20}}>Quiz</h1><EmptyState icon="quiz" title="No documents available" sub="The admin will upload study materials soon."/></div>;

  if(phase==="setup") return (
    <div className="page-padding" style={{padding:"32px 36px",maxWidth:520,margin:"0 auto"}}>
      <h1 style={{fontSize:25,fontWeight:700,marginBottom:5}}>Quiz Generator</h1>
      <p style={{color:"#64748b",fontSize:13.5,marginBottom:26}}>AI generates questions from your document's actual content.</p>
      <div style={{...glass(),padding:22,marginBottom:14}}>
        <label style={{fontSize:13.5,fontWeight:500,display:"block",marginBottom:9}}>Document</label>
        <select value={selDocId} onChange={e=>setSelDocId(e.target.value)}
          style={{width:"100%",background:"#0d1117",border:"1px solid rgba(255,255,255,0.09)",borderRadius:9,padding:"9px 12px",color:selDocId?"#f1f5f9":"#64748b",fontSize:13.5,outline:"none",fontFamily:"inherit",marginBottom:18}}>
          <option value="">— Select a document —</option>
          {docs.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <label style={{fontSize:13.5,fontWeight:500,display:"block",marginBottom:9}}>Difficulty</label>
        <div style={{display:"flex",gap:8}}>
          {["easy","medium","hard"].map(d=>(
            <button key={d} onClick={()=>setDifficulty(d)}
              style={{...btn,flex:1,padding:"9px",borderRadius:9,background:difficulty===d?"#6366f133":"rgba(255,255,255,0.04)",border:`1px solid ${difficulty===d?"#6366f166":"rgba(255,255,255,0.09)"}`,color:difficulty===d?"#818cf8":"#64748b",fontSize:13.5,textTransform:"capitalize"}}>
              {d}
            </button>
          ))}
        </div>
      </div>
      <button onClick={startQuiz} disabled={!selDocId||generating}
        style={{...btn,width:"100%",background:selDocId&&!generating?"linear-gradient(135deg,#6366f1,#22d3ee)":"rgba(255,255,255,0.08)",color:selDocId&&!generating?"#fff":"#64748b",padding:"12px",borderRadius:10,fontSize:14.5,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
        {generating?<><Spinner size={16}/> Generating questions…</>:<><Ic name="sparkle" size={15} color={selDocId&&!generating?"#fff":"#64748b"}/> Generate Quiz</>}
      </button>
    </div>
  );

  if(phase==="result") return (
    <div className="page-padding" style={{padding:"32px 36px",maxWidth:500,margin:"0 auto",textAlign:"center"}}>
      <div style={{...glass(),padding:34}}>
        <div style={{width:72,height:72,borderRadius:"50%",background:(pct>=70?"#4ade80":"#fb923c")+"22",border:`3px solid ${pct>=70?"#4ade80":"#fb923c"}`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",fontSize:24,fontWeight:800,color:pct>=70?"#4ade80":"#fb923c"}}>{pct}%</div>
        <h2 style={{fontSize:20,fontWeight:700,marginBottom:5}}>Quiz Complete!</h2>
        <p style={{color:"#64748b",marginBottom:22,fontSize:13.5}}>{pct>=80?"Excellent!":pct>=60?"Good effort!":"Keep studying!"} — "{selDoc?.name}"</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:9,marginBottom:20}}>
          {[{v:score,l:"Correct",c:"#4ade80"},{v:questions.length-score,l:"Wrong",c:"#f87171"},{v:`${Math.floor(elapsed/60)}:${String(elapsed%60).padStart(2,"0")}`,l:"Time",c:"#22d3ee"}].map((s,i)=>(
            <div key={i} style={{...glass(10),padding:11}}><div style={{fontSize:19,fontWeight:700,color:s.c,fontFamily:i===2?"'JetBrains Mono',monospace":"inherit"}}>{s.v}</div><div style={{fontSize:12,color:"#64748b"}}>{s.l}</div></div>
          ))}
        </div>
        <div style={{textAlign:"left",marginBottom:18}}>
          {questions.map((q,i)=>(
            <div key={i} style={{...glass(8),padding:11,marginBottom:6,borderLeft:`3px solid ${answers[i]===q.ans?"#4ade80":"#f87171"}`}}>
              <div style={{fontSize:13,fontWeight:500,marginBottom:3}}>{q.q}</div>
              <div style={{fontSize:12,color:"#64748b"}}>Your answer: <span style={{color:answers[i]===q.ans?"#4ade80":"#f87171"}}>{q.opts?.[answers[i]]??"—"}</span></div>
              {answers[i]!==q.ans&&<div style={{fontSize:12,color:"#4ade80"}}>Correct: {q.opts?.[q.ans]}</div>}
              <div style={{fontSize:12,color:"#64748b",marginTop:3}}>💡 {q.exp}</div>
            </div>
          ))}
        </div>
        <button onClick={()=>{setPhase("setup");setResultSaved(false);}} style={{...btn,...glass(9),padding:"9px 22px",fontSize:13.5}}>Take Another Quiz</button>
      </div>
    </div>
  );

  return (
    <div className="page-padding" style={{padding:"32px 36px",maxWidth:560,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:16,fontSize:13,color:"#64748b"}}>
        <span>Q{qIdx+1}/{questions.length} — <span style={{color:"#94a3b8"}}>{selDoc?.name}</span></span>
        <span style={{fontFamily:"'JetBrains Mono',monospace",color:"#22d3ee"}}>⏱ {Math.floor(elapsed/60)}:{String(elapsed%60).padStart(2,"0")}</span>
      </div>
      <div style={{height:5,background:"rgba(255,255,255,0.08)",borderRadius:999,marginBottom:20}}><div style={{height:"100%",width:`${((qIdx+(answers[qIdx]!==undefined?1:0))/questions.length)*100}%`,background:"linear-gradient(90deg,#6366f1,#22d3ee)",borderRadius:999,transition:"width 0.3s"}}/></div>
      <div style={{...glass(),padding:24,marginBottom:12}}>
        <p style={{fontSize:16,fontWeight:600,lineHeight:1.5,marginBottom:18}}>{q?.q}</p>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {q?.opts?.map((opt,i)=>{
            const sel=answers[qIdx]===i,corr=showExp&&i===q.ans,wrong=showExp&&sel&&i!==q.ans;
            return (
              <button key={i} onClick={()=>{if(!showExp){setAnswers(p=>({...p,[qIdx]:i}));setShowExp(true);}}}
                style={{...btn,padding:"10px 13px",borderRadius:8,textAlign:"left",fontSize:13.5,border:`1px solid ${corr?"#4ade8088":wrong?"#f8717188":sel?"#6366f166":"rgba(255,255,255,0.09)"}`,background:corr?"#4ade8018":wrong?"#f8717118":sel?"#6366f118":"rgba(255,255,255,0.04)",color:"#f1f5f9",display:"flex",alignItems:"center",gap:9}}>
                <span style={{width:21,height:21,borderRadius:5,border:"1px solid rgba(255,255,255,0.09)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,flexShrink:0,background:corr?"#4ade8044":wrong?"#f8717144":"transparent",color:corr?"#4ade80":wrong?"#f87171":"#64748b"}}>{["A","B","C","D"][i]}</span>{opt}
              </button>
            );
          })}
        </div>
        {showExp&&<div style={{marginTop:12,padding:"9px 11px",background:"#22d3ee11",border:"1px solid #22d3ee33",borderRadius:7,fontSize:12.5,color:"#22d3ee"}}>💡 {q?.exp}</div>}
      </div>
      {showExp&&<button onClick={()=>{if(qIdx<questions.length-1){setQIdx(qIdx+1);setShowExp(false);}else setPhase("result");}} style={{...btn,width:"100%",background:"linear-gradient(135deg,#6366f1,#22d3ee)",color:"#fff",padding:"12px",borderRadius:10,fontSize:14.5}}>{qIdx<questions.length-1?"Next Question →":"See Results"}</button>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// PROGRESS
// ═══════════════════════════════════════════════════════════════
const Progress = ({docs,chatHistory,quizResults,flashcardStats}) => {
  const avg=quizResults.length?Math.round(quizResults.reduce((s,r)=>s+r.pct,0)/quizResults.length):null;
  return (
    <div className="page-padding" style={{padding:"32px 36px",maxWidth:820,margin:"0 auto"}}>
      <h1 style={{fontSize:25,fontWeight:700,marginBottom:5}}>Progress</h1>
      <p style={{color:"#64748b",fontSize:13.5,marginBottom:24}}>Your learning activity this session.</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:13,marginBottom:22}}>
        {[{icon:"book",label:"Docs Available",value:docs.length,color:"#6366f1"},{icon:"chat",label:"Questions Asked",value:chatHistory.length,color:"#22d3ee"},{icon:"quiz",label:"Quizzes Taken",value:quizResults.length,color:"#4ade80"},{icon:"flash",label:"Cards Mastered",value:`${flashcardStats.known}/${flashcardStats.total}`,color:"#fb923c"}].map((s,i)=>(
          <div key={i} style={{...glass(),padding:17}}>
            <div style={{width:33,height:33,borderRadius:8,background:s.color+"22",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:9}}><Ic name={s.icon} size={15} color={s.color}/></div>
            <div style={{fontSize:24,fontWeight:700}}>{s.value}</div>
            <div style={{fontSize:12.5,color:"#64748b",marginTop:3}}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{...glass(),padding:20,marginBottom:14}}>
        <h3 style={{fontWeight:600,marginBottom:14}}>Quiz History</h3>
        {quizResults.length===0?<div style={{textAlign:"center",padding:"22px 0",color:"#64748b",fontSize:13.5}}>No quizzes taken yet.</div>
          :<>
            <div style={{display:"flex",alignItems:"flex-end",gap:5,height:72,marginBottom:12}}>
              {quizResults.slice(-14).map((r,i)=>(<div key={i} title={`${r.pct}%`} style={{flex:1,height:r.pct*0.72,background:r.pct>=70?"linear-gradient(to top,#6366f1,#22d3ee)":"linear-gradient(to top,#fb923c88,#fb923c44)",borderRadius:"3px 3px 0 0",minWidth:10}}/>))}
            </div>
            {[...quizResults].reverse().map((r,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,0.08)",fontSize:13}}>
                <span style={{color:"#94a3b8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"60%"}}>{r.doc}</span>
                <div style={{display:"flex",gap:10,flexShrink:0}}><Badge color={r.pct>=70?"#4ade80":"#fb923c"}>{r.pct}%</Badge><span style={{fontSize:12,color:"#64748b"}}>{r.score}/{r.total}</span></div>
              </div>
            ))}
            {avg!==null&&<div style={{marginTop:12,padding:"9px 12px",background:"#6366f10d",border:"1px solid #6366f122",borderRadius:7,fontSize:13,color:"#94a3b8"}}>Session average: <strong style={{color:"#818cf8"}}>{avg}%</strong> across {quizResults.length} quiz{quizResults.length!==1?"zes":""}</div>}
          </>}
      </div>
      <div style={{...glass(),padding:20}}>
        <h3 style={{fontWeight:600,marginBottom:13}}>Available Documents</h3>
        {docs.length===0?<div style={{textAlign:"center",padding:"18px 0",color:"#64748b",fontSize:13.5}}>No documents uploaded yet.</div>
          :docs.map(d=>(<div key={d.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,0.08)"}}><Ic name="file" size={13} color={fileClr(d.filename)}/><span style={{flex:1,fontSize:13.5}}>{d.name}</span><span style={{fontSize:12,color:"#64748b"}}>{d.chunks} chunks</span><Badge color={fileClr(d.filename)}>{d.type.toUpperCase()}</Badge></div>))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════════
const Analytics = ({docs,chatHistory,quizResults}) => {
  const maxChunks=docs.length?Math.max(...docs.map(d=>d.chunks)):1;
  return (
    <div className="page-padding" style={{padding:"32px 36px",maxWidth:860,margin:"0 auto"}}>
      <h1 style={{fontSize:25,fontWeight:700,marginBottom:5}}>Analytics</h1>
      <p style={{color:"#64748b",fontSize:13.5,marginBottom:22}}>Real-time platform activity.</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(195px,1fr))",gap:13,marginBottom:22}}>
        {[{icon:"book",label:"Documents",value:docs.length,sub:`${docs.reduce((s,d)=>s+d.chunks,0).toLocaleString()} chunks`,color:"#6366f1"},{icon:"chat",label:"Questions",value:chatHistory.length,sub:"This session",color:"#22d3ee"},{icon:"quiz",label:"Quizzes",value:quizResults.length,sub:quizResults.length?`Avg ${Math.round(quizResults.reduce((s,r)=>s+r.pct,0)/quizResults.length)}%`:"None yet",color:"#4ade80"},{icon:"flash",label:"Flashcard Sets",value:docs.filter(d=>d.flashcards?.length>0).length,color:"#fb923c"}].map((s,i)=>(
          <div key={i} style={{...glass(),padding:17}}>
            <div style={{width:33,height:33,borderRadius:8,background:s.color+"22",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:9}}><Ic name={s.icon} size={15} color={s.color}/></div>
            <div style={{fontSize:24,fontWeight:700}}>{s.value}</div>
            <div style={{fontSize:12,color:"#64748b",marginTop:2}}>{s.sub||s.label}</div>
          </div>
        ))}
      </div>
      {docs.length===0&&chatHistory.length===0&&quizResults.length===0
        ?<EmptyState icon="chart" title="No data yet" sub="Upload documents and let students interact — analytics will populate automatically."/>
        :<>
          {docs.length>0&&(
            <div style={{...glass(),padding:20,marginBottom:14}}>
              <h3 style={{fontWeight:600,marginBottom:16}}>Documents</h3>
              {docs.map(d=>(
                <div key={d.id} style={{marginBottom:13}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5,fontSize:13}}><span style={{color:"#94a3b8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"70%"}}>{d.name}</span><span style={{color:"#64748b",flexShrink:0}}>{d.chunks} chunks · {fmtSize(d.size)}</span></div>
                  <div style={{height:5,background:"rgba(255,255,255,0.08)",borderRadius:999}}><div style={{height:"100%",width:`${(d.chunks/maxChunks)*100}%`,background:`linear-gradient(90deg,${fileClr(d.filename)},${fileClr(d.filename)}88)`,borderRadius:999}}/></div>
                </div>
              ))}
            </div>
          )}
          {quizResults.length>0&&(
            <div style={{...glass(),padding:20}}>
              <h3 style={{fontWeight:600,marginBottom:14}}>Quiz Results</h3>
              <div style={{display:"flex",alignItems:"flex-end",gap:5,height:70,marginBottom:12}}>
                {quizResults.map((r,i)=>(<div key={i} title={`${r.pct}%`} style={{flex:1,height:r.pct*0.7,background:r.pct>=70?"linear-gradient(to top,#6366f1,#22d3ee)":"linear-gradient(to top,#fb923c88,#fb923c44)",borderRadius:"3px 3px 0 0",minWidth:12}}/>))}
              </div>
              {[...quizResults].reverse().map((r,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,0.08)",fontSize:13}}>
                  <span style={{color:"#94a3b8"}}>{r.doc} <span style={{color:"#64748b",textTransform:"capitalize"}}>({r.difficulty})</span></span>
                  <Badge color={r.pct>=70?"#4ade80":"#fb923c"}>{r.pct}%</Badge>
                </div>
              ))}
            </div>
          )}
        </>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════════════════
const Users = () => {
  const [users,setUsers]=useState({});
  const [loading,setLoading]=useState(true);
  useEffect(()=>{storageLoad(USERS_KEY,{}).then(u=>{setUsers(u);setLoading(false);});},[]);
  const list=Object.entries(users).map(([email,u])=>({email,...u}));
  return (
    <div className="page-padding" style={{padding:"32px 36px",maxWidth:820,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
        <div style={{width:36,height:36,borderRadius:9,background:"#6366f122",display:"flex",alignItems:"center",justifyContent:"center"}}><Ic name="users" size={17} color="#6366f1"/></div>
        <div><h1 style={{fontSize:25,fontWeight:700,lineHeight:1}}>Registered Students</h1><p style={{fontSize:13,color:"#64748b",marginTop:3}}>All students who have created accounts</p></div>
      </div>
      {loading?<div style={{display:"flex",justifyContent:"center",padding:40}}><Spinner size={24}/></div>
        :list.length===0
          ?<EmptyState icon="users" title="No students yet" sub="Students who register will appear here. Share the link to your app!"/>
          :<div style={{...glass(),overflow:"hidden"}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",padding:"10px 16px",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
              {["Name","Email","Role"].map(h=><span key={h} style={{fontSize:11.5,color:"#64748b",fontWeight:600,letterSpacing:"0.05em",textTransform:"uppercase"}}>{h}</span>)}
            </div>
            {list.map((u,i)=>(
              <div key={u.email} style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",padding:"12px 16px",borderBottom:i<list.length-1?"1px solid rgba(255,255,255,0.06)":"none",alignItems:"center"}}>
                <div style={{display:"flex",alignItems:"center",gap:9}}>
                  <div style={{width:28,height:28,borderRadius:7,background:"#6366f133",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#818cf8",flexShrink:0}}>{u.name[0].toUpperCase()}</div>
                  <span style={{fontSize:13.5,fontWeight:500}}>{u.name}</span>
                </div>
                <span style={{fontSize:13,color:"#64748b"}}>{u.email}</span>
                <Badge color="#6366f1">student</Badge>
              </div>
            ))}
          </div>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [route,setRoute]   = useState("landing");
  const [user,setUser]     = useState(null);
  const [page,setPage]     = useState("dashboard");
  const [docs,setDocs]     = useState([]);
  const [loadingDocs,setLoadingDocs] = useState(true);
  const [chatHistory,setChatHistory] = useState([]);
  const [quizResults,setQuizResults] = useState([]);
  const [flashcardStats,setFlashcardStats] = useState({known:0,total:0});
  const [chatDoc,setChatDoc] = useState(null);

  useEffect(()=>{
    storageLoad(DOCS_KEY,[]).then(saved=>{
      if(Array.isArray(saved)) setDocs(saved);
      setLoadingDocs(false);
    });
  },[]);

  const firstRender = useRef(true);
  useEffect(()=>{
    if(firstRender.current){firstRender.current=false;return;}
    storageSave(DOCS_KEY, docs);
  },[docs]);

  const handleLogin  = u => {setUser(u);setPage("dashboard");setRoute("app");};
  const handleLogout = () => {setUser(null);setRoute("landing");setPage("dashboard");setChatHistory([]);setQuizResults([]);};

  const renderPage = () => {
    if(page==="upload"&&user?.role!=="admin"){setPage("dashboard");return null;}
    switch(page){
      case "dashboard":  return <Dashboard user={user} docs={docs} chatHistory={chatHistory} quizResults={quizResults} flashcardStats={flashcardStats} setPage={setPage}/>;
      case "upload":     return <Upload onUpload={doc=>setDocs(p=>[...p,doc])}/>;
      case "documents":  return <Documents user={user} docs={docs} onDelete={id=>setDocs(p=>p.filter(d=>d.id!==id))} setPage={setPage} setChatDoc={setChatDoc}/>;
      case "chat":       return <Chat user={user} docs={docs} chatDoc={chatDoc} onMessage={q=>setChatHistory(p=>[...p,{q,ts:Date.now()}])}/>;
      case "flashcards": return <Flashcards docs={docs} onUpdateDoc={(id,u)=>setDocs(p=>p.map(d=>d.id===id?{...d,...u}:d))} onFlashcardStats={setFlashcardStats}/>;
      case "quiz":       return <Quiz docs={docs} onResult={r=>setQuizResults(p=>[...p,r])}/>;
      case "progress":   return <Progress docs={docs} chatHistory={chatHistory} quizResults={quizResults} flashcardStats={flashcardStats}/>;
      case "analytics":  return <Analytics docs={docs} chatHistory={chatHistory} quizResults={quizResults}/>;
      case "users":      return <Users/>;
      default:           return <Dashboard user={user} docs={docs} chatHistory={chatHistory} quizResults={quizResults} flashcardStats={flashcardStats} setPage={setPage}/>;
    }
  };

  if(loadingDocs) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16,background:"#07090f"}}>
      <div style={{width:40,height:40,background:"linear-gradient(135deg,#6366f1,#22d3ee)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:4}}>
        <Ic name="brain" size={20} color="#fff"/>
      </div>
      <Spinner size={28}/>
      <p style={{color:"#64748b",fontSize:14}}>Loading LearnGPT…</p>
    </div>
  );

  return (
    <>
      <style>{GS}</style>
      {route==="landing"  && <Landing onNav={setRoute}/>}
      {route==="login"    && <AuthPage mode="login"    onNav={setRoute} onLogin={handleLogin}/>}
      {route==="register" && <AuthPage mode="register" onNav={setRoute} onLogin={handleLogin}/>}
      {route==="app"&&user&&(
        <Layout user={user} page={page} setPage={setPage} onLogout={handleLogout}>
          {renderPage()}
        </Layout>
      )}
    </>
  );
}
