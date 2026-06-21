#!/bin/bash
echo "========================================="
echo "  基金分析平台 - 本地服务器"
echo "========================================="
echo ""
# Find an available port
PORT=8080
while lsof -i :$PORT >/dev/null 2>&1; do PORT=$((PORT+1)); done
echo "→ 启动服务器: http://localhost:$PORT"
echo ""
echo "  在同一 Wi-Fi 下的设备可以访问:"
echo "  http://$(ifconfig en0 2>/dev/null | grep 'inet ' | awk '{print $2}'):$PORT"
echo ""
echo "  按 Ctrl+C 停止服务器"
echo "========================================="
echo ""
python3 -m http.server $PORT --directory "$(dirname "$0")"
