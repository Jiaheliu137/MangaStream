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
import { initDragFeature, updateCursorStyle } from './drag.js';
import {
    initKeyboardShortcuts,
    initRefreshButton,
    initPinButton,
    initTitlebar,
    initThemeButton,
    initModeButton,
    initZoomButton,
    initHelpButton,
    updateModeButtonIcon,
    syncEagleTheme
} from './ui.js';
import { initPDFExportButton } from './pdfExport.js';
import { debounce } from './utils.js';
import { UIConfig } from './constants.js';

// 初始化插件
function initializePlugin() {
    initThemeButton();
    initModeButton();
    const container = document.querySelector('#image-container');
    if (container) {
        setImageFixedSize();
        updateHorizontalScroll();
        updateVerticalScrollbar();
    }

    updateCursorStyle();
}

// Eagle插件生命周期钩子
eagle.onPluginCreate((plugin) => {
    // 同步 Eagle 主题
    syncEagleTheme();
});

// 监听 Eagle 主题变化，实时同步
eagle.onThemeChanged(() => {
    syncEagleTheme();
});

eagle.onPluginRun(() => {
    // 应用i18n翻译到HTML元素 (确保此阶段i18next已准备就绪)
    applyI18nTitles();
    
    // 更新由JS动态控制的title
    updateModeButtonIcon();
    
    loadSelectedItems();
});

eagle.onPluginShow(() => {
    loadSelectedItems();
});

eagle.onPluginHide(() => {
});

eagle.onPluginBeforeExit((event) => {
});

// 应用 data-i18n-title 翻译
function applyI18nTitles() {
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        el.title = i18next.t(key);
    });
}

// 文档加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
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

    // 初始化标题栏（最小化、关闭、固定）
    initTitlebar();
    initPinButton();

    // 初始化PDF导出按钮
    initPDFExportButton();

    // 初始化模式与主题按钮
    initThemeButton();
    initModeButton();

    // 初始化缩放按钮
    initZoomButton();

    // 初始化帮助按钮
    initHelpButton();

    // 初始化完成后检查并处理滚动条状态
    setTimeout(() => {
        updateVerticalScrollbar();
    }, UIConfig.INIT_SCROLLBAR_DELAY);
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
    }, UIConfig.RESIZE_CLASS_DELAY);
}, UIConfig.RESIZE_DEBOUNCE));
