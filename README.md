# opencode-trigger-panel

OpenCode 关键词触发器：**Skill + TUI 可视化配置面板**。

输入关键词自动加载对应 Skill，侧边栏面板可视化增删改查触发规则。

## 功能

- **keyword-trigger skill**：AI 驱动的关键词匹配，自动加载对应 Skill
- **TUI 侧边栏面板**：实时展示触发规则，斜杠命令增删改查
- **多对多映射**：一个关键词可触发多个 Skill，一个 Skill 可被多个关键词触发
- **匹配声明**：命中关键词时回复开头显示 `🎯 关键词匹配: [xxx] → skill-name`
- 自动发现可用 Skill（全局 / superpowers / 项目级 / Claude 兼容目录）
- Morandi 风格主题自适应，中英文自动检测

## 截图

```
┌──────────────────────────────────┐
│ ▼ 🎯 关键词触发器 (3)             │
│ ──────────────────────────────── │
│ [审核] [方案]                    │
│   → brainstorming                │
│   → grill-me                     │
│ ──────────────────────────────── │
│ [debug] [调试] [bug]             │
│   → chrome-devtools              │
│   → systematic-debugging         │
│ ──────────────────────────────── │
│ 💡 /trigger-add · /trigger-edit  │
└──────────────────────────────────┘
```

## 安装

### 方式一：从 GitHub 克隆（推荐）

```bash
git clone https://github.com/<your-username>/opencode-trigger-panel.git
cd opencode-trigger-panel
npm install
node install.mjs
```

`install.mjs` 会自动完成：
1. 复制 `skill/` 到 `~/.config/opencode/skills/keyword-trigger/`
2. 注册 TUI 插件到 `tui.json`（通过 `file://` 引用源码，Bun 运行时自动转译）
3. 保留你已有的 `triggers.json` 配置（仅首次复制示例）

### 方式二：手动安装

```bash
# 1. 复制 skill 文件
cp -r skill/ ~/.config/opencode/skills/keyword-trigger/

# 2. 编辑 ~/.config/opencode/tui.json，添加插件引用
```

```json
{
  "plugin": [
    "file:///absolute/path/to/opencode-trigger-panel/src/index.tsx"
  ]
}
```

### 重启 OpenCode

进入任意 session，侧边栏即可看到「🎯 关键词触发器」面板。

## 斜杠命令

| 命令 | 功能 |
|------|------|
| `/trigger-config` | 显示/隐藏侧边栏面板 |
| `/trigger-add` | 添加规则：输入关键词 → 多选 Skills → 保存 |
| `/trigger-edit` | 编辑规则：选择规则 → 修改关键词/Skills → 保存 |
| `/trigger-remove` | 删除规则：选择 → 确认 → 删除 |
| `/trigger-list` | 查看所有规则 |

## triggers.json 格式

配置文件路径：`~/.config/opencode/skills/keyword-trigger/triggers.json`

```json
{
  "triggers": [
    {
      "keywords": ["审核", "方案"],
      "skills": ["brainstorming", "grill-me"]
    },
    {
      "keywords": ["debug", "调试", "bug"],
      "skills": ["chrome-devtools", "systematic-debugging"]
    }
  ]
}
```

匹配规则：用户输入**包含**任意关键词即触发（大小写不敏感，子字符串匹配）。

## 项目结构

```
opencode-trigger-panel/
├── skill/              # keyword-trigger skill
│   ├── SKILL.md        # skill 定义（AI 读取并执行）
│   └── triggers.json   # 示例配置
├── src/                # TUI 插件源码
│   ├── index.tsx       # 插件入口
│   ├── panel.tsx       # 侧边栏面板组件
│   ├── dialogs.tsx     # 增删改对话框
│   ├── triggers.ts     # 文件 I/O
│   ├── skills.ts       # skill 发现
│   ├── i18n.ts         # 中英文
│   └── theme.ts        # 主题色
├── install.mjs         # 一键安装脚本
├── package.json
└── tsconfig.json
```

## 开发

```bash
npm install
npm run typecheck    # 类型检查
npm run build        # 编译到 dist/（npm 发布用）
```

本地开发无需编译，直接编辑 `src/*.tsx`，重启 opencode 即可生效。

## 技术栈

- TypeScript + SolidJS (`@opentui/solid`)
- OpenCode TUI Plugin API (`@opencode-ai/plugin/tui`)
- Morandi 色彩降饱和算法（参考 opencode-visual-cache）

## License

MIT
