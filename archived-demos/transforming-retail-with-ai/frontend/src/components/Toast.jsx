import React, { useEffect } from "react";
import "./Toast.css";

export default function Toast({ message, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 2200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="toast-center-wrapper">
      <div className="toast-center">{message}</div>
    </div>
  );
}

