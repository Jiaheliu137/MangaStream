// MangaStream 主入口文件 - 模块化重构版本
// 导入所有模块
import { initZoomFeature } from './zoom.js';
import {
    initCustomScrollbar,
    initVerticalScrollbar,
    setupScrollbarVisibility,
    updateHorizontalScroll,
    updateVerticalScrollbar
} from './scrollbar.js';
import { loadSelectedItems, setImageFixedSize } from './imageLoader.js';
import { initDragFeature } from './drag.js';
import {
    initKeyboardShortcuts,
    initRefreshButton,
    initPinButton,
    addStyles
} from './ui.js';
import { initPDFExportButton } from './pdfExport.js';
import { debounce } from './utils.js';

// 初始化插件
function initializePlugin() {
    const container = document.querySelector('#image-container');
    if (container) {
        setImageFixedSize();
        updateHorizontalScroll(1.0);
        updateVerticalScrollbar();
    }

    if (window.updateAfterZoom) {
        window.updateAfterZoom();
    }
}

// Eagle插件生命周期钩子
eagle.onPluginCreate((plugin) => {
    console.log('eagle.onPluginCreate');

    // 初始化缩放功能
    initZoomFeature();

    // 初始化自定义滚动条
    initCustomScrollbar();
});

eagle.onPluginRun(() => {
    console.log('eagle.onPluginRun');
    loadSelectedItems();
});

eagle.onPluginShow(() => {
    console.log('eagle.onPluginShow');
    loadSelectedItems();
});

eagle.onPluginHide(() => {
    console.log('eagle.onPluginHide');
});

eagle.onPluginBeforeExit((event) => {
    console.log('eagle.onPluginBeforeExit');
});

// 文档加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded - 初始化所有功能');

    // 添加样式
    addStyles();

    // 初始化缩放功能
    initZoomFeature();

    // 初始化自定义滚动条
    initCustomScrollbar();

    // 初始化垂直滚动条
    initVerticalScrollbar();

    // 设置滚动条可见性
    setupScrollbarVisibility();

    // 初始化拖动功能
    initDragFeature();

    // 初始化刷新按钮
    initRefreshButton();

    // 初始化键盘快捷键
    initKeyboardShortcuts();

    // 初始化固定按钮
    initPinButton();

    // 初始化PDF导出按钮
    initPDFExportButton();

    // 初始化完成后检查并处理滚动条状态
    setTimeout(() => {
        updateVerticalScrollbar();
    }, 500);
});

// 窗口大小改变时更新
window.addEventListener('resize', debounce(() => {
    document.body.classList.add('resizing');

    const container = document.querySelector('#image-container');
    if (container) {
        initializePlugin();
    }

    setTimeout(() => {
        document.body.classList.remove('resizing');
    }, 200);
}, 300));
