import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: "/",
  plugins: [react()],
  preview: {
   port: 3000,
   strictPort: true,
   allowedHosts: ["wealth-manager-agent-v2.1s6emm0ktx8z.us-east.codeengine.appdomain.cloud", 
                  "dsce-test-ce-wtx-wealth-manager-single-agent-ui.1pde6bclcwl3.us-south.codeengine.appdomain.cloud",
                  "dsce-prod-ce-wtx-wealth-manager-single-agent-ui.1op8ay1afyb7.us-south.codeengine.appdomain.cloud",
                  "58691dd33e.dsceapp.buildlab.cloud"
                 ]
  },
  server: {
   port: 3000,
   strictPort: true,
   host: true,
   origin: "http://0.0.0.0:3000",
  },
 });
