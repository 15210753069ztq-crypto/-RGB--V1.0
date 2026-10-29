# 基于双向协同图引导的RGB-事件融合目标检测系统 V1.0

对应论文：*From Unidirectional to Bidirectional Synergy: Graph-Guided Event Detection via Semantics-Guided Feedback and Adaptive Gating*（SGF 语义反馈 + ADG 自适应双层门控，DSEC-Detection 数据集）。

本系统是**纯前端单页应用**（Vue 3 + Element Plus + ECharts），所有第三方库已放在 `vendor/` 目录，**不需要安装任何软件、不需要联网、不需要后端**，用 Chrome 或 Edge 打开 `index.html` 就能使用。页面上的检测画面、事件点、热力图由程序按固定随机种子合成，每次打开结果一致。

## 1. 运行

- Windows：双击 `start.bat`，或直接双击 `index.html`。
- macOS / Linux：执行 `./start.sh`，或用浏览器打开 `index.html`。

左侧导航共九个功能模块：检测总览大屏、数据集管理、事件流可视化、时空图构建、模型管理、训练任务管理、检测推理分析、评估与消融、方法对比。

## 2. 截图方法

截图尺寸建议统一为 **1920×1080**（与软著说明书模版一致）。

### 方法一：手动截图（最简单）

1. 用 Chrome 打开 `index.html`，按 `F11` 进入全屏（显示器分辨率为 1920×1080 时，全屏后正好是 1920×1080）。
2. 显示器分辨率不是 1920×1080 时：按 `F12` 打开开发者工具 → 按 `Ctrl+Shift+M` 切换设备模式 → 顶部尺寸填 `1920 × 1080`、缩放选 `100%` → 按 `Ctrl+Shift+P`，输入 `screenshot`，选择 **Capture screenshot**，浏览器会直接下载一张 1920×1080 的 PNG。
3. 依次点击左侧菜单，每个页面截一张。建议额外截一张“新增”对话框（数据集管理页右上角“新增”按钮）。

### 方法二：自动截图（一条命令截全部页面）

需要电脑上装有 Node.js 16 及以上：

```bash
npm install
npx playwright install chromium
npm run screenshot
```

截图保存到 `screenshots/` 目录，截哪些页面、文件名、等待时间都在 `scripts/shots.json` 中配置。

### 截图放进软件说明书

说明书 Word 中每张图的位置都放了灰色占位图，图下方写有对应的截图文件名（如 `screenshots/01_检测总览大屏.png`）。在 Word 中右键占位图 → **更改图片** → **来自文件**，选择对应截图即可，图片大小会自动保持一致。

## 3. 修改数据

页面上显示的全部数据都在 **`data/data.js`** 一个文件中，用记事本或 VS Code 打开修改后保存，刷新浏览器即可生效。

| 数据表（data.js 中的键） | 对应页面 | 内容 |
|---|---|---|
| `system` | 顶部栏 | 系统名称 `name`、简称 `short`、版本、用户名；`fixedTime` 为顶部栏显示的固定时间（截图时与数据日期一致），改为 `""` 则显示电脑当前时间 |
| `sequence` | 数据集管理、总览 | DSEC 数据序列：名称、场景、帧数、事件数、标注数等 |
| `model` | 模型管理 | 模型变体（dsec/feedback/gating/combine × ResNet18/50）、SGF/ADG 开关、参数量、最佳 mAP |
| `train_job` / `train_metric` | 训练任务管理 | 训练任务；逐 epoch 的验证 mAP、训练损失、学习率（画曲线用） |
| `detect_record` | 总览、推理分析、事件流、时空图 | 检测记录与检测框 `boxes`（640×480 像素坐标，`cls` 为 car/pedestrian） |
| `detect_task` | 总览 | 检测任务进度与状态 |
| `eval_result` | 评估与消融 | 各变体 mAP、AP50、AP75、APs、APm、APl、F1、Recall |
| `compare_method` | 方法对比 | 对比方法指标；`is_ours: 1` 表示本文方法（自动排在表格最后并高亮） |
| `graph_config` | 时空图构建 | 建图参数（时间窗、邻域半径、最大邻居数等） |

说明：
- 论文中给出的数值（ResNet18/ResNet50 的 mAP、ResNet50 基线与本文方法的多尺度指标）已按原文填入；论文 Word 中缺失的表格数值（对比方法的具体指标、部分 F1/Recall、训练曲线逐点值）为示例值，请按论文终稿替换。
- 修改检测框坐标会同时改变合成画面中车辆/行人的位置。
- 在页面上点“新增/编辑/删除”也能改数据，修改保存在浏览器缓存中；`data.js` 一旦被修改，缓存自动作废。点击顶部栏“重置数据”也可恢复为 `data.js` 的内容。

### 换成真实图片

把图片放到 `images/` 目录（例如 `images/zurich_13_0030.png`），在 `data.js` 对应的 `detect_record` 记录中填写 `"image_url": "images/zurich_13_0030.png"`。页面会改为显示真实图片，并在上面叠加该记录的检测框；图片加载失败时自动回退为合成画面。

## 4. 目录结构

```
index.html          入口页面
data/data.js        全部展示数据（改数据只改这里）
js/common.js        数据仓库与通用组件（指标卡片、面板、图表、画布、增删改查表格）
js/synth.js         合成图绘制（道路场景、事件流、SGF 反馈热力图、ADG 门控图、时空图）
js/pages1~3.js      九个功能页面
js/app.js           导航菜单与路由
css/theme.css       深色主题样式
vendor/             Vue、Element Plus、ECharts 等第三方库（本地文件）
scripts/            自动截图脚本与截图清单
images/             可选：放置真实图片
```
