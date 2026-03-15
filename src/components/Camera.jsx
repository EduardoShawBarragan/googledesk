import React, { useRef, useEffect } from "react";
import CameraButton from "./CameraButton";

export default function Camera() {
  const videoRef = useRef();

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then(stream => (videoRef.current.srcObject = stream))
      .catch(err => console.error(err));
  }, []);

  return (
    <div style={{ position: "relative", height: "100vh", width: "100vw", overflow: "hidden" }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
      <CameraButton onClick={() => {}} />
    </div>
  );
}
