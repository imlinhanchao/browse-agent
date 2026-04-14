# Browse Agent — Multi-Instance Control Server

基于 [browse-agent-sdk](../../packages/sdk) 构建的**多实例浏览器控制网站**，使用 Express + TypeORM (SQLite) 作为后端，Vue 3 + UnoCSS 作为前端。

---

## 功能

- 创建多个浏览器控制实例，每个实例独立 WebSocket 端口
- 名称和密钥均可随机生成
- 复制 WS 地址和密钥到 Browse Agent 扩展即可控制浏览器
- 控制页面访问需输入密钥进行身份验证
- 实时截图、标签页管理、导航、点击模拟、键盘输入等完整控制功能

## 快速开始

### 1. 构建 SDK（首次运行时需要）

在仓库根目录执行：

```bash
npm install
npm run build:shared
npm run build:sdk
```

### 2. 安装后端依赖

```bash
cd examples/multi-server
npm install
```

### 3. 安装并构建前端

```bash
npm run install:client
npm run build:client
```

### 4. 启动服务器

```bash
npm start
```

浏览器访问 [http://localhost:3000](http://localhost:3000)

### 开发模式（前后端分离热更新）

**终端 1**（后端）：
```bash
cd examples/multi-server
npm run dev
```

**终端 2**（前端，访问 http://localhost:5173，API 自动代理到后端）：
```bash
cd examples/multi-server/client
npm run dev
```

---

## 使用流程

1. 打开网站主页，点击「新建实例」
2. 填写实例名称和密钥（或点击 🎲 随机生成），点击「创建实例」
3. 复制实例的 **WS 地址**（如 `ws://your-server:9400`）和 **密钥**
4. 在 Chrome 安装 Browse Agent 扩展，将 WS 地址和密钥粘贴进扩展
5. 扩展连接成功后，实例状态指示灯变为绿色
6. 点击实例卡片上的「控制」按钮，输入密钥进入控制页面
7. 控制页面支持：截图、导航、点击、滚动、键盘输入等

---

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `HTTP_PORT` | `3000` | HTTP 服务端口 |

WebSocket 端口从 **9400** 开始自动分配，每个实例独占一个端口。

---

## 目录结构

```
multi-server/
├── src/
│   ├── index.ts          # Express 入口
│   ├── data-source.ts    # TypeORM / SQLite 配置
│   ├── manager.ts        # BrowserAgent 实例管理器
│   ├── entities/
│   │   └── Instance.ts   # 实例数据模型
│   └── routes/
│       ├── instances.ts  # 实例 CRUD API
│       └── control.ts    # 浏览器控制 API（需密钥验证）
├── client/               # Vue 3 + UnoCSS 前端
│   ├── src/
│   │   ├── pages/
│   │   │   ├── HomePage.vue    # 实例列表与创建
│   │   │   └── ControlPage.vue # 浏览器控制面板
│   │   └── components/
│   │       ├── InstanceCard.vue
│   │       └── CreateModal.vue
│   └── ...
└── data/                 # SQLite 数据库（运行时生成）
```
