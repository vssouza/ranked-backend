#!/usr/bin/env bash

set -euo pipefail

# Resolve script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SRC_DIR="$SCRIPT_DIR/../db/migrations"
DEST_DIR="$SCRIPT_DIR/../supabase/migrations"

BASE_DATE="20260102"
BASE_TIME=0

mkdir -p "$DEST_DIR"

echo "Renaming migrations from $SRC_DIR → $DEST_DIR"
echo

for file in $(ls "$SRC_DIR"/*.sql | sort); do
  base=$(basename "$file")

  # Strip numeric prefix (001_, 002_, etc.)
  name=$(echo "$base" | sed -E 's/^[0-9]+_//')

  printf -v ts "%02d" "$BASE_TIME"
  new_name="${BASE_DATE}0001${ts}_${name}"

  echo "→ $base  →  $new_name"

  cp "$file" "$DEST_DIR/$new_name"

  BASE_TIME=$((BASE_TIME + 1))
done

echo
echo "Done. Review supabase/migrations before running supabase db push."
