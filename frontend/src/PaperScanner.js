import { useEffect, useRef, useState } from 'react';

const images = [{ src: '/paper-2.png' }];

export const Scanner = () => {
  // --- STEP 1: ADD THESE TWO REFS HERE ---
  const containerRef = useRef(null);
  const scannerRef = useRef(null); 
  // ---------------------------------------

  const openCvURL = 'https://docs.opencv.org/4.7.0/opencv.js';
  const [loadedOpenCV, setLoadedOpenCV] = useState(false);
  
  // Note: Changed to images[0] since your array only has one item
  const [selectedImage, setSelectedImage] = useState(images[0]);

  useEffect(() => {
    // --- STEP 2: INITIALIZE THE REF ---
    // This prevents the 'scannerRef is not defined' error
    if (!window.jscanify || !window.cv || typeof window.cv.Mat !== 'function') return;

    if (!scannerRef.current) {
      scannerRef.current = new window.jscanify();
    }
    
    const scanner = scannerRef.current;
    if (!scanner) return; // Guard clause if jscanify hasn't loaded yet

    loadOpenCv(() => {
      if (selectedImage && containerRef.current) {
        const newImg = new Image(); // Use Image constructor for better reliability
        newImg.src = selectedImage.src;

        newImg.onload = function () {
          // 1. Perform the extraction
          const resultCanvas = scanner.extractPaper(newImg, 800, 1131); // Increased res for better download quality
          
          // 2. Clear and Show in UI (Optional)
          containerRef.current.innerHTML = '';
          containerRef.current.append(resultCanvas);

          // 3. --- ADD THE DOWNLOAD TRIGGER HERE ---
          // Convert canvas to a high-quality JPEG blob
          resultCanvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            
            link.href = url;
            link.download = 'scanned-paper.jpg'; // The name of the file
            
            // Append to body, click it, and remove it
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up the memory
            URL.revokeObjectURL(url);
            
            console.log("Download triggered!");
          }, 'image/jpeg', 0.95);
        };
      }
    });
  }, [selectedImage, loadedOpenCV]);

  const loadOpenCv = (onComplete) => {
    const isScriptPresent = !!document.getElementById('open-cv');
    if (isScriptPresent || loadedOpenCV) {
      setLoadedOpenCV(true);
      onComplete();
    } else {
      const script = document.createElement('script');
      script.id = 'open-cv';
      script.src = openCvURL;
      script.onload = function () {
        setTimeout(() => {
          onComplete();
        }, 1000);
        setLoadedOpenCV(true);
      };
      document.body.appendChild(script);
    }
  };
  const downloadScan = () => {
    // Look inside our container for the canvas created by the scanner
    const canvas = containerRef.current?.querySelector('canvas');
    
    if (canvas) {
      const link = document.createElement('a');
      link.download = 'scanned-paper.jpg';
      link.href = canvas.toDataURL('image/jpeg', 0.9);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      alert("No scanned image found! Please wait for the processing to finish.");
    }
  };
  return (
    <div className="scanner-container">
      {!loadedOpenCV && (
        <div style={{ color: '#fff', textAlign: 'center', padding: '20px' }}>
          <h2>Loading OpenCV...</h2>
        </div>
      )}
      <button 
        onClick={downloadScan}
        style={{
          margin: '20px 0',
          padding: '15px 30px',
          background: '#28a745',
          color: '#fff',
          border: 'none',
          borderRadius: '50px',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: 'pointer',
          boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
        }}
      >
        Download Scanned Image
      </button>
      <div 
        ref={containerRef} 
        style={{ 
          width: '100%', 
          minHeight: '400px', 
          background: '#111', 
          display: 'flex', 
          flexDirection: 'column',
          justifyContent: 'center', 
          alignItems: 'center',
          borderRadius: '12px',
          padding: '10px'
        }}
      >
        {!selectedImage && <p style={{ color: '#666' }}>Select an image to scan</p>}
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
        {images.map((image, index) => (
          <img
            key={index}
            src={image.src}
            onClick={() => setSelectedImage(image)}
            style={{ 
              width: '80px', 
              border: selectedImage?.src === image.src ? '2px solid blue' : 'none' 
            }}
            alt="thumbnail"
          />
        ))}
      </div>
    </div>
  );
};