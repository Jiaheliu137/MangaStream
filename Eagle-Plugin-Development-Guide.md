# Eagle 插件开发完整指南

> 本文档适用于 Claude.ai Projects 或作为独立参考文档

---

## 目录

1. [插件开发概述](#插件开发概述)
2. [核心概念](#核心概念)
3. [插件结构](#插件结构)
4. [API 完整参考](#api-完整参考)
5. [实用示例代码](#实用示例代码)
6. [最佳实践](#最佳实践)

---

## 插件开发概述

Eagle 插件使用标准 Web 技术（HTML、CSS、JavaScript）开发，可以访问 Node.js 原生 API。

### 技术环境
- **运行时**: Chromium 107 + Node.js 16
- **无 CORS 限制**: 可访问任意 URL
- **完整 Node.js 支持**: 访问原生 API 和 npm 包
- **国际化**: 内置 i18n 支持

### 四种插件类型

1. **窗口插件 (Window Plugin)** - 点击触发弹窗
2. **后台服务插件 (Background Service)** - 后台持续运行
3. **格式扩展插件 (Format Extension)** - 支持新文件格式
4. **检查器扩展插件 (Inspector Extension)** - 增强信息面板

---

## 核心概念

### 必需的文件结构

```
my-eagle-plugin/
├── manifest.json          (必需 - 插件配置)
├── index.html            (窗口插件必需)
├── main.js               (插件逻辑)
├── styles.css            (样式)
└── package.json          (可选 - npm 依赖)
```

### manifest.json 配置

**基础配置：**

```json
{
  "id": "your-unique-plugin-id",
  "name": "插件显示名称",
  "version": "1.0.0",
  "description": "插件描述",
  "author": "作者名",
  "main": "index.html",
  "type": "window",
  "keywords": ["标签1", "标签2"]
}
```

**必需字段：**
- `id`: 唯一标识符（小写字母、数字、连字符）
- `name`: 在 Eagle 中显示的名称
- `version`: 语义化版本号（如 "1.0.0"）
- `main`: 入口文件（窗口插件为 HTML 文件）
- `type`: 插件类型（window、background、format、inspector）

**可选但推荐：**
- `description`: 插件功能说明
- `author`: 创建者名称
- `keywords`: 搜索标签
- `icon`: 插件图标路径
- `i18n`: 国际化配置

### 国际化配置示例

```json
{
  "i18n": {
    "en": {
      "title": "My Plugin",
      "greeting": "Hello"
    },
    "zh-CN": {
      "title": "我的插件",
      "greeting": "你好"
    },
    "ja": {
      "title": "私のプラグイン",
      "greeting": "こんにちは"
    }
  }
}
```

---

## 插件结构

### 开发工作流程

1. **创建插件结构**: 设置 manifest.json 和文件
2. **本地开发**: 使用 Eagle 的"导入本地项目"功能测试
3. **调试**: 使用开发者工具（Ctrl+Shift+I）
4. **全面测试**: 使用不同场景和数据测试
5. **打包**: 准备分发
6. **发布**: 提交到 Eagle 插件中心（可选）

### 基础窗口插件示例

**index.html:**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>我的插件</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      padding: 20px;
    }
    .item {
      border: 1px solid #ddd;
      padding: 10px;
      margin: 10px 0;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <h1>选中的项目</h1>
  <div id="items-container"></div>

  <script>
    async function loadItems() {
      try {
        const items = await eagle.item.getSelected();

        if (items.length === 0) {
          document.getElementById('items-container').innerHTML =
            '<p>未选择任何项目</p>';
          return;
        }

        const container = document.getElementById('items-container');
        container.innerHTML = items.map(item => `
          <div class="item">
            <h3>${item.name}</h3>
            <p>类型: ${item.ext.toUpperCase()}</p>
            <p>大小: ${(item.size / 1024).toFixed(2)} KB</p>
            <p>标签: ${item.tags.join(', ') || '无'}</p>
          </div>
        `).join('');

      } catch (error) {
        eagle.log.error('加载项目失败:', error);
        eagle.notification.show({
          title: '错误',
          message: error.message,
          type: 'error'
        });
      }
    }

    loadItems();
  </script>
</body>
</html>
```

---

## API 完整参考

### Item API - 项目管理

#### eagle.item.getSelected()
获取当前选中的项目

```javascript
const items = await eagle.item.getSelected();
console.log(items); // Item 对象数组
```

**返回:** `Promise<Item[]>`

#### Item 对象结构

```javascript
{
  id: "LJEL9VABCDEF",           // 唯一项目 ID
  name: "image.jpg",            // 文件名
  ext: "jpg",                   // 文件扩展名
  size: 1024000,                // 文件大小（字节）
  filePath: "/path/to/file",    // 完整文件路径
  url: "file:///path/to/file",  // 文件 URL
  tags: ["tag1", "tag2"],       // 标签数组
  folders: ["folder-id"],       // 父文件夹 ID
  width: 1920,                  // 图片宽度
  height: 1080,                 // 图片高度
  annotation: "备注...",         // 项目注释
  rating: 5,                    // 评分（0-5）
  modificationTime: 1234567890  // 最后修改时间戳
}
```

#### eagle.item.get(id)
通过 ID 获取特定项目

```javascript
const item = await eagle.item.get("LJEL9VABCDEF");
```

**参数:** `id` (string) - 项目 ID
**返回:** `Promise<Item>`

#### eagle.item.getAll()
获取当前库中的所有项目

```javascript
const allItems = await eagle.item.getAll();
```

**返回:** `Promise<Item[]>`

---

### Folder API - 文件夹管理

#### eagle.folder.get(id)
通过 ID 获取文件夹

```javascript
const folder = await eagle.folder.get("folder-id");
```

**返回:** `Promise<Folder>`

#### eagle.folder.getAll()
获取所有文件夹

```javascript
const folders = await eagle.folder.getAll();
```

**返回:** `Promise<Folder[]>`

#### Folder 对象结构

```javascript
{
  id: "folder-id",
  name: "我的文件夹",
  description: "文件夹描述",
  children: [],              // 子文件夹 ID
  modificationTime: 1234567890
}
```

---

### Tag API - 标签管理

#### eagle.tag.getAll()
获取库中所有标签

```javascript
const tags = await eagle.tag.getAll();
```

**返回:** `Promise<Tag[]>`

#### Tag 对象结构

```javascript
{
  id: "tag-id",
  name: "标签名",
  color: "#FF0000"
}
```

---

### Library API - 资源库访问

#### eagle.library.get()
获取当前资源库信息

```javascript
const library = await eagle.library.get();
console.log(library.name);
console.log(library.path);
```

**返回:** `Promise<Library>`

---

### Window API - 窗口控制

#### eagle.window.close()
关闭插件窗口

```javascript
eagle.window.close();
```

#### eagle.window.resize(width, height)
调整窗口大小

```javascript
eagle.window.resize(800, 600);
```

**参数:**
- `width` (number): 窗口宽度（像素）
- `height` (number): 窗口高度（像素）

#### eagle.window.setPosition(x, y)
设置窗口位置

```javascript
eagle.window.setPosition(100, 100);
```

#### eagle.window.center()
窗口居中显示

```javascript
eagle.window.center();
```

#### eagle.window.setAlwaysOnTop(flag)
设置窗口始终置顶

```javascript
eagle.window.setAlwaysOnTop(true);
```

---

### Dialog API - 对话框

#### eagle.dialog.showMessageBox(options)
显示消息框

```javascript
const result = await eagle.dialog.showMessageBox({
  type: 'question',
  title: '确认',
  message: '您确定吗？',
  buttons: ['是', '否'],
  defaultId: 0
});

console.log(result.response); // 点击按钮的索引
```

**选项:**
- `type`: 'none' | 'info' | 'error' | 'question' | 'warning'
- `title`: 对话框标题
- `message`: 消息文本
- `buttons`: 按钮标签数组
- `defaultId`: 默认按钮索引

**返回:** `Promise<{response: number}>`

#### eagle.dialog.showOpenDialog(options)
显示文件打开对话框

```javascript
const result = await eagle.dialog.showOpenDialog({
  title: '选择文件',
  properties: ['openFile', 'multiSelections'],
  filters: [
    { name: '图片', extensions: ['jpg', 'png', 'gif'] },
    { name: '所有文件', extensions: ['*'] }
  ]
});

console.log(result.filePaths); // 选中的文件路径数组
```

**返回:** `Promise<{filePaths: string[]}>`

#### eagle.dialog.showSaveDialog(options)
显示文件保存对话框

```javascript
const result = await eagle.dialog.showSaveDialog({
  title: '保存文件',
  defaultPath: 'output.json',
  filters: [
    { name: 'JSON', extensions: ['json'] }
  ]
});

console.log(result.filePath); // 选择的保存路径
```

**返回:** `Promise<{filePath: string}>`

---

### Notification API - 通知

#### eagle.notification.show(options)
向用户显示通知

```javascript
eagle.notification.show({
  title: '成功',
  message: '操作成功完成',
  type: 'success',
  duration: 3000
});
```

**选项:**
- `title` (string): 通知标题（可选）
- `message` (string): 通知消息
- `type`: 'info' | 'success' | 'warning' | 'error'
- `duration` (number): 显示时长（毫秒，默认 3000）

---

### Context Menu API - 右键菜单

#### eagle.contextMenu.show(items)
显示右键菜单

```javascript
eagle.contextMenu.show([
  {
    label: '选项 1',
    click: () => console.log('选项 1 被点击')
  },
  { type: 'separator' },
  {
    label: '选项 2',
    enabled: true,
    click: () => console.log('选项 2 被点击')
  }
]);
```

---

### Clipboard API - 剪贴板

#### eagle.clipboard.writeText(text)
写入文本到剪贴板

```javascript
eagle.clipboard.writeText('Hello World');
```

#### eagle.clipboard.readText()
从剪贴板读取文本

```javascript
const text = eagle.clipboard.readText();
```

#### eagle.clipboard.writeImage(path)
写入图片到剪贴板

```javascript
eagle.clipboard.writeImage('/path/to/image.png');
```

---

### App API - 应用信息

#### eagle.app.getVersion()
获取 Eagle 版本

```javascript
const version = eagle.app.getVersion();
console.log(version); // 例如: "3.0.0"
```

#### eagle.app.getLocale()
获取当前语言

```javascript
const locale = eagle.app.getLocale();
console.log(locale); // 例如: "zh-CN", "en"
```

#### eagle.app.openURL(url)
在默认浏览器中打开 URL

```javascript
eagle.app.openURL('https://example.com');
```

---

### Event API - 事件处理

#### eagle.event.on(eventName, callback)
注册事件监听器

```javascript
eagle.event.on('selectionChanged', (items) => {
  console.log('选择已更改:', items);
});
```

**常用事件:**
- `selectionChanged`: 项目选择更改
- `libraryChanged`: 资源库切换
- `itemAdded`: 新项目添加
- `itemDeleted`: 项目删除
- `itemUpdated`: 项目修改

#### eagle.event.off(eventName, callback)
移除事件监听器

```javascript
function handler(items) {
  console.log(items);
}

eagle.event.on('selectionChanged', handler);
// 稍后...
eagle.event.off('selectionChanged', handler);
```

---

### Log API - 日志工具

#### eagle.log.debug(message, ...args)
记录调试消息

```javascript
eagle.log.debug('调试信息:', data);
```

#### eagle.log.info(message, ...args)
记录信息消息

```javascript
eagle.log.info('操作开始');
```

#### eagle.log.warn(message, ...args)
记录警告

```javascript
eagle.log.warn('警告:', warningMessage);
```

#### eagle.log.error(message, ...args)
记录错误

```javascript
eagle.log.error('发生错误:', error);
```

---

### OS & System APIs - 系统 API

#### eagle.os.platform()
获取操作系统平台

```javascript
const platform = eagle.os.platform();
// 返回: 'darwin' | 'win32' | 'linux'
```

#### eagle.os.homedir()
获取用户主目录

```javascript
const home = eagle.os.homedir();
```

#### eagle.shell.showItemInFolder(path)
在系统文件浏览器中显示文件

```javascript
eagle.shell.showItemInFolder('/path/to/file');
```

#### eagle.shell.openPath(path)
用默认应用程序打开文件或目录

```javascript
eagle.shell.openPath('/path/to/file.pdf');
```

---

## 实用示例代码

### 示例 1: 图片批处理器

处理选中的图片，过滤大图片并导出信息。

```javascript
const fs = require('fs');
const path = require('path');

async function filterLargeImages() {
  try {
    const items = await eagle.item.getSelected();

    // 过滤大于 1MB 的图片
    const largeImages = items.filter(item => {
      return item.ext.match(/\.(jpg|jpeg|png|gif)$/i) && item.size > 1024 * 1024;
    });

    console.log(`找到 ${largeImages.length} 张大于 1MB 的图片`);

    eagle.notification.show({
      message: `找到 ${largeImages.length} 张大图片`,
      type: 'success'
    });

    return largeImages;

  } catch (error) {
    eagle.log.error('错误:', error);
    eagle.notification.show({
      title: '错误',
      message: error.message,
      type: 'error'
    });
  }
}

async function exportImageInfo() {
  try {
    const items = await eagle.item.getSelected();

    const imageInfo = items
      .filter(item => item.ext.match(/\.(jpg|jpeg|png|gif)$/i))
      .map(item => ({
        name: item.name,
        size: item.size,
        width: item.width,
        height: item.height,
        tags: item.tags,
        path: item.filePath
      }));

    // 显示保存对话框
    const result = await eagle.dialog.showSaveDialog({
      title: '导出图片信息',
      defaultPath: 'image-info.json',
      filters: [
        { name: 'JSON', extensions: ['json'] }
      ]
    });

    if (result.filePath) {
      fs.writeFileSync(result.filePath, JSON.stringify(imageInfo, null, 2));

      eagle.notification.show({
        title: '导出完成',
        message: `已保存到 ${path.basename(result.filePath)}`,
        type: 'success'
      });
    }

  } catch (error) {
    eagle.log.error('导出错误:', error);
  }
}
```

---

### 示例 2: 标签管理器

管理选中项目的标签。

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>标签管理器</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 20px;
    }
    .tag-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 10px 0;
    }
    .tag {
      background: #e0e0e0;
      padding: 5px 10px;
      border-radius: 12px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <h1>标签管理器</h1>

  <div>
    <h2>库中所有标签</h2>
    <div id="all-tags" class="tag-list"></div>
  </div>

  <div>
    <h2>选中项目的标签</h2>
    <div id="selected-tags" class="tag-list"></div>
  </div>

  <script>
    async function loadAllTags() {
      try {
        const tags = await eagle.tag.getAll();
        const container = document.getElementById('all-tags');

        container.innerHTML = tags.map(tag => `
          <div class="tag" style="background-color: ${tag.color}20;">
            ${tag.name}
          </div>
        `).join('');

      } catch (error) {
        eagle.log.error('加载标签失败:', error);
      }
    }

    async function loadSelectedTags() {
      try {
        const items = await eagle.item.getSelected();
        const tagSet = new Set();

        items.forEach(item => {
          item.tags.forEach(tag => tagSet.add(tag));
        });

        const container = document.getElementById('selected-tags');
        container.innerHTML = Array.from(tagSet).map(tag => `
          <div class="tag">${tag}</div>
        `).join('');

      } catch (error) {
        eagle.log.error('加载选中标签失败:', error);
      }
    }

    // 启动时加载
    loadAllTags();
    loadSelectedTags();

    // 监听选择变化
    eagle.event.on('selectionChanged', loadSelectedTags);
  </script>
</body>
</html>
```

---

### 示例 3: 自定义查看器

类似 MangaStream 的连续查看器。

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>自定义查看器</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      background: #1a1a1a;
      overflow-y: scroll;
      overflow-x: hidden;
    }

    #container {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }

    .image-wrapper {
      margin: 0 0 2px 0;
      text-align: center;
    }

    .image-wrapper img {
      width: 100%;
      height: auto;
      display: block;
    }

    #controls {
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.7);
      padding: 10px;
      border-radius: 4px;
      color: white;
      z-index: 1000;
    }

    button {
      padding: 5px 10px;
      margin: 2px;
      background: #007AFF;
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div id="controls">
    <div id="progress">加载中...</div>
    <button onclick="zoomIn()">放大</button>
    <button onclick="zoomOut()">缩小</button>
    <button onclick="resetZoom()">重置</button>
  </div>

  <div id="container"></div>

  <script>
    let currentZoom = 100;

    async function loadImages() {
      try {
        const items = await eagle.item.getSelected();

        // 仅过滤图片
        const images = items.filter(item =>
          item.ext.match(/\.(jpg|jpeg|png|gif|webp)$/i)
        );

        if (images.length === 0) {
          document.getElementById('container').innerHTML =
            '<p style="color: white; text-align: center; margin-top: 50px;">未选择图片</p>';
          return;
        }

        // 显示图片
        const container = document.getElementById('container');
        container.innerHTML = images.map((img, index) => `
          <div class="image-wrapper">
            <img src="${img.url}" alt="${img.name}" loading="lazy" />
          </div>
        `).join('');

        document.getElementById('progress').textContent =
          `已加载 ${images.length} 张图片`;

        eagle.log.info(`已加载 ${images.length} 张图片`);

      } catch (error) {
        eagle.log.error('加载图片失败:', error);
        eagle.notification.show({
          title: '错误',
          message: error.message,
          type: 'error'
        });
      }
    }

    function zoomIn() {
      currentZoom += 10;
      updateZoom();
    }

    function zoomOut() {
      currentZoom = Math.max(10, currentZoom - 10);
      updateZoom();
    }

    function resetZoom() {
      currentZoom = 100;
      updateZoom();
    }

    function updateZoom() {
      const container = document.getElementById('container');
      container.style.maxWidth = `${800 * (currentZoom / 100)}px`;
      document.getElementById('progress').textContent =
        `缩放: ${currentZoom}%`;
    }

    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          zoomIn();
        } else if (e.key === '-') {
          e.preventDefault();
          zoomOut();
        } else if (e.key === '0') {
          e.preventDefault();
          resetZoom();
        }
      }
    });

    // 启动时加载图片
    loadImages();
  </script>
