#!/bin/bash
echo "========================================="
echo "  推送到 GitHub - 需要 Token"
echo "========================================="
echo ""
echo "请先在浏览器打开以下网址创建 Token："
echo "https://github.com/settings/tokens"
echo ""
echo "点击 Generate new token → Generate new token (classic)"
echo "Name: fund-analyzer"
echo "Scopes: 勾选 repo"
echo "点 Generate → 复制生成的 token"
echo "========================================="
echo ""
read -p "粘贴你的 Token 后按回车: " TOKEN
echo ""

cd /Users/zong/Documents/生成一个基金浏览网站
git remote set-url origin https://zongrui1996:$TOKEN@github.com/zongrui1996/fund-analyzer.git
git push -u origin main 2>&1

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 推送成功！"
    echo ""
    echo "下一步：打开浏览器"
    echo "https://github.com/zongrui1996/fund-analyzer/settings/pages"
    echo "在 Branch 选: main → /(root) → Save"
    echo ""
    echo "等2分钟，你的网站上线："
    echo "https://zongrui1996.github.io/fund-analyzer/"
    echo ""
    # Clean up token from remote URL
    git remote set-url origin https://github.com/zongrui1996/fund-analyzer.git
else
    echo ""
    echo "❌ 推送失败，检查 Token 是否正确"
fi
echo ""
read -p "按回车键退出..."
