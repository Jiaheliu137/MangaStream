# MangaStream 开发者文档

## 项目概述

MangaStream 是一个 Eagle 插件，用于提供漫画式的连续阅读体验。本文档面向开发者，详细说明代码架构和技术实现。

---

## 技术栈

- **前端框架**: 原生 JavaScript (ES6 Modules)
- **PDF生成**: jsPDF 2.5.1
- **Eagle API**: Eagle Plugin API
- **构建工具**: 无（纯前端项目）

---

## 代码架构 (v1.5.1)

### 模块化重构

从 v1.3.0 开始，项目进行了完整的模块化重构，v1.4.0 引入了虚拟滚动机制，v1.5.0 新增多模式阅读系统，v1.5.1 引进完整 i18n 国际化支持：

```
js/
├── plugin.js          # 主入口文件，协调各模块
├── constants.js       # 全局常量定义（含 READING_MODES 枚举）
├── utils.js           # 通用工具函数
├── modeManager.js     # 阅读模式管理模块（v1.5.0 新增）
├── zoom.js            # 缩放功能模块
├── scrollbar.js       # 自定义滚动条模块
├── imageLoader.js     # 图片加载与虚拟滚动核心
├── drag.js            # 拖动功能模块
├── ui.js              # UI控制与键盘快捷键模块
└── pdfExport.js       # PDF导出功能模块
```

### 模块职责

#### 1. `constants.js` - 常量定义
```javascript
- STANDARD_MANGA_WIDTH: 标准漫画宽度 (800px)
- STANDARD_MANGA_HEIGHT: 横向模式标准高度 (800px)
- READING_MODES: 阅读模式枚举 (VERTICAL / HORIZONTAL_LTR / HORIZONTAL_RTL)
- AnimationConfig: 动画配置参数
- SUPPORTED_IMAGE_FORMATS: 支持的图片格式
- ScrollConfig: 键盘滚动配置 (ARROW_SCROLL_PX / PAGE_SCROLL_RATIO)
- ZoomConfig: 缩放限制配置
```

#### 2. `utils.js` - 工具函数
```javascript
- debounce(): 防抖函数
- throttle(): 节流函数
- ensureNoTransitions(): 禁用CSS过渡
- DOM: DOM元素缓存对象
```

#### 3. `zoom.js` - 缩放功能（CSS zoom 实现）
```javascript
- getCurrentZoom(): 获取当前缩放比例
- applyContentPosition(): 应用 CSS zoom 缩放（布局由浏览器自动处理）
- resetContentPosition(): 重置交叉轴滚动（模式切换时调用）
- applyZoomWithMouseCenter(): 边缘锚定缩放（Ctrl+滚轮 / 按钮 / 键盘）
- applyZoomAtMousePosition(): 鼠标位置锚定缩放（左键+滚轮）
- applyZoom(): 便捷缩放入口
- showZoomLevel(): 显示缩放级别指示器
- initZoomFeature(): 初始化缩放功能
```

#### 4. `scrollbar.js` - 滚动条管理
```javascript
- showScrollbars(): 显示所有滚动条
- showHorizontalScrollbar(): 显示水平滚动条
- showVerticalScrollbar(): 显示垂直滚动条
- updateHorizontalScroll(): 更新水平滚动条
- updateVerticalScrollbar(): 更新垂直滚动条（拖拽期间自动跳过，防止反馈环路）
- updateCrossAxisScrollbar(): 更新交叉轴滚动条
- initCustomScrollbar(): 初始化自定义滚动条
- initVerticalScrollbar(): 初始化垂直滚动条
- setupScrollbarVisibility(): 设置滚动条可见性
```