</body>
</html>
```

---

### 示例 4: 后台服务监控

监控新添加的项目。

**manifest.json:**
```json
{
  "id": "item-monitor",
  "name": "项目监控器",
  "version": "1.0.0",
  "description": "监控添加到库中的新项目",
  "main": "background.js",
  "type": "background"
}
```

**background.js:**
```javascript
let itemCount = 0;

async function initialize() {
  eagle.log.info('项目监控器已启动');

  // 获取初始计数
  const items = await eagle.item.getAll();
  itemCount = items.length;
  eagle.log.info(`初始项目计数: ${itemCount}`);

  // 监听项目添加
  eagle.event.on('itemAdded', handleItemAdded);
}

function handleItemAdded(item) {
  itemCount++;

  eagle.log.info(`新项目已添加: ${item.name}`);
  eagle.log.info(`总项目数: ${itemCount}`);

  // 显示通知
  eagle.notification.show({
    title: '新项目已添加',
    message: `${item.name} (总计: ${itemCount})`,
    type: 'info'
  });
}

// 启动服务
initialize();
```

---

## 最佳实践

### 1. 始终检查选中项目

```javascript
async function processItems() {
  const items = await eagle.item.getSelected();

  if (!items || items.length === 0) {
    eagle.notification.show({
      message: '未选择任何项目',
      type: 'warning'
    });
    return;
  }

  // 继续处理...
}
```

### 2. 优雅的错误处理

```javascript
async function safeOperation() {
  try {
    const items = await eagle.item.getSelected();
    // 处理项目...

  } catch (error) {
    eagle.log.error('操作失败:', error);
    eagle.notification.show({
      title: '错误',
      message: error.message,
      type: 'error'
    });
  }
}
```

### 3. 提供用户反馈

```javascript
async function longOperation() {
  eagle.notification.show({
    message: '处理中...',
    type: 'info'
  });

  // 执行操作...

  eagle.notification.show({
    message: '完成！',
    type: 'success'
  });
}
```

### 4. 使用异步/等待

```javascript
// 好的做法
async function getData() {
  const items = await eagle.item.getSelected();
  const library = await eagle.library.get();
  return { items, library };
}

