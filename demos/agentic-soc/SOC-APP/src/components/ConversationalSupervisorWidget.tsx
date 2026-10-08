'use client';

import { useEffect } from 'react';

// ── Constants ────────────────────────────────────────────────────────────────

const WXO_HOST         = 'https://us-south.watson-orchestrate.cloud.ibm.com';
const ORCHESTRATION_ID = '8471af1899b34564b2b04be799f50d75_f616a30e-4d64-46a7-97e5-403725a4df8a';
const CRN              = 'crn:v1:bluemix:public:watsonx-orchestrate:us-south:a/8471af1899b34564b2b04be799f50d75:f616a30e-4d64-46a7-97e5-403725a4df8a::';
const AGENT_ID         = process.env.NEXT_PUBLIC_CONV_SUPERVISOR_AGENT_ID || '7cce8e72-7c29-4a5e-a2ce-07127ae3a78d';

// Only treat NEXT_PUBLIC_WXO_AGENT_ENV_ID as a real environment ID if it
// looks like a UUID. The value "live" (or other non-UUID strings) must be
// omitted — passing it causes a 422 from the WxO getLiveAgentDetails endpoint.
const UUID_RE      = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RAW_ENV_ID   = process.env.NEXT_PUBLIC_WXO_AGENT_ENV_ID || '';
const AGENT_ENV_ID = UUID_RE.test(RAW_ENV_ID) ? RAW_ENV_ID : '';

// ── Token helper ─────────────────────────────────────────────────────────────

async function fetchEmbedToken(): Promise<string | undefined> {
  try {
    const res  = await fetch('/api/wxo-token');
    const data = await res.json();
    if (data.success && data.token) return data.token;
    console.warn('[WxO embed] Token endpoint returned:', data.error || 'no token');
  } catch (err) {
    console.warn('[WxO embed] Could not fetch JWT — widget may not load:', err);
  }
  return undefined;
}

// ── Widget component ─────────────────────────────────────────────────────────

export function ConversationalSupervisorWidget() {
  useEffect(() => {
    let script: HTMLScriptElement | null = null;

    async function initWidget() {
      // Only fetch a JWT when the backend has the private key configured.
      // When security is disabled the token must NOT be sent.
      let token: string | undefined;
      try {
        const res  = await fetch('/api/wxo-token');
        const data = await res.json();
        if (data.success && data.token) token = data.token;
      } catch {
        // Network error — proceed without token.
      }

      window.wxOConfiguration = {
        orchestrationID:    ORCHESTRATION_ID,
        hostURL:            WXO_HOST,
        rootElementID:      'root',
        deploymentPlatform: 'ibmcloud',
        crn:                CRN,
        chatOptions: {
          agentId: AGENT_ID,
          ...(token        ? { token }                              : {}),
          ...(AGENT_ENV_ID ? { agentEnvironmentId: AGENT_ENV_ID }  : {}),
        },
      };

      script = document.createElement('script');
      script.src = `${WXO_HOST}/wxochat/wxoLoader.js?embed=true`;
      script.addEventListener('load', () => {
        const instance = window.wxoLoader.init();
        if (token && instance?.on) {
          instance.on('authTokenNeeded', async (event: any) => {
            const newToken = await fetchEmbedToken();
            if (newToken) {
              event.authToken = newToken;
            } else {
              console.warn('[WxO embed] authTokenNeeded: failed to refresh token');
            }
          });
        }
      });
      document.head.appendChild(script);
    }

    initWidget();

    return () => {
      if (script && document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  return null;
}