#### 5. `imageLoader.js` - 图片加载 (虚拟滚动核心)
```javascript
- precalculateSizes(): 预计算每张图片的精确显示尺寸（根据模式计算宽或高）
- preloadImages(): 后台预解码引擎，提前 decode() 50 张图片
- getVisibleRange(): 二分查找当前可视图片范围
- renderVisibleItems(): 纯增量边缘 DOM 更新（只动首尾，不碰中间）
- createImageElement(): 优先从预解码缓存取已解码 Image 对象
- `jumpToPage()`: 程序化跳转到指定页码（支持所有模式），v1.5.0 重构了坐标映射数学模型，确保任何缩放比例下最终呈现的像素绝对中心都完美对齐视口中心。
- `captureCurrentIndexForModeSwitch()`: 切换模式前捕获当前页码
- `loadSelectedItems()`: 加载选中的图片
- `displaySelectedItems()`: 显示选中的图片（含首次加载、获取数据、格式过滤等完整流程）
- `reloadForModeSwitch()`: (v1.5.0 新增) **海量图片模式切换终极优化（快速路径）**。针对 10w+ 级别图片数量设计。该函数跳过了耗时的 API 调用和格式过滤，直接复用内存中已有的 `totalFilteredItems` 数组，重新进行前缀和算术计算。并且引入了**异步遮蔽机制**：执行 500ms 的淡出黑屏动画，在纯黑状态下静默完成 CSS 排版方向重建、虚拟 DOM 销毁重建、计算精确对齐坐标并调用 `jumpToPage`，最后淡入，提供电影级无缝转场体验。
- `getCurrentImages()`: 获取当前图片列表（供PDF导出使用）
```

#### 6. `modeManager.js` - 阅读模式管理 (v1.5.0 新增)
```javascript
- getReadingMode(): 获取当前阅读模式
- isHorizontalMode(): 是否为横向模式（LTR 或 RTL）
- isHorizontalLTRMode(): 是否为左到右横向模式
- isHorizontalRTLMode(): 是否为右到左横向模式
- applyBodyModeClasses(): 将决定排版方向的底层 CSS 切换逻辑独立出，供延时消隐黑屏时调用防穿帮
- setReadingMode(): 设置阅读模式（含互斥锁防止快速连按重叠切换）
- toggleReadingMode(): 在三种模式间循环切换（含进度捕获）
- clearModeSwitchLock(): 解除模式切换互斥锁（动画完成后调用）
- getStandardSizeValue(): 根据当前模式返回标准尺寸
```

**极限性能优化 (v1.4.0) - 三层架构：**
- **第一层：精确预计算虚拟滚动**：DOM 树上永远只挂载视窗前后的约 30 个节点，CLS = 0
- **第二层：纯增量边缘 DOM 更新**：滚动 1 张只删 1 个 + 加 1 个节点，中间节点不触碰
- **第三层：预解码对象复用**：后台 `img.decode()` 50 张图，同一个 JS 对象直接塞进 DOM，零重复解码

**多模式阅读架构 (v1.5.0) - 模式无关虚拟滚动：**
- `modeManager.js` 统一管理模式状态，通过 CSS 类名切换布局方向
- `imageLoader.js` 的 `precalculateSizes()` 根据当前模式动态计算主轴尺寸（竖屏算高度，横屏算宽度）
- 模式切换时通过快速路径 `reloadForModeSwitch()` 重新渲染，`captureCurrentIndexForModeSwitch()` 捕获进度，保证零闪烁瞬时响应。

#### 7. `drag.js` - 拖动功能（绝对滚动定位）
```javascript
- initDragFeature(): 初始化拖动功能
- updateCursorStyle(): 更新光标样式
- shouldEnableCrossAxisDrag(): 判断是否启用交叉轴拖动（通过 viewport 溢出检测）
- getDragLogicalScroll(): 获取逻辑滚动位置（未被 Chrome 舍入的精确值，供缩放时使用）
- updateDragSnapshot(): 缩放发生时更新拖拽快照（防止拖拽中缩放导致位置跳变）
```

