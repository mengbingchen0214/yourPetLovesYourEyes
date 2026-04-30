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

### 开发模式运行

```bash
npm install
npm run dev
```

### 打包

```bash
npm run build
# 输出到 dist/
```

---

## 使用说明

| 操作 | 效果 |
|---|---|
| 点击「开始护眼」 | 启动 20 分钟倒计时 |
| 拖动宠物 | 移动到任意位置 |
| `Cmd+Shift+E` | 显示 / 隐藏宠物窗口 |
| 右键托盘图标 | 暂停、个性化设置、退出 |

### 个性化（右键托盘 → 个性化）

- **更换20分钟宠物照**：主人工作状态显示的图片
- **更换20秒宠物照**：主人休息提醒时显示的图片
- **更换顶部图标**：菜单栏图标
- **更换App图标**：Dock 图标
- **修改问候语**：首次启动的欢迎语

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
