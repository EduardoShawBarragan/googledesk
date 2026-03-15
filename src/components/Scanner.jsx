import { useEffect, useRef, useState } from 'react';
import './scanner.css';

const initialImages = [
  { src: '/paper-2.png' }
];

export const Scanner = () => {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const overlayRef = useRef(null);
  const arImageRef = useRef(null);
  const smoothedQuadRef = useRef(null);
  const missFrameCountRef = useRef(0);
  const foundPaperRef = useRef(false);
  const captureIntervalRef = useRef(null);
  const prevGrayRef = useRef(null);
  const prevQuadSmallRef = useRef(null);
  const openCvURL = 'https://docs.opencv.org/4.7.0/opencv.js';

  const [loadedOpenCV, setLoadedOpenCV] = useState(false);
  const [images, setImages] = useState(initialImages);
  const [selectedImage, setSelectedImage] = useState(initialImages[0]);
  const [foundPaperImageSrc, setFoundPaperImageSrc] = useState(null);
  
  // Always run the scanner on whichever image is currently in the list
  useEffect(() => {
    if (images.length === 0) {
      setSelectedImage(null);
    } else if (!selectedImage || selectedImage.src !== images[0].src) {
      setSelectedImage(images[0]);
    }
  }, [images]);

  // after state declarations
  const loadOpenCv = (onComplete) => {
    const existing = document.getElementById('open-cv');

    const waitForCV = () => {
      if (window.cv && window.cv.Mat) {
        console.log('[Scanner] OpenCV runtime initialized');
        setLoadedOpenCV(true);
        onComplete();
      } else {
        console.log('[Scanner] Waiting for OpenCV runtime...');
        setTimeout(waitForCV, 100);
      }
    };

    if (existing) {
      waitForCV();
      return;
    }

    const script = document.createElement('script');
    script.id = 'open-cv';
    script.src = 'https://docs.opencv.org/4.7.0/opencv.js';
    script.onload = () => {
      console.log('[Scanner] OpenCV script loaded, initializing runtime...');
      waitForCV();
    };
    document.body.appendChild(script);
  };

  // A4 aspect ratio: short : long = 1 : √2 (portrait height = width * √2)
  const A4_RATIO = Math.SQRT2;

  // Complete 2 or 3 visible corners to a full 4-point quad assuming A4 and perpendicular sides.
  // Returns [tl, tr, br, bl] or null if invalid.
  const completeA4Quad = (points) => {
    const dist = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

    if (points.length === 3) {
      const [A, B, C] = points;
      const angleAt = (v, p1, p2) => {
        const ux = p1.x - v.x, uy = p1.y - v.y;
        const wx = p2.x - v.x, wy = p2.y - v.y;
        const dot = ux * wx + uy * wy;
        const len = Math.sqrt((ux * ux + uy * uy) * (wx * wx + wy * wy)) || 1e-6;
        return (Math.acos(Math.max(-1, Math.min(1, dot / len))) * 180) / Math.PI;
      };
      const aA = angleAt(A, B, C), aB = angleAt(B, A, C), aC = angleAt(C, A, B);
      const rightIdx = [aA, aB, aC].findIndex((a) => Math.abs(a - 90) < 25);
      if (rightIdx < 0) return null;
      const vertex = points[rightIdx]; 
      const others = points.filter((_, i) => i !== rightIdx);
      const D = { x: others[0].x + others[1].x - vertex.x, y: others[0].y + others[1].y - vertex.y };
      const four = [...points, D];
      four.sort((a, b) => a.y - b.y);
      const top = four.slice(0, 2).sort((a, b) => a.x - b.x);
      const bottom = four.slice(2, 4).sort((a, b) => a.x - b.x);
      return [top[0], top[1], bottom[1], bottom[0]];
    }

    if (points.length === 2) {
      const [A, B] = points;
      const dx = B.x - A.x, dy = B.y - A.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1e-6;
      const horizontal = Math.abs(dx) >= Math.abs(dy);
      let w, h, perpX, perpY;
      if (horizontal) {
        w = len;
        h = w * A4_RATIO;
        perpX = -dy / len;
        perpY = dx / len;
      } else {
        h = len;
        w = h / A4_RATIO;
        perpX = dy / len;
        perpY = -dx / len;
      }
      const C = { x: B.x + perpX * h, y: B.y + perpY * h };
      const D = { x: A.x + perpX * h, y: A.y + perpY * h };
      const four = [A, B, C, D];
      four.sort((a, b) => a.y - b.y);
      const top = four.slice(0, 2).sort((a, b) => a.x - b.x);
      const bottom = four.slice(2, 4).sort((a, b) => a.x - b.x);
      return [top[0], top[1], bottom[1], bottom[0]];
    }

    return null;
  };

  // When a contour crosses a camera frame edge, build a 4-point quad using that edge as one side.
  // Returns [tl, tr, br, bl] or null. imgW/imgH = image size; contourPoints = array of {x,y}.
  const buildQuadFromFrameEdge = (contourPoints, imgW, imgH) => {
    if (!contourPoints || contourPoints.length < 3) return null;
    const pts = contourPoints;
    const n = pts.length;
    const minX = Math.min(...pts.map((p) => p.x));
    const maxX = Math.max(...pts.map((p) => p.x));
    const minY = Math.min(...pts.map((p) => p.y));
    const maxY = Math.max(...pts.map((p) => p.y));
    const edgeThreshold = 12;

    const intersectTop = (p1, p2) => {
      if (p1.y === p2.y) return null;
      const t = (0 - p1.y) / (p2.y - p1.y);
      if (t < 0 || t > 1) return null;
      const x = p1.x + t * (p2.x - p1.x);
      return x >= 0 && x <= imgW ? { x, y: 0 } : null;
    };
    const intersectBottom = (p1, p2) => {
      if (p1.y === p2.y) return null;
      const t = (imgH - 1 - p1.y) / (p2.y - p1.y);
      if (t < 0 || t > 1) return null;
      const x = p1.x + t * (p2.x - p1.x);
      return x >= 0 && x <= imgW ? { x, y: imgH - 1 } : null;
    };
    const intersectLeft = (p1, p2) => {
      if (p1.x === p2.x) return null;
      const t = (0 - p1.x) / (p2.x - p1.x);
      if (t < 0 || t > 1) return null;
      const y = p1.y + t * (p2.y - p1.y);
      return y >= 0 && y <= imgH ? { x: 0, y } : null;
    };
    const intersectRight = (p1, p2) => {
      if (p1.x === p2.x) return null;
      const t = (imgW - 1 - p1.x) / (p2.x - p1.x);
      if (t < 0 || t > 1) return null;
      const y = p1.y + t * (p2.y - p1.y);
      return y >= 0 && y <= imgH ? { x: imgW - 1, y } : null;
    };

    // Top: paper extends above frame
    if (minY < edgeThreshold) {
      const hits = [];
      for (let j = 0; j < n; j++) {
        const p1 = pts[j];
        const p2 = pts[(j + 1) % n];
        const q = intersectTop(p1, p2);
        if (q) hits.push(q);
      }
      if (hits.length >= 2) {
        hits.sort((a, b) => a.x - b.x);
        const topL = hits[0];
        const topR = hits[1];
        const bottomPts = pts.filter((p) => p.y > minY + 5).sort((a, b) => b.y - a.y);
        if (bottomPts.length >= 2) {
          const byX = bottomPts.slice(0, 2).sort((a, b) => a.x - b.x);
          const bl = byX[0];
          const br = byX[1];
          const four = [topL, topR, br, bl];
          four.sort((a, b) => a.y - b.y);
          const top = four.slice(0, 2).sort((a, b) => a.x - b.x);
          const bottom = four.slice(2, 4).sort((a, b) => a.x - b.x);
          return [top[0], top[1], bottom[1], bottom[0]];
        }
      }
    }
    // Bottom: paper extends below frame
    if (maxY > imgH - edgeThreshold) {
      const hits = [];
      for (let j = 0; j < n; j++) {
        const p1 = pts[j];
        const p2 = pts[(j + 1) % n];
        const q = intersectBottom(p1, p2);
        if (q) hits.push(q);
      }
      if (hits.length >= 2) {
        hits.sort((a, b) => a.x - b.x);
        const bottomL = hits[0];
        const bottomR = hits[1];
        const topPts = pts.filter((p) => p.y < maxY - 5).sort((a, b) => a.y - b.y);
        if (topPts.length >= 2) {
          const byX = topPts.slice(0, 2).sort((a, b) => a.x - b.x);
          const tl = byX[0];
          const tr = byX[1];
          const four = [tl, tr, bottomR, bottomL];
          four.sort((a, b) => a.y - b.y);
          const top = four.slice(0, 2).sort((a, b) => a.x - b.x);
          const bottom = four.slice(2, 4).sort((a, b) => a.x - b.x);
          return [top[0], top[1], bottom[1], bottom[0]];
        }
      }
    }
    // Left: paper extends past left frame
    if (minX < edgeThreshold) {
      const hits = [];
      for (let j = 0; j < n; j++) {
        const p1 = pts[j];
        const p2 = pts[(j + 1) % n];
        const q = intersectLeft(p1, p2);
        if (q) hits.push(q);
      }
      if (hits.length >= 2) {
        hits.sort((a, b) => a.y - b.y);
        const leftT = hits[0];
        const leftB = hits[1];
        const rightPts = pts.filter((p) => p.x > minX + 5).sort((a, b) => b.x - a.x);
        if (rightPts.length >= 2) {
          const byY = rightPts.slice(0, 2).sort((a, b) => a.y - b.y);
          const tr = byY[0];
          const br = byY[1];
          const four = [leftT, tr, br, leftB];
          four.sort((a, b) => a.y - b.y);
          const top = four.slice(0, 2).sort((a, b) => a.x - b.x);
          const bottom = four.slice(2, 4).sort((a, b) => a.x - b.x);
          return [top[0], top[1], bottom[1], bottom[0]];
        }
      }
    }
    // Right: paper extends past right frame
    if (maxX > imgW - edgeThreshold) {
      const hits = [];
      for (let j = 0; j < n; j++) {
        const p1 = pts[j];
        const p2 = pts[(j + 1) % n];
        const q = intersectRight(p1, p2);
        if (q) hits.push(q);
      }
      if (hits.length >= 2) {
        hits.sort((a, b) => a.y - b.y);
        const rightT = hits[0];
        const rightB = hits[1];
        const leftPts = pts.filter((p) => p.x < maxX - 5).sort((a, b) => a.x - b.x);
        if (leftPts.length >= 2) {
          const byY = leftPts.slice(-2).sort((a, b) => a.y - b.y);
          const tl = byY[0];
          const bl = byY[1];
          const four = [tl, rightT, rightB, bl];
          four.sort((a, b) => a.y - b.y);
          const top = four.slice(0, 2).sort((a, b) => a.x - b.x);
          const bottom = four.slice(2, 4).sort((a, b) => a.x - b.x);
          return [top[0], top[1], bottom[1], bottom[0]];
        }
      }
    }
    return null;
  };

  // Use OpenCV to automatically detect the paper in any input image,
  // then perform a perspective warp so the result is just the page.
  // This is now fully generic (no hard‑coded coordinates for paper‑2).
  const extractPaperWithOpenCV = (imgElement, targetWidth, targetHeight) => {
    const cv = window.cv;
    if (!cv || !cv.Mat) {
      console.error('[Scanner] OpenCV not ready inside extractPaperWithOpenCV');
      return null;
    }

    let src, gray, blurred, edged, contours, hierarchy;
    let paperCnt = null;

    try {
      src = cv.imread(imgElement);
      gray = new cv.Mat();
      blurred = new cv.Mat();
      edged = new cv.Mat();

      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
      // Light blur to knock down noise but keep edges
      cv.GaussianBlur(gray, blurred, new cv.Size(3, 3), 0, 0, cv.BORDER_DEFAULT);
      cv.Canny(blurred, edged, 60, 180);

      contours = new cv.MatVector();
      hierarchy = new cv.Mat();
      cv.findContours(edged, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

      const imgArea = src.cols * src.rows;
      let bestScore = 0;
      let bestAreaRatio = 0;
      const allCandidates = [];
      const rejectedContourArea = []; // contour area ratio outside [0.02, 0.99] – store bbox
      const rejectedNotQuad = [];     // approxPolyDP gave ≠4 points – store polygon
      const rejectedQuadArea = [];   // 4 points but quad area ratio outside [0.02, 0.99]

      const dist = (p1, p2) =>
        Math.sqrt((p1.x - p2.x) * (p1.x - p2.x) + (p1.y - p2.y) * (p1.y - p2.y));

      const quadArea = (q) => {
        if (!q || q.length !== 4) return 0;
        const [a, b, c, d] = q;
        return 0.5 * Math.abs((a.x * b.y - b.x * a.y) + (b.x * c.y - c.x * b.y) + (c.x * d.y - d.x * c.y) + (d.x * a.y - a.x * d.y));
      };

      const srcW = src.cols;
      const srcH = src.rows;

      for (let i = 0; i < contours.size(); i++) {
        const c = contours.get(i);
        const cArea = cv.contourArea(c);
        const cRatio = cArea / imgArea;
        if (cRatio < 0.02 || cRatio > 0.99) {
          const rect = cv.boundingRect(c);
          rejectedContourArea.push({ x: rect.x, y: rect.y, width: rect.width, height: rect.height, ratio: cRatio });
          c.delete();
          continue;
        }
        // Contour crosses a frame edge? Build quad using that edge as one side (paper extends out of frame).
        const contourPoints = [];
        for (let j = 0; j < c.rows; j++) contourPoints.push({ x: c.intAt(j, 0), y: c.intAt(j, 1) });
        const frameEdgeQuad = buildQuadFromFrameEdge(contourPoints, srcW, srcH);
        if (frameEdgeQuad && frameEdgeQuad.length === 4) {
          const areaRatio = quadArea(frameEdgeQuad) / imgArea;
          if (areaRatio >= 0.02 && areaRatio <= 0.99) {
            const ordered = frameEdgeQuad.map((p) => ({ x: p.x, y: p.y }));
            allCandidates.push(ordered);
            if (areaRatio > bestScore) {
              bestScore = areaRatio;
              bestAreaRatio = areaRatio;
              if (paperCnt) paperCnt.delete();
              paperCnt = cv.matFromArray(4, 1, cv.CV_32SC2, [
                Math.round(ordered[0].x), Math.round(ordered[0].y),
                Math.round(ordered[1].x), Math.round(ordered[1].y),
                Math.round(ordered[2].x), Math.round(ordered[2].y),
                Math.round(ordered[3].x), Math.round(ordered[3].y),
              ]);
            }
          }
        }

        const peri = cv.arcLength(c, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(c, approx, 0.02 * peri, true);

        if (approx.rows !== 4) {
          const pts = [];
          for (let j = 0; j < approx.rows; j++) pts.push({ x: approx.intAt(j, 0), y: approx.intAt(j, 1) });
          rejectedNotQuad.push(pts);
          approx.delete();
          c.delete();
          continue;
        }

        const area = cv.contourArea(approx);
        const areaRatio = area / imgArea;
        if (areaRatio < 0.02 || areaRatio > 0.99) {
          const ptsTmp = [];
          for (let j = 0; j < 4; j++) ptsTmp.push({ x: approx.intAt(j, 0), y: approx.intAt(j, 1) });
          ptsTmp.sort((a, b) => a.y - b.y);
          const top = ptsTmp.slice(0, 2).sort((a, b) => a.x - b.x);
          const bottom = ptsTmp.slice(2, 4).sort((a, b) => a.x - b.x);
          rejectedQuadArea.push([top[0], top[1], bottom[1], bottom[0]].map((p) => ({ x: p.x, y: p.y })));
          approx.delete();
          c.delete();
          continue;
        }
        const ptsTmp = [];
        for (let j = 0; j < 4; j++) ptsTmp.push({ x: approx.intAt(j, 0), y: approx.intAt(j, 1) });
        ptsTmp.sort((a, b) => a.y - b.y);
        const top = ptsTmp.slice(0, 2).sort((a, b) => a.x - b.x);
        const bottom = ptsTmp.slice(2, 4).sort((a, b) => a.x - b.x);
        const orderedQuad = [top[0], top[1], bottom[1], bottom[0]];

        allCandidates.push(orderedQuad.map((p) => ({ x: p.x, y: p.y })));

        if (areaRatio > bestScore) {
          bestScore = areaRatio;
          bestAreaRatio = areaRatio;
          if (paperCnt) paperCnt.delete();
          paperCnt = cv.matFromArray(4, 1, cv.CV_32SC2, [
            Math.round(orderedQuad[0].x), Math.round(orderedQuad[0].y),
            Math.round(orderedQuad[1].x), Math.round(orderedQuad[1].y),
            Math.round(orderedQuad[2].x), Math.round(orderedQuad[2].y),
            Math.round(orderedQuad[3].x), Math.round(orderedQuad[3].y),
          ]);
        }
        approx.delete();
        c.delete();
      }

      if (typeof window !== 'undefined') {
        window.lastDetectionCandidates = allCandidates;
        window.lastDetectionRejectedContourArea = rejectedContourArea;
        window.lastDetectionRejectedNotQuad = rejectedNotQuad;
        window.lastDetectionRejectedQuadArea = rejectedQuadArea;
      }

      if (!paperCnt) {
        if (typeof window !== 'undefined') {
          window.lastDetectionCandidates = [];
          window.lastDetectionRejectedTooSmall = []; // no "best" quad to reject
        }
        src.delete();
        gray.delete();
        blurred.delete();
        edged.delete();
        contours.delete();
        hierarchy.delete();
        return null;
      }

      // If the best contour is extremely small in the frame, treat it as no paper.
      const minAreaRatio = 0.15;
      if (bestAreaRatio < minAreaRatio) {
        const pts = [];
        for (let i = 0; i < paperCnt.rows; i++) pts.push({ x: paperCnt.intAt(i, 0), y: paperCnt.intAt(i, 1) });
        if (typeof window !== 'undefined') window.lastDetectionRejectedTooSmall = pts;
        src.delete();
        gray.delete();
        blurred.delete();
        edged.delete();
        contours.delete();
        hierarchy.delete();
        paperCnt.delete();
        return null;
      }
      if (typeof window !== 'undefined') window.lastDetectionRejectedTooSmall = [];

      // Convert contour points to array of {x,y}
      const pts = [];
      for (let i = 0; i < paperCnt.rows; i++) {
        const x = paperCnt.intAt(i, 0);
        const y = paperCnt.intAt(i, 1);
        pts.push({ x, y });
      }

      // Order points: top-left, top-right, bottom-right, bottom-left
      pts.sort((a, b) => a.y - b.y);
      const top = pts.slice(0, 2).sort((a, b) => a.x - b.x);
      const bottom = pts.slice(2, 4).sort((a, b) => a.x - b.x);
      const tl = top[0];
      const tr = top[1];
      const br = bottom[1];
      const bl = bottom[0];

      const ordered = [tl, tr, br, bl];

      // Expose the detected quad so the live video overlay can draw it
      if (typeof window !== 'undefined') {
        window.lastDetectedQuad = ordered.map((p) => ({ x: p.x, y: p.y }));
      }

      const imgW = imgElement.naturalWidth || imgElement.width;
      const imgH = imgElement.naturalHeight || imgElement.height;

      // If no explicit target size, derive from the detected quadrilateral
      // and scale up for higher-resolution output.
      // 3× gives noticeably crisper text while staying performant.
      const resolutionScale = 3;
      if (!targetWidth || !targetHeight) {
        const dist = (p1, p2) =>
          Math.sqrt((p1.x - p2.x) * (p1.x - p2.x) + (p1.y - p2.y) * (p1.y - p2.y));

        const widthTop = dist(tl, tr);
        const widthBottom = dist(bl, br);
        const rawWidth = Math.max(widthTop, widthBottom);

        const heightLeft = dist(tl, bl);
        const heightRight = dist(tr, br);
        const rawHeight = Math.max(heightLeft, heightRight);

        targetWidth = Math.round(rawWidth * resolutionScale);
        targetHeight = Math.round(rawHeight * resolutionScale);

        console.log('[Scanner] Using detected paper quad and derived size', {
          imgW,
          imgH,
          rawWidth,
          rawHeight,
          targetWidth,
          targetHeight,
        });
      }

      const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
        ordered[0].x, ordered[0].y,
        ordered[1].x, ordered[1].y,
        ordered[2].x, ordered[2].y,
        ordered[3].x, ordered[3].y,
      ]);

      const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
        0, 0,
        targetWidth - 1, 0,
        targetWidth - 1, targetHeight - 1,
        0, targetHeight - 1,
      ]);

      const M = cv.getPerspectiveTransform(srcTri, dstTri);
      const dst = new cv.Mat();
      const dsize = new cv.Size(targetWidth, targetHeight);
      // Use INTER_CUBIC for higher-quality upscaling of text and edges
      cv.warpPerspective(src, dst, M, dsize, cv.INTER_CUBIC, cv.BORDER_CONSTANT, new cv.Scalar());

      // Create a canvas and draw the color result
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      cv.imshow(canvas, dst);

      // Cleanup
      src.delete();
      gray.delete();
      blurred.delete();
      edged.delete();
      contours.delete();
      hierarchy.delete();
      paperCnt.delete();
      srcTri.delete();
      dstTri.delete();
      M.delete();
      dst.delete();

      return canvas;
    } catch (err) {
      console.error('[Scanner] Error in extractPaperWithOpenCV', err);
      // Cleanup best-effort
      src && src.delete();
      gray && gray.delete();
      blurred && blurred.delete();
      edged && edged.delete();
      contours && contours.delete();
      hierarchy && hierarchy.delete();
      paperCnt && paperCnt.delete();
      return null;
    }
  };

  useEffect(() => {
    // Only run if the user has selected an image
    if (!selectedImage) return;

    // First, load OpenCV
    loadOpenCv(() => {
      console.log('[Scanner] OpenCV ready, using direct OpenCV pipeline...');

      // If we're not rendering a result container anymore (AR-only mode),
      // skip this legacy image-processing pipeline.
      if (!containerRef.current) {
        return;
      }

      // Clear previous result
      containerRef.current.innerHTML = '';

      // Create image element
      const newImg = document.createElement('img');
      newImg.crossOrigin = 'anonymous'; // ✅ important: must be BEFORE src
      newImg.src = selectedImage.src;

      // When image loads, scan and append canvases
      newImg.onload = function () {
        try {
          console.log('[Scanner] Image loaded for scanning', {
            width: newImg.naturalWidth,
            height: newImg.naturalHeight,
            src: newImg.src,
          });

          // Let extractPaperWithOpenCV choose a target size based on the detected paper itself
          const resultCanvas = extractPaperWithOpenCV(newImg);

          if (!resultCanvas) {
            console.warn('[Scanner] extractPaperWithOpenCV returned null/undefined');
            return;
          }

          console.log('[Scanner] extractPaperWithOpenCV result canvas', {
            width: resultCanvas.width,
            height: resultCanvas.height,
          });

          // Expose for manual inspection in devtools if you want
          window.paper2ResultCanvas = resultCanvas;
          window.paper2ResultDataURL = resultCanvas.toDataURL('image/png');

          containerRef.current.append(resultCanvas);
        } catch (err) {
          console.error('[Scanner] Error during scanning', err);
        }
      };
    });
  }, [selectedImage]);

  useEffect(() => {
    let isMounted = true;

    const enableCamera = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          console.warn('[Scanner] Camera not supported in this browser');
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('[Scanner] Error accessing camera', err);
      }
    };

    enableCamera();

    // Preload AR overlay SVG as an image so we can draw it fast on the canvas
    if (!arImageRef.current) {
      const img = new Image();
      img.src = '/usethis.svg';
      img.onload = () => {
        arImageRef.current = img;
        console.log('[Scanner] AR overlay image loaded');
      };
    }

    const drawQuadOverlay = (quad) => {
      const video = videoRef.current;
      const overlay = overlayRef.current;
      if (!overlay || !video) return;

      const width = video.videoWidth || overlay.width;
      const height = video.videoHeight || overlay.height;
      if (!width || !height) return;

      overlay.width = width;
      overlay.height = height;

      const ctx = overlay.getContext('2d');
      ctx.clearRect(0, 0, overlay.width, overlay.height);

      const win = typeof window !== 'undefined' ? window : null;
      const hasDebug =
        win &&
        ( (win.lastDetectionRejectedContourAreaFull && win.lastDetectionRejectedContourAreaFull.length > 0) ||
          (win.lastDetectionRejectedNotQuadFull && win.lastDetectionRejectedNotQuadFull.length > 0) ||
          (win.lastDetectionRejectedQuadAreaFull && win.lastDetectionRejectedQuadAreaFull.length > 0) ||
          (win.lastDetectionRejectedTooSmallFull && win.lastDetectionRejectedTooSmallFull.length > 0) ||
          (win.lastDetectionCandidatesFull && win.lastDetectionCandidatesFull.length > 0) );

      if (!quad || quad.length !== 4) {
        smoothedQuadRef.current = null;
        if (!hasDebug) return;
      }

      // Smooth motion of the detected quad to reduce jitter (only when we have a chosen quad)
      let quadToDraw = quad;
      if (quad && quad.length === 4) {
        const prev = smoothedQuadRef.current;
        const alpha = 0.3;
        let smoothed;
        if (!prev || prev.length !== 4) {
          smoothed = quad.map((p) => ({ x: p.x, y: p.y }));
        } else {
          smoothed = quad.map((p, i) => ({
            x: prev[i].x + alpha * (p.x - prev[i].x),
            y: prev[i].y + alpha * (p.y - prev[i].y),
          }));
        }
        smoothedQuadRef.current = smoothed;
        quadToDraw = smoothed;
      }

      // Draw AR content first (warped to quad), then outline on top
      const arImg = arImageRef.current;
      const cv = window.cv;
      if (arImg && cv && cv.Mat && cv.getPerspectiveTransform && cv.warpPerspective && quadToDraw && quadToDraw.length === 4) {
        const srcW = arImg.naturalWidth || arImg.width || 200;
        const srcH = arImg.naturalHeight || arImg.height || 300;

        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = srcW;
        srcCanvas.height = srcH;
        const srcCtx = srcCanvas.getContext('2d');
        srcCtx.drawImage(arImg, 0, 0, srcW, srcH);

        const srcMat = cv.imread(srcCanvas);
        const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
          0, 0,
          srcW, 0,
          srcW, srcH,
          0, srcH,
        ]);
        const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
          quadToDraw[0].x, quadToDraw[0].y,
          quadToDraw[1].x, quadToDraw[1].y,
          quadToDraw[2].x, quadToDraw[2].y,
          quadToDraw[3].x, quadToDraw[3].y,
        ]);
        const M = cv.getPerspectiveTransform(srcTri, dstTri);
        const dsize = new cv.Size(overlay.width, overlay.height);
        const warped = new cv.Mat();
        cv.warpPerspective(srcMat, warped, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = overlay.width;
        tempCanvas.height = overlay.height;
        cv.imshow(tempCanvas, warped);

        ctx.globalAlpha = 0.95;
        ctx.drawImage(tempCanvas, 0, 0);
        ctx.globalAlpha = 1;

        srcMat.delete();
        srcTri.delete();
        dstTri.delete();
        M.delete();
        warped.delete();
      }

      // ---- Rejected and candidate overlays (so you can see why things were accepted/rejected) ----
      // 1) Contours rejected for area (too small or too large) – gray boxes
      const rejectedRects = win ? win.lastDetectionRejectedContourAreaFull : null;
      if (rejectedRects && rejectedRects.length > 0) {
        ctx.strokeStyle = '#888888';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        for (const r of rejectedRects) {
          ctx.strokeRect(r.x, r.y, r.width, r.height);
        }
        ctx.setLineDash([]);
      }

      // 2) Approx polygon not 4 points (triangle, pentagon, etc.) – magenta; if 3 points work, complete and show quad
      const rejectedNotQuad = win ? win.lastDetectionRejectedNotQuadFull : null;
      if (rejectedNotQuad && rejectedNotQuad.length > 0) {
        ctx.strokeStyle = '#ff00ff';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        for (const poly of rejectedNotQuad) {
          if (!poly || poly.length < 2) continue;
          ctx.beginPath();
          ctx.moveTo(poly[0].x, poly[0].y);
          for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
          ctx.closePath();
          ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.fillStyle = '#ff00ff';
        for (const poly of rejectedNotQuad) {
          for (const p of poly) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        // For triangles (3 points): infer 4th point with A4 and draw the completed quad
        for (const poly of rejectedNotQuad) {
          if (!poly || poly.length !== 3) continue;
          const quad = completeA4Quad(poly);
          if (!quad || quad.length !== 4) continue;
          const near = (a, b, eps = 2) => Math.abs(a.x - b.x) <= eps && Math.abs(a.y - b.y) <= eps;
          let inferredPoint = null;
          for (const pt of quad) {
            if (!poly.some((p) => near(p, pt))) {
              inferredPoint = pt;
              break;
            }
          }
          ctx.strokeStyle = '#ff00ff';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(quad[0].x, quad[0].y);
          ctx.lineTo(quad[1].x, quad[1].y);
          ctx.lineTo(quad[2].x, quad[2].y);
          ctx.lineTo(quad[3].x, quad[3].y);
          ctx.closePath();
          ctx.stroke();
          ctx.setLineDash([]);
          if (inferredPoint) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(inferredPoint.x, inferredPoint.y, 6, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = 'rgba(255, 0, 255, 0.5)';
            ctx.fill();
          }
        }
      }

      // 3) Quad but area ratio out of range – yellow
      const rejectedQuadArea = win ? win.lastDetectionRejectedQuadAreaFull : null;
      if (rejectedQuadArea && rejectedQuadArea.length > 0) {
        ctx.strokeStyle = '#d4d404';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        for (const q of rejectedQuadArea) {
          if (!q || q.length !== 4) continue;
          ctx.beginPath();
          ctx.moveTo(q[0].x, q[0].y);
          ctx.lineTo(q[1].x, q[1].y);
          ctx.lineTo(q[2].x, q[2].y);
          ctx.lineTo(q[3].x, q[3].y);
          ctx.closePath();
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }

      // 4) Best quad rejected for being too small (area < 15% of frame) – red
      const rejectedTooSmall = win ? win.lastDetectionRejectedTooSmallFull : null;
      if (rejectedTooSmall && rejectedTooSmall.length === 4) {
        ctx.strokeStyle = '#e03030';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(rejectedTooSmall[0].x, rejectedTooSmall[0].y);
        ctx.lineTo(rejectedTooSmall[1].x, rejectedTooSmall[1].y);
        ctx.lineTo(rejectedTooSmall[2].x, rejectedTooSmall[2].y);
        ctx.lineTo(rejectedTooSmall[3].x, rejectedTooSmall[3].y);
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 5) Candidate quads (passed all filters, one will be chosen) – orange
      const candidateQuads = win ? win.lastDetectionCandidatesFull : null;
      if (candidateQuads && candidateQuads.length > 0) {
        ctx.strokeStyle = '#ff8800';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        for (const q of candidateQuads) {
          if (!q || q.length !== 4) continue;
          ctx.beginPath();
          ctx.moveTo(q[0].x, q[0].y);
          ctx.lineTo(q[1].x, q[1].y);
          ctx.lineTo(q[2].x, q[2].y);
          ctx.lineTo(q[3].x, q[3].y);
          ctx.closePath();
          ctx.stroke();
          ctx.fillStyle = 'rgba(255, 136, 0, 0.15)';
          ctx.fill();
        }
        ctx.setLineDash([]);
        ctx.fillStyle = '#ff8800';
        for (const q of candidateQuads) {
          if (!q || q.length !== 4) continue;
          for (const p of q) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // 6) Chosen paper quad – green
      if (quadToDraw && quadToDraw.length === 4) {
        ctx.strokeStyle = '#00ff4d';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(quadToDraw[0].x, quadToDraw[0].y);
        ctx.lineTo(quadToDraw[1].x, quadToDraw[1].y);
        ctx.lineTo(quadToDraw[2].x, quadToDraw[2].y);
        ctx.lineTo(quadToDraw[3].x, quadToDraw[3].y);
        ctx.closePath();
        ctx.stroke();
      }

    };

    const DETECT_MAX_PX = 400;

    const captureBurst = async () => {
      const video = videoRef.current;
      if (!video || !video.srcObject || video.readyState < 2) return;

      const candidates = [];
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const scale = Math.min(1, DETECT_MAX_PX / Math.max(vw, vh));
      const sw = Math.round(vw * scale);
      const sh = Math.round(vh * scale);

      const smallCanvas = document.createElement('canvas');
      smallCanvas.width = sw;
      smallCanvas.height = sh;
      smallCanvas.getContext('2d').drawImage(video, 0, 0, sw, sh);

      if (window.cv && window.cv.Mat) {
        const cv = window.cv;
        let currGray = null;
        try {
          const src = cv.imread(smallCanvas);
          currGray = new cv.Mat();
          cv.cvtColor(src, currGray, cv.COLOR_RGBA2GRAY);
          src.delete();

          const scaleX = vw / sw;
          const scaleY = vh / sh;

          if (candidates.length === 0) {
            const resultCanvas = extractPaperWithOpenCV(smallCanvas);
            const quad = window.lastDetectedQuad;
            const rawCandidates = window.lastDetectionCandidates || [];
            window.lastDetectionCandidatesFull = rawCandidates.map((q) =>
              q.map((p) => ({ x: p.x * scaleX, y: p.y * scaleY }))
            );
            const scaleRejected = (items, mapPoint) => (items || []).map(mapPoint);
            window.lastDetectionRejectedContourAreaFull = scaleRejected(
              window.lastDetectionRejectedContourArea,
              (r) => ({ x: r.x * scaleX, y: r.y * scaleY, width: r.width * scaleX, height: r.height * scaleY, ratio: r.ratio })
            );
            window.lastDetectionRejectedNotQuadFull = scaleRejected(
              window.lastDetectionRejectedNotQuad,
              (poly) => poly.map((p) => ({ x: p.x * scaleX, y: p.y * scaleY }))
            );
            window.lastDetectionRejectedQuadAreaFull = scaleRejected(
              window.lastDetectionRejectedQuadArea,
              (q) => q.map((p) => ({ x: p.x * scaleX, y: p.y * scaleY }))
            );
            window.lastDetectionRejectedTooSmallFull = (window.lastDetectionRejectedTooSmall || []).map((p) => ({
              x: p.x * scaleX,
              y: p.y * scaleY,
            }));
            if (resultCanvas && quad && quad.length === 4) {
              const quadFull = quad.map((p) => ({ x: p.x * scaleX, y: p.y * scaleY }));
              const qualityScore = resultCanvas.width * resultCanvas.height;
              candidates.push({ quad: quadFull, qualityScore });
              prevQuadSmallRef.current = quad.map((p) => ({ x: p.x, y: p.y }));
              if (prevGrayRef.current) prevGrayRef.current.delete();
              prevGrayRef.current = currGray.clone();
              currGray.delete();
              currGray = null;
            }
          }

          // When full contour detection failed: track last quad with optical flow; if 2–3 corners visible, complete with A4
          if (candidates.length === 0 && typeof cv.calcOpticalFlowPyrLK === 'function' && prevGrayRef.current && prevQuadSmallRef.current && prevQuadSmallRef.current.length === 4) {
            try {
              const prevPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
                prevQuadSmallRef.current[0].x, prevQuadSmallRef.current[0].y,
                prevQuadSmallRef.current[1].x, prevQuadSmallRef.current[1].y,
                prevQuadSmallRef.current[2].x, prevQuadSmallRef.current[2].y,
                prevQuadSmallRef.current[3].x, prevQuadSmallRef.current[3].y,
              ]);
              const nextPts = new cv.Mat(4, 1, cv.CV_32FC2);
              const status = new cv.Mat(4, 1, cv.CV_8UC1);
              const err = new cv.Mat(4, 1, cv.CV_32FC1);
              const criteria = new cv.TermCriteria(cv.TERM_CRITERIA_EPS | cv.TERM_CRITERIA_COUNT, 30, 0.01);
              cv.calcOpticalFlowPyrLK(prevGrayRef.current, currGray, prevPts, nextPts, status, err, new cv.Size(21, 21), 3, criteria);
              criteria.delete();
              prevPts.delete();

              const inside = (p) => p.x >= 0 && p.x < sw && p.y >= 0 && p.y < sh;
              const statusData = status.data;
              const data32 = nextPts.data32F;
              const tracked = [];
              for (let i = 0; i < 4; i++) {
                const x = data32[i * 2];
                const y = data32[i * 2 + 1];
                const ok = statusData && statusData[i] === 1;
                if (ok && inside({ x, y })) tracked.push({ x, y });
              }
              nextPts.delete();
              status.delete();
              err.delete();

              let quadSmall = null;
              if (tracked.length === 4) {
                const order = (pts) => {
                  pts.sort((a, b) => a.y - b.y);
                  const top = pts.slice(0, 2).sort((a, b) => a.x - b.x);
                  const bottom = pts.slice(2, 4).sort((a, b) => a.x - b.x);
                  return [top[0], top[1], bottom[1], bottom[0]];
                };
                quadSmall = order(tracked.map((p) => ({ ...p })));
              } else if (tracked.length === 3 || tracked.length === 2) {
                quadSmall = completeA4Quad(tracked);
              }
              if (quadSmall && quadSmall.length === 4) {
                const quadFull = quadSmall.map((p) => ({ x: p.x * scaleX, y: p.y * scaleY }));
                candidates.push({ quad: quadFull, qualityScore: 0.3 }); // lower than full detection
                prevQuadSmallRef.current = quadSmall;
                if (prevGrayRef.current) prevGrayRef.current.delete();
                prevGrayRef.current = currGray.clone();
                currGray.delete();
                currGray = null;
              }
            } catch (_) {
              prevQuadSmallRef.current = null;
            }
          }

          if (currGray) currGray.delete();
        } catch (err) {
          console.error('[Scanner] Error scanning burst frame', err);
        }
      }

      // Don't update images state – we only draw the overlay; keeps video visible.
      if (candidates.length > 0) {
        candidates.sort((a, b) => b.qualityScore - a.qualityScore);
        const best = candidates[0];
        missFrameCountRef.current = 0;
        drawQuadOverlay(best.quad);
      } else if (smoothedQuadRef.current && missFrameCountRef.current < 25) {
        missFrameCountRef.current += 1;
        drawQuadOverlay(smoothedQuadRef.current);
      } else {
        missFrameCountRef.current = 0;
        smoothedQuadRef.current = null;
        prevQuadSmallRef.current = null;
        if (prevGrayRef.current) {
          prevGrayRef.current.delete();
          prevGrayRef.current = null;
        }
        if (typeof window !== 'undefined') window.lastDetectionCandidatesFull = [];
        drawQuadOverlay(null);
      }
    };

    const runLoop = () => {
      captureBurst().finally(() => {
        if (captureIntervalRef.current !== null) {
          captureIntervalRef.current = setTimeout(runLoop, 0);
        }
      });
    };
    captureIntervalRef.current = setTimeout(runLoop, 0);

    return () => {
      if (captureIntervalRef.current != null) {
        clearTimeout(captureIntervalRef.current);
        captureIntervalRef.current = null;
      }
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);


  return (
    <div className="scanner-container">
      <div className="scanner-camera">
        <h3>Camera</h3>
        <div className="scanner-camera-video-wrapper">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
          />
          <canvas ref={overlayRef} className="scanner-overlay" />
        </div>
      </div>
    </div>
  );
};