// 避免
function getData() {
  eagle.item.getSelected().then(items => {
    eagle.library.get().then(library => {
      // 回调地狱...
    });
  });
}
```

### 5. 清理事件监听器

```javascript
let handler = null;

function startListening() {
  handler = (items) => {
    console.log('选择已更改', items);
  };
  eagle.event.on('selectionChanged', handler);
}

function stopListening() {
  if (handler) {
    eagle.event.off('selectionChanged', handler);
    handler = null;
  }
}
```

### 6. 性能优化

```javascript
// 批量处理
async function processBatch(items) {
  const batchSize = 50;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await processBatchItems(batch);

    // 更新进度
    eagle.notification.show({
      message: `处理中 ${Math.min(i + batchSize, items.length)}/${items.length}`,
      type: 'info'
    });
  }
}
```

### 7. 调试技巧

```javascript
// 开发时启用详细日志
const DEBUG = true;

function debug(...args) {
  if (DEBUG) {
    eagle.log.debug(...args);
  }
}

async function operation() {
  debug('开始操作');
  const items = await eagle.item.getSelected();
  debug('获取到项目:', items.length);
  // ...
}
```

### 8. 国际化支持

```javascript
// 从 manifest 获取翻译
function t(key) {
  const manifest = require('./manifest.json');
  const locale = eagle.app.getLocale();
  const i18n = manifest.i18n || {};
  const lang = i18n[locale] || i18n['en'] || {};
  return lang[key] || key;
}

