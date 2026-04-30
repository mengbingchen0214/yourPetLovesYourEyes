#!/bin/bash
set -e

# 找到构建输出目录
if [ -d "dist/mac-arm64" ]; then
  OUT="dist/mac-arm64"
else
  OUT="dist/mac"
fi

APP="$OUT/护眼Pet.app"
CMD="安装护眼Pet.command"
README="安装说明.txt"
ZIP="dist/护眼Pet-Mac.zip"

# 去除隔离标记
xattr -cr "$APP" 2>/dev/null || true

# 复制安装脚本
cp "$CMD" "$OUT/"
cp "$README" "$OUT/"

# 打包 zip
rm -f "$ZIP"
cd "$OUT"
zip -r "../../$ZIP" "护眼Pet.app" "安装护眼Pet.command" "安装说明.txt"
cd ../..

echo ""
echo "打包完成：$ZIP"
