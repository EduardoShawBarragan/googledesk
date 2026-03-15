import { useEffect, useRef, useState } from 'react';
import './scanner.css';

const images = [
  { src: '/paper-2.png' }
];

export const Scanner = () => {
  const containerRef = useRef(null);
  const openCvURL = 'https://docs.opencv.org/4.7.0/opencv.js';

  const [loadedOpenCV, setLoadedOpenCV] = useState(false);
  const [selectedImage, setSelectedImage] = useState(undefined);
  

  // after state declarations
  const loadOpenCv = (onComplete) => {
    if (document.getElementById('open-cv')) return onComplete();
    const script = document.createElement('script');
    script.id = 'open-cv';
    script.src = 'https://docs.opencv.org/4.7.0/opencv.js';
    script.onload = onComplete;
    document.body.appendChild(script);
  };


  //////////////////////////////
  // Load jscanify dynamically
  const loadScanner = () => {
    if (window.jscanify) return Promise.resolve();
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/jscanify/dist/jscanify.min.js';
      script.onload = () => resolve();
      document.body.appendChild(script);
    });
  };

  useEffect(() => {
    // Only run if the user has selected an image
    if (!selectedImage) return;

    // First, load OpenCV
    loadOpenCv(() => {
      // Then, load jscanify
      loadScanner().then(() => {
        // Clear previous result
        containerRef.current.innerHTML = '';

        // Create image element
        const newImg = document.createElement('img');
        newImg.crossOrigin = 'anonymous'; // ✅ important: must be BEFORE src
        newImg.src = selectedImage.src;

        // When image loads, scan and append canvases
        newImg.onload = function () {
          const scanner = new window.jscanify();
          const resultCanvas = scanner.extractPaper(newImg, 386, 500);
          containerRef.current.append(resultCanvas);

          const highlightedCanvas = scanner.highlightPaper(newImg);
          containerRef.current.append(highlightedCanvas);
        };
      });
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