#### 7. `ui.js` - UI控制
```javascript
- initRefreshButton(): 初始化刷新按钮
- initPinButton(): 初始化固定按钮
- initThemeButton(): 初始化沉浸模式主题切换按钮
- initModeButton(): 初始化模式切换按钮（绑定点击事件）
- updateModeButtonIcon(): 更新模式按钮图标（竖屏/LTR/RTL）
- toggleTheme(): 切换背景颜色逻辑
- initKeyboardShortcuts(): 注册全局快捷键 (M/T/H/P/F + 方向键自动适配横竖模式)
- clearAllToasts(): 清除所有残留 toast 和进度指示器
- showExportProgress(): 显示导出进度（含除零保护）
- addStyles(): 添加样式
```

#### 8. `pdfExport.js` - PDF导出 (v1.3.0 新增)
```javascript
- exportCurrentImagesToPDF(): 导出PDF主函数
- initPDFExportButton(): 初始化PDF导出按钮
- loadAndResizeImage(): 加载并缩放图片到统一宽度
- exportToPDF(): PDF生成核心逻辑
```

---

## 核心技术实现

### 1. 图片统一宽度显示

**问题**: 不同尺寸的图片需要统一宽度显示，保持比例

**解决方案**:
```javascript
// constants.js
export const STANDARD_MANGA_WIDTH = 800;

// imageLoader.js - 创建图片元素时
imgContainer.style.width = `${STANDARD_MANGA_WIDTH}px`;
img.style.width = `${STANDARD_MANGA_WIDTH}px`;
img.style.maxWidth = `${STANDARD_MANGA_WIDTH}px`;
img.style.height = 'auto'; // 高度自动，保持比例
```

### 2. 性能体验极限优化 (v1.4.0 虚拟滚动 + 预解码复用)

**旧方案** (v1.3.0及之前):
- 使用 `IntersectionObserver` 懒加载，DOM 挂载所有节点，万张图片直接卡死。

**新方案三层架构** (v1.4.0):

**第一层：精确前缀和预计算**
```javascript
function precalculateHeights() {
    // 渲染前通过 Eagle API 原始宽高，秒算出几万张图的绝对定位
    const displayHeight = item.height * (STANDARD_MANGA_WIDTH / item.width);
    heightPrefixSum[i + 1] = heightPrefixSum[i] + displayHeight + divider;
}
```

**第二层：纯增量边缘 DOM 更新**
```javascript
function renderVisibleItems() {
    // 滚动 1 张 → 只从顶部删 1 个节点 + 底部追加 1 个节点
    // 中间的图片节点完全不碰，Chrome 的解码进程不受干扰
}
```

**第三层：预解码对象复用（核心突破）**
```javascript
function preloadImages(centerIndex) {
    const img = new Image();
    img.src = `file://${imagePath}`;
    img.decode(); // 强制解码
    decodedImageCache.set(index, img); // 缓存同一个 JS 对象
}

function createImageElement(item, index) {
    let img = decodedImageCache.get(index); // 命中！同一对象，零解码
    if (!img) img = new Image(); // 未命中才创建新的
}
```

> **为什么“同一个对象”是关键？** Chrome 对 `file://` URL 不会在不同 `HTMLImageElement` 实例之间共享解码位图。如果创建新的 `<img>` 并设置相同的 `src`，Chrome 仍然会从零解码。只有复用同一个 JS 对象才能实现零延迟绘制。

**优势**:
- **DOM 恒定**: DOM 总节点数 < 30，与图片总数无关
- **零加载闪烁**: 预解码 50 张告别“空白→加载出来”的视觉闪烁
- **极致顺滑**: 轻松拉起 20w+ 图片而不产生丝毫卡顿

### 3. PDF导出实现 (v1.3.0 新增)

**核心需求**:
1. 所有图片统一宽度 800px
2. 高度按比例缩放
3. 每张图片独立成页
4. 页面尺寸 = 图片尺寸（无留白）

**实现步骤**:

