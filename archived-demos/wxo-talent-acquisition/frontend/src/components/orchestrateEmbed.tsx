/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/OrchestrateEmbed.tsx
// Lightweight React wrapper that bootstraps the Watsonx Orchestrate webchat
// using environment variables provided by Vite. It injects the loader script
// once and exposes a few knobs via props.

import  { useEffect } from "react";
import './orchestrateEmbed.css';
/**
 * Props to override defaults coming from env.
 */
export type OrchestrateEmbedProps = {
  /** The DOM element id that the chat should attach to. Defaults to 'root'. */
  rootElementId?: string;
  /** Whether to show the floating launcher. Defaults to true. */
  showLauncher?: boolean;
  /** If you need to override env-provided values at runtime. */
  orchestrationId?: string;
  hostURL?: string; // e.g. https://<region>.ibm.com
  crn?: string;
  agentId?: string;
  agentEnvironmentId?: string; // optional, if your deployment requires it
  deploymentPlatform?: "ibmcloud" | "openshift" | string;
};

// Safely declare globals used by the embed script
declare global {
  interface Window {
    wxoLoader?: {
      init: () => void;
      destroy?: () => void;
    };
    wxOConfiguration: any;
  }
}

const LOADER_SCRIPT_ID = "wxo-loader-script";

export default function OrchestrateEmbed({
  rootElementId = "root",
  showLauncher = true,
  orchestrationId,
  hostURL,
  crn,
  agentId,
  agentEnvironmentId,
  deploymentPlatform = "ibmcloud",
}: OrchestrateEmbedProps) {
  useEffect(() => {
    // Resolve values from env (Vite injects import.meta.env.* at build time)
    const env = import.meta.env as Record<string, string | undefined>;

    const cfg = {
      orchestrationID: orchestrationId ?? env.VITE_ORCHESTRATION_ID ?? "",
      hostURL: hostURL ?? env.VITE_HOST_URL ?? "",
      rootElementID: rootElementId,
      showLauncher,
      crn: crn ?? env.VITE_CRN ?? "",
      deploymentPlatform,
      // Some deployments require an environment id in addition to agent id
      chatOptions: {
        agentId: agentId ?? env.VITE_AGENT_ID ?? "",
        agentEnvironmentId:
          agentEnvironmentId ?? env.VITE_AGENT_ENVIRONMENT_ID ?? undefined,
      },
    } as const;
    // Guard: basic sanity checks to help during dev
    if (!cfg.hostURL) {
      // eslint-disable-next-line no-console
      console.error(
        "[OrchestrateEmbed] Missing hostURL. Set VITE_HOST_URL or pass via props."
      );
      return;
    }
    if (!cfg.orchestrationID) {
      // eslint-disable-next-line no-console
      console.warn(
        "[OrchestrateEmbed] orchestrationID is empty. Set VITE_ORCHESTRATION_ID or pass via props."
      );
    }

    // Expose configuration before loading the script (required by the loader)
    window.wxOConfiguration = cfg;

    // If a previous instance exists (hot reload), try to teardown
    try {
      window.wxoLoader?.destroy?.();
    } catch (error){
        console.log('error', error)
    }

    // Avoid injecting multiple times
    let script = document.getElementById(
      LOADER_SCRIPT_ID
    ) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = LOADER_SCRIPT_ID;
      script.async = true;
      script.src = `${cfg.hostURL}/wxochat/wxoLoader.js?embed=true`;
      script.onload = () => {
        try {
          window.wxoLoader?.init();
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("[OrchestrateEmbed] Failed to init wxoLoader", e);
        }
      };
      document.head.appendChild(script);
    } else {
      // If already present (e.g., Fast Refresh), re-init with the new config
      try {
        window.wxoLoader?.init();
      } catch (error) {
        console.error("error", error);
      }
    }

    // Optional cleanup: only destroy on unmount (do not remove the script tag)
    return () => {
      try {
        window.wxoLoader?.destroy?.();
      } catch (error) {
        console.error("error", error);
      }
    };
  }, [
    rootElementId,
    showLauncher,
    orchestrationId,
    hostURL,
    crn,
    agentId,
    agentEnvironmentId,
    deploymentPlatform,
  ]);

  // This component renders nothing; it just bootstraps the chat.
  return null;
}
