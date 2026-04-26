# 手动标记易混词功能设计文档

## 1. 功能概述

当前易混词页面（`/confusions`）完全依赖系统自动生成：根据低评分记录和拼写相似度自动发现容易记串的词对。

本功能允许用户**主动标记**任意卡片之间的易混关系，支持两种入口：
1. **单张卡片配对**：在牌组详情页点击某张卡片的"标记易混"，在多选弹窗中勾选多张卡片作为易混目标
2. **批量选择**：在牌组详情页进入批量选择模式，勾选多张卡片后一键创建易混分组

两种入口最终都走同一套"星型配对"逻辑：以主卡片为中心，其余选中的卡片作为 confusions。

## 2. 用户流程

### 2.1 单张卡片配对

1. 用户进入 `/decks/detail?deckId=xxx`
2. 在某张卡片（如 skull）上点击"🔗 标记易混"
3. 弹出卡片选择器弹窗（CardSelector）
4. 弹窗顶部有搜索框，可搜索**全部已学卡片**（跨牌组），支持按 front / phonetic / meaning 实时过滤
5. 弹窗内显示搜索结果，支持 checkbox 多选
6. 用户勾选 skill、skulk，点击"确认标记"
7. 系统调用 `createManualConfusionGroup`，以 skull 为主卡片，skill/skulk 为 confusions
8. 创建成功后，弹窗关闭，页面 toast 提示"已创建易混分组"

### 2.2 批量选择

1. 用户进入 `/decks/detail?deckId=xxx`
2. 页面顶部出现"批量选择"按钮
3. 点击后进入选择模式：每张卡片左侧出现 checkbox，同时顶部出现搜索框，可按 front / phonetic 过滤当前牌组卡片
4. 用户勾选 skull、skill、skulk
5. 底部出现浮动操作栏，显示"已选择 3 张"
6. 点击"标记为易混"按钮
7. 系统调用 `createManualConfusionGroup`，以 skull（第一张选中）为主卡片，skill/skulk 为 confusions
8. 底部栏显示"已创建"，2 秒后自动退出选择模式

### 2.3 查看手动标记的易混词

1. 用户进入 `/confusions`
2. 页面顶部有两个标签页："自动发现" / "手动标记"
3. 默认显示"自动发现"（现有逻辑）
4. 切换到"手动标记"后，展示用户手动创建的所有易混分组
5. 展示方式与自动发现**完全一致**：左右两栏 diff 对比、相似度 badge、展开/收起动画
6. 手动标记的分组右上角 badge 显示"👤 手动标记"，而非"⚠️ X 次低评分"

## 3. 数据结构

### 3.1 类型变更

```ts
// lib/types.ts

export interface ConfusionGroup {
  cardId: string;
  front: string;
  back: string;
  deckName: string;
  lowRatingCount: number;
  lastReviewedAt: string | null;
  source: "auto" | "manual";        // 新增字段
  confusions: ConfusionCandidate[];
}
```

- `source` 默认值为 `"auto"`，兼容现有数据
- 手动标记时：`source = "manual"`, `lowRatingCount = 0`, `lastReviewedAt = null`

### 3.2 新增 API

```ts
// lib/data-service.ts

/**
 * 创建手动易混分组
 * @param sourceCardId 主卡片 ID
 * @param targetCardIds 易混目标卡片 ID 数组
 */
export async function createManualConfusionGroup(
  sourceCardId: string,
  targetCardIds: string[],
): Promise<{ groupId: string }>;

/**
 * 获取手动标记的易混分组列表
 */
export async function getManualConfusionGroups(): Promise<ConfusionGroup[]>;
```

## 4. UI/UX 设计

### 4.1 牌组详情页（deck detail）

**单张标记入口**：
- 每张卡片右上角（状态 badge 旁边）增加一个幽灵按钮"🔗 标记易混"
- 按钮样式：`variant="ghost" size="sm" className="text-primary"`

**批量选择模式**：
- 页面标题行右侧增加"批量选择"按钮
- 点击后：
  - 每张卡片左侧出现 `18px` 圆形 checkbox
  - 卡片 hover 状态增加选中态边框
  - 底部出现固定浮动栏（`fixed bottom-4 left-4 right-4 md:absolute`）
  - 浮动栏显示"已选择 N 张" + "标记为易混"主按钮 + "取消"次按钮
- 选中 < 2 张时，"标记为易混"按钮 disabled，tooltip 提示"请至少选择 2 张卡片"

### 4.2 卡片选择器弹窗（CardSelector）

**新建组件** `components/ui/CardSelector.tsx`：
- Modal 弹窗，标题为"选择易混卡片"
- 顶部搜索框，搜索范围是**全部已学卡片（跨牌组）**，支持按 front / phonetic / meaning 实时过滤
- 下方是卡片列表，每项显示：`front` + `phonetic` + `meanings[0]`，并在右侧标注所属牌组名
- 每项左侧有 checkbox，支持多选
- 底部显示"已选择 N 张" + "确认"按钮
- 触发来源的主卡片本身从列表中排除（避免自己和自己配对）
- 确认后返回选中的 `cardId[]` 给调用方

### 4.3 易混词页面（confusions）

**标签页切换**：
- 在标题"易混词"下方增加分段控制器（segmented control）
- 两个选项："自动发现"（默认）/ "手动标记"
- 切换时数据重新加载，展示对应 source 的分组
- 空状态："还没有手动标记的易混词。去牌组详情页选择几张相似卡片试试吧。"

**手动标记分组展示**：
- 复用现有 `ConfusionGroup` 的渲染逻辑
- 主卡片右上角的 badge 改为：
  ```tsx
  <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
    👤 手动标记
  </span>
  ```
- 展开后每个 candidate 的 diff 对比、相似度 badge 与自动发现完全一致

## 5. 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `lib/types.ts` | 修改 | `ConfusionGroup` 增加 `source` 字段 |
| `lib/data-service.ts` | 修改 | 新增 `createManualConfusionGroup`、`getManualConfusionGroups` |
| `app/decks/detail/page.tsx` | 修改 | 增加单张标记入口、批量选择模式、浮动操作栏 |
| `app/confusions/page.tsx` | 修改 | 增加 Tab 切换、手动标记展示、空状态 |
| `components/ui/CardSelector.tsx` | **新建** | 卡片多选弹窗组件 |

## 6. 数据持久化

- 手动标记的易混关系通过现有 CloudBase 存储层持久化
- 建议在后端数据库中新增 `manual_confusions` 集合（或表），结构与 `confusion_groups` 一致，但增加 `source: "manual"`
- 查询时，`getConfusionPageData` 返回 `source = "auto"` 的数据；`getManualConfusionGroups` 返回 `source = "manual"` 的数据
- 前端合并展示由 `/confusions` 页面根据当前激活的 Tab 决定调用哪个 API
