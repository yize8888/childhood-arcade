#!/bin/sh
set -e

# Ensure data directories exist
mkdir -p /data /data/uploads /data/bios /data/saves /data/cores

# Seed BIOS files from the image into the mounted volume on first boot. We
# iterate every platform subdir under /opt/bios-seed so new platforms (added
# to data/bios/<plat>/ in the repo) are picked up automatically without
# having to edit this script.
if [ -d /opt/bios-seed ]; then
  for plat_dir in /opt/bios-seed/*/; do
    plat=$(basename "$plat_dir")
    mkdir -p "/data/bios/$plat"
    if [ -z "$(ls -A /data/bios/$plat 2>/dev/null)" ]; then
      cp -n "$plat_dir"* "/data/bios/$plat/" 2>/dev/null || true
    fi
  done
fi

# If cores dir is empty, seed it from the image (prefetch-cores result)
if [ -d /opt/cores-seed ] && [ -z "$(ls -A /data/cores 2>/dev/null)" ]; then
  cp -n /opt/cores-seed/* /data/cores/ 2>/dev/null || true
fi

exec "$@"
