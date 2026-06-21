#!/bin/bash
# ======================================
# 一键部署脚本 - 基金分析平台
# 用法: bash deploy.sh
# ======================================

echo "=== 基金分析平台 部署工具 ==="
echo ""

# Check if git is configured
if ! git config --global user.name > /dev/null 2>&1; then
  echo "设置 Git 用户信息..."
  read -p "请输入你的 GitHub 用户名: " GIT_USER
  read -p "请输入你的 GitHub 邮箱: " GIT_EMAIL
  git config --global user.name "$GIT_USER"
  git config --global user.email "$GIT_EMAIL"
fi

# Ask for repo name
read -p "请输入 GitHub 仓库名称 (默认: fund-analyzer): " REPO_NAME
REPO_NAME=${REPO_NAME:-fund-analyzer}

echo ""
echo "=== 步骤 1: 初始化 Git 仓库 ==="
cd "$(dirname "$0")"
git init
git add -A
git commit -m "Initial commit: 基金分析平台"

echo ""
echo "=== 步骤 2: 推送到 GitHub ==="
echo "请先打开 https://github.com/new 创建一个新仓库"
echo "仓库名: $REPO_NAME"
echo "设置为 Public"
echo "不要勾选任何初始化选项"
read -p "创建完成后按回车继续..."

echo ""
echo "请输入你的 GitHub 仓库地址"
echo "(例如: https://github.com/你的用户名/$REPO_NAME.git)"
read -p "仓库地址: " REPO_URL

git remote add origin $REPO_URL
git push -u origin main

echo ""
echo "=== 步骤 3: 启用 GitHub Pages ==="
echo "请打开 https://github.com/$(git config --global user.name)/$REPO_NAME/settings/pages"
echo "在 Source 中选择: Deploy from branch"
echo "Branch 选择: main, 文件夹选择: / (root)"
echo "点击 Save"
echo ""
echo "等待 1-2 分钟后，你的网站就会在以下地址上线:"
echo "https://$(git config --global user.name).github.io/$REPO_NAME/"
echo ""
echo "=== 部署完成 ==="
