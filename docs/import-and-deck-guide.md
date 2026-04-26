# 导入 CSV 与创建牌组说明

这份说明对应当前 `前端/整理版` 里的实际实现规则，不是理想设计稿。

## 1. 如何创建牌组

入口：
- 打开 [新建牌组页](/Users/jinyulin/Desktop/英语词汇记忆开发 animal farm/前端/整理版/app/decks/new/page.tsx)

当前支持这 3 个字段：

1. `name`
- 必填
- 不能为空
- 这是牌组名称

2. `description`
- 选填
- 用来说明这个牌组适合什么学习场景

3. `tags`
- 选填
- 在页面里用英文逗号 `,` 分隔
- 例如：`精读,文学,高频词`

当前创建牌组时，真正必须有的只有：
- `name`

---

## 2. 如何导入 CSV

入口：
- 打开 [导入页](/Users/jinyulin/Desktop/英语词汇记忆开发 animal farm/前端/整理版/app/import/page.tsx)

当前有两种导入方式：

1. 直接选择本地 `.csv` 文件
- 点击“选择 CSV 文件”
- 页面会自动把内容读进预览框

2. 直接把 CSV 内容粘贴到文本框
- 适合快速试验小批量数据

导入前最好填这两个值：

1. `文件名`
- 用来记录本次导入批次

2. `默认牌组名`
- 当 CSV 里没有 `deck_name` 列时，会用这个名字创建或归入牌组

---

## 3. CSV 支持的格式

当前支持两种格式。

### 格式 A：无表头简化格式

每行 3 列：

```csv
front,back,example
ubiquitous,adj. 普遍存在的,Coffee shops are ubiquitous in the city.
ephemeral,adj. 短暂的,Fame can be ephemeral.
```

对应关系：
- 第 1 列：`front`
- 第 2 列：`back`
- 第 3 列：`example`

这种格式下：
- 不支持单独写 `phonetic`
- 不支持单独写 `note`
- 不支持单独写 `deck_name`
- 牌组会使用“默认牌组名”

### 格式 B：带表头完整格式

支持这些列名：

```csv
front_text,back_text,phonetic,example_text,note,deck_name
```

示例：

```csv
front_text,back_text,phonetic,example_text,note,deck_name
ubiquitous,adj. 普遍存在的,/juːˈbɪkwɪtəs/,Coffee shops are ubiquitous in the city.,,Animal Farm 导入词库
ephemeral,adj. 短暂的,/ɪˈfemərəl/,Fame can be ephemeral.,常见于文学语境,Animal Farm 导入词库
```

其中：
- `front_text`：必填
- `back_text`：必填
- `phonetic`：选填
- `example_text`：选填
- `note`：选填
- `deck_name`：选填

---

## 4. 当前导入规则

导入时当前会做这些校验：

1. 必填字段校验
- `front_text` 和 `back_text` 不能为空

2. 表头校验
- 如果你用了表头，表头必须是系统支持的列名
- 不支持额外乱写列名

3. 批次内重复校验
- 同一次 CSV 导入里，重复词条会被拦下

4. 已有词条重复校验
- 如果目标牌组里已经有同样的词条，会跳过并报失败行

当前重复判断的依据是：
- `deck_name + front + back`

---

## 5. 导入成功后会发生什么

导入成功后：

1. 如果目标牌组不存在
- 系统会自动创建牌组

2. 每条成功导入的卡片
- 会创建一张新卡
- 初始状态为 `new`

3. 页面右侧会显示本次批次结果
- 成功创建数量
- 失败行数
- 每一行失败原因

---

## 6. 最容易踩的坑

1. 表头拼错
- 例如写成 `front`、`back`，但又同时声明自己是表头格式
- 这种情况会被当成非法表头

2. 忘了填 `默认牌组名`
- 如果你的 CSV 又没有 `deck_name` 列，系统会回退到默认名字

3. 同一张卡重复导入
- 当前会被识别为重复并跳过

4. 逗号分隔过于复杂
- 当前解析是简化版，不适合带很多引号嵌套、逗号转义特别复杂的 CSV
- 如果你的内容很复杂，建议先用简单文本做第一版导入

---

## 7. 推荐最稳妥的模板

如果你想最少踩坑，建议直接用这个格式：

```csv
front_text,back_text,phonetic,example_text,note,deck_name
ubiquitous,adj. 普遍存在的,/juːˈbɪkwɪtəs/,Coffee shops are ubiquitous in the city.,,Animal Farm 导入词库
ephemeral,adj. 短暂的,/ɪˈfemərəl/,Fame can be ephemeral.,,Animal Farm 导入词库
serendipity,n. 机缘巧合,/ˌserənˈdɪpəti/,Their reunion felt like serendipity.,,Animal Farm 导入词库
```
