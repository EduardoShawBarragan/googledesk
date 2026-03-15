import { useEffect, useRef, useState, useCallback } from 'react';
import './Scanner.css';

// ── PASTE GEMINI API KEY HERE ──
const GEMINI_API_KEY = 'AIzaSyB9q-Hh7iqPch1olLNJUGKA06C2u5bLmw8';

const GEMINI_BLUE   = '#4285F4';
const GEMINI_RED    = '#EA4335';
const GEMINI_YELLOW = '#FBBC05';
const GEMINI_GREEN  = '#34A853';

/* ════════════════════════════════════════
   GOOGLE-STYLE SVG ICONS
   Matching Google's Material icon aesthetic
════════════════════════════════════════ */

// Google Lens icon — actual PNG asset
const LensIcon = ({ size = 72 }) => (
  <img src="/lens-icon.png" width={size} height={size} alt="Scan" style={{ display:'block' }}/>
);

// Google "G" logo style app icon
const GoogleDeskIcon = ({ size = 26 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
    <rect width="40" height="40" rx="10" fill="white"/>
    <path d="M20 8C13.37 8 8 13.37 8 20C8 26.63 13.37 32 20 32C26.63 32 32 26.63 32 20H20V24H27.18C26.22 26.9 23.36 29 20 29C15.58 29 12 25.42 12 21C12 16.58 15.58 13 20 13C22.03 13 23.88 13.74 25.32 14.97L28.15 12.14C26.06 10.2 23.18 9 20 9V8Z" fill={GEMINI_BLUE}/>
    <path d="M8 20C8 17.1 9.07 14.46 10.83 12.44L13.7 15.31C12.63 16.59 12 18.22 12 20H8Z" fill={GEMINI_RED}/>
    <path d="M20 8V9C22.89 9 25.52 10.07 27.54 11.84L25.32 14.97C23.88 13.74 22.03 13 20 13V8Z" fill={GEMINI_YELLOW}/>
    <path d="M20 29C23.36 29 26.22 26.9 27.18 24H20V29Z" fill={GEMINI_GREEN}/>
  </svg>
);

// Google Material History icon
const HistoryIcon = ({ size = 22, color = 'white' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M13 3C8.03 3 4 7.03 4 12H1L4.89 15.89L4.96 16.03L9 12H6C6 8.13 9.13 5 13 5C16.87 5 20 8.13 20 12C20 15.87 16.87 19 13 19C11.07 19 9.32 18.21 8.06 16.94L6.64 18.36C8.27 19.99 10.52 21 13 21C17.97 21 22 16.97 22 12C22 7.03 17.97 3 13 3ZM12 8V13L16.28 15.54L17 14.33L13.5 12.25V8H12Z"/>
  </svg>
);

// Google Material Settings icon
const SettingsIcon = ({ size = 22, color = 'white' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M19.14 12.94C19.18 12.64 19.2 12.33 19.2 12C19.2 11.68 19.18 11.36 19.13 11.06L21.16 9.48C21.34 9.34 21.39 9.07 21.28 8.87L19.36 5.55C19.24 5.33 18.99 5.26 18.77 5.33L16.38 6.29C15.88 5.91 15.35 5.59 14.76 5.35L14.4 2.81C14.36 2.57 14.16 2.4 13.92 2.4H10.08C9.84 2.4 9.65 2.57 9.61 2.81L9.25 5.35C8.66 5.59 8.12 5.92 7.63 6.29L5.24 5.33C5.01 5.25 4.76 5.33 4.64 5.55L2.72 8.87C2.6 9.08 2.65 9.34 2.86 9.48L4.89 11.06C4.84 11.36 4.8 11.69 4.8 12C4.8 12.31 4.82 12.64 4.87 12.94L2.84 14.52C2.66 14.66 2.61 14.93 2.72 15.13L4.64 18.45C4.76 18.67 5.01 18.74 5.24 18.67L7.63 17.71C8.13 18.09 8.66 18.41 9.25 18.65L9.61 21.19C9.65 21.43 9.84 21.6 10.08 21.6H13.92C14.16 21.6 14.36 21.43 14.39 21.19L14.75 18.65C15.34 18.41 15.88 18.08 16.37 17.71L18.76 18.67C18.99 18.75 19.24 18.67 19.36 18.45L21.28 15.13C21.4 14.91 21.34 14.66 21.15 14.52L19.14 12.94ZM12 15.6C10.02 15.6 8.4 13.98 8.4 12C8.4 10.02 10.02 8.4 12 8.4C13.98 8.4 15.6 10.02 15.6 12C15.6 13.98 13.98 15.6 12 15.6Z"/>
  </svg>
);

// Google Material Screenshot / Camera icon
const ScreenshotIcon = ({ size = 20, color = 'white' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M20 4H16.83L15 2H9L7.17 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM12 17C9.24 17 7 14.76 7 12C7 9.24 9.24 7 12 7C14.76 7 17 9.24 17 12C17 14.76 14.76 17 12 17ZM12 9C10.34 9 9 10.34 9 12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12C15 13.66 13.66 9 12 9Z"/>
    <circle cx="12" cy="12" r="3" fill={color}/>
  </svg>
);

// Google Material Feedback / Star icon
const FeedbackIcon = ({ size = 20, color = 'white' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM12 14L9 11.79V7H10.5V11.21L13 13.01L12 14Z"/>
    <path d="M13 9H11V13.22L13.78 15.28L14.72 13.97L12.5 12.38V9H13Z" fill={color}/>
    <path d="M12 17.27L15.18 19.1L14.36 15.51L17.16 13.07L13.49 12.75L12 9.35L10.51 12.75L6.84 13.07L9.64 15.51L8.82 19.1L12 17.27Z"/>
  </svg>
);

// Google Material Close icon
const CloseIcon = ({ size = 20, color = 'rgba(255,255,255,0.7)' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z"/>
  </svg>
);

// Google Material Back arrow
const BackIcon = ({ size = 20, color = 'white' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M20 11H7.83L13.42 5.41L12 4L4 12L12 20L13.41 18.59L7.83 13H20V11Z"/>
  </svg>
);

/* ════════════════════════════════════════
   OPENCV LOADER
════════════════════════════════════════ */
const loadOpenCv = (onComplete) => {
  const existing = document.getElementById('open-cv');
  const waitForCV = () => {
    if (window.cv && window.cv.Mat) {
      onComplete();
    } else {
      setTimeout(waitForCV, 100);
    }
  };
  if (existing) { waitForCV(); return; }
  const script = document.createElement('script');
  script.id  = 'open-cv';
  script.src = 'https://docs.opencv.org/4.7.0/opencv.js';
  script.onload = waitForCV;
  document.body.appendChild(script);
};

/* ════════════════════════════════════════
   OPENCV PAPER EXTRACTION
   Detects paper in image, perspective warps it flat
════════════════════════════════════════ */
const extractPaperWithOpenCV = (imgElement) => {
  const cv = window.cv;
  if (!cv || !cv.Mat) return null;

  let src, gray, blurred, edged, contours, hierarchy;
  let paperCnt = null;

  try {
    src      = cv.imread(imgElement);
    gray     = new cv.Mat();
    blurred  = new cv.Mat();
    edged    = new cv.Mat();
    contours = new cv.MatVector();
    hierarchy = new cv.Mat();

    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
    cv.GaussianBlur(gray, blurred, new cv.Size(3, 3), 0, 0, cv.BORDER_DEFAULT);
    cv.Canny(blurred, edged, 60, 180);
    cv.findContours(edged, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    const imgArea = src.cols * src.rows;
    let bestScore = 0;

    for (let i = 0; i < contours.size(); i++) {
      const c      = contours.get(i);
      const peri   = cv.arcLength(c, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(c, approx, 0.02 * peri, true);

      if (approx.rows === 4) {
        const area      = cv.contourArea(approx);
        const areaRatio = area / imgArea;
        if (areaRatio < 0.1 || areaRatio > 0.95) { approx.delete(); c.delete(); continue; }

        const ptsTmp = [];
        for (let j = 0; j < approx.rows; j++) ptsTmp.push({ x: approx.intAt(j, 0), y: approx.intAt(j, 1) });
        ptsTmp.sort((a, b) => a.y - b.y);
        const top    = ptsTmp.slice(0, 2).sort((a, b) => a.x - b.x);
        const bottom = ptsTmp.slice(2, 4).sort((a, b) => a.x - b.x);
        const dist   = (p1, p2) => Math.sqrt((p1.x-p2.x)**2 + (p1.y-p2.y)**2);
        const avgW   = (dist(top[0],top[1]) + dist(bottom[0],bottom[1])) / 2;
        const avgH   = (dist(top[0],bottom[0]) + dist(top[1],bottom[1])) / 2;
        const aspect = avgH > 0 ? avgH / avgW : 0;

        if (aspect < 0.8 || aspect > 2.2) { approx.delete(); c.delete(); continue; }

        const score = areaRatio * Math.exp(-Math.abs(aspect - 1.4));
        if (score > bestScore) {
          bestScore = score;
          if (paperCnt) paperCnt.delete();
          paperCnt = approx;
        } else { approx.delete(); }
      } else { approx.delete(); }
      c.delete();
    }

    if (!paperCnt) {
      // Fallback: return full image canvas
      const fb = document.createElement('canvas');
      fb.width = src.cols; fb.height = src.rows;
      cv.imshow(fb, src);
      [src,gray,blurred,edged,contours,hierarchy].forEach(m => m.delete());
      return fb;
    }

    // Order corners: TL, TR, BR, BL
    const pts = [];
    for (let i = 0; i < paperCnt.rows; i++) pts.push({ x: paperCnt.intAt(i,0), y: paperCnt.intAt(i,1) });
    pts.sort((a,b) => a.y - b.y);
    const top    = pts.slice(0,2).sort((a,b) => a.x - b.x);
    const bottom = pts.slice(2,4).sort((a,b) => a.x - b.x);
    const [tl,tr,br,bl] = [top[0],top[1],bottom[1],bottom[0]];
    const dist = (p1,p2) => Math.sqrt((p1.x-p2.x)**2 + (p1.y-p2.y)**2);
    const tw   = Math.round(Math.max(dist(tl,tr), dist(bl,br)));
    const th   = Math.round(Math.max(dist(tl,bl), dist(tr,br)));

    const srcTri = cv.matFromArray(4,1,cv.CV_32FC2,[tl.x,tl.y,tr.x,tr.y,br.x,br.y,bl.x,bl.y]);
    const dstTri = cv.matFromArray(4,1,cv.CV_32FC2,[0,0,tw-1,0,tw-1,th-1,0,th-1]);
    const M      = cv.getPerspectiveTransform(srcTri, dstTri);
    const dst    = new cv.Mat();
    cv.warpPerspective(src, dst, M, new cv.Size(tw,th), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

    const canvas = document.createElement('canvas');
    canvas.width = tw; canvas.height = th;
    cv.imshow(canvas, dst);

    [src,gray,blurred,edged,contours,hierarchy,paperCnt,srcTri,dstTri,M,dst].forEach(m => m.delete());
    return canvas;

  } catch(err) {
    console.error('[Scanner] OpenCV error:', err);
    [src,gray,blurred,edged,contours,hierarchy,paperCnt].forEach(m => m && m.delete());
    return null;
  }
};

/* ════════════════════════════════════════
   GEMINI VISION ANALYSIS
   Sends flattened paper image to Gemini
════════════════════════════════════════ */
async function analyseWithGemini(paperCanvas, mode, typedText = '') {
  const base64 = paperCanvas.toDataURL('image/jpeg', 0.85).split(',')[1];

  const prompts = {
    'Mark Work': `You are Google Desk, an AR educational tutor. The image shows a student's written work that has been automatically scanned and flattened. ${typedText ? `Student note: "${typedText}"` : ''}
Analyse the work carefully. Mark it out of 10.
Respond ONLY in this exact JSON format (no markdown, no extra text):
{"score": 8, "correct": true, "feedback": "Your explanation here.", "steps": null}
If errors exist set correct to false and steps to an array of corrective step strings.
If no work is visible: {"score": 0, "correct": false, "feedback": "Please point your camera at your written work.", "steps": null}`,

    'Explain': `You are Google Desk, an AR educational tutor. The image shows scanned written work. ${typedText ? `Student asked: "${typedText}"` : ''}
Explain the content shown clearly and step by step.
Respond ONLY in this exact JSON format (no markdown):
{"score": null, "correct": null, "feedback": "Your explanation in 2-3 sentences.", "steps": ["Key point 1", "Key point 2", "Key point 3"]}`,

    'Quiz Me': `You are Google Desk, an AR educational tutor. The image shows scanned written work. ${typedText ? `Context: "${typedText}"` : ''}
Create a quiz question based on what you see.
Respond ONLY in this exact JSON format (no markdown):
{"score": null, "correct": null, "feedback": "Quiz question based on the work shown.", "steps": ["Hint 1", "Hint 2", "Answer: the answer here"]}`
  };

  const res = await fetch(
    `/gemini/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: 'image/jpeg', data: base64 } },
            { text: prompts[mode] }
          ]
        }]
      })
    }
  );
if (!res.ok) {
  const errText = await res.text();
  throw new Error(`Gemini API error ${res.status}: ${errText}`);
}
const data  = await res.json();
const text  = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
const clean = text.replace(/```json|```/g, '').trim();
return JSON.parse(clean);
}

/* ════════════════════════════════════════
   SCAN OVERLAY — animated coloured edges
════════════════════════════════════════ */
const ScanOverlay = ({ scanning, marked }) => {
  const BOX = { top:'15%', left:'4%', right:'4%', bottom:'32%' };
  const ec  = marked
    ? { tl:GEMINI_GREEN, tr:GEMINI_GREEN, bl:GEMINI_GREEN, br:GEMINI_GREEN }
    : { tl:GEMINI_RED,   tr:GEMINI_BLUE,  bl:GEMINI_GREEN, br:GEMINI_YELLOW };

  const corner = (pos) => {
    const b = { position:'absolute', width:28, height:28, transition:'border-color 0.5s' };
    if (pos==='tl') return { ...b, top:BOX.top,       left:BOX.left,   borderTop:`3.5px solid ${ec.tl}`, borderLeft:`3.5px solid ${ec.tl}`,   borderRadius:'4px 0 0 0' };
    if (pos==='tr') return { ...b, top:BOX.top,       right:BOX.right, borderTop:`3.5px solid ${ec.tr}`, borderRight:`3.5px solid ${ec.tr}`,  borderRadius:'0 4px 0 0' };
    if (pos==='bl') return { ...b, bottom:BOX.bottom, left:BOX.left,   borderBottom:`3.5px solid ${ec.bl}`, borderLeft:`3.5px solid ${ec.bl}`, borderRadius:'0 0 0 4px' };
    return                 { ...b, bottom:BOX.bottom, right:BOX.right, borderBottom:`3.5px solid ${ec.br}`, borderRight:`3.5px solid ${ec.br}`,borderRadius:'0 0 4px 0' };
  };

  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:5 }}>
      <div style={{ position:'absolute', inset:0, background:`linear-gradient(to bottom,rgba(0,0,0,0.35) 0%,transparent 15%),linear-gradient(to top,rgba(0,0,0,0.35) 0%,transparent 32%),linear-gradient(to right,rgba(0,0,0,0.2) 0%,transparent 4%),linear-gradient(to left,rgba(0,0,0,0.2) 0%,transparent 4%)` }}/>
      {['tl','tr','bl','br'].map(p => <div key={p} style={corner(p)}/>)}
      {scanning && (<>
        <div style={{ position:'absolute', top:BOX.top,    left:BOX.left, right:BOX.right, height:2, background:`linear-gradient(90deg,${GEMINI_RED},${GEMINI_BLUE})`,   transformOrigin:'left',   animation:'edgeH 1.6s ease-in-out infinite',         boxShadow:`0 0 10px ${GEMINI_RED}` }}/>
        <div style={{ position:'absolute', bottom:BOX.bottom, left:BOX.left, right:BOX.right, height:2, background:`linear-gradient(90deg,${GEMINI_GREEN},${GEMINI_YELLOW})`, transformOrigin:'right',  animation:'edgeH 1.6s ease-in-out infinite reverse', boxShadow:`0 0 10px ${GEMINI_GREEN}` }}/>
        <div style={{ position:'absolute', left:BOX.left,  top:BOX.top, bottom:BOX.bottom, width:2,  background:`linear-gradient(180deg,${GEMINI_RED},${GEMINI_GREEN})`,   transformOrigin:'top',    animation:'edgeV 1.6s ease-in-out infinite 0.2s',    boxShadow:`0 0 10px ${GEMINI_BLUE}` }}/>
        <div style={{ position:'absolute', right:BOX.right, top:BOX.top, bottom:BOX.bottom, width:2, background:`linear-gradient(180deg,${GEMINI_BLUE},${GEMINI_YELLOW})`, transformOrigin:'bottom', animation:'edgeV 1.6s ease-in-out infinite reverse 0.2s', boxShadow:`0 0 10px ${GEMINI_YELLOW}` }}/>
        <div style={{ position:'absolute', left:BOX.left, right:BOX.right, top:BOX.top, height:2, background:`linear-gradient(90deg,transparent,${GEMINI_BLUE},transparent)`, animation:'sweepLine 1.8s ease-in-out infinite', boxShadow:`0 0 16px 4px rgba(66,133,244,0.5)` }}/>
      </>)}
      {marked && <div style={{ position:'absolute', top:BOX.top, left:BOX.left, right:BOX.right, bottom:BOX.bottom, border:`2px solid ${GEMINI_GREEN}`, borderRadius:6, boxShadow:`0 0 22px ${GEMINI_GREEN},inset 0 0 22px rgba(52,168,83,0.1)`, animation:'glowPulse 1s ease-in-out 2' }}/>}
    </div>
  );
};

/* ════════════════════════════════════════
   FEEDBACK PANEL — bottom sheet
════════════════════════════════════════ */
const FeedbackPanel = ({ result, mode, onClose, onAskMore }) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 50); }, []);

  return (
    <div style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:20, background:'linear-gradient(180deg,rgba(10,10,22,0.97),rgba(5,5,15,0.99))', borderTop:`1px solid rgba(66,133,244,0.25)`, borderRadius:'24px 24px 0 0', padding:'0 0 36px', transform:visible?'translateY(0)':'translateY(100%)', transition:'transform 0.45s cubic-bezier(0.34,1.56,0.64,1)', maxHeight:'68vh', overflowY:'auto', backdropFilter:'blur(24px)' }}>
      <div style={{ display:'flex', justifyContent:'center', padding:'12px 0 6px' }}>
        <div style={{ width:36, height:4, borderRadius:2, background:'rgba(255,255,255,0.18)' }}/>
      </div>
      <div style={{ padding:'6px 20px 14px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div>
            <div style={{ color:'#fff', fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:15 }}>Google Desk</div>
            <div style={{ color:'rgba(255,255,255,0.4)', fontSize:11, fontFamily:'monospace' }}>
              {mode === 'Mark Work' ? 'Live Marking' : mode === 'Explain' ? 'Explanation' : 'Quiz'}
            </div>
          </div>
        </div>
        <button onClick={onClose} style={{ background:'rgba(255,255,255,0.08)', border:'none', color:'rgba(255,255,255,0.6)', width:32, height:32, borderRadius:'50%', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <CloseIcon size={18}/>
        </button>
      </div>

      {/* Score badge */}
      {mode === 'Mark Work' && result.score !== null && (
        <div style={{ padding:'0 20px 14px' }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:result.correct?'rgba(52,168,83,0.15)':'rgba(234,67,53,0.15)', border:`1px solid ${result.correct?'rgba(52,168,83,0.4)':'rgba(234,67,53,0.4)'}`, borderRadius:20, padding:'6px 16px' }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:result.correct?GEMINI_GREEN:GEMINI_RED, boxShadow:`0 0 8px ${result.correct?GEMINI_GREEN:GEMINI_RED}` }}/>
            <span style={{ color:result.correct?GEMINI_GREEN:GEMINI_RED, fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:13 }}>
              {result.correct ? `${result.score}/10 — Correct ✓` : `${result.score}/10 — Needs Work`}
            </span>
          </div>
        </div>
      )}
      {mode === 'Quiz Me'  && <div style={{ padding:'0 20px 14px' }}><div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(66,133,244,0.15)', border:`1px solid rgba(66,133,244,0.4)`, borderRadius:20, padding:'6px 16px' }}><span style={{ color:GEMINI_BLUE, fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:13 }}>🎯 Quiz Time</span></div></div>}
      {mode === 'Explain'  && <div style={{ padding:'0 20px 14px' }}><div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(251,188,5,0.15)', border:`1px solid rgba(251,188,5,0.4)`, borderRadius:20, padding:'6px 16px' }}><span style={{ color:GEMINI_YELLOW, fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:13 }}>💡 Explanation</span></div></div>}

      <div style={{ padding:'0 20px 18px' }}>
        <p style={{ color:'rgba(255,255,255,0.85)', fontSize:14, lineHeight:1.75, fontFamily:"'DM Sans',sans-serif", margin:0 }}>{result.feedback}</p>
      </div>

      {result.steps?.length > 0 && (
        <div style={{ padding:'0 20px 20px' }}>
          <div style={{ color:'rgba(255,255,255,0.35)', fontSize:10, fontFamily:'monospace', marginBottom:10, letterSpacing:1.5 }}>
            {mode==='Quiz Me'?'HINTS & ANSWER':mode==='Explain'?'KEY POINTS':'SUGGESTED STEPS'}
          </div>
          {result.steps.map((step, i) => (
            <div key={i} style={{ display:'flex', gap:12, marginBottom:10, alignItems:'flex-start' }}>
              <div style={{ minWidth:22, height:22, borderRadius:'50%', background:`linear-gradient(135deg,${GEMINI_BLUE},#7b2ff7)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#fff', fontFamily:'monospace' }}>{i+1}</div>
              <div style={{ color:'rgba(255,255,255,0.75)', fontSize:13, fontFamily:"'DM Sans',sans-serif", lineHeight:1.6 }}>{step}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ padding:'0 20px', display:'flex', gap:10 }}>
        <button onClick={onAskMore} style={{ flex:1, padding:'13px 0', background:`linear-gradient(135deg,${GEMINI_BLUE},#7b2ff7)`, border:'none', borderRadius:14, color:'#fff', fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:14, cursor:'pointer', boxShadow:`0 4px 20px rgba(66,133,244,0.4)` }}>Ask Gemini More ✦</button>
        <button onClick={onClose} style={{ padding:'13px 18px', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:14, color:'rgba(255,255,255,0.7)', fontFamily:"'DM Sans',sans-serif", fontSize:14, cursor:'pointer' }}>Scan Again</button>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════
   HISTORY PANEL
════════════════════════════════════════ */
const HistoryPanel = ({ history, onClose }) => (
  <div style={{ position:'absolute', inset:0, zIndex:40, background:'rgba(5,5,15,0.98)', display:'flex', flexDirection:'column', fontFamily:"'DM Sans',sans-serif" }}>
    <div style={{ padding:'52px 20px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div>
          <div style={{ color:'#fff', fontWeight:700, fontSize:16 }}>Work History</div>
          <div style={{ color:'rgba(255,255,255,0.4)', fontSize:11 }}>{history.length} session{history.length!==1?'s':''} saved</div>
        </div>
      </div>
      <button onClick={onClose} style={{ background:'rgba(255,255,255,0.08)', border:'none', width:36, height:36, borderRadius:'50%', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <CloseIcon size={20}/>
      </button>
    </div>
    <div style={{ flex:1, overflowY:'auto', padding:16 }}>
      {history.length === 0 && (
        <div style={{ textAlign:'center', color:'rgba(255,255,255,0.3)', marginTop:60, fontSize:14 }}>No history yet — scan some work first!</div>
      )}
      {[...history].reverse().map((item, i) => (
        <div key={i} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:16, padding:'14px 16px', marginBottom:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <div style={{ padding:'3px 10px', borderRadius:12, fontSize:11, fontWeight:700,
                background:item.mode==='Mark Work'?'rgba(66,133,244,0.2)':item.mode==='Quiz Me'?'rgba(52,168,83,0.2)':'rgba(251,188,5,0.2)',
                color:item.mode==='Mark Work'?GEMINI_BLUE:item.mode==='Quiz Me'?GEMINI_GREEN:GEMINI_YELLOW,
                border:`1px solid ${item.mode==='Mark Work'?'rgba(66,133,244,0.4)':item.mode==='Quiz Me'?'rgba(52,168,83,0.4)':'rgba(251,188,5,0.4)'}`,
              }}>{item.mode}</div>
              {item.result.score !== null && (
                <div style={{ padding:'3px 10px', borderRadius:12, fontSize:11, fontWeight:700, background:item.result.correct?'rgba(52,168,83,0.2)':'rgba(234,67,53,0.2)', color:item.result.correct?GEMINI_GREEN:GEMINI_RED, border:`1px solid ${item.result.correct?'rgba(52,168,83,0.4)':'rgba(234,67,53,0.4)'}` }}>
                  {item.result.score}/10
                </div>
              )}
            </div>
            <div style={{ color:'rgba(255,255,255,0.3)', fontSize:11 }}>{item.timestamp}</div>
          </div>
          {item.snapshot && <img src={item.snapshot} alt="scan" style={{ width:'100%', borderRadius:10, marginBottom:8, maxHeight:120, objectFit:'cover' }}/>}
          <p style={{ color:'rgba(255,255,255,0.7)', fontSize:13, lineHeight:1.6, margin:0 }}>{item.result.feedback}</p>
        </div>
      ))}
    </div>
  </div>
);

/* ════════════════════════════════════════
   SETTINGS PANEL (contains feedback + screenshot)
════════════════════════════════════════ */
const SettingsPanel = ({ onClose, onScreenshot }) => {
  const [rating,  setRating]  = useState(0);
  const [comment, setComment] = useState('');
  const [sent,    setSent]    = useState(false);

  const submitFeedback = () => {
    if (!rating) return;
    console.log('Feedback submitted:', { rating, comment });
    // TODO: POST to Django backend → /api/feedback/
    setSent(true);
    setTimeout(onClose, 1600);
  };

  return (
    <div style={{ position:'absolute', inset:0, zIndex:40, background:'rgba(5,5,15,0.98)', display:'flex', flexDirection:'column', fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ padding:'52px 20px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <SettingsIcon size={24} color={GEMINI_BLUE}/>
          <div style={{ color:'#fff', fontWeight:700, fontSize:16 }}>Settings</div>
        </div>
        <button onClick={onClose} style={{ background:'rgba(255,255,255,0.08)', border:'none', width:36, height:36, borderRadius:'50%', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <CloseIcon size={20}/>
        </button>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'20px 20px' }}>

        {/* Feedback section */}
        <div>
          <div style={{ color:'rgba(255,255,255,0.4)', fontSize:11, fontFamily:'monospace', letterSpacing:1.5, marginBottom:12 }}>FEEDBACK</div>
          <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:16, padding:'16px' }}>
            {sent ? (
              <div style={{ textAlign:'center', padding:'20px 0' }}>
                <div style={{ fontSize:36, marginBottom:10 }}>✅</div>
                <div style={{ color:'#fff', fontWeight:700, fontSize:16 }}>Thanks for your feedback!</div>
              </div>
            ) : (<>
              <div style={{ color:'#fff', fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:15, marginBottom:4 }}>Rate Google Desk</div>
              <div style={{ color:'rgba(255,255,255,0.45)', fontSize:13, marginBottom:16 }}>Help us improve the experience</div>
              <div style={{ display:'flex', gap:8, marginBottom:16 }}>
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => setRating(n)} style={{ flex:1, padding:'10px 0', borderRadius:10, border:`1px solid ${rating>=n?'rgba(66,133,244,0.6)':'rgba(255,255,255,0.1)'}`, background:rating>=n?'rgba(66,133,244,0.2)':'rgba(255,255,255,0.05)', color:rating>=n?GEMINI_BLUE:'rgba(255,255,255,0.4)', fontSize:20, cursor:'pointer' }}>★</button>
                ))}
              </div>
              <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Any comments? (optional)" rows={3} style={{ width:'100%', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:10, color:'#fff', padding:'10px 12px', fontFamily:"'DM Sans',sans-serif", fontSize:13, outline:'none', resize:'none', marginBottom:12, boxSizing:'border-box' }}/>
              <button onClick={submitFeedback} style={{ width:'100%', padding:'12px 0', background:rating?`linear-gradient(135deg,${GEMINI_BLUE},#7b2ff7)`:'rgba(255,255,255,0.07)', border:'none', borderRadius:12, color:'#fff', fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:14, cursor:'pointer', opacity:rating?1:0.5 }}>Submit Feedback</button>
            </>)}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════
   CHAT MODAL
════════════════════════════════════════ */
const ChatModal = ({ onClose, initialContext }) => {
  const [messages, setMessages] = useState([
    { role:'model', text: initialContext || "Hi! I can explain anything from your work. What would you like to know?" }
  ]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages]);

  const send = async () => {
    if (!input.trim()) return;
    const userMsg = input.trim(); setInput('');
    const updated = [...messages, { role:'user', text:userMsg }];
    setMessages(updated); setLoading(true);
    try {
      const history = updated.slice(1).map(m => ({ role:m.role==='model'?'model':'user', parts:[{ text:m.text }] }));
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        { method:'POST', headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify({ system_instruction:{ parts:[{ text:'You are Google Desk Tutor, an AR educational assistant. Be encouraging, clear, and concise.' }] }, contents:history }) }
      );
      const data  = await res.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Let me think...';
      setMessages(m => [...m, { role:'model', text:reply }]);
    } catch { setMessages(m => [...m, { role:'model', text:'Connection issue — check API key.' }]); }
    setLoading(false);
  };

  return (
    <div style={{ position:'absolute', inset:0, zIndex:30, background:'rgba(5,5,15,0.97)', display:'flex', flexDirection:'column', fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ padding:'52px 20px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <GoogleDeskIcon size={30}/>
          <div>
            <div style={{ color:'#fff', fontWeight:700, fontSize:16 }}>Ask Google Desk</div>
            <div style={{ color:'rgba(255,255,255,0.4)', fontSize:11 }}>Powered by Gemini · Live Agent</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background:'rgba(255,255,255,0.08)', border:'none', width:36, height:36, borderRadius:'50%', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <BackIcon size={20}/>
        </button>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'16px 16px 0' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display:'flex', justifyContent:msg.role==='user'?'flex-end':'flex-start', marginBottom:12 }}>
            {msg.role==='model' && <div style={{ marginRight:8, marginTop:2 }}><GoogleDeskIcon size={22}/></div>}
            <div style={{ maxWidth:'80%', padding:'10px 14px', borderRadius:msg.role==='user'?'18px 18px 4px 18px':'18px 18px 18px 4px', background:msg.role==='user'?`linear-gradient(135deg,${GEMINI_BLUE},#7b2ff7)`:'rgba(255,255,255,0.07)', color:'#fff', fontSize:14, lineHeight:1.6, border:msg.role==='model'?'1px solid rgba(255,255,255,0.1)':'none' }}>{msg.text}</div>
          </div>
        ))}
        {loading && <div style={{ display:'flex', gap:8, padding:'0 0 12px 30px' }}>{[0,1,2].map(i => <div key={i} style={{ width:7, height:7, borderRadius:'50%', background:GEMINI_BLUE, animation:`bounce 1.2s ${i*0.2}s infinite` }}/>)}</div>}
        <div ref={bottomRef}/>
      </div>
      <div style={{ padding:'12px 16px 36px', borderTop:'1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display:'flex', gap:10 }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key==='Enter' && send()} placeholder="Ask about your work..." style={{ flex:1, padding:'13px 16px', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:14, color:'#fff', fontSize:14, fontFamily:"'DM Sans',sans-serif", outline:'none' }}/>
          <button onClick={send} style={{ width:46, height:46, borderRadius:13, background:input.trim()?`linear-gradient(135deg,${GEMINI_BLUE},#7b2ff7)`:'rgba(255,255,255,0.07)', border:'none', color:'#fff', cursor:'pointer', fontSize:20, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:input.trim()?`0 4px 16px rgba(66,133,244,0.4)`:'none' }}>↑</button>
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════
   CAMERA PERMISSION SCREEN
════════════════════════════════════════ */
const CameraPermissionScreen = ({ onRequest, onDeny }) => (
  <div style={{ position:'absolute', inset:0, background:'#050510', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:32, gap:24, zIndex:50 }}>
    <LensIcon size={72}/>
    <div style={{ textAlign:'center' }}>
      <div style={{ color:'#fff', fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:22, marginBottom:10 }}>Camera Access Needed</div>
      <div style={{ color:'rgba(255,255,255,0.5)', fontFamily:"'DM Sans',sans-serif", fontSize:14, lineHeight:1.7 }}>Google Desk uses your camera to scan and mark your work in real time.</div>
    </div>
    <button onClick={onRequest} style={{ width:'100%', maxWidth:280, padding:'15px 0', background:`linear-gradient(135deg,${GEMINI_BLUE},#7b2ff7)`, border:'none', borderRadius:16, color:'#fff', fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:16, cursor:'pointer', boxShadow:`0 6px 24px rgba(66,133,244,0.5)` }}>Allow Camera</button>
    <button onClick={onDeny} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.35)', fontFamily:"'DM Sans',sans-serif", fontSize:13, cursor:'pointer' }}>Not now</button>
  </div>
);

/* ════════════════════════════════════════
   MAIN SCANNER COMPONENT
════════════════════════════════════════ */
export const Scanner = () => {
  const [phase,     setPhase]     = useState('idle');   // idle | scanning | result | chat | history | settings
  const [mode,      setMode]      = useState('Mark Work');
  const [result,    setResult]    = useState(null);
  const [history,   setHistory]   = useState([]);
  const [camState,  setCamState]  = useState('prompt'); // prompt | active | denied
  const [cvReady,   setCvReady]   = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error,     setError]     = useState('');

  const videoRef = useRef(null);

  /* ── Load OpenCV on mount ── */
  useEffect(() => {
    loadOpenCv(() => setCvReady(true));
  }, []);

  /* ── Start camera ── */
  const startCamera = () => {
    navigator.mediaDevices?.getUserMedia({
      video: { facingMode:{ ideal:'environment' }, width:{ ideal:1280 }, height:{ ideal:720 } }
    })
    .then(stream => {
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(()=>{}); }
      setCamState('active');
    })
    .catch(() => setCamState('denied'));
  };

  /* ── Cleanup camera on unmount ── */
  useEffect(() => {
    return () => { videoRef.current?.srcObject?.getTracks().forEach(t => t.stop()); };
  }, []);

  /* ── Screenshot function ── */
  const takeScreenshot = useCallback(() => {
    if (!videoRef.current) return;
    const c = document.createElement('canvas');
    c.width  = videoRef.current.videoWidth  || 1280;
    c.height = videoRef.current.videoHeight || 720;
    c.getContext('2d').drawImage(videoRef.current, 0, 0);
    const link = document.createElement('a');
    link.download = `googledesk-${Date.now()}.jpg`;
    link.href = c.toDataURL('image/jpeg', 0.92);
    link.click();
  }, []);

  /* ── Main analysis: capture frame → OpenCV flatten → Gemini ── */
  const runAnalysis = useCallback(async () => {
    if (!videoRef.current || analyzing) return;
    if (!GEMINI_API_KEY) { setError('Add Gemini API key at the top of ARTutor.jsx'); return; }

    setAnalyzing(true);
    setPhase('scanning');
    setError('');

    try {
      // 1. Capture video frame to an <img> element so OpenCV can read it
      const frameCanvas = document.createElement('canvas');
      frameCanvas.width  = videoRef.current.videoWidth  || 640;
      frameCanvas.height = videoRef.current.videoHeight || 480;
      frameCanvas.getContext('2d').drawImage(videoRef.current, 0, 0);

      let paperCanvas = frameCanvas; // fallback if OpenCV not ready

      // 2. If OpenCV is ready, try to detect and flatten the paper
      if (cvReady) {
        const img   = document.createElement('img');
        img.src     = frameCanvas.toDataURL('image/jpeg', 0.9);
        await new Promise(res => { img.onload = res; });
        const warped = extractPaperWithOpenCV(img);
        if (warped) paperCanvas = warped;
      }

      // 3. Save snapshot for history (from original frame, not warped)
      const snap = frameCanvas.toDataURL('image/jpeg', 0.5);

      // 4. Send flattened paper to Gemini
      const res = await analyseWithGemini(paperCanvas, mode, '');

      // 5. Save to history
      setHistory(h => [...h, {
        mode, result: res, snapshot: snap,
        timestamp: new Date().toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })
      }]);

      setResult(res);
      setPhase('result');

    } catch(e) {
      console.error(e);
      setError('Gemini error — check API key or network connection.');
      setPhase('idle');
    }

    setAnalyzing(false);
  }, [mode, analyzing, cvReady]);

  const handleBack = () => { window.location.href = 'https://www.google.com'; };

  const modeColor = { 'Mark Work':GEMINI_BLUE, 'Explain':GEMINI_YELLOW, 'Quiz Me':GEMINI_GREEN };

  return (
    <div style={{ position:'relative', width:'100%', maxWidth:430, height:'100dvh', margin:'0 auto', background:'#000', overflow:'hidden', userSelect:'none' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes edgeH    { 0%{transform:scaleX(0);opacity:0} 15%{opacity:1} 85%{opacity:1} 100%{transform:scaleX(1);opacity:0} }
        @keyframes edgeV    { 0%{transform:scaleY(0);opacity:0} 15%{opacity:1} 85%{opacity:1} 100%{transform:scaleY(1);opacity:0} }
        @keyframes sweepLine{ 0%{top:15%;opacity:0.9} 100%{top:68%;opacity:0.1} }
        @keyframes glowPulse{ 0%,100%{opacity:1} 50%{opacity:0.35} }
        @keyframes bounce   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes pulse    { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.88)} }
        @keyframes fadeIn   { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes lensIdle { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }
        * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
        ::-webkit-scrollbar { width:0; }
        input::placeholder,textarea::placeholder { color:rgba(255,255,255,0.35); }
      `}</style>

      {/* ── PERMISSION SCREEN ── */}
      {camState === 'prompt' && <CameraPermissionScreen onRequest={startCamera} onDeny={() => setCamState('denied')}/>}

      {/* ── LIVE CAMERA ── */}
      <video ref={videoRef} autoPlay playsInline muted
        style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', display:camState==='active'?'block':'none' }}
      />

      {/* ── CAMERA DENIED FALLBACK ── */}
      {camState === 'denied' && (
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at 60% 40%,#1a0d35 0%,#0a1228 50%,#03030c 100%)' }}>
          <div style={{ position:'absolute', top:'44%', left:0, right:0, textAlign:'center' }}>
            <div style={{ color:'rgba(255,255,255,0.25)', fontFamily:"'DM Sans',sans-serif", fontSize:13 }}>Camera access denied</div>
            <button onClick={startCamera} style={{ marginTop:12, padding:'8px 20px', background:'rgba(66,133,244,0.2)', border:`1px solid rgba(66,133,244,0.4)`, borderRadius:20, color:GEMINI_BLUE, fontFamily:"'DM Sans',sans-serif", fontSize:13, cursor:'pointer' }}>Try Again</button>
          </div>
        </div>
      )}

      {/* ── SCAN OVERLAY ── */}
      {camState === 'active' && (phase === 'scanning' || phase === 'result') && (
        <ScanOverlay scanning={phase==='scanning'} marked={phase==='result'}/>
      )}

      {/* ── OpenCV STATUS (only shown while loading) ── */}
      {!cvReady && camState === 'active' && (
        <div style={{ position:'absolute', top:'18%', left:'50%', transform:'translateX(-50%)', zIndex:8, background:'rgba(0,0,0,0.6)', borderRadius:20, padding:'6px 16px', border:`1px solid rgba(251,188,5,0.3)`, backdropFilter:'blur(8px)' }}>
          <span style={{ color:GEMINI_YELLOW, fontFamily:"'DM Sans',sans-serif", fontSize:12 }}>⏳ Loading OpenCV…</span>
        </div>
      )}

      {/* ── ERROR TOAST ── */}
      {error && (
        <div style={{ position:'absolute', top:'14%', left:'5%', right:'5%', zIndex:25, background:'rgba(234,67,53,0.9)', borderRadius:12, padding:'12px 16px', animation:'fadeIn 0.3s ease' }}>
          <div style={{ color:'#fff', fontFamily:"'DM Sans',sans-serif", fontSize:13 }}>{error}</div>
        </div>
      )}

      {/* ════════════════════════
          TOP BAR
          Left:   History icon
          Centre: Google Desk logo + name
          Right:  Settings icon
      ════════════════════════ */}
      {camState !== 'prompt' && !['history','settings','chat'].includes(phase) && (
        <div style={{ position:'absolute', top:0, left:0, right:0, zIndex:10, padding:'48px 16px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', background:'linear-gradient(180deg,rgba(0,0,0,0.7) 0%,transparent 100%)' }}>

          {/* Spacer to balance the right settings button */}
          <div style={{ width:40 }}/>

          {/* Centre: name only */}
          <span style={{ color:'#fff', fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:17, textShadow:'0 1px 10px rgba(0,0,0,0.6)' }}>Google Desk</span>

          {/* Settings — top RIGHT */}
          <button onClick={() => setPhase('settings')} title="Settings"
            style={{ width:40, height:40, borderRadius:'50%', background:'rgba(0,0,0,0.4)', border:'1px solid rgba(255,255,255,0.15)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)' }}>
            <SettingsIcon size={20}/>
          </button>
        </div>
      )}

      {/* ════════════════════════
          BOTTOM PANEL (idle)
          Mode selector + Scan button
      ════════════════════════ */}
      {camState !== 'prompt' && phase === 'idle' && (
        <div style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:10, background:'transparent', padding:'40px 24px 52px', display:'flex', flexDirection:'column', alignItems:'center', gap:18, animation:'fadeIn 0.5s ease' }}>

          {/* Scan button row: History | Lens | Screenshot */}
          <div style={{ display:'flex', alignItems:'center', gap:24 }}>

            {/* History — left of scan button */}
            <button onClick={() => setPhase('history')} title="Work History"
              style={{ width:48, height:48, borderRadius:'50%', background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)' }}>
              <HistoryIcon size={22}/>
            </button>

            {/* Centre — Google Lens scan button */}
            <button onClick={runAnalysis} disabled={analyzing}
              style={{ background:'transparent', border:'none', borderRadius:14, width:84, height:84, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', filter: analyzing?'opacity(0.5)':'drop-shadow(0 8px 24px rgba(0,0,0,0.5))', animation:'lensIdle 2.5s ease-in-out infinite' }}>
              <LensIcon size={72}/>
            </button>

            {/* Screenshot — right of scan button */}
            <button onClick={takeScreenshot} title="Take Screenshot"
              style={{ width:48, height:48, borderRadius:'50%', background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)' }}>
              <ScreenshotIcon size={22}/>
            </button>
          </div>

          {/*
            ── AR DRAWING (commented out — re-enable when needed) ──
            <button onClick={() => setArMode(arMode==='draw'?null:'draw')}> ✏️ Draw </button>

            ── AR TYPING (commented out — re-enable when needed) ──
            <button onClick={() => setArMode(arMode==='type'?null:'type')}> ⌨️ Type </button>
          */}
        </div>
      )}

      {/* ── SCANNING STATUS ── */}
      {phase === 'scanning' && (
        <div style={{ position:'absolute', bottom:'10%', left:0, right:0, zIndex:10, display:'flex', justifyContent:'center', animation:'fadeIn 0.3s ease' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, background:'rgba(8,8,20,0.88)', borderRadius:22, padding:'11px 22px', border:'1px solid rgba(66,133,244,0.3)', backdropFilter:'blur(12px)' }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:GEMINI_BLUE, animation:'pulse 0.9s infinite', boxShadow:`0 0 10px ${GEMINI_BLUE}` }}/>
            <span style={{ color:'#fff', fontFamily:"'DM Sans',sans-serif", fontSize:14, fontWeight:500 }}>
              {cvReady ? 'Flattening paper + Gemini analysing…' : 'Gemini analysing…'}
            </span>
          </div>
        </div>
      )}

      {/* ── RESULT PANEL ── */}
      {phase === 'result' && result && (
        <FeedbackPanel result={result} mode={mode}
          onClose={() => setPhase('idle')}
          onAskMore={() => setPhase('chat')}
        />
      )}

      {/* ── CHAT ── */}
      {phase === 'chat' && (
        <ChatModal onClose={() => setPhase('result')} initialContext={result?.feedback}/>
      )}

      {/* ── HISTORY ── */}
      {phase === 'history' && (
        <HistoryPanel history={history} onClose={() => setPhase('idle')}/>
      )}

      {/* ── SETTINGS (contains feedback + screenshot) ── */}
      {phase === 'settings' && (
        <SettingsPanel onClose={() => setPhase('idle')} onScreenshot={takeScreenshot}/>
      )}
    </div>
  );
};
