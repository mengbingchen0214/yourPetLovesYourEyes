#!/bin/bash

DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="护眼Pet.app"
APP_SRC="$DIR/$APP_NAME"
APP_DEST="/Applications/$APP_NAME"

echo ""
echo "=============================="
echo "  护眼Pet 安装程序"
echo "=============================="
echo ""

if [ ! -d "$APP_SRC" ]; then
  echo "错误：找不到 $APP_NAME"
  echo "请确保「$APP_NAME」和本安装程序在同一个文件夹内"
  echo ""
  read -p "按回车键退出..."
  exit 1
fi

echo "正在安装，请稍候..."

if [ -d "$APP_DEST" ]; then
  rm -rf "$APP_DEST"
fi

cp -r "$APP_SRC" "$APP_DEST"
xattr -dr com.apple.quarantine "$APP_DEST" 2>/dev/null

echo ""
echo "安装成功！"
echo "请打开 Applications（应用程序）文件夹，双击「护眼Pet」启动"
echo ""
read -p "按回车键退出..."
