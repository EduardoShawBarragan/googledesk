import { useState, useRef, useEffect, useCallback } from "react";
import Frame from "./Frame.svg";
import Webcam from "react-webcam"; // add at top


// ── GEMINI API KEY HERE ──
const GEMINI_API_KEY = "112346534";

const GEMINI_BLUE   = "#3b7ded";
const GEMINI_RED    = "#e43e2b";
const GEMINI_YELLOW = "#f0b501";
const GEMINI_GREEN  = "#2ba24c";

/* ══════════════════════════════════════════
   ICONS
══════════════════════════════════════════ */
const GeminiIcon = ({ size = 28 }) => (
  <img
    src={Frame}
    alt="Gemini"
    width={size}
    height={size}
    style={{ display: "block" }}
  />
);

/* ══════════════════════════════════════════
   GEMINI VISION <API>
   Captures video frame + canvas drawing,
   sends both as base64 image to Gemini
══════════════════════════════════════════ */
async function analyseWithGemini(videoEl, drawingCanvas, mode, typedText) {
  // Compose: video frame + drawing layer into one image
  const offscreen = document.createElement("canvas");
  offscreen.width  = videoEl.videoWidth  || 640;
  offscreen.height = videoEl.videoHeight || 480;
  const ctx = offscreen.getContext("2d");
  ctx.drawImage(videoEl, 0, 0, offscreen.width, offscreen.height);
  if (drawingCanvas) ctx.drawImage(drawingCanvas, 0, 0, offscreen.width, offscreen.height);

  const base64 = offscreen.toDataURL("image/jpeg", 0.85).split(",")[1];

  const prompts = {
    "Mark Work": `You are Google Desk, an AR educational tutor. The student has shown you their written work via camera. ${typedText ? `They also wrote: "${typedText}"` : ""}
Analyse the work visible in the image. Mark it out of 10. 
Respond in this EXACT JSON format (no markdown, no extra text):
{"score": 8, "correct": true, "feedback": "Your explanation here.", "steps": null}
If the work has errors, set correct to false and steps to an array of strings with corrective steps.
If no written work is visible, set score to 0, correct to false, feedback to "Please point your camera at your written work.", steps to null.`,

    "Explain": `You are Google Desk, an AR educational tutor. The student wants you to explain the content shown in the camera. ${typedText ? `They specifically asked: "${typedText}"` : ""}
Look at the work/content in the image and provide a clear explanation.
Respond in this EXACT JSON format (no markdown, no extra text):
{"score": null, "correct": null, "feedback": "Your detailed explanation here in 2-3 sentences.", "steps": ["Step or point 1", "Step or point 2", "Step or point 3"]}`,

    "Quiz Me": `You are Google Desk, an AR educational tutor. The student wants to be quizzed on the content shown in the camera. ${typedText ? `Context from student: "${typedText}"` : ""}
Look at the work/content visible in the image and create a quiz question based on it.
Respond in this EXACT JSON format (no markdown, no extra text):
{"score": null, "correct": null, "feedback": "Here is your quiz question based on what I can see: [write a specific question here]", "steps": ["Hint 1 if they get stuck", "Hint 2", "Answer: [the answer]"]}`
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: "image/jpeg", data: base64 } },
            { text: prompts[mode] }
          ]
        }]
      })
    }
  );
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  // Strip any markdown fences just in case
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

