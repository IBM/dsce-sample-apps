import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
   server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: ["*","dsce-frontend.1y9n0rrkkv47.us-south.codeengine.appdomain.cloud", "dsce-test-ce-wtxo-talent-acquisition-ui.1pde6bclcwl3.us-south.codeengine.appdomain.cloud","dsce-prod-ce-wtxo-talent-acquisition-ui.1op8ay1afyb7.us-south.codeengine.appdomain.cloud","498b6995fc.dsceapp.buildlab.cloud"],   // :point_left: allow all hosts
  },
})