#### Step 1: 图片预处理
```javascript
// pdfExport.js - loadAndResizeImage()
async function loadAndResizeImage(imagePath, targetWidth) {
    // 1. 加载原始图片
    const img = new Image();
    img.src = `file://${imagePath}`;

    // 2. 计算缩放比例
    const scale = targetWidth / img.width;
    const scaledHeight = img.height * scale;

    // 3. 创建Canvas，使用缩放后的尺寸
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;  // 800px
    canvas.height = scaledHeight; // 按比例计算

    // 4. 绘制缩放后的图片
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, targetWidth, scaledHeight);

    // 5. 转换为Base64
    return {
        base64: canvas.toDataURL('image/jpeg', 0.95),
        width: targetWidth,
        height: scaledHeight
    };
}
```

**关键点**: 在Canvas阶段就完成图片缩放，而不是在PDF中缩放

#### Step 2: PDF生成
```javascript
// pdfExport.js - exportToPDF()
const pxToMm = 25.4 / 96; // 像素转毫米 (96 DPI)

for (let i = 0; i < processedImages.length; i++) {
    const imgData = processedImages[i];

    // 转换为毫米
    const widthMM = imgData.width * pxToMm;   // 800px → mm
    const heightMM = imgData.height * pxToMm; // 按比例 → mm

    // 创建页面，尺寸 = 图片尺寸
    pdf.addPage([widthMM, heightMM], 'portrait');

    // 添加图片，填满整个页面
    pdf.addImage(imgData.base64, 'JPEG', 0, 0, widthMM, heightMM);
}
```

**效果**:
- ✅ 所有图片宽度一致 (800px)
- ✅ 高度按比例缩放
- ✅ 页面大小 = 图片大小
- ✅ 完全无留白
- ✅ 可分页，可连续阅读

### 4. 自定义滚动条

**原因**: 隐藏原生滚动条，提供更好的视觉体验

**实现**:
```javascript
// scrollbar.js
// 通用滚动条控制器 createScrollbarController()
- 统一管理 show/hide/timer/display/pointerEvents

// 主轴滚动条 (updateVerticalScrollbar)
- 竖向模式=垂直滚动条，横向模式=水平滚动条
- 根据 viewport.scrollHeight/scrollWidth 计算手柄尺寸和位置

// 交叉轴滚动条 (updateCrossAxisScrollbar)
- 竖向模式=水平滚动条，横向模式=垂直滚动条
- 读取 viewport 原生滚动位置（CSS zoom 改变真实布局尺寸）

