# 护眼Pet 🐾

> 一只住在你 Mac 桌面上的小宠物，每 20 分钟提醒你望远护眼。

---

## 功能

- **护眼提醒**：遵循 20-20-20 法则——每 20 分钟触发一次，全屏遮罩提示你望向 20 米外 20 秒
- **桌面常驻**：无边框透明窗口，始终置顶，可随意拖动位置
- **宠物动画**：睡觉时轻微浮动，休息提醒时点头动画
- **个性化**：自定义宠物图片（睡觉/休息两张）、顶栏图标、App 图标、问候语
- **系统托盘**：实时倒计时显示，暂停/继续、显示/隐藏宠物
- **多显示器**：休息遮罩覆盖所有连接的显示器

---

## 安装

### macOS（下载后）

如果 macOS 提示「护眼Pet 已损坏，无法打开」：

1. **方案 A - 快速绕过**：
   - 右键点击 **护眼Pet.app** → **打开**
   - 点击对话框中的「打开」按钮
   - macOS 会记住这个选择，以后可以直接打开

2. **方案 B - 终端命令**：
   ```bash
   sudo spctl --master-disable
   ```
   （这会临时关闭 Gatekeeper，打开 app 后用 `--master-enable` 重新开启）

3. **方案 C - 解压 ZIP**（推荐）：
   - 下载 **ZIP** 文件而不是 DMG
   - 解压后直接运行护眼Pet
   - 可能仍需要右键 → 打开的临时绕过方法

### 开发模式运行

```bash
npm install
npm run dev
```

### 构建与发布

本项目使用 **GitHub Actions** 进行自动化多平台构建。CI/CD 流水线会自动为 macOS、Windows 和 Linux 构建安装包。

#### 手动构建（推荐用于测试）

1. 访问 [GitHub Actions](https://github.com/mengbingchen0214/yourPetLovesYourEyes/actions/workflows/release.yml)
2. 点击 **"Run workflow"** → **"Run workflow"**
3. 等待构建完成（通常需要 10-15 分钟）
4. 从工作流运行记录中下载构建产物

#### 自动发布

推送新的版本标签以触发自动发布构建：

```bash
npm version patch  # 或 minor/major
git push --tags
```

这将创建一个新的 GitHub Release，包含所有平台的安装包：
- **macOS**: DMG 和 ZIP (ARM64 + x64)
- **Windows**: NSIS 安装包和便携版 EXE (x64)
- **Linux**: AppImage、DEB 和 RPM (x64)

#### 构建要求

- Node.js 22+
- pnpm 9+
- 平台特定构建在 GitHub 托管的运行器上执行：
  - macOS 构建: `macos-latest`
  - Windows 构建: `windows-latest`
  - Linux 构建: `ubuntu-latest`

---

## 使用说明

| 操作 | 效果 |
|---|---|
| 点击「开始护眼」 | 启动 20 分钟倒计时 |
| 拖动宠物 | 移动到任意位置 |
| `Cmd+Shift+E` | 显示 / 隐藏宠物窗口 |
| 右键托盘图标 | 暂停、个性化设置、支持开发者、退出 |

### 个性化（右键托盘 → 个性化）

- **更换20分钟宠物照**：主人工作状态显示的图片
- **更换20秒宠物照**：主人休息提醒时显示的图片
- **更换顶部图标**：菜单栏图标
- **更换App图标**：Dock 图标
- **修改问候语**：首次启动的欢迎语

---

## 支持开发者

如果您喜欢这个应用，可以通过支付宝扫码支持开发者继续维护和更新：

- 右键托盘图标 → **☕ 支持开发者**
- 建议金额：¥2.88
- 无需注册或激活码，扫码即可支持

感谢您的支持！❤️

---

## 文件结构

```
eye-pet/
├── main.js              # Electron 主进程（状态机、计时器、托盘）
├── preload.js           # 渲染进程 IPC 桥接
├── index.html           # 桌面宠物界面
├── overlay.html         # 休息提醒全屏遮罩
├── input-dialog.html    # 问候语输入弹窗
├── dialog-preload.js    # 弹窗 IPC 桥接
├── assets/              # 宠物图片资源
│   ├── angel.png        # 默认宠物图片
│   ├── angel-wakeup.png # 休息提醒图片
│   └── donation-qrcode.jpeg # 支付宝收款码
├── backend/             # 图片处理后端（可选，独立服务）
│   ├── server.py        # FastAPI：去背景 + Q版化处理
│   └── requirements.txt
├── web/                 # Netlify 落地页
│   └── index.html
├── build/               # 图标资源和打包配置
└── scripts/
    └── package.sh       # 打包脚本
```

---

## 后端图片处理（可选）

`backend/` 提供独立的 Python 服务，支持宠物照片去背景和 Q 版风格处理：

```bash
cd backend
pip install -r requirements.txt
python server.py
# 启动后访问 http://localhost:8765
```

接口：
- `POST /process-qversion`：去背景 + Q 版化，返回 base64 PNG
- `POST /remove-background`：仅去背景

---

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面端 | Electron 41 + HTML/CSS/JS |
| 图片处理后端 | Python + FastAPI + rembg + Pillow |
| 落地页 | 纯 HTML，部署于 Netlify |

---

## 系统要求

- macOS 12+
- 护眼提醒功能无需联网
- 所有功能完全免费，欢迎自愿捐赠支持开发
