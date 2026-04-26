# Animal Farm Flashcards

一个基于艾宾浩斯遗忘曲线的英语词汇闪卡记忆工具。

**在线体验**: https://animal-farm-vocab.pages.dev

## 背景

这个项目的起点很简单：读完 *Animal Farm* 之后，想把里面的生词记住。

市面上的背单词 App 要么太重，要么不够灵活，更离谱的是appstore里面的记忆单词的软件居然需要25美刀。于是自己写了一个。最初打算做成商业化产品，但在支付系统对接上遇到了不少问题，索性开源出来，给有同样需求的人用。

如果你也有看完英文书后想巩固词汇的需求，这个工具或许适合你。觉得不错的话，欢迎通过微信公众号「**柴可饭前闲谈**」交流。

## 功能

| 功能 | 说明 |
|------|------|
| 闪卡复习 | 英文单词、中文释义、音标、例句一屏展示，支持 TTS 朗读 |
| 间隔重复 | 基于艾宾浩斯遗忘曲线，7 个复习阶段：10 分钟 → 1 天 → 2 天 → 4 天 → 7 天 → 15 天 → 30 天 |
| 易混词辨析 | 自动检测拼写/发音相似的词汇，支持手动标记，逐字符 diff 高亮 |
| CSV 批量导入 | 支持上传文件或粘贴文本，自动去重，自动创建牌组 |
| 学习统计 | 7 日复习量、正确率、学习时长、弱点卡片排行 |
| 牌组管理 | 创建牌组、添加卡片、搜索过滤、批量操作 |
| 今日回看 | 正式学习后可回看当天学过的卡，不影响复习计划 |
| 主题切换 | 跟随系统 / 白天模式 / 黑夜模式 |
| 语音朗读 | 浏览器内置 TTS，支持慢速 / 正常 / 快速三档语速 |
| PWA 支持 | 可添加到手机主屏幕，支持离线访问 |
| 设备隔离 | 每个浏览器自动分配独立数据空间，无需登录 |

## 快速开始

```bash
git clone https://github.com/TinLim7/flashcard.git
cd flashcard
npm install
npm run dev
```

打开 http://localhost:3000，即可使用。默认为 mock 数据模式，所有数据存储在浏览器本地，无需任何后端配置。

## CSV 导入

### 导入入口

首页点击「导入词库」，或进入 `/import` 页面。

### CSV 格式

**带表头（推荐）：**

```csv
front_text,back_text,phonetic,example_text,note,deck_name
ubiquitous,adj. 普遍存在的,/juːˈbɪkwɪtəs/,Coffee shops are ubiquitous in the city.,,Animal Farm 词库
ephemeral,adj. 短暂的,/ɪˈfemərəl/,Fame can be ephemeral.,,Animal Farm 词库
serendipity,n. 机缘巧合,/ˌserənˈdɪpəti/,Their reunion felt like serendipity.,,Animal Farm 词库
```

**无表头（简单格式）：**

```csv
ubiquitous,adj. 普遍存在的,Coffee shops are ubiquitous in the city.
ephemeral,adj. 短暂的,Fame can be ephemeral.
```

无表头时按位置解析：第 1 列为英文单词，第 2 列为释义，第 3 列为例句。需要在页面上填写默认牌组名。

### 字段说明

| 字段 | 必填 | 说明 |
|------|------|------|
| `front_text` | 是 | 英文单词或短语 |
| `back_text` | 是 | 中文释义 |
| `phonetic` | 否 | 音标，如 `/juːˈbɪkwɪtəs/` |
| `example_text` | 否 | 例句 |
| `note` | 否 | 备注，支持结构化格式：`句子意思：...｜句中义：...｜出处：...` |
| `deck_name` | 否 | 牌组名称，不存在则自动创建 |

### 导入规则

- 按 `牌组名 + 单词 + 释义` 组合去重，跳过已存在的卡片
- 同一文件内的重复行也会被跳过
- 导入完成后显示成功数量和失败详情

### 下载模板

导入页面提供「下载模板」按钮，可获取带示例数据的 CSV 模板文件。

### 用 AI 生成词库

