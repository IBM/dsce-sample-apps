#!/usr/bin/env python3
"""
Test the AI Guardrails API with a JSON input file

Usage:
  python test_api.py test_deploy.json
  python test_api.py your_custom_test.json
"""

import sys
import json
import requests

API_URL = "https://guardrails-api.23jw6l1ualch.us-south.codeengine.appdomain.cloud"

def test_api(json_file):
    """Test the API with a JSON file"""

    # Read the JSON file
    print(f"Reading test data from: {json_file}")
    with open(json_file, 'r') as f:
        payload = json.load(f)

    print("\nRequest Payload:")
    print(json.dumps(payload, indent=2))

    # Call the API
    print(f"\nCalling API: {API_URL}/api/evaluate")
    response = requests.post(
        f"{API_URL}/api/evaluate",
        json=payload,
        headers={"Content-Type": "application/json"}
    )

    # Show results
    print(f"\nStatus Code: {response.status_code}")
    print("\nResponse:")
    print(json.dumps(response.json(), indent=2))

    # Parse and highlight key results
    if response.status_code == 200:
        data = response.json()
        if data['status'] == 'success':
            print("\n" + "="*60)
            print("RESULTS SUMMARY")
            print("="*60)
            for metric_name, result in data['results'].items():
                score = result['score']
                passed = result['passed']
                status = "✅ PASS" if not passed else "⚠️  DETECTED"
                print(f"{metric_name:30} Score: {score:.2f}  {status}")
            print("="*60)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python test_api.py <json_file>")
        print("Example: python test_api.py test_deploy.json")
        sys.exit(1)

    json_file = sys.argv[1]
    test_api(json_file)
