import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SOC — Agentic Security Operations',
  description: 'IBM watsonx Orchestrate — SOC Agentic Pipeline: Triage → Classification → RCA → Notification → Action → Close',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