// 使用
document.getElementById('title').textContent = t('title');
```

---

## 常见问题解决

### 插件不显示

- 检查 manifest.json 语法
- 确认 `id` 是唯一的
- 确保 `main` 文件存在

### API 不工作

- 确认使用的是 `eagle` 全局对象
- 检查 API 方法是否存在于文档中
- 正确处理 Promise（使用 async/await）

### 权限问题

- Eagle 插件拥有完全访问权限，无权限系统
- 访问本地文件时检查路径是否为绝对路径

### 性能问题

- 使用懒加载（`loading="lazy"`）
- 批量处理大量项目
- 缓存 API 结果，避免重复调用
- 使用防抖（debounce）限制事件处理频率

---

## 开发资源

- **官方文档**: https://developer.eagle.cool/plugin-api/zh-cn
- **开发者工具**: Ctrl+Shift+I（在插件窗口中）
- **社区支持**: 加入 Eagle 开发者社区获取帮助

---

## 总结

Eagle 插件开发提供了强大而灵活的 API，让您能够：

✅ 访问和管理 Eagle 中的所有内容
✅ 创建自定义用户界面
✅ 使用 Node.js 的完整功能
✅ 集成第三方服务和工具
✅ 自动化重复性任务
✅ 增强 Eagle 的核心功能

遵循本指南中的最佳实践，您将能够创建高质量、用户友好的 Eagle 插件。

---

**文档版本**: 1.0.0
**最后更新**: 2026-01-06
**适用于**: Eagle 3.0+
