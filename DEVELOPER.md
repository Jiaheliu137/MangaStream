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

## 代码架构 (v1.3.0)

### 模块化重构

从 v1.3.0 开始，项目进行了完整的模块化重构，将原来 2600+ 行的单文件代码拆分为多个独立模块：

```
js/
├── plugin.js          # 主入口文件，协调各模块
├── constants.js       # 全局常量定义
├── utils.js          # 通用工具函数
├── zoom.js           # 缩放功能模块
├── scrollbar.js      # 自定义滚动条模块
├── imageLoader.js    # 图片加载与懒加载模块
├── drag.js           # 拖动功能模块
├── ui.js             # UI控制与键盘快捷键模块
└── pdfExport.js      # PDF导出功能模块
```

### 模块职责

#### 1. `constants.js` - 常量定义
```javascript
- STANDARD_MANGA_WIDTH: 标准漫画宽度 (800px)
- AnimationConfig: 动画配置参数
- SUPPORTED_IMAGE_FORMATS: 支持的图片格式
- LazyLoadConfig: 懒加载配置
- ZoomConfig: 缩放限制配置
```

#### 2. `utils.js` - 工具函数
```javascript
- debounce(): 防抖函数
- throttle(): 节流函数
- ensureNoTransitions(): 禁用CSS过渡
- DOM: DOM元素缓存对象
```

#### 3. `zoom.js` - 缩放功能
```javascript
- getCurrentZoom(): 获取当前缩放比例
- getCurrentOffset(): 获取当前偏移量
- applyContentPosition(): 应用内容位置和缩放
- resetContentPosition(): 重置内容位置
- applyZoomWithMouseCenter(): 以鼠标为中心缩放
- initZoomFeature(): 初始化缩放功能
```

#### 4. `scrollbar.js` - 滚动条管理
```javascript
- showScrollbars(): 显示所有滚动条
- showHorizontalScrollbar(): 显示水平滚动条
- showVerticalScrollbar(): 显示垂直滚动条
- updateHorizontalScroll(): 更新水平滚动条
- updateVerticalScrollbar(): 更新垂直滚动条
- initCustomScrollbar(): 初始化自定义滚动条
- initVerticalScrollbar(): 初始化垂直滚动条
- setupScrollbarVisibility(): 设置滚动条可见性
```

#### 5. `imageLoader.js` - 图片加载
```javascript
- loadSelectedItems(): 加载选中的图片
- displaySelectedItems(): 显示选中的图片
- setImageFixedSize(): 设置图片固定尺寸
- getCurrentImages(): 获取当前图片列表（供PDF导出使用）
```

**懒加载优化 (v1.3.0):**
- 使用 `IntersectionObserver` API 替代传统滚动监听
- 提前 500px 开始加载图片
- 大幅降低 CPU 占用，提升性能

#### 6. `drag.js` - 拖动功能
```javascript
- initDragFeature(): 初始化拖动功能
- updateCursorStyle(): 更新光标样式
- shouldEnableHorizontalDrag(): 判断是否启用水平拖动
```

#### 7. `ui.js` - UI控制
```javascript
- initRefreshButton(): 初始化刷新按钮
- initPinButton(): 初始化固定按钮
- initKeyboardShortcuts(): 初始化键盘快捷键
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

### 2. 懒加载优化 (v1.3.0)

**旧方案** (v1.2.0及之前):
- 使用滚动事件监听
- 手动计算距离底部的距离
- 高频触发，CPU占用高

**新方案** (v1.3.0):
```javascript
// imageLoader.js
const intersectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src && !img.src) {
                img.src = img.dataset.src;
                intersectionObserver.unobserve(img);
            }
        }
    });
}, {
    root: document.querySelector('#viewport'),
    rootMargin: '500px', // 提前500px开始加载
    threshold: 0.01
});
```

**优势**:
- 浏览器原生API，性能更好
- 自动管理可见性检测
- CPU占用降低约 50%

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
// 水平滚动条
- 根据内容宽度和视口宽度计算滚动条宽度
- 监听拖动事件，同步更新内容偏移
- 自动隐藏（500ms延迟）

// 垂直滚动条
- 根据内容高度和视口高度计算滚动条高度
- 监听拖动事件，同步更新viewport.scrollTop
- 自动隐藏（500ms延迟）
```

### 5. 缩放功能

**特性**:
- Ctrl + 滚轮缩放
- 以鼠标位置为中心缩放
- 缩放范围: 0.2x - 5.0x
- 缩放时同步更新滚动条

**实现**:
```javascript
// zoom.js - applyZoomWithMouseCenter()
const scaleRatio = newZoom / oldZoom;
currentOffsetX = currentOffsetX * scaleRatio; // 按比例调整偏移
currentZoom = newZoom;

// 应用变换
container.style.transform =
    `translateX(calc(-50% + ${currentOffsetX}px)) scale(${currentZoom})`;
```

---

## Bug修复记录

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

### 1. IntersectionObserver 懒加载
- **优化前**: 滚动事件 + 手动计算
- **优化后**: IntersectionObserver API
- **提升**: CPU占用降低约 50%

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

### 4. 图片预加载
- 使用 `dataset.src` 存储真实路径
- IntersectionObserver 触发时才加载
- 减少初始加载时间

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
- **加载方式**: CDN动态加载
- **文档**: https://github.com/parallax/jsPDF

---

## 未来规划

### 短期 (v1.4.0)
- [ ] 添加更多导出格式（CBZ、EPUB）
- [ ] 图片预处理（裁剪白边、锐化）
- [ ] 自定义PDF页面尺寸

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
