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

  // For this specific demo image (paper-2), use a fixed quadrilateral
  // that approximates the four corners of the sheet, then rectify it.
  // This avoids the contour-detection errors that were badly distorting the page.
  const extractPaperWithOpenCV = (imgElement, targetWidth, targetHeight) => {
    const cv = window.cv;
    if (!cv || !cv.Mat) {
      console.error('[Scanner] OpenCV not ready inside extractPaperWithOpenCV');
      return null;
    }

    let src;

    try {
      src = cv.imread(imgElement);

      const imgW = imgElement.naturalWidth;
      const imgH = imgElement.naturalHeight;

      // Approximate the four corners of the paper in this specific image,
      // measured as fractions of the image dimensions.
      const tl = { x: 0.16 * imgW, y: 0.05 * imgH };
      const tr = { x: 0.93 * imgW, y: 0.08 * imgH };
      const br = { x: 0.96 * imgW, y: 0.96 * imgH };
      const bl = { x: 0.12 * imgW, y: 0.98 * imgH };

      const ordered = [tl, tr, br, bl];

      // If no explicit target size, derive from the approximated quadrilateral
      if (!targetWidth || !targetHeight) {
        const rawWidth = imgW * 0.8;  // approximate paper width span
        const rawHeight = imgH * 0.9; // approximate paper height span

        targetWidth = Math.round(rawWidth);
        targetHeight = Math.round(rawHeight);

        console.log('[Scanner] Using fixed paper quad and size', {
          imgW,
          imgH,
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
      srcTri.delete();
      dstTri.delete();
      M.delete();
      dst.delete();

      return canvas;
    } catch (err) {
      console.error('[Scanner] Error in extractPaperWithOpenCV', err);
      // Cleanup best-effort
      src && src.delete();
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
