# 周一升旗检查模块 实施方案

依据：`docs/superpowers/specs/2026-09-21-monday-flag-inspection-design.md`

运行测试：`npm test`（bundled Node）。
本地预览：`npm run serve` 后开 `http://localhost:5173`。

## 任务 1 模块定义与操场归属

新增 `js/modules.js`：

- `MODULES`：`daily`、`flag` 两个模块的定义（标签、扣分项、是否按操场分组、位置类型）
- `FLAG_REASONS`：红领巾、校服、黑鞋子、迟到或逗留班级、其他情况（需备注）
- `groundForGrade(grade)`：一年级/四年级 → 金轮操场，二年级/三年级 → 玉兔操场

新增 `tests/modules.test.mjs` 覆盖操场归属与扣分项编码唯一性。

## 任务 2 日期工具

新增 `js/dates.js`：

- `lastMondayIso(from)`：返回不晚于 `from` 的最近一个周一（`from` 为周一时返回当天）
- `formatChipDate(date)`：把 `YYYY-MM-DD` 转成 `M月D日`

新增 `tests/dates.test.mjs`，覆盖周一当天、周二、周日三种边界。

## 任务 3 记录模型支持学号与模块

修改 `js/records.js`：

- `normalizeRecord` 增加 `module`（缺省 `daily`）与 `studentNos`（缺省 `[]`）
- 新增 `parseStudentNos(raw)`：接受空格、逗号、顿号、分号分隔，去重、数值升序、最多 20 个、逐项 1–3 位数字
- 新增 `defaultPointsFor(studentNos)`：有学号时等于个数，否则 1
- `validateDraft` 按 `module` 分支：`flag` 模块校验升旗扣分项与学号；`daily` 模块行为不变

扩展 `tests/records.test.mjs`：旧数据兼容、学号解析、flag 校验、非法学号报错。

## 任务 4 升旗汇总

修改 `js/summary.js`：

- `summarize(records, date, moduleId)` 增加模块过滤，默认 `daily` 保持兼容
- 新增 `summarizeFlag(records, date)`：按操场、班级分组，班内相同扣分项合并学号，输出 `{ grounds, totals }`

新增 `tests/flag-summary.test.mjs`：按操场分组、同学号合并、整班记录、无扣分的操场不出现。

## 任务 5 升旗图片排版

修改 `js/image-export.js`：

- 保留 `buildImagePlan(records, date)` 供 `daily` 使用
- 新增 `buildFlagImagePlan(records, date)`：标题 + 两段操场 + 班级明细 + 末行合计
- `renderSummaryBlob(records, date, moduleId)` 按模块选择排版

扩展 `tests/image-layout.test.mjs`：标题文案、操场段落顺序、只出现有扣分的班级、末行合计。

## 任务 6 界面与模块切换

修改 `index.html`、`styles.css`、`app.js`：

- 头部新增模块切换按钮（日常值日检查 / 周一升旗检查），标题改为「值日检查记录」
- 录入页新增学号输入框、操场只读标签；`flag` 模块隐藏检查时间与位置方式
- 选择扣分项后按学号个数自动填分值，用户手动改过后不再覆盖
- 汇总页按当前模块渲染，`flag` 模块按操场分段，班级内合并扣分项
- 历史列表按当前模块过滤
- 导出文件名按模块区分为 `-值日检查扣分情况.png` / `-升旗检查扣分情况.png`

新增 `tests/ui-module.test.mjs`：渲染文案函数（操场标签、学号显示、整班显示）的纯函数测试。

## 任务 7 PWA 与文档

- `manifest.webmanifest` 名称改为「值日检查记录」/「值日检查」
- `sw.js` 缓存列表加入 `js/modules.js`、`js/dates.js`，缓存版本号递增到 `v2`
- 新增 `README.md`：功能说明、使用步骤、备份说明

## 任务 8 验收

1. `npm test` 全部通过（现有 22 项 + 新增）
2. 本地浏览器走通：升旗模块录入 3 个学号 → 汇总显示金轮/玉兔分段 → 导出 PNG 打开正常
3. 日常值日模块回归：录入、汇总、导出仍正常
4. 旧数据兼容：导入上一版导出的 JSON 备份后记录仍可读

## 任务 9 部署

1. 把 `feature/duty-deduction-app` 合并回 `main`
2. 创建 GitHub 仓库并推送
3. 打开 GitHub Pages（`main` 分支，根目录）
4. 手机与电脑各打开一次链接确认可用、可安装到主屏幕