// 拖拽反馈环路防护
- 拖拽期间设置 isDraggingVerticalScrollbarFlag / isDraggingScrollbar
- updateVerticalScrollbar() 入口检查标志，拖拽中跳过
- 松手后执行一次同步刷新
```

**关键设计**: 虚拟滚动的 spacer 会在 scroll 事件中动态重排，导致 `scrollHeight` 变化。如果拖拽 → `scrollTo()` → scroll 事件 → `updateVerticalScrollbar()` 重算手柄位置，会覆盖拖拽设置的位置（反馈环路）。通过拖拽期间跳过 scroll 事件驱动的更新来打破这个环路。

### 5. 缩放功能（CSS zoom 实现）

**特性**:
- Ctrl + 滚轮：边缘锚定缩放（主轴阅读起始边不动，交叉轴居中）
- 左键 + 滚轮：鼠标位置锚定缩放（鼠标指向的像素不动）
- Ctrl + 0：重置缩放到 100%
- 缩放范围: 0.2x - 5.0x
- 缩放时同步更新滚动条

**实现原理 — 从 `transform: scale()` 到 CSS `zoom`**:

旧方案使用 `transform: scale()` + 手动 `translateX/Y` 偏移管理，需要约 40 行代码维护交叉轴边界钳制。CSS `zoom` 会真正改变布局尺寸，浏览器自动处理溢出和滚动条，大幅简化代码。

```javascript
// zoom.js — 核心只需一行
container.style.zoom = currentZoom;
```

**缩放锚定策略**:

三种模式共用一套参数化逻辑，通过主轴/交叉轴互换实现：

```
竖向模式:    主轴=Y（顶部锚定）  交叉轴=X（居中锚定）
左右横屏:    主轴=X（左边锚定）  交叉轴=Y（居中锚定）
右左横屏:    主轴=X（右边锚定）  交叉轴=Y（居中锚定，scrollLeft 取负）
```

边缘锚定公式（主轴）：`newScroll = oldScroll * scaleRatio`
中心锚定公式（交叉轴）：`newScroll = (oldScroll + viewportCenter) * scaleRatio - viewportCenter`
鼠标锚定公式（左键+滚轮主轴）：`newScroll = (oldScroll + mouseInViewport) * scaleRatio - mouseInViewport`

**交叉轴无溢出 → 溢出的过渡处理**:

当内容未溢出 viewport 时，CSS `margin: 0 auto` 使内容视觉居中，但 `scrollLeft=0`。此时中心锚定公式 `(0 + cx) * ratio - cx` 会算出错误偏移。解决方案：缩放前检测交叉轴溢出状态，未溢出时直接用 `(scrollWidth - clientWidth) / 2` 居中。

```javascript
if (hadCrossOverflow) {
    // 已有溢出：标准中心锚定公式
    newScroll = (oldScroll + center) * scaleRatio - center;
} else {
    // 未溢出→可能溢出：直接居中
    newScroll = (scrollSize - clientSize) / 2;
}
```

---

## Bug修复记录

### CSS zoom 重构相关修复

**Bug 1: Chrome CSS zoom + scrollBy 亚像素舍入累积漂移（拖拽不跟手）**

**现象**: 使用 CSS `zoom` 后，拖拽图片时鼠标与内容逐渐错位，拖得越久偏移越大。

**根因**: Chrome 在 CSS zoom 非整数倍下对每次 `scrollBy()` 的参数做亚像素舍入。增量式拖拽（每帧 `scrollBy(-dx, -dy)`）中，每帧的起点是上一帧被舍入过的结果，误差像滚雪球一样累积。

```
帧1: scrollBy(-3) → 期望 97，实际 96.5（误差 0.5）
帧2: scrollBy(-3) → 期望 93.5，实际 93（累积误差 1.0）
...
帧50: 累积误差可达 20-30px
```

**修复**: 从增量式改为绝对定位式。`mousedown` 时拍快照（起始滚动位置 + 起始鼠标位置），`mousemove` 时每帧从快照重算：

```javascript
// mousedown: 拍快照
dragStartScrollLeft = viewport.scrollLeft;
dragStartMouseX = e.clientX;

// mousemove: 每帧从快照计算，不依赖上一帧
viewport.scrollLeft = dragStartScrollLeft - (e.clientX - dragStartMouseX);
```

Chrome 对赋值结果的舍入只影响当前帧显示，下一帧从原始快照重算，误差永远 < 1px，不会累积。本质是将**递推（依赖上一帧）**换成**直接计算（每帧独立）**——数值计算中经典的避免误差累积方法。

**Bug 2: 拖拽过程中缩放导致画面跳变**

**现象**: 按住左键拖拽的同时滚轮缩放，画面瞬间跳到错误位置。

**根因**: 缩放改变了 `viewport.scrollLeft/Top`，但拖拽快照（`dragStartScrollLeft/Top`）还是缩放前的旧值，下一帧 `mousemove` 从过期快照算出错误位置。

**修复**: 缩放完成后调用 `updateDragSnapshot()`，把快照刷新为缩放后的滚动位置和当前鼠标位置，相当于"重新按下鼠标"。

**Bug 3: 拖拽中连续多次缩放仍累积舍入漂移**

**现象**: 单纯拖拽完美跟手，但边拖拽边反复缩放后，鼠标与画面相对位置缓慢漂移。

**根因**: `updateDragSnapshot()` 从 `viewport.scrollLeft` 回读快照值，而此值已被 Chrome 舍入。多次缩放 → 多次回读舍入值 → 误差再次累积。

**修复**: 引入"逻辑滚动位置"（`logicalScrollLeft/Top`），整条拖拽-缩放链路中滚动值从不回读 viewport：

```
mousedown → 从 viewport 读一次初始值（唯一一次回读）
mousemove → 从 dragStart 算出精确 logicalScroll，赋给 viewport
wheel缩放 → zoom.js 通过 getDragLogicalScroll() 读精确值做计算
         → 算完通过 updateDragSnapshot(精确值) 写回快照
