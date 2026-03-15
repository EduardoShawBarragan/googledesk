import { useEffect, useRef, useState } from 'react';
import './scanner.css';

const images = [
  { src: '/paper-2.png' }
];

export const Scanner = () => {
  const containerRef = useRef(null);
  const openCvURL = 'https://docs.opencv.org/4.7.0/opencv.js';

  const [loadedOpenCV, setLoadedOpenCV] = useState(false);
  const [selectedImage, setSelectedImage] = useState(images[0]);
  

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

      for (let i = 0; i < contours.size(); i++) {
        const c = contours.get(i);
        const peri = cv.arcLength(c, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(c, approx, 0.02 * peri, true);

        if (approx.rows === 4) {
          const area = cv.contourArea(approx);
          const areaRatio = area / imgArea;

          // Skip very small or almost-full-image quads
          if (areaRatio < 0.1 || areaRatio > 0.95) {
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

          // Favor aspect ratios roughly like a sheet of paper (between ~1 and 2)
          if (aspect < 0.8 || aspect > 2.2) {
            approx.delete();
            c.delete();
            continue;
          }

          // Score by area and how close the aspect ratio is to ~1.4 (A‑series paper)
          const aspectTarget = 1.4;
          const aspectScore = Math.exp(-Math.abs(aspect - aspectTarget));
          const score = areaRatio * aspectScore;

          if (score > bestScore) {
            bestScore = score;
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
        console.warn('[Scanner] Could not find paper contour, falling back to full image');
        // Just return the original image as a canvas
        const canvasFallback = document.createElement('canvas');
        canvasFallback.width = imgElement.naturalWidth;
        canvasFallback.height = imgElement.naturalHeight;
        cv.imshow(canvasFallback, src);
        src.delete();
        gray.delete();
        blurred.delete();
        edged.delete();
        contours.delete();
        hierarchy.delete();
        return canvasFallback;
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

      const imgW = imgElement.naturalWidth;
      const imgH = imgElement.naturalHeight;

      // If no explicit target size, derive from the detected quadrilateral
      if (!targetWidth || !targetHeight) {
        const dist = (p1, p2) =>
          Math.sqrt((p1.x - p2.x) * (p1.x - p2.x) + (p1.y - p2.y) * (p1.y - p2.y));

        const widthTop = dist(tl, tr);
        const widthBottom = dist(bl, br);
        const rawWidth = Math.max(widthTop, widthBottom);

        const heightLeft = dist(tl, bl);
        const heightRight = dist(tr, br);
        const rawHeight = Math.max(heightLeft, heightRight);

        targetWidth = Math.round(rawWidth);
        targetHeight = Math.round(rawHeight);

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
      // Use INTER_LINEAR with modest scale to preserve edge sharpness
      cv.warpPerspective(src, dst, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

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


  return (
    <div className="scanner-container">
      <div className="scanner-thumbnails">
        {!loadedOpenCV && <h2>Loading OpenCV...</h2>}
        {images.map((image, index) => (
          <img
            key={index}
            className={selectedImage && selectedImage.src === image.src ? 'selected' : ''}
            src={image.src}
            onClick={() => setSelectedImage(image)}
            alt={`Paper ${index + 1}`}
          />
        ))}
      </div>
      <div ref={containerRef} id="result-container"></div>
    </div>
  );
};
