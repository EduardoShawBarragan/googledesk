import React from "react";

export default function CameraButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        position: "absolute",
        bottom: "30px",
        left: "50%",
        transform: "translateX(-50%)",
        padding: "15px 30px",
        fontSize: "16px",
        borderRadius: "8px",
        border: "none",
        backgroundColor: "#007bff",
        color: "#fff",
        cursor: "pointer",
      }}
    >
      Dummy Button
    </button>
  );
}
