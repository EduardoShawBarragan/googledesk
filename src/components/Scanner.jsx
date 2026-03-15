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
  const foundPaperRef = useRef(false);
  const captureIntervalRef = useRef(null);
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

      for (let i = 0; i < contours.size(); i++) {
        const c = contours.get(i);
        const peri = cv.arcLength(c, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(c, approx, 0.02 * peri, true);

        if (approx.rows === 4) {
          const area = cv.contourArea(approx);
          const areaRatio = area / imgArea;

          // Skip only extremely tiny or literally full-frame quads
          if (areaRatio < 0.02 || areaRatio > 0.99) {
            approx.delete();
            c.delete();
            continue;
          }

          // Compute a rough aspect ratio to favor paper‑like rectangles
          const ptsTmp = [];
          for (let j = 0; j < approx.rows; j++) {
            const x = approx.intAt(j, 0);
            const y = approx.intAt(j, 1);
            ptsTmp.push({ x, y });
          }
          ptsTmp.sort((a, b) => a.y - b.y);
          const top = ptsTmp.slice(0, 2).sort((a, b) => a.x - b.x);
          const bottom = ptsTmp.slice(2, 4).sort((a, b) => a.x - b.x);
          const tlCand = top[0];
          const trCand = top[1];
          const brCand = bottom[1];
          const blCand = bottom[0];

          const dist = (p1, p2) =>
            Math.sqrt((p1.x - p2.x) * (p1.x - p2.x) + (p1.y - p2.y) * (p1.y - p2.y));

          const widthTop = dist(tlCand, trCand);
          const widthBottom = dist(blCand, brCand);
          const heightLeft = dist(tlCand, blCand);
          const heightRight = dist(trCand, brCand);

          const avgWidth = (widthTop + widthBottom) / 2;
          const avgHeight = (heightLeft + heightRight) / 2;
          const aspect = avgHeight > 0 ? avgHeight / avgWidth : 0;

          // Score primarily by area; keep aspect in logs only so we don't over‑reject.
          const score = areaRatio;

          if (score > bestScore) {
            bestScore = score;
            bestAreaRatio = areaRatio;
            if (paperCnt) {
              paperCnt.delete();
            }
            paperCnt = approx; // keep this approx
          } else {
            approx.delete();
          }
        } else {
          approx.delete();
        }
        c.delete();
      }

      if (!paperCnt) {
        console.warn('[Scanner] Could not find a suitable paper contour – treating as no paper.', {
          imgArea,
          bestScore,
          bestAreaRatio,
        });
        src.delete();
        gray.delete();
        blurred.delete();
        edged.delete();
        contours.delete();
        hierarchy.delete();
        return null;
      }

      // If the best contour is extremely small in the frame, treat it as no paper
      // so random noise doesn't immediately trigger detection, but real pages do.
      const minAreaRatio = 0.15;
      if (bestAreaRatio < minAreaRatio) {
        console.warn('[Scanner] Best contour area too small, ignoring as non‑paper:', {
          bestAreaRatio,
          minAreaRatio,
          imgArea,
        });
        src.delete();
        gray.delete();
        blurred.delete();
        edged.delete();
        contours.delete();
        hierarchy.delete();
        paperCnt.delete();
        return null;
      }

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

      const imgW = imgElement.naturalWidth;
      const imgH = imgElement.naturalHeight;

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

      if (!quad || quad.length !== 4) return;

      // Draw AR content first (warped to quad), then outline on top
      const arImg = arImageRef.current;
      const cv = window.cv;
      if (arImg && cv && cv.Mat && cv.getPerspectiveTransform && cv.warpPerspective) {
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
          quad[0].x, quad[0].y,
          quad[1].x, quad[1].y,
          quad[2].x, quad[2].y,
          quad[3].x, quad[3].y,
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

      ctx.strokeStyle = '#00ff4d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(quad[0].x, quad[0].y);
      ctx.lineTo(quad[1].x, quad[1].y);
      ctx.lineTo(quad[2].x, quad[2].y);
      ctx.lineTo(quad[3].x, quad[3].y);
      ctx.closePath();
      ctx.stroke();
    };

    const captureBurst = async () => {
      const video = videoRef.current;
      if (!video || !video.srcObject || video.readyState < 2) return;

      const candidates = [];

      for (let i = 0; i < 1; i++) {
        if (!video || !video.srcObject || video.readyState < 2) break;

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        const dataURL = canvas.toDataURL('image/png');

        if (window.cv && window.cv.Mat) {
          await new Promise((resolve) => {
            const imgEl = new Image();
            imgEl.onload = () => {
              try {
                const resultCanvas = extractPaperWithOpenCV(imgEl);
                const quad = window.lastDetectedQuad;
                if (resultCanvas && quad && quad.length === 4) {
                  const qualityScore = resultCanvas.width * resultCanvas.height;
                  candidates.push({ quad, qualityScore });
                }
              } catch (err) {
                console.error('[Scanner] Error scanning burst frame', err);
              } finally {
                resolve();
              }
            };
            imgEl.src = dataURL;
          });
        }

        // Small delay between frames in the burst to reduce motion blur
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Don't update images state – we only draw the overlay; keeps video visible.
      if (candidates.length > 0) {
        candidates.sort((a, b) => b.qualityScore - a.qualityScore);
        const best = candidates[0];
        console.warn('[Scanner] Paper detected in burst; drawing best quad overlay.', {
          qualityScore: best.qualityScore,
        });
        drawQuadOverlay(best.quad);
      } else {
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