mousemove → 继续从精确快照计算
```

Chrome 的舍入被隔离在"显示层"，计算层始终使用未舍入的精确浮点数。

**Bug 4: 缩放到内容溢出 viewport 时交叉轴不居中**

**现象**: 从 100% 逐步放大，内容从不溢出到溢出 viewport 的瞬间，图片跳到一侧而非保持居中。

**根因**: 内容未溢出时由 CSS `margin: 0 auto` 视觉居中，`scrollLeft=0`。中心锚定公式 `(0 + cx) * ratio - cx` 误以为"内容左边缘在 viewport 左边缘"，算出错误偏移。

**修复**: 缩放前检测交叉轴溢出状态。未溢出时跳过公式，直接用 `(scrollWidth - clientWidth) / 2` 居中。

### 代码审计修复 (v1.5.2)

**全面代码审计**，修复 3 个 CRITICAL、6 个 HIGH、5 个 MEDIUM、1 个 LOW 级别问题：

**CRITICAL:**
- **C1: Ctrl+W 关闭行为错误** — `eagle.window.hide()` 改为 `eagle.window.close()`，`hide()` 实际上是关闭窗口而非隐藏
- **C2: `isRendering` 死锁** — 从 `requestAnimationFrame` 异步解锁改为 `finally` 块同步解锁，防止渲染异常时标志永远不释放
- **C3: 模式切换竞态条件** — `modeManager.js` 引入 `isModeSwitching` 互斥锁，`setReadingMode()` 在切换动画完成前拒绝新的切换请求

**HIGH:**
- **H1: PDF 导出零尺寸图片崩溃** — `loadAndResizeImage()` 在 `img.onload` 中检查 `width/height === 0` 提前 reject
- **H2: 进度条除零** — `showExportProgress()` 对 `total === 0` 的情况返回 `0%`
- **H3: `img.alt` 硬编码中文** — 用 `i18next.t('image.unnamed')` 替代 `'未命名'`
- **H4: `onPluginShow` 竞态** — 添加 `domReady` 门控，仅在 `DOMContentLoaded` 完成后才执行 `loadSelectedItems()`
- **H5: jsPDF 加载硬编码延迟** — 200ms `setTimeout` 替换为最多 2s 的轮询检测
- **H6: `transition: all` 性能隐患** — 全部 6 处替换为显式属性列表

**MEDIUM:**
- **M1: 生产环境 `console.log`** — 全部清除
- **M2: 缓存淘汰策略** — 从 FIFO（Map 插入序）改为按距视口中心距离排序淘汰
- **M3: 递归栈溢出风险** — `getAllSubFolderIds()` 从递归改为迭代（栈模拟）
- **M4: 错误消息拼接安全** — PDF 导出 catch 中对 `err.message` 做 `instanceof Error` 检查
- **M5: 魔法数字** — 键盘滚动 `150px` 和 `0.8` 提取为 `ScrollConfig` 常量

**LOW:**
- **L3: 残留 UI 清理** — `onPluginHide` 时调用 `clearAllToasts()` 清除残留 toast 和进度指示器

**Bug: 竖向模式垂直滚动条拖拽反向（拖下画面往上跑）**

**现象**: 横向模式水平滚动条拖拽完美跟手，但竖向模式垂直滚动条向下拖拽时画面反方向移动。

**根因**: scroll 事件反馈环路。拖拽设置 `bar.style.top` + `viewport.scrollTo()` → 触发 scroll 事件 → `updateVerticalScrollbar()` 根据虚拟滚动的动态 `scrollHeight` 重算滚动条位置 → 覆盖了拖拽刚设置的 `bar.style.top`。横向滚动条不受影响，因为交叉轴的 `scrollWidth` 是真实 DOM 尺寸，不受虚拟滚动 spacer 动态变化的影响。

**修复**: 在 `scrollbar.js` 中引入模块级 `isDraggingVerticalScrollbarFlag`，`updateVerticalScrollbar()` 入口处检查该标志和 `isDraggingScrollbar`，拖拽期间跳过 scroll 事件驱动的滚动条位置更新。松手时（`mouseup`）执行一次 `updateVerticalScrollbar()` 同步最终状态。

### v1.5.1
**Bug**: 插件添加多语言支持后，鼠标悬停按钮等地方显示 `undefined`，无法正确读取国际化字符串。

**原因**: 
最初将多语言静态元素翻译函数 `applyI18nTitles()` 放在了 `document.addEventListener('DOMContentLoaded', ...)` 中执行。但在 Eagle 插件生命周期中，此时 Eagle 宿主软件尚未将语言配置（`eagle.app.locale`）注入完成，导致 `i18next` 初始化为空或提取不到对应 Key 的报错。且 Eagle 官方对语言文件的命名要求非常严格，必须完整匹配（如 `ko_KR.json` 不能写成 `ko.json`）。

**修复**: 
1. 语言文件命名严格遵循 Eagle 官方支持的 8 个字符串代码：`en, ja_JP, es_ES, de_DE, zh_TW, zh_CN, ko_KR, ru_RU`。
2. 将所有涉及 `i18next.t()` 和更新 DOM i18n 属性的动作，移动到 `eagle.onPluginRun` 这个由宿主触发的钩子回调中执行，确保国际化引擎准备就绪后才执行文本替换。

### v1.4.0
**Bug**: 极其大量图片同时下拉加载时引发的滚轮跳跃与漂移反馈循环 (Scroll Drift Feedback Loop)

**修复**:
通过引入 **预计算虚拟滚动 + 强制禁用 CSS Scroll Anchoring (`overflow-anchor: none`)**，彻底消灭了依靠 `IntersectionObserver` 或估算高度引发的一系列由于 Image onload 返回真实尺寸产生的 CLS 跳变问题。

### v1.5.0
**Bug 1**: 模式切换按钮首次打开插件时不响应，必须缩放窗口才生效

**原因**: `initializePlugin()` 函数在 `plugin.js` 中定义但从未在 `DOMContentLoaded` 中被调用，导致 `initModeButton()` 和 `initThemeButton()` 未执行，按钮没有绑定点击事件。

**修复**: 在 `DOMContentLoaded` 事件中显式调用 `initThemeButton()` 和 `initModeButton()`。

**Bug 2**: 横屏模式 RTL 方向图片无法加载 / LTR 方向图片比例失调

**原因**: 横屏模式下图片尺寸计算逻辑未正确转换主/副轴，导致图片高度不固定、宽度未按比例缩放。RTL 方向的原生 `scrollLeft` 负值未正确处理。

**修复**: 重写 `createImageElement()` 和 `precalculateSizes()` 的尺寸计算逻辑，使用 `Math.abs(scrollLeft)` 统一处理 RTL 滚动坐标。

**Bug 3**: 模式切换时丢失阅读进度

**原因**: 切换模式触发 `loadSelectedItems()` 重建整个 DOM，`resetContentPosition()` 将滚动位置归零。

**修复**: 引入 `captureCurrentIndexForModeSwitch()` 在切换前捕获页码，在 `displaySelectedItems()` 中先设置 `scrollLeft/scrollTop` 到目标偏移再调用 `renderVisibleItems()`，直接渲染目标页附近内容。

**Bug 4**: 横屏模式下自定义滚动条无法拖拽

**原因**: 横向/竖向滚动条的拖拽逻辑未区分主轴和副轴，横屏模式下滚动条拖拽事件的坐标映射错误。

**修复**: 重构 `handleHorizontalScrollbarDrag()` 和 `handleVerticalScrollbarDrag()`，根据当前模式正确分配主轴滚动与副轴平移。

### v1.3.0
**Bug**: 300张图片后宽度突变

**原因**:
- 前300张图片使用 `STANDARD_MANGA_WIDTH` (800px)
- 300张后使用 `width: '100%'`

**修复**:
```javascript
// imageLoader.js - loadImageBatch()
// 修改前
imgContainer.style.width = '100%';
img.style.width = '100%';

