#!/bin/bash
echo "=== 基金数据自动刷新 - 安装工具 ==="
echo ""

# Install launchd job
PLIST="$HOME/Library/LaunchAgents/com.fundanalyzer.refresh.plist"
cp "/Users/zong/Documents/生成一个基金浏览网站/scripts/com.fundanalyzer.refresh.plist" "$PLIST"
launchctl load "$PLIST"
echo "✓ 自动刷新已安装（每个交易日 9:00 AM 运行）"
echo ""

# Test run
echo "是否立即运行一次测试刷新？（y/n）"
read -r ans
if [ "$ans" = "y" ]; then
    echo "正在运行测试（约5-10秒）..."
    python3 "/Users/zong/Documents/生成一个基金浏览网站/scripts/refresh_data.py"
    echo "✓ 测试完成"
fi
echo ""
echo "查看日志: cat /Users/zong/Documents/生成一个基金浏览网站/scripts/refresh.log"
echo "手动刷新: python3 /Users/zong/Documents/生成一个基金浏览网站/scripts/refresh_data.py"
echo "刷新周历史: python3 /Users/zong/Documents/生成一个基金浏览网站/scripts/refresh_nav.py"