/* ══════════════════════════════════════════
   SCAN OVERLAY
══════════════════════════════════════════ */
const ScanOverlay = ({ scanning, marked }) => {
  const BOX = { top:"18%", left:"5%", right:"5%", bottom:"36%" };
  const ec = marked
    ? { tl:GEMINI_GREEN, tr:GEMINI_GREEN, bl:GEMINI_GREEN, br:GEMINI_GREEN }
    : { tl:GEMINI_RED,   tr:GEMINI_BLUE,  bl:GEMINI_GREEN, br:GEMINI_YELLOW };
  const corner = (pos) => {
    const b = { position:"absolute", width:28, height:28, transition:"border-color 0.5s" };
    if (pos==="tl") return { ...b, top:BOX.top,       left:BOX.left,   borderTop:`3.5px solid ${ec.tl}`, borderLeft:`3.5px solid ${ec.tl}`,   borderRadius:"4px 0 0 0" };
    if (pos==="tr") return { ...b, top:BOX.top,       right:BOX.right, borderTop:`3.5px solid ${ec.tr}`, borderRight:`3.5px solid ${ec.tr}`,  borderRadius:"0 4px 0 0" };
    if (pos==="bl") return { ...b, bottom:BOX.bottom, left:BOX.left,   borderBottom:`3.5px solid ${ec.bl}`, borderLeft:`3.5px solid ${ec.bl}`, borderRadius:"0 0 0 4px" };
    return                 { ...b, bottom:BOX.bottom, right:BOX.right, borderBottom:`3.5px solid ${ec.br}`, borderRight:`3.5px solid ${ec.br}`,borderRadius:"0 0 4px 0" };
  };
  return (
    <div style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:5 }}>
      <div style={{ position:"absolute", inset:0, background:`linear-gradient(to bottom,rgba(0,0,0,0.35) 0%,transparent 18%),linear-gradient(to top,rgba(0,0,0,0.35) 0%,transparent 36%),linear-gradient(to right,rgba(0,0,0,0.2) 0%,transparent 5%),linear-gradient(to left,rgba(0,0,0,0.2) 0%,transparent 5%)` }}/>
      {["tl","tr","bl","br"].map(p => <div key={p} style={corner(p)}/>)}
      {scanning && (<>
        <div style={{ position:"absolute", top:BOX.top,    left:BOX.left, right:BOX.right, height:2, background:`linear-gradient(90deg,${GEMINI_RED},${GEMINI_BLUE})`,   boxShadow:`0 0 10px ${GEMINI_RED}`,   transformOrigin:"left",   animation:"edgeH 1.6s ease-in-out infinite" }}/>
        <div style={{ position:"absolute", bottom:BOX.bottom, left:BOX.left, right:BOX.right, height:2, background:`linear-gradient(90deg,${GEMINI_GREEN},${GEMINI_YELLOW})`, boxShadow:`0 0 10px ${GEMINI_GREEN}`, transformOrigin:"right",  animation:"edgeH 1.6s ease-in-out infinite reverse" }}/>
        <div style={{ position:"absolute", left:BOX.left,  top:BOX.top, bottom:BOX.bottom, width:2, background:`linear-gradient(180deg,${GEMINI_RED},${GEMINI_GREEN})`,   boxShadow:`0 0 10px ${GEMINI_BLUE}`,  transformOrigin:"top",    animation:"edgeV 1.6s ease-in-out infinite 0.2s" }}/>
        <div style={{ position:"absolute", right:BOX.right, top:BOX.top, bottom:BOX.bottom, width:2, background:`linear-gradient(180deg,${GEMINI_BLUE},${GEMINI_YELLOW})`, boxShadow:`0 0 10px ${GEMINI_YELLOW}`,transformOrigin:"bottom", animation:"edgeV 1.6s ease-in-out infinite reverse 0.2s" }}/>
        <div style={{ position:"absolute", left:BOX.left, right:BOX.right, top:BOX.top, height:2, background:`linear-gradient(90deg,transparent,${GEMINI_BLUE},transparent)`, boxShadow:`0 0 16px 4px rgba(66,133,244,0.5)`, animation:"sweepLine 1.8s ease-in-out infinite" }}/>
      </>)}
      {marked && <div style={{ position:"absolute", top:BOX.top, left:BOX.left, right:BOX.right, bottom:BOX.bottom, border:`2px solid ${GEMINI_GREEN}`, borderRadius:6, boxShadow:`0 0 22px ${GEMINI_GREEN},inset 0 0 22px rgba(52,168,83,0.1)`, animation:"glowPulse 1s ease-in-out 2" }}/>}
    </div>
  );
};

/* ══════════════════════════════════════════
   AR DRAWING CANVAS
   Finger drawing + text overlay on camera
══════════════════════════════════════════ */
const ARCanvas = ({ active, canvasRef, onDrawEnd }) => {
  const isDrawing = useRef(false);
  const lastPos   = useRef(null);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const src  = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - rect.left) * (canvas.width / rect.width), y: (src.clientY - rect.top) * (canvas.height / rect.height) };
  };

  const startDraw = (e) => {
    if (!active) return;
    e.preventDefault();
    isDrawing.current = true;
    const pos = getPos(e, canvasRef.current);
    lastPos.current = pos;
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
    ctx.fillStyle = "#FFD700";
    ctx.fill();
  };

  const draw = (e) => {
    if (!isDrawing.current || !active) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#FFD700";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
  };

  const endDraw = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    lastPos.current = null;
    if (onDrawEnd) setTimeout(onDrawEnd, 1200); // trigger Gemini after 1.2s pause
  };

  return (
    <canvas
      ref={canvasRef}
      width={1280} height={720}
      style={{ position:"absolute", inset:0, width:"100%", height:"100%", zIndex:6, touchAction:"none", cursor: active ? "crosshair" : "default", opacity: active ? 1 : 0.6 }}
      onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
      onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
    />
  );
};

