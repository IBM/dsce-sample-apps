"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import styles from "./page.module.css";
import "./globals.scss";
import SearchOpportunitiesForm from "./Components/SearchOpportunitiesForm/SearchOpportunitiesForm";
import AppHeader from "./Components/AppHeader/AppHeader";
import { Theme } from '@carbon/react';

export default function Home() {
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        scrollBehavior: "smooth",
      }}
    >
      <Theme theme='g100'>
        <AppHeader></AppHeader>
      </Theme>
      
      <div style={{ flex: "1 0 auto" }}>
        <SearchOpportunitiesForm />
      </div>

      <footer
        style={{
          backgroundColor: "#000",
          color: "#fff",
          textAlign: "center",
          padding: "0.5rem",
          fontSize: "0.9rem",
          flexShrink: 0,
        }}
      >
        Powered by <span style={{ fontWeight: "600" }}>Watsonx</span> © 2025
      </footer>
    </div>
  );
}
