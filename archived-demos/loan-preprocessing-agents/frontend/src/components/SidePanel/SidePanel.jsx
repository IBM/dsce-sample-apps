import React, { useEffect, useRef } from "react";
import "./SidePanel.css";

const SidePanel = ({ isOpen, onClose, children }) => {
  const panelRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Close on ESC key
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEsc);
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
    };
  }, [isOpen, onClose]);

  return (
    <div className={`sidepanel-overlay ${isOpen ? "open" : ""}`}>
      <div ref={panelRef} className={`sidepanel ${isOpen ? "open" : ""}`}>
        <button className="sidepanel-close" onClick={onClose}>
          ✕
        </button>
        <div className="sidepanel-content">{children}</div>
      </div>
    </div>
  );
};

export default SidePanel;
