#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p vendor
archive=vendor/bobshell-2.0.4.tgz
expected=10de047ffdc23a50f3e1ef69fad3b6313ff6dda0010589a22efe26b24685254b
temporary=$(mktemp "${archive}.XXXXXX")
trap 'rm -f "$temporary"' EXIT HUP INT TERM
curl -fsSL https://s3.us-south.cloud-object-storage.appdomain.cloud/bob-shell/bobshell-2.0.4.tgz -o "$temporary"
actual=$(shasum -a 256 "$temporary" | awk '{print $1}')
[ "$actual" = "$expected" ] || { echo 'Bob archive checksum mismatch' >&2; exit 1; }
mv "$temporary" "$archive"
echo "Verified $archive"
