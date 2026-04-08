[English](README.md) / 简体中文

# Browse Agent

一个浏览器自动化工具包，由 **Chrome 扩展** 和 **npm SDK** 组成，两者通过带认证的 WebSocket 通信。

## 架构

```
┌──────────────────┐     WebSocket (HMAC Auth)     ┌──────────────────┐
│   Your Node.js   │◄─────────────────────────────►│ Chrome Extension │
│   Application    │    Commands & Responses       │ (Service Worker) │
│  (browse-agent-  │                               │                  │
│       sdk)       │                               │  ┌───────────────┤
│                  │                               │  │ Content Script│
└──────────────────┘                               └──┴───────────────┘
                                                          │
                                                    ┌─────▼─────┐
                                                    │  Browser  │
                                                    │   Tabs    │
                                                    └───────────┘
```

## 功能

| 能力 | 方法 |
|---|---|
| 打开 URL 并获取内容 | `agent.navigate(url)` / `agent.getContent()` |
| 注入 JavaScript | `agent.injectScript(code)` / `agent.evaluate(expr)` |
| 注入 CSS | `agent.injectCSS(code)` |
| 查询 DOM | `agent.getDOM(selector)` |
| 全页面截图 | `agent.screenshotFullPage()` |
| 视口截图 | `agent.screenshotVisible()` |
| 区域截图 | `agent.screenshotArea({ x, y, width, height })` |
| 列出/关闭标签页 | `agent.listTabs()` / `agent.closeTab(id)` |

## 安全

SDK 与扩展之间使用 **HMAC-SHA256 双向认证**：

1. 服务端向扩展发送随机 challenge
2. 扩展使用共享密钥签名 challenge，并回传自己的 challenge
3. 服务端校验 HMAC 后，再对扩展 challenge 进行签名并确认
4. 扩展校验服务端签名，完成双向认证
5. 后续消息均附带 HMAC 签名和时间戳（防重放）

WebSocket 服务仅接受 `127.0.0.1` 连接。

## 项目结构

```
browse-agent/
├── .github/workflows/
│   └── release-extension-draft.yml  # 手动触发：构建并创建草稿发布
├── packages/
│   ├── shared/          # 共享类型、协议、HMAC 工具
│   ├── extension/       # Chrome MV3 扩展
│   │   └── build/       # 扩展构建产物（Chrome 中加载此目录）
│   └── sdk/             # Node.js npm SDK
├── examples/
│   └── basic-usage.mjs  # 使用示例
├── package.json         # Workspace 根配置
└── tsconfig.base.json
```

## 快速开始

### 构建

```bash
npm install
npm run build
```

### 加载 Chrome 扩展

1. 打开 Chrome -> `chrome://extensions/`
2. 开启右上角 Developer mode
3. 点击 Load unpacked
4. 选择 `packages/extension/build/` 目录

### 配置扩展

1. 点击工具栏中的 Browse Agent 扩展图标
2. 设置 **WebSocket URL**: `ws://127.0.0.1:9315`（默认）
3. 设置 **Shared Secret**: 与 SDK 一致的密钥
4. 点击 **Save**

### 使用 SDK

```typescript
import { BrowserAgent } from 'browse-agent-sdk';

const agent = new BrowserAgent({
  secret: 'same-secret-as-extension',
  port: 9315,
});

await agent.start();
await agent.waitForConnection();

const result = await agent.navigate('https://example.com');
console.log(result.title);

await agent.stop();
```

### 运行示例

```bash
node examples/basic-usage.mjs
```

## Browse Agent Skill

你可以在任意支持读取当前工作区本地 Skills 的 AI 助手中调用 `skills/browse-agent`，让 Agent 访问网页、提取数据、查询 DOM 或截图。

1. 在当前仓库打开你的 AI 助手或导入 `skills/browse-agent` 作为 Skill 模块
   - 确保助手支持本地 Skill（例如 AgentGPT、LangSmith、LangAgent 等）
   - 或确保当前工作区是本项目，这样助手才能发现本地 Skill。

2. 触发 Skill 可以用两种方式（具体取决于助手界面）：

  - Slash 命令方式：`/browse-agent <你的任务描述>`
  - 自然语言方式：直接描述网页浏览任务（例如“访问某个 URL 并提取正文”）

  示例提示词：

  - `/browse-agent 访问 https://example.com 并返回标题和正文`
  - `打开 https://news.ycombinator.com，提取前 10 条标题`
  - `对 https://example.com 做整页截图并保存`

3. 查看返回结果

  Skill 会按你的任务返回结构化结果（例如 `title`、`url`、`content`、截图信息、DOM 查询结果等）。

> [!NOTE] 初始化
> 首次使用时，Skill 流程会自动完成依赖准备。  
> 如果你的环境阻止该步骤或自动初始化失败，再手动执行以下兜底命令：`node skills/browse-agent/scripts/setup.mjs`  
> 该命令会安装 `browse-agent-sdk`，并将扩展下载到 `.browse-agent/extension/`。  

## API 参考

### `BrowserAgent(options)`

| 参数 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `secret` | `string` | *必填* | 共享 HMAC 密钥 |
| `port` | `number` | `9315` | WebSocket 服务端口 |
| `host` | `string` | `127.0.0.1` | WebSocket 服务地址 |
| `timeout` | `number` | `30000` | 默认命令超时（ms） |

### 导航

- `navigate(url, options?)`：在新标签页打开 URL
- `getContent(options?)`：获取页面 HTML 或文本
- `listTabs()`：列出所有打开的标签页
- `closeTab(tabId)`：关闭指定标签页

### 注入

- `injectScript(code, tabId?)`：在页面中执行 JavaScript
- `injectCSS(code, tabId?)`：向页面注入 CSS
- `evaluate(expression, tabId?)`：执行表达式并返回结果
- `getDOM(selector, options?)`：按 CSS 选择器查询 DOM

### 截图

- `screenshotFullPage(options?)`：截取整个滚动页面
- `screenshotVisible(options?)`：截取当前视口
- `screenshotArea(clip, options?)`：截取指定区域
- `screenshot(options)`：通用截图接口

## 开发

```bash
# 扩展监听模式
npm run dev:extension

# 构建全部
npm run build

# 按包构建
npm run build:shared
npm run build:sdk
npm run build:extension

# 清理 packages/* 下的 dist 目录
npm run clean

# 清理扩展 build 目录
npm run clean -w packages/extension
```