// 修改后
imgContainer.style.width = `${STANDARD_MANGA_WIDTH}px`;
img.style.width = `${STANDARD_MANGA_WIDTH}px`;
```

---

## 性能优化

### 1. 二分查找的前缀和虚拟滚动 (Virtual Scrolling)
- **优化前**: DOM 无限增长，十万个 DOM 轻松杀死 Chromium 进程。渲染引发剧烈 CPU 占用与内存 OOM。
- **优化后**: 内存 DOM 长青不增，时间查询复杂度 `O(log N)`，内存 $O(N)$ (仅存储数值)。
- **提升**: 性能上限与流畅度呈现几何级突变，从此性能与总图片数无关。

### 2. 函数节流/防抖
```javascript
// utils.js
- throttle(): 限制函数执行频率（滚动、拖动）
- debounce(): 延迟执行（窗口resize）
```

### 3. DOM缓存
```javascript
// utils.js - DOM对象
const DOM = {
    elements: {},
    get(selector) {
        if (!this.elements[selector]) {
            this.elements[selector] = document.querySelector(selector);
        }
        return this.elements[selector];
    }
};
```

### 4. 图片渲染级保护
- 计算预留绝对高度，强行阻止渲染引擎 Layout 树在拉取流媒体图像资源途中产生的页面布局变动回流跳跃。

---

## 开发规范

### 1. 模块导入导出
```javascript
// 导出
export function functionName() { }
export const CONSTANT_NAME = value;

