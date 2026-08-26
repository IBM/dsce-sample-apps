// openshift/jobs/download-model.mjs
// Run at image build time to bake the model in — cluster has no internet egress.
import { pipeline, env } from '@xenova/transformers';
env.allowLocalModels = true;
await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
process.exit(0);