手动整理单词太慢？可以把不会的单词丢给 AI，让它帮你生成标准格式的 CSV。

**提示词示例：**

```
我把以下单词整理成了列表，请帮我生成一个 CSV 文件，包含以下列：
front_text, back_text, phonetic, example_text, note, deck_name

要求：
- back_text 用中文释义，标注词性
- phonetic 用国际音标
- example_text 给一个地道的英文例句
- note 里写句子意思、句中义、出处（如果是书里的句子）
- deck_name 统一设为 "Animal Farm 词库"

单词列表：
ubiquitous
ephemeral
serendipity
tyranny
allegory
```

**推荐工具：** ChatGPT、Claude、Kimi、DeepSeek 等支持长文本的 AI 都可以。生成后直接复制 CSV 内容粘贴到导入页面即可。

## 学习流程

### 1. 进入学习

在 `/study` 页面选择学习范围（全部牌组或指定牌组），点击「开始学习」。

系统优先安排到期复习卡片；只有当复习清空后，才会引入新词（每日上限 25 张）。

### 2. 翻卡评分

- 点击卡片或按 `Space` 键翻转
- 翻转后看到释义、例句、备注
- 选择评分：
  - **1 - 完全不会**：当天重新排入队列（约 4 张卡后再次出现）
  - **2 - 有点印象**：当天重新排入队列（约 8 张卡后再次出现）
  - **3 - 认识**：进入下一个复习阶段
  - **4 - 很熟**：进入更长的复习间隔
- 快捷键：`1` `2` `3` `4` 对应四个评分

### 3. 完成学习

学习完成后显示本次摘要（学习总数、新词数、复习数），并自动检测新学词汇中的易混词。

### 4. 今日回看

正式学习完成后，可选择「回看今天学过的卡」，重新练习当天的内容，不影响正式复习计划。

## 易混词

### 自动发现

每次学习完成后，系统自动分析新学的卡片，从三个维度检测易混词：

| 维度 | 权重 | 方法 |
|------|------|------|
| 拼写相似度 | 50% | 编辑距离（Levenshtein） |
| 发音相似度 | 30% | 辅音骨架 LCS |
| 释义相似度 | 20% | 关键词 Jaccard 系数 |

综合得分 ≥ 0.65 且至少两个维度 > 0.5 时，判定为易混词。

### 手动标记

- 在牌组详情页批量选择卡片 →「标记为易混」
- 在学习翻卡页面点击「标记易混」按钮
- 在易混词页面点击「新建手动分组」

## 部署到 Cloudflare Pages

### 1. 创建 D1 数据库

```bash
npx wrangler d1 create your-database-name
```

将返回的 `database_id` 填入 `wrangler.toml`。

### 2. 执行数据库迁移

```bash
npx wrangler d1 migrations apply your-database-name --remote
```

### 3. 构建并部署

```bash
npm run deploy:cloudflare
```

首次部署后，在 Cloudflare Pages 项目设置中添加环境变量：

| 变量 | 值 |
|------|------|
| `NEXT_PUBLIC_DATA_MODE` | `cloudflare` |

## 项目结构

```
├── app/                    # Next.js 页面
│   ├── app/                # 首页（学习仪表盘）
│   ├── study/              # 学习入口、学习中、学习完成
│   ├── decks/              # 牌组列表、详情、新建、添加卡片
│   ├── import/             # CSV 导入
│   ├── confusions/         # 易混词管理
│   ├── stats/              # 学习统计
│   ├── settings/           # 设置
│   └── landing/            # 宣传页
├── components/             # UI 组件
├── functions/api/          # Cloudflare Pages Functions（后端）
├── lib/                    # 工具函数、数据服务、类型定义
├── migrations/             # D1 数据库迁移
├── public/                 # 静态资源、PWA 配置
└── wrangler.toml           # Cloudflare 配置
```

## 技术栈

- **前端**: Next.js 15 + React 19 + TypeScript
- **样式**: Tailwind CSS
- **动画**: Framer Motion
- **后端**: Cloudflare Pages Functions + D1 (SQLite)
- **部署**: Cloudflare Pages（静态导出）
- **PWA**: Service Worker + Manifest

## 开源协议

MIT
