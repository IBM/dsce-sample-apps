#!/bin/sh

echo "=== Generating runtime config with Python ==="

python3 << 'PYTHON_SCRIPT'
import os
import json

env_vars = {k: v for k, v in os.environ.items() if k.startswith('REACT_APP_')}

config_js = f"window._env_ = {json.dumps(env_vars, indent=2)};"

with open('/usr/share/nginx/html/env-config.js', 'w') as f:
    f.write(config_js)

print("Generated config:")
print(config_js)
PYTHON_SCRIPT

echo "=== Verifying files ==="
ls -la /usr/share/nginx/html/ | head -20

exec "$@"