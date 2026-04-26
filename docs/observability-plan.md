# 前端可观测性接点说明

这份文档用于指导前端层面的关键交互日志预留，不包含外部分析平台，也不要求接第三方 telemetry。目标只是让前端在和后端联调、排错、回归测试时有明确的结构化事件位。

## 总原则

- 关键写操作必须有 `before` 和 `after`
- 关键失败必须有 `failure`
- 日志字段必须结构化，不用大段自然语言
- 前端只记录最小必要上下文，不记录敏感信息

## 公共字段

前端关键事件统一带这些字段：

- `trace_id`
- `session_id`
- `device_id`
- `route`
- `action`
- `result`
- `timestamp`

按页面再补：

- `deck_id`
- `card_id`
- `batch_id`
- `pair_code_id`

## 学习流程

### 创建学习 session

- `session.start.before`
- `session.start.after`
- `session.start.failure`

Before 字段：

- `deck_scope`
- `selected_deck_ids`
- `route`

After 字段：

- `session_id`
- `queue_counts`
- `result`

### 展示卡片

- `session.card.show`

字段：

- `session_id`
- `card_id`
- `position`
- `queue_remaining`

### 翻卡

- `session.card.flip.before`
- `session.card.flip.after`

Before 字段：

- `session_id`
- `card_id`
- `is_flipped: false`

After 字段：

- `session_id`
- `card_id`
- `is_flipped: true`

### 提交评分

- `review.submit.before`
- `review.submit.after`
- `review.submit.failure`

Before 字段：

- `session_id`
- `card_id`
- `rating`
- `route`

After 字段：

- `session_id`
- `card_id`
- `rating`
- `next_due_preview`
- `result`

Failure 字段：

- `session_id`
- `card_id`
- `rating`
- `stage`
- `message`

### 结束学习

- `session.complete.before`
- `session.complete.after`

Before 字段：

- `session_id`
- `completed_count`
- `remaining_count`

After 字段：

- `session_id`
- `completed_count`
- `route_to`
- `result`

## CSV 导入

### 批次开始

- `import.csv.batch.start`

字段：

- `batch_id`
- `file_name`
- `route`

### 单行失败

- `import.csv.row.failure`

字段：

- `batch_id`
- `row_number`
- `error_code`
- `message`

### 批次完成

- `import.csv.batch.complete`

字段：

- `batch_id`
- `created_count`
- `failed_count`
- `result`

## 设备配对

### 发起配对

- `pair.device.start`

字段：

- `route`
- `device_id`
- `pair_code_id`

### 配对完成

- `pair.device.after`

字段：

- `device_id`
- `pair_code_id`
- `result`

### 配对失败

- `pair.device.failure`

字段：

- `device_id`
- `pair_code_id`
- `stage`
- `message`

## 建议的前端落点

建议后续在这些位置预留 logger 调用：

- `app/study/page.tsx` 的 session 创建提交点
- `app/study/session/page.tsx` 的翻卡和评分处理函数
- `app/import/page.tsx` 的上传、预览、导入提交点
- `app/pair/page.tsx` 的配对提交点
- 统一请求层或 action 层的失败处理逻辑

## 现在先不要做的事

- 不要接第三方埋点 SDK
- 不要把 UI 点击事件全都记录成噪音日志
- 不要把敏感数据直接打进日志
- 不要把前端日志和后端业务日志混成一个不分层的大对象
