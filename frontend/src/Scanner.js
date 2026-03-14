import React, { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";

export default function Scanner() {
  const webcamRef = useRef(null);
  const [scanner, setScanner] = useState(null);

  const [highlightedImage, setHighlightedImage] = useState(null);
  const [extractedImage, setExtractedImage] = useState(null);
  const [corners, setCorners] = useState(null);

  // Wait until OpenCV and jscanify are loaded
  useEffect(() => {
    const waitForLibs = () => {
      if (window.cv && window.jscanify) {
        setScanner(new window.jscanify());
        console.log("jscanify ready!");
      } else {
        setTimeout(waitForLibs, 100);
      }
    };
    waitForLibs();
  }, []);

  const captureAndScan = () => {
    if (!scanner || !webcamRef.current) return;

    const video = webcamRef.current.video;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Highlight the paper
    const highlightedCanvas = scanner.highlightPaper(canvas);
    setHighlightedImage(highlightedCanvas.toDataURL("image/png"));

    // Extract the flattened paper
    const extractedCanvas = scanner.extractPaper(canvas, 600, 800);
    setExtractedImage(extractedCanvas.toDataURL("image/png"));

    // Get corners
    const contour = scanner.findPaperContour(canvas);
    if (contour) {
      const detectedCorners = scanner.getCornerPoints(contour);
      setCorners(detectedCorners);
      console.log("Corners:", detectedCorners);
    } else {
      setCorners(null);
      console.log("No paper detected.");
    }
  };

  return (
    <div>
      <Webcam ref={webcamRef} />
      <button onClick={captureAndScan}>Scan Page</button>

      {highlightedImage && (
        <div>
          <h4>Highlighted Paper</h4>
          <img src={highlightedImage} alt="highlighted paper" />
        </div>
      )}

      {extractedImage && (
        <div>
          <h4>Extracted Paper</h4>
          <img src={extractedImage} alt="extracted paper" />
        </div>
      )}

      {corners && (
        <div>
          <h4>Corners:</h4>
          <pre>{JSON.stringify(corners, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}