// 导入
import { functionName, CONSTANT_NAME } from './module.js';
```

### 2. 命名规范
- **函数**: camelCase (例: `loadSelectedItems`)
- **常量**: UPPER_SNAKE_CASE (例: `STANDARD_MANGA_WIDTH`)
- **类**: PascalCase (例: `ImageLoader`)
- **私有函数**: 前缀下划线 (例: `_privateFunction`)

### 3. 注释规范
```javascript
// 单行注释：简短说明

/**
 * 多行注释：详细说明
 * @param {string} imagePath - 图片路径
 * @returns {Promise<Object>} 图片数据
 */
```

### 4. 错误处理
```javascript
try {
    // 主要逻辑
} catch (err) {
    console.error('错误描述:', err);
    showErrorMessage('用户友好的错误提示');
}
```

---

## 构建与部署

### 开发环境
1. 克隆仓库
2. 在Eagle中导入本地项目
3. 修改代码后刷新插件即可

### 发布流程
1. 更新 `manifest.json` 中的版本号
2. 更新 `README.md` 中的更新内容
3. 更新本文档（如有架构变更）
4. 提交到GitHub
5. 在Eagle插件中心发布

---

## 依赖库

### jsPDF
- **版本**: 2.5.1
- **用途**: PDF生成
- **加载方式**: 插件本地 `vendor` 离线打包 + CDN 后备机制保护
- **文档**: https://github.com/parallax/jsPDF

---

## 未来规划

### 短期 (v1.6.0)
- [ ] 添加更多导出格式（CBZ、EPUB）
- [ ] 图片预处理（裁剪白边、锐化）
- [ ] 自定义PDF页面尺寸
- [ ] 更多图片展示模式（如双页对开、无缝瀑布流等）

### 长期 (v2.0.0)
- [ ] TypeScript重写
- [ ] 单元测试
- [ ] 性能监控
- [ ] 插件设置面板

---

## 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 许可证

本项目采用 MIT 许可证

---

## 联系方式

- GitHub: https://github.com/Jiaheliu137/MangaStream
- Issues: https://github.com/Jiaheliu137/MangaStream/issues
