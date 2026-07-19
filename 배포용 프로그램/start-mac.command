#!/bin/bash
cd "$(dirname "$0")"

# Remove macOS quarantine attribute (blocks unsigned apps downloaded from internet)
xattr -cr . 2>/dev/null

# Detect architecture
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
  BIN="./bin/my-data-analysis-macos-arm64"
else
  BIN="./bin/my-data-analysis-macos-x64"
fi

# Ensure binary is executable
chmod +x "$BIN"

# Ad-hoc codesign if not properly signed (fixes "damaged" error on other Macs)
codesign -s - --force "$BIN" 2>/dev/null

echo ""
echo "========================================="
echo "  소셜미디어 데이터 분석 도구"
echo "  http://localhost:3007"
echo "========================================="
echo ""
echo "종료: Ctrl+C 또는 이 창 닫기"
echo ""

# Open browser after short delay
(sleep 2 && open "http://localhost:3007") &

"$BIN"
