/**
 * GET /api/config-files
 *
 * Fetches agent instruction files and config YAML files from IBM Cloud Object Storage.
 * Each file is retrieved by its COS object key and returned as plain text.
 *
 * Required env vars:
 *   COS_API_KEY          — IBM Cloud API key with COS read access
 *   COS_INSTANCE_CRN     — COS service instance CRN
 *   COS_ENDPOINT         — Regional endpoint e.g. https://s3.us-south.cloud-object-storage.appdomain.cloud
 *   COS_BUCKET           — Bucket name
 */

import { NextResponse } from 'next/server';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const IBMCOS = require('ibm-cos-sdk');

const FILE_MANIFEST: { id: string; label: string; group: string; key: string }[] = [
  { id: 'triage-instructions',         label: 'Triage Logic',            group: 'Agents', key: 'triage_agent.yaml'            },
  { id: 'classification-instructions', label: 'Classification Logic',    group: 'Agents', key: 'classification_agent.yaml'    },
  { id: 'rca-instructions',            label: 'RCA Logic',               group: 'Agents', key: 'rca_agent.yaml'               },
  { id: 'notification-instructions',   label: 'Notification Logic',      group: 'Agents', key: 'notify_agent.yaml'            },
  { id: 'action-instructions',         label: 'Action Logic',            group: 'Agents', key: 'action_agent.yaml'            },
  { id: 'close-instructions',          label: 'Close Logic',             group: 'Agents', key: 'close_agent.yaml'             },
  { id: 'allowlist',                   label: 'allowlist.yaml',           group: 'Config', key: 'allowlist.yaml'               },
  { id: 'exfil-tools',                 label: 'exfil_tools.yaml',         group: 'Config', key: 'exfil_tools.yaml'             },
  { id: 'maintenance-windows',         label: 'maintenance_windows.yaml', group: 'Config', key: 'maintenance_windows.yaml'     },
  { id: 'privileged-accounts',         label: 'privileged_accounts.yaml', group: 'Config', key: 'privileged_accounts.yaml'     },
  { id: 'service-path-policy',         label: 'service_path_policy.yaml', group: 'Config', key: 'service_path_policy.yaml'     },
];

function getCosClient() {
  const apiKey      = process.env.COS_API_KEY;
  const instanceCrn = process.env.COS_INSTANCE_CRN;
  const endpoint    = process.env.COS_ENDPOINT;

  if (!apiKey || !instanceCrn || !endpoint) {
    throw new Error('Missing COS env vars: COS_API_KEY, COS_INSTANCE_CRN, COS_ENDPOINT');
  }

  return new IBMCOS.S3({
    endpoint,
    apiKeyId: apiKey,
    ibmAuthEndpoint: 'https://iam.cloud.ibm.com/identity/token',
    serviceInstanceId: instanceCrn,
  });
}

async function fetchObject(cos: any, bucket: string, key: string): Promise<string> {
  const resp = await cos.getObject({ Bucket: bucket, Key: key }).promise();
  return resp.Body.toString('utf-8');
}

export async function GET() {
  const bucket = process.env.COS_BUCKET;

  if (!bucket) {
    return NextResponse.json({ error: 'COS_BUCKET env var is not set' }, { status: 500 });
  }

  let cos: any;
  try {
    cos = getCosClient();
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  const results = await Promise.all(
    FILE_MANIFEST.map(async ({ id, label, group, key }) => {
      let content = '';
      try {
        content = await fetchObject(cos, bucket, key);
      } catch (err: any) {
        content = `# Could not fetch "${key}" from COS bucket "${bucket}"\n# Error: ${err.message}`;
      }
      return { id, label, group, content };
    })
  );

  return NextResponse.json({ files: results });
}