/* ══════════════════════════════════════════
   FEEDBACK PANEL
══════════════════════════════════════════ */
const FeedbackPanel = ({ result, mode, onClose, onAskMore }) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 50); }, []);

  const modeLabel = { "Mark Work":"Marked", "Explain":"Explanation", "Quiz Me":"Quiz" }[mode] || "Feedback";

  return (
    <div style={{ position:"absolute", bottom:0, left:0, right:0, zIndex:20, background:"linear-gradient(180deg,rgba(10,10,22,0.97),rgba(5,5,15,0.99))", borderTop:`1px solid rgba(66,133,244,0.25)`, borderRadius:"24px 24px 0 0", padding:"0 0 36px", transform: visible?"translateY(0)":"translateY(100%)", transition:"transform 0.45s cubic-bezier(0.34,1.56,0.64,1)", maxHeight:"68vh", overflowY:"auto", backdropFilter:"blur(24px)" }}>
      <div style={{ display:"flex", justifyContent:"center", padding:"12px 0 6px" }}>
        <div style={{ width:36, height:4, borderRadius:2, background:"rgba(255,255,255,0.18)" }}/>
      </div>
      <div style={{ padding:"6px 20px 14px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <GeminiIcon size={28}/>
          <div>
            <div style={{ color:"#fff", fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:15 }}>Google Desk</div>
            <div style={{ color:"rgba(255,255,255,0.4)", fontSize:11, fontFamily:"monospace" }}>Live {modeLabel}</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background:"rgba(255,255,255,0.08)", border:"none", color:"rgba(255,255,255,0.6)", width:32, height:32, borderRadius:"50%", cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
      </div>

      {/* Score badge — only for Mark Work */}
      {mode === "Mark Work" && result.score !== null && (
        <div style={{ padding:"0 20px 14px" }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, background: result.correct?"rgba(52,168,83,0.15)":"rgba(234,67,53,0.15)", border:`1px solid ${result.correct?"rgba(52,168,83,0.4)":"rgba(234,67,53,0.4)"}`, borderRadius:20, padding:"6px 16px" }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:result.correct?GEMINI_GREEN:GEMINI_RED, boxShadow:`0 0 8px ${result.correct?GEMINI_GREEN:GEMINI_RED}` }}/>
            <span style={{ color:result.correct?GEMINI_GREEN:GEMINI_RED, fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:13 }}>
              {result.correct ? `${result.score}/10 — Correct ✓` : `${result.score}/10 — Needs Work`}
            </span>
          </div>
        </div>
      )}

      {/* Quiz badge */}
      {mode === "Quiz Me" && (
        <div style={{ padding:"0 20px 14px" }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(66,133,244,0.15)", border:`1px solid rgba(66,133,244,0.4)`, borderRadius:20, padding:"6px 16px" }}>
            <span style={{ color:GEMINI_BLUE, fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:13 }}>🎯 Quiz Time</span>
          </div>
        </div>
      )}

      {/* Explain badge */}
      {mode === "Explain" && (
        <div style={{ padding:"0 20px 14px" }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(251,188,5,0.15)", border:`1px solid rgba(251,188,5,0.4)`, borderRadius:20, padding:"6px 16px" }}>
            <span style={{ color:GEMINI_YELLOW, fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:13 }}>💡 Explanation</span>
          </div>
        </div>
      )}

      <div style={{ padding:"0 20px 18px" }}>
        <p style={{ color:"rgba(255,255,255,0.85)", fontSize:14, lineHeight:1.75, fontFamily:"'DM Sans',sans-serif", margin:0 }}>{result.feedback}</p>
      </div>

      {result.steps && result.steps.length > 0 && (
        <div style={{ padding:"0 20px 20px" }}>
          <div style={{ color:"rgba(255,255,255,0.35)", fontSize:10, fontFamily:"monospace", marginBottom:10, letterSpacing:1.5 }}>
            {mode==="Quiz Me" ? "HINTS & ANSWER" : mode==="Explain" ? "KEY POINTS" : "SUGGESTED STEPS"}
          </div>
          {result.steps.map((step, i) => (
            <div key={i} style={{ display:"flex", gap:12, marginBottom:10, alignItems:"flex-start" }}>
              <div style={{ minWidth:22, height:22, borderRadius:"50%", background:`linear-gradient(135deg,${GEMINI_BLUE},#7b2ff7)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"#fff", fontFamily:"monospace" }}>{i+1}</div>
              <div style={{ color:"rgba(255,255,255,0.75)", fontSize:13, fontFamily:"'DM Sans',sans-serif", lineHeight:1.6 }}>{step}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ padding:"0 20px", display:"flex", gap:10 }}>
        <button onClick={onAskMore} style={{ flex:1, padding:"13px 0", background:`linear-gradient(135deg,${GEMINI_BLUE},#7b2ff7)`, border:"none", borderRadius:14, color:"#fff", fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:14, cursor:"pointer", boxShadow:`0 4px 20px rgba(66,133,244,0.4)` }}>Ask Gemini More ✦</button>
        <button onClick={onClose} style={{ padding:"13px 18px", background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:14, color:"rgba(255,255,255,0.7)", fontFamily:"'DM Sans',sans-serif", fontSize:14, cursor:"pointer" }}>Scan Again</button>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════
   HISTORY PANEL
══════════════════════════════════════════ */
const HistoryPanel = ({ history, onClose }) => (
  <div style={{ position:"absolute", inset:0, zIndex:40, background:"rgba(5,5,15,0.98)", display:"flex", flexDirection:"column", fontFamily:"'DM Sans',sans-serif" }}>
    <div style={{ padding:"52px 20px 14px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <GeminiIcon size={28}/>
        <div>
          <div style={{ color:"#fff", fontWeight:700, fontSize:16 }}>Work History</div>
          <div style={{ color:"rgba(255,255,255,0.4)", fontSize:11 }}>{history.length} session{history.length!==1?"s":""} saved</div>
        </div>
      </div>
      <button onClick={onClose} style={{ background:"rgba(255,255,255,0.08)", border:"none", color:"rgba(255,255,255,0.6)", width:36, height:36, borderRadius:"50%", cursor:"pointer", fontSize:20 }}>×</button>
    </div>
    <div style={{ flex:1, overflowY:"auto", padding:"16px" }}>
      {history.length === 0 && (
        <div style={{ textAlign:"center", color:"rgba(255,255,255,0.3)", marginTop:60, fontFamily:"'DM Sans',sans-serif", fontSize:14 }}>No history yet — scan some work first!</div>
      )}
      {[...history].reverse().map((item, i) => (
        <div key={i} style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:16, padding:"14px 16px", marginBottom:12 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <div style={{ padding:"3px 10px", borderRadius:12, fontSize:11, fontWeight:700,
                background: item.mode==="Mark Work"?"rgba(66,133,244,0.2)":item.mode==="Quiz Me"?"rgba(52,168,83,0.2)":"rgba(251,188,5,0.2)",
                color: item.mode==="Mark Work"?GEMINI_BLUE:item.mode==="Quiz Me"?GEMINI_GREEN:GEMINI_YELLOW,
                border: `1px solid ${item.mode==="Mark Work"?"rgba(66,133,244,0.4)":item.mode==="Quiz Me"?"rgba(52,168,83,0.4)":"rgba(251,188,5,0.4)"}`,
              }}>{item.mode}</div>
              {item.result.score !== null && (
                <div style={{ padding:"3px 10px", borderRadius:12, fontSize:11, fontWeight:700, background: item.result.correct?"rgba(52,168,83,0.2)":"rgba(234,67,53,0.2)", color:item.result.correct?GEMINI_GREEN:GEMINI_RED, border:`1px solid ${item.result.correct?"rgba(52,168,83,0.4)":"rgba(234,67,53,0.4)"}` }}>
                  {item.result.score}/10
                </div>
              )}
            </div>
            <div style={{ color:"rgba(255,255,255,0.3)", fontSize:11 }}>{item.timestamp}</div>
          </div>
          {item.snapshot && (
            <img src={item.snapshot} alt="scan" style={{ width:"100%", borderRadius:10, marginBottom:8, maxHeight:120, objectFit:"cover" }}/>
          )}
          <p style={{ color:"rgba(255,255,255,0.7)", fontSize:13, lineHeight:1.6, margin:0 }}>{item.result.feedback}</p>
        </div>
      ))}
    </div>
  </div>
);

/* ══════════════════════════════════════════
   FEEDBACK MODAL
══════════════════════════════════════════ */
const FeedbackModal = ({ onClose }) => {
  const [rating, setRating]     = useState(0);
  const [comment, setComment]   = useState("");
  const [sent, setSent]         = useState(false);

  const submit = () => {
    if (!rating) return;
    // In production, send to Django backend
    console.log("Feedback:", { rating, comment });
    setSent(true);
    setTimeout(onClose, 1500);
  };

  return (
    <div style={{ position:"absolute", inset:0, zIndex:50, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div style={{ width:"100%", maxWidth:430, background:"linear-gradient(180deg,rgba(14,14,28,0.99),rgba(5,5,15,1))", borderRadius:"24px 24px 0 0", padding:"0 24px 48px", borderTop:"1px solid rgba(66,133,244,0.2)" }}>
        <div style={{ display:"flex", justifyContent:"center", padding:"12px 0 16px" }}>
          <div style={{ width:36, height:4, borderRadius:2, background:"rgba(255,255,255,0.18)" }}/>
        </div>
        {sent ? (
          <div style={{ textAlign:"center", padding:"20px 0" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
            <div style={{ color:"#fff", fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:18 }}>Thanks for your feedback!</div>
          </div>
        ) : (<>
          <div style={{ color:"#fff", fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:18, marginBottom:6 }}>Send Feedback</div>
          <div style={{ color:"rgba(255,255,255,0.45)", fontSize:13, marginBottom:20 }}>Help us improve Google Desk</div>
          <div style={{ display:"flex", gap:10, marginBottom:20 }}>
            {[1,2,3,4,5].map(n => (
              <button key={n} onClick={() => setRating(n)} style={{ flex:1, padding:"12px 0", borderRadius:12, border:`1px solid ${rating>=n?"rgba(66,133,244,0.6)":"rgba(255,255,255,0.1)"}`, background: rating>=n?"rgba(66,133,244,0.2)":"rgba(255,255,255,0.05)", color: rating>=n?GEMINI_BLUE:"rgba(255,255,255,0.4)", fontSize:18, cursor:"pointer" }}>★</button>
            ))}
          </div>
          <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Any other comments? (optional)" rows={3} style={{ width:"100%", background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:12, color:"#fff", padding:"12px 14px", fontFamily:"'DM Sans',sans-serif", fontSize:13, outline:"none", resize:"none", marginBottom:16 }}/>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={submit} style={{ flex:1, padding:"13px 0", background:`linear-gradient(135deg,${GEMINI_BLUE},#7b2ff7)`, border:"none", borderRadius:14, color:"#fff", fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:14, cursor:"pointer", opacity: rating?1:0.5 }}>Submit</button>
            <button onClick={onClose} style={{ padding:"13px 18px", background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:14, color:"rgba(255,255,255,0.7)", fontFamily:"'DM Sans',sans-serif", fontSize:14, cursor:"pointer" }}>Cancel</button>
          </div>
        </>)}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════
   CHAT MODAL
══════════════════════════════════════════ */
const ChatModal = ({ onClose, initialContext }) => {
  const [messages, setMessages] = useState([
    { role:"model", text: initialContext || "Hi! I can explain anything from your work. What would you like to know?" }
  ]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages]);

  const send = async () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setInput("");
    const updated = [...messages, { role:"user", text:userMsg }];
    setMessages(updated);
    setLoading(true);
    try {
      const history = updated.slice(1).map(m => ({ role: m.role==="model"?"model":"user", parts:[{ text: m.text }] }));
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method:"POST", headers:{ "Content-Type":"application/json" },
          body: JSON.stringify({
            system_instruction: { parts:[{ text:"You are Google Desk Tutor, an AR educational assistant. Be encouraging, clear, and concise. Break maths and science down step by step." }] },
            contents: history,
          })
        }
      );
      const data = await res.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Let me think...";
      setMessages(m => [...m, { role:"model", text:reply }]);
    } catch {
      setMessages(m => [...m, { role:"model", text:"Connection issue — check API key." }]);
    }
    setLoading(false);
  };

  return (
    <div style={{ position:"absolute", inset:0, zIndex:30, background:"rgba(5,5,15,0.97)", display:"flex", flexDirection:"column", fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ padding:"52px 20px 14px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <GeminiIcon size={30}/>
          <div>
            <div style={{ color:"#fff", fontWeight:700, fontSize:16 }}>Ask Google Desk</div>
            <div style={{ color:"rgba(255,255,255,0.4)", fontSize:11 }}>Powered by Gemini · Live Agent</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background:"rgba(255,255,255,0.08)", border:"none", color:"rgba(255,255,255,0.6)", width:36, height:36, borderRadius:"50%", cursor:"pointer", fontSize:20 }}>←</button>
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"16px 16px 0" }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display:"flex", justifyContent:msg.role==="user"?"flex-end":"flex-start", marginBottom:12 }}>
            {msg.role==="model" && <div style={{ marginRight:8, marginTop:2 }}><GeminiIcon size={22}/></div>}
            <div style={{ maxWidth:"80%", padding:"10px 14px", borderRadius:msg.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px", background:msg.role==="user"?`linear-gradient(135deg,${GEMINI_BLUE},#7b2ff7)`:"rgba(255,255,255,0.07)", color:"#fff", fontSize:14, lineHeight:1.6, border:msg.role==="model"?"1px solid rgba(255,255,255,0.1)":"none" }}>{msg.text}</div>
          </div>
        ))}
        {loading && (
          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"0 0 12px 30px" }}>
            {[0,1,2].map(i => <div key={i} style={{ width:7, height:7, borderRadius:"50%", background:GEMINI_BLUE, animation:`bounce 1.2s ${i*0.2}s infinite` }}/>)}
          </div>
        )}
        <div ref={bottomRef}/>
      </div>
      <div style={{ padding:"12px 16px 36px", borderTop:"1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ display:"flex", gap:10, alignItems:"flex-end" }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key==="Enter" && send()} placeholder="Ask about your work..." style={{ flex:1, padding:"13px 16px", background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:14, color:"#fff", fontSize:14, fontFamily:"'DM Sans',sans-serif", outline:"none" }}/>
          <button onClick={send} style={{ width:46, height:46, borderRadius:13, background:input.trim()?`linear-gradient(135deg,${GEMINI_BLUE},#7b2ff7)`:"rgba(255,255,255,0.07)", border:"none", color:"#fff", cursor:"pointer", fontSize:20, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:input.trim()?`0 4px 16px rgba(66,133,244,0.4)`:"none" }}>↑</button>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════
   CAMERA PERMISSION SCREEN
══════════════════════════════════════════ */
const CameraPermissionScreen = ({ onRequest, onDeny }) => (
  <div style={{ position:"absolute", inset:0, background:"#050510", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:32, gap:24, zIndex:50 }}>
    <GeminiIcon size={72}/>
    <div style={{ textAlign:"center" }}>
      <div style={{ color:"#fff", fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:22, marginBottom:10 }}>Camera Access Needed</div>
      <div style={{ color:"rgba(255,255,255,0.5)", fontFamily:"'DM Sans',sans-serif", fontSize:14, lineHeight:1.7 }}>Google Desk uses your camera to scan and mark your work in real time. Your camera feed is never stored or sent anywhere without your action.</div>
    </div>
    <button onClick={onRequest} style={{ width:"100%", maxWidth:280, padding:"15px 0", background:`linear-gradient(135deg,${GEMINI_BLUE},#7b2ff7)`, border:"none", borderRadius:16, color:"#fff", fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:16, cursor:"pointer", boxShadow:`0 6px 24px rgba(66,133,244,0.5)` }}>Allow Camera</button>
    <button onClick={onDeny} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.35)", fontFamily:"'DM Sans',sans-serif", fontSize:13, cursor:"pointer" }}>Not now</button>
  </div>
);

/* ══════════════════════════════════════════
   TYPING OVERLAY INPUT
══════════════════════════════════════════ */
const TypingOverlay = ({ onSubmit, onClose }) => {
  const [text, setText] = useState("");
  return (
    <div style={{ position:"absolute", bottom:160, left:16, right:16, zIndex:15, animation:"fadeIn 0.3s ease" }}>
      <div style={{ background:"rgba(10,10,22,0.92)", borderRadius:16, padding:"12px 14px", border:"1px solid rgba(66,133,244,0.3)", backdropFilter:"blur(16px)" }}>
        <div style={{ color:"rgba(255,255,255,0.5)", fontSize:11, fontFamily:"monospace", marginBottom:8, letterSpacing:1 }}>TYPE ON SCREEN</div>
        <input autoFocus value={text} onChange={e => setText(e.target.value)}
          placeholder="Type your question or annotation..."
          style={{ width:"100%", background:"transparent", border:"none", color:"#fff", fontSize:15, fontFamily:"'DM Sans',sans-serif", outline:"none" }}
          onKeyDown={e => { if (e.key==="Enter" && text.trim()) { onSubmit(text.trim()); } if (e.key==="Escape") onClose(); }}
        />
        <div style={{ display:"flex", gap:8, marginTop:10 }}>
          <button onClick={() => text.trim() && onSubmit(text.trim())} style={{ flex:1, padding:"9px 0", background:`linear-gradient(135deg,${GEMINI_BLUE},#7b2ff7)`, border:"none", borderRadius:10, color:"#fff", fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:13, cursor:"pointer" }}>Send to Gemini ✦</button>
          <button onClick={onClose} style={{ padding:"9px 14px", background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, color:"rgba(255,255,255,0.6)", fontFamily:"'DM Sans',sans-serif", fontSize:13, cursor:"pointer" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════
   MAIN APP
══════════════════════════════════════════ */
export default function ARTutorApp() {
  const [phase, setPhase]           = useState("idle");   // idle | scanning | result | chat | history | feedback
  const [mode, setMode]             = useState("Mark Work");
  const [result, setResult]         = useState(null);
  const [history, setHistory]       = useState([]);
  const [arMode, setArMode]         = useState(null);     // null | "draw" | "type"
  const [typedText, setTypedText]   = useState("");
  const [analyzing, setAnalyzing]   = useState(false);
  const [error, setError]           = useState("");
  const [storedImages, setStoredImages] = useState([]);
  console.log(storedImages );


  // Webcam replaces videoRef + camState
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  

  // Track if user granted webcam permission
  
  const [webcamPermission, setWebcamPermission] = useState(false);

  // Capture a snapshot from the webcam
  const captureSnapshot = useCallback(() => {
    if (!webcamRef.current) return null;
    return webcamRef.current.getScreenshot(); // base64 JPEG
  }, []);

  // Auto-capture snapshots every 10 seconds for internal use
  useEffect(() => {
    if (!webcamPermission) return;

    const interval = setInterval(() => {
      const snap = captureSnapshot();
      if (snap) setStoredImages(prev => [...prev, snap]);
    }, 10000); // every 10 seconds

    return () => clearInterval(interval);
  }, [webcamPermission, captureSnapshot]);

  /* Clear drawing canvas */
  const clearCanvas = () => {
    if (canvasRef.current) {
      canvasRef.current.getContext("2d").clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  const requestCameraAccess = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (webcamRef.current) webcamRef.current.srcObject = stream;
      setWebcamPermission(true);
    } catch (e) {
      console.error("Camera access denied", e);
      setWebcamPermission(false);
    }
  };

  /* Run Gemini analysis */
  const runAnalysis = useCallback(async (overrideText) => {
    if (!webcamRef.current?.video || analyzing) return;
    if (!GEMINI_API_KEY) {
      setError("Gemini API key at the top of App.js");
      return;
    }

    setAnalyzing(true);
    setPhase("scanning");
    setError("");

    try {
      const res = await analyseWithGemini(
        webcamRef.current.video,
        canvasRef.current,
        mode,
        overrideText || typedText
      );

      const snap = captureSnapshot();
      const entry = {
        mode,
        result: res,
        snapshot: snap,
        timestamp: new Date().toLocaleString("en-GB", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      setHistory(h => [...h, entry]);
      setResult(res);
      setPhase("result");
    } catch (e) {
      setError("Gemini error — check API key or try again.");
      setPhase("idle");
    }

    setAnalyzing(false);
  }, [mode, typedText, analyzing, captureSnapshot]);

  /* Called when user finishes drawing */
  const onDrawEnd = useCallback(() => {
    if (arMode === "draw") runAnalysis();
  }, [arMode, runAnalysis]);

  /* Typed text submitted */
  const onTypeSubmit = (text) => {
    setTypedText(text);
    setArMode(null);
    runAnalysis(text);
  };

  const modeColors = {
    "Mark Work": GEMINI_BLUE,
    "Explain":   GEMINI_YELLOW,
    "Quiz Me":   GEMINI_GREEN,
  };

  return (
    <div style={{ position:"relative", width:"100%", maxWidth:430, height:"100dvh", margin:"0 auto", background:"#000", overflow:"hidden", userSelect:"none" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes edgeH    { 0%{transform:scaleX(0);opacity:0} 15%{opacity:1} 85%{opacity:1} 100%{transform:scaleX(1);opacity:0} }
        @keyframes edgeV    { 0%{transform:scaleY(0);opacity:0} 15%{opacity:1} 85%{opacity:1} 100%{transform:scaleY(1);opacity:0} }
        @keyframes sweepLine{ 0%{top:18%;opacity:0.9} 100%{top:64%;opacity:0.1} }
        @keyframes glowPulse{ 0%,100%{opacity:1} 50%{opacity:0.35} }
        @keyframes bounce   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes pulse    { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.88)} }
        @keyframes fadeIn   { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes lensIdle { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }
        * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
        ::-webkit-scrollbar { width:0; }
        input::placeholder,textarea::placeholder { color:rgba(255,255,255,0.35); }
      `}</style>

      {!webcamPermission && (
        <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", background:"#000" }}>
          <button
            onClick={requestCameraAccess}
            style={{
              padding:"12px 24px",
              fontSize:16,
              borderRadius:8,
              cursor:"pointer",
              background:"#4285F4",
              color:"#fff",
              border:"none"
            }}
          >
            Allow Camera
          </button>
        </div>
      )}
      
      {webcamPermission && (
        <Webcam
          audio={false}
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          videoConstraints={{ facingMode: "environment" }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            zIndex: 0 // behind all AR overlays and buttons
          }}
        />
      )}

      {/* ── AR DRAWING CANVAS ── */}
      {webcamPermission === true && (
        <ARCanvas active={arMode==="draw"} canvasRef={canvasRef} onDrawEnd={onDrawEnd}/>
      )}

      {/* ── SCAN OVERLAY ── */}
      {webcamPermission === true && (phase==="scanning" || phase==="result") && (
        <ScanOverlay scanning={phase==="scanning"} marked={phase==="result"}/>
      )}

      {/* ── TYPED TEXT OVERLAY (shows on screen) ── */}
      {typedText && phase !== "result" && (
        <div style={{ position:"absolute", top:"15%", left:"8%", right:"8%", zIndex:7, background:"rgba(0,0,0,0.6)", borderRadius:12, padding:"10px 14px", border:`1px solid rgba(255,215,0,0.4)`, backdropFilter:"blur(8px)", pointerEvents:"none" }}>
          <div style={{ color:"#FFD700", fontFamily:"'DM Sans',sans-serif", fontSize:14, lineHeight:1.5 }}>{typedText}</div>
        </div>
      )}

      {/* ── ERROR TOAST ── */}
      {error && (
        <div style={{ position:"absolute", top:"12%", left:"5%", right:"5%", zIndex:25, background:"rgba(234,67,53,0.9)", borderRadius:12, padding:"12px 16px", animation:"fadeIn 0.3s ease" }}>
          <div style={{ color:"#fff", fontFamily:"'DM Sans',sans-serif", fontSize:13 }}>{error}</div>
        </div>
      )}

      {/* ── TOP BAR ── */}
      {webcamPermission === null && phase !== "history" && phase !== "feedback" && (
        <div style={{ position:"absolute", top:0, left:0, right:0, zIndex:10, padding:"50px 20px 14px", display:"flex", alignItems:"center", justifyContent:"space-between", background:"linear-gradient(180deg,rgba(0,0,0,0.65) 0%,transparent 100%)" }}>          
          <div style={{ display:"flex", gap:8 }}>
            {/* History (clock) */}
            <button onClick={() => setPhase("history")} title="Work History" style={{ width:36, height:36, borderRadius:"50%", background:"rgba(0,0,0,0.35)", border:"1px solid rgba(255,255,255,0.15)", color:"rgba(255,255,255,0.7)", fontSize:15, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>🕐</button>
            {/* Feedback (three dots) */}
            <button onClick={() => setPhase("feedback")} title="Send Feedback" style={{ width:36, height:36, borderRadius:"50%", background:"rgba(0,0,0,0.35)", border:"1px solid rgba(255,255,255,0.15)", color:"rgba(255,255,255,0.7)", fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>⋯</button>
          </div>
        </div>
      )}

      {/* ── AR TOOLBAR (draw / type / clear) ── */}
      {webcamPermission === true && phase === "idle" && (
        <div style={{ position:"absolute", top:"12%", right:14, zIndex:12, display:"flex", flexDirection:"column", gap:8 }}>
          <button onClick={() => setArMode(arMode==="draw" ? null : "draw")} title="Draw on screen" style={{ width:40, height:40, borderRadius:12, background: arMode==="draw"?`rgba(66,133,244,0.4)`:"rgba(0,0,0,0.5)", border:`1px solid ${arMode==="draw"?"rgba(66,133,244,0.8)":"rgba(255,255,255,0.15)"}`, color:"#fff", fontSize:18, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(8px)" }}>✏️</button>
          <button onClick={() => setArMode(arMode==="type" ? null : "type")} title="Type on screen" style={{ width:40, height:40, borderRadius:12, background: arMode==="type"?`rgba(251,188,5,0.3)`:"rgba(0,0,0,0.5)", border:`1px solid ${arMode==="type"?"rgba(251,188,5,0.8)":"rgba(255,255,255,0.15)"}`, color:"#fff", fontSize:18, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(8px)" }}>⌨️</button>
          {(arMode || typedText) && (
            <button onClick={() => { clearCanvas(); setTypedText(""); setArMode(null); }} title="Clear" style={{ width:40, height:40, borderRadius:12, background:"rgba(234,67,53,0.3)", border:"1px solid rgba(234,67,53,0.6)", color:"#fff", fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(8px)" }}>🗑️</button>
          )}
        </div>
      )}

      {/* ── TYPING INPUT ── */}
      {arMode === "type" && phase === "idle" && (
        <TypingOverlay onSubmit={onTypeSubmit} onClose={() => setArMode(null)}/>
      )}

      {/* ── IDLE BOTTOM PANEL ── */}
      {webcamPermission === null && phase === "idle" && (
        <div style={{ position:"absolute", bottom:0, left:0, right:0, zIndex:10, background:"linear-gradient(180deg, transparent 30%, rgba(0,0,0,1) 90%)", padding:"20px 24px 52px", display:"flex", flexDirection:"column", alignItems:"center", gap:16, animation:"fadeIn 3s ease" }}>
          <div style={{ textAlign:"center" }}>
            <div style={{ color:"#fff", fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:22, marginBottom:4 }}>Mark My Work</div>
            <div style={{ color:"rgba(255,255,255,0.45)", fontFamily:"'DM Sans',sans-serif", fontSize:13, lineHeight:1.6 }}>Point camera at your work and tap to scan<br/>or draw/type on screen to annotate</div>
          </div>

          {/* Scan Button */}
          <button onClick={() => { setTypedText(""); runAnalysis(); }} disabled={analyzing} style={{ background:"rgba(255,255,255,0.1)", border:"1.5px solid rgba(255,255,255,0.2)", borderRadius:22, width:84, height:84, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", boxShadow:"0 0 0 12px rgba(255,255,255,0.04),0 8px 32px rgba(0,0,0,0.5)", backdropFilter:"blur(8px)", animation:"lensIdle 2.5s ease-in-out infinite", opacity: analyzing?0.5:1 }}>
            <GeminiIcon size={52}/>
          </button>

          {/* Mode pills — each changes Gemini prompt */}
          <div style={{ display:"flex", gap:8 }}>
            {["Mark Work","Explain","Quiz Me"].map((label) => (
              <button key={label} onClick={() => setMode(label)} style={{ padding:"7px 14px", borderRadius:20, background: mode===label?`rgba(${label==="Mark Work"?"66,133,244":label==="Explain"?"251,188,5":"52,168,83"},0.2)`:"rgba(255,255,255,0.07)", border: mode===label?`1px solid rgba(${label==="Mark Work"?"66,133,244":label==="Explain"?"251,188,5":"52,168,83"},0.5)`:"1px solid rgba(255,255,255,0.1)", color: mode===label?modeColors[label]:"rgba(255,255,255,0.45)", fontFamily:"'DM Sans',sans-serif", fontSize:12, fontWeight:600, cursor:"pointer", transition:"all 0.2s" }}>{label}</button>
            ))}
          </div>
        </div>
      )}

      {/* ── SCANNING STATUS ── */}
      {phase === "scanning" && (
        <div style={{ position:"absolute", bottom:"10%", left:0, right:0, zIndex:10, display:"flex", justifyContent:"center", animation:"fadeIn 0.3s ease" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, background:"rgba(8,8,20,0.88)", borderRadius:22, padding:"11px 22px", border:"1px solid rgba(66,133,244,0.3)", backdropFilter:"blur(12px)" }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:GEMINI_BLUE, animation:"pulse 0.9s infinite", boxShadow:`0 0 10px ${GEMINI_BLUE}` }}/>
            <span style={{ color:"#fff", fontFamily:"'DM Sans',sans-serif", fontSize:14, fontWeight:500 }}>Gemini is analysing…</span>
          </div>
        </div>
      )}

      {/* ── RESULT PANEL ── */}
      {phase === "result" && result && (
        <FeedbackPanel result={result} mode={mode} onClose={() => { setPhase("idle"); clearCanvas(); setTypedText(""); }} onAskMore={() => setPhase("chat")}/>
      )}

      {/* ── CHAT ── */}
      {phase === "chat" && (
        <ChatModal onClose={() => setPhase("result")} initialContext={result?.feedback}/>
      )}

      {/* ── HISTORY ── */}
      {phase === "history" && (
        <HistoryPanel history={history} onClose={() => setPhase("idle")}/>
      )}

      {/* ── FEEDBACK MODAL ── */}
      {phase === "feedback" && (
        <FeedbackModal onClose={() => setPhase("idle")}/>
      )}
    </div>
  );
}

console.log(CameraPermissionScreen );
