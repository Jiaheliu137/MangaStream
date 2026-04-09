// 键盘快捷键和UI控制模块
import { applyZoomWithMouseCenter, getCurrentZoom } from './zoom.js';
import { showScrollbars } from './scrollbar.js';
import { loadSelectedItems } from './imageLoader.js';
import { exportCurrentImagesToPDF } from './pdfExport.js';
import { ZoomConfig, ScrollConfig } from './constants.js';

// UI组件可见性状态
let uiComponentsVisible = true;

// Eagle 主题映射：eagle.app.theme 值 -> CSS 类名
const EAGLE_THEME_MAP = {
    'Auto': null, // 由 isDarkColors 决定
    'LIGHT': 'theme-light',
    'LIGHTGRAY': 'theme-lightgray',
    'GRAY': 'theme-gray',
    'DARK': 'theme-dark',
    'BLUE': 'theme-blue',
    'PURPLE': 'theme-purple'
};

// 所有可切换的主题
const ALL_THEMES = ['theme-light', 'theme-lightgray', 'theme-gray', 'theme-dark', 'theme-blue', 'theme-purple'];
let currentThemeIndex = 0;

import { toggleReadingMode, isHorizontalMode, isHorizontalLTRMode, isHorizontalRTLMode } from './modeManager.js';

// 应用主题（内部通用函数）
function applyTheme(themeClass) {
    // 移除所有主题类
    ALL_THEMES.forEach(t => document.body.classList.remove(t));
    document.body.classList.add(themeClass);

    // 同步 currentThemeIndex
    const idx = ALL_THEMES.indexOf(themeClass);
    if (idx !== -1) currentThemeIndex = idx;

    // 更新面板选中状态
    updateSwatchActive();
}

// 从 Eagle 同步主题
export function syncEagleTheme() {
    if (typeof eagle === 'undefined' || !eagle.app) return;
    const eagleTheme = eagle.app.theme;
    let themeClass = EAGLE_THEME_MAP[eagleTheme];

    // Auto 模式：根据系统深色判断
    if (!themeClass) {
        themeClass = eagle.app.isDarkColors() ? 'theme-gray' : 'theme-light';
    }

    applyTheme(themeClass);
}


// 初始化刷新按钮
export function initRefreshButton() {
    const refreshButton = document.getElementById('refresh-button');
    if (!refreshButton) return;
    const refreshIcon = refreshButton.querySelector('.refresh-icon');

    refreshButton.addEventListener('click', () => {
        // 添加旋转动画类
        refreshButton.classList.add('refreshing');
        
        // 执行刷新操作
        loadSelectedItems();
        
        // 动画完成后移除类
        setTimeout(() => {
            refreshButton.classList.remove('refreshing');
        }, 500);
    });
}

// 初始化固定按钮（标题栏中的pin按钮）
export function initPinButton() {
    const pinButton = document.getElementById('titlebar-pin');
    if (!pinButton) return;
    const pinNormal = pinButton.querySelector('.pin-icon-normal');
    const pinPinned = pinButton.querySelector('.pin-icon-pinned');
    let isPinned = false;

    pinButton.addEventListener('click', () => {
        isPinned = !isPinned;

        if (isPinned) {
            pinButton.classList.add('active');
            pinButton.title = i18next.t('ui.unpinWindow');
            if (pinNormal) pinNormal.style.display = 'none';
            if (pinPinned) pinPinned.style.display = '';
            eagle.window.setAlwaysOnTop(true)
                .then(() => eagle.window.focus())
                .catch(err => console.error('Error setting window on top:', err));
        } else {
            pinButton.classList.remove('active');
            pinButton.title = i18next.t('ui.pinWindow');
            if (pinNormal) pinNormal.style.display = '';
            if (pinPinned) pinPinned.style.display = 'none';
            eagle.window.setAlwaysOnTop(false)
                .then(() => eagle.window.focus())
                .catch(err => console.error('Error clearing window on top:', err));
        }
    });
}

// 更新最大化按钮图标（全屏 vs 还原）
function updateMaximizeIcon() {
    const maximizeIcon = document.querySelector('#titlebar-maximize .maximize-icon');
    const restoreIcon = document.querySelector('#titlebar-maximize .restore-icon');
    if (!maximizeIcon || !restoreIcon) return;

    if (document.fullscreenElement) {
        maximizeIcon.style.display = 'none';
        restoreIcon.style.display = '';
    } else {
        maximizeIcon.style.display = '';
        restoreIcon.style.display = 'none';
    }
}

// 初始化标题栏按钮（最小化、最大化、关闭）
export function initTitlebar() {
    const minimizeBtn = document.getElementById('titlebar-minimize');
    const maximizeBtn = document.getElementById('titlebar-maximize');
    const closeBtn = document.getElementById('titlebar-close');
    const titlebarDrag = document.getElementById('titlebar-drag');

    if (minimizeBtn) {
        minimizeBtn.addEventListener('click', () => {
            if (typeof eagle !== 'undefined' && eagle.window && typeof eagle.window.minimize === 'function') {
                eagle.window.minimize().catch(err => console.error('Error minimizing:', err));
            }
        });
    }

    if (maximizeBtn) {
        maximizeBtn.addEventListener('click', async () => {
            try {
                if (!document.fullscreenElement) {
                    await document.documentElement.requestFullscreen();
                } else {
                    await document.exitFullscreen();
                }
            } catch (err) {
                console.error('Error toggling fullscreen:', err);
            }
        });
    }

    // 双击标题栏 → 全屏/还原
    if (titlebarDrag) {
        titlebarDrag.addEventListener('dblclick', async () => {
            try {
                if (!document.fullscreenElement) {
                    await document.documentElement.requestFullscreen();
                } else {
                    await document.exitFullscreen();
                }
            } catch (err) {
                console.error('Error toggling fullscreen:', err);
            }
        });

        // 全屏状态下，拖动标题栏任意方向退出全屏
        let dragStart = null;
        titlebarDrag.addEventListener('mousedown', (e) => {
            if (document.fullscreenElement) {
                dragStart = { x: e.screenX, y: e.screenY };
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (dragStart && document.fullscreenElement) {
                const dx = Math.abs(e.screenX - dragStart.x);
                const dy = Math.abs(e.screenY - dragStart.y);
                if (dx > 10 || dy > 10) {
                    dragStart = null;
                    document.exitFullscreen().catch(() => {});
                }
            }
        });

        document.addEventListener('mouseup', () => {
            dragStart = null;
        });
    }

    // 监听全屏状态变化，同步图标 + 调整拖拽区域
    document.addEventListener('fullscreenchange', () => {
        updateMaximizeIcon();
        // 全屏时禁用系统拖拽，以便鼠标事件能正常触发退出全屏
        if (titlebarDrag) {
            titlebarDrag.style.webkitAppRegion = document.fullscreenElement ? 'no-drag' : 'drag';
        }
    });

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (typeof eagle !== 'undefined' && eagle.window && typeof eagle.window.close === 'function') {
                eagle.window.close();
            } else {
                window.close();
            }
        });
    }
}

// 初始化键盘快捷键
export function initKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
        // 检查是否在输入框中，避免误触发
        const isInputFocused = event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.isContentEditable;

        // Ctrl+加号或等号(+/=)：放大
        if (event.ctrlKey && (event.key === '+' || event.key === '=')) {
            event.preventDefault();

            const oldZoom = getCurrentZoom();
            let newZoom = oldZoom + 0.1;
            newZoom = Math.min(ZoomConfig.MAX_ZOOM, newZoom);

            applyZoomWithMouseCenter(newZoom, oldZoom);
            showScrollbars();
        }

        // Ctrl+减号(-)：缩小
        if (event.ctrlKey && event.key === '-') {
            event.preventDefault();

            const oldZoom = getCurrentZoom();
            let newZoom = oldZoom - 0.1;
            newZoom = Math.max(ZoomConfig.MIN_ZOOM, newZoom);

            applyZoomWithMouseCenter(newZoom, oldZoom);
            showScrollbars();
        }

        // F键：进入全屏
        if (!isInputFocused && event.key.toLowerCase() === 'f') {
            event.preventDefault();
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
            }
        }

        // Esc键：关闭面板/退出全屏（按优先级逐层关闭）
        if (event.key === 'Escape') {
            const helpOverlay = document.getElementById('help-overlay');
            const themePanel = document.getElementById('theme-panel');

            if (helpOverlay && helpOverlay.classList.contains('visible')) {
                helpOverlay.classList.remove('visible');
            } else if (themePanel && themePanel.classList.contains('visible')) {
                themePanel.classList.remove('visible');
            } else if (document.fullscreenElement) {
                document.exitFullscreen();
            }
        }

        // H键：隐藏/显示UI组件
        if (!isInputFocused && event.key.toLowerCase() === 'h') {
            event.preventDefault();

            uiComponentsVisible = !uiComponentsVisible;
            const displayValue = uiComponentsVisible ? 'flex' : 'none';

            ['refresh-button', 'export-pdf-button', 'theme-button', 'mode-button', 'zoom-button', 'help-button'].forEach(id => {
                const btn = document.getElementById(id);
                if (btn) btn.style.display = displayValue;
            });
        }

        // I键：显示/隐藏快捷键帮助
        if (!isInputFocused && event.key.toLowerCase() === 'i') {
            event.preventDefault();
            toggleHelpOverlay();
        }

        // M键：切换排版模式
        if (!isInputFocused && event.key.toLowerCase() === 'm') {
            event.preventDefault();
            toggleReadingMode();
            updateModeButtonIcon();
        }

        // B键：顺序切换主题色
        if (!isInputFocused && !event.shiftKey && !event.ctrlKey && event.key.toLowerCase() === 'b') {
            event.preventDefault();
            cycleNextTheme();
        }

        // Shift+T：切换固定窗口（与官方一致）
        if (!isInputFocused && event.shiftKey && event.key.toLowerCase() === 't') {
            event.preventDefault();
            const pinButton = document.getElementById('titlebar-pin');
            if (pinButton) {
                pinButton.click();

                if (typeof eagle !== 'undefined' && eagle.window && typeof eagle.window.focus === 'function') {
                    eagle.window.focus();
                }
            }
        }

        // Ctrl+W：关闭窗口
        if (event.ctrlKey && event.key === 'w') {
            event.preventDefault();

            if (typeof eagle !== 'undefined' && eagle.window && typeof eagle.window.close === 'function') {
                eagle.window.close();
            }
        }

        // 键盘滚动控制 (W/S/A/D, Up/Down/Left/Right, Space)
        if (!isInputFocused && !event.ctrlKey && !event.altKey && !event.metaKey) {
            const viewportEl = document.getElementById('viewport');
            if (viewportEl) {
                const scrollAmount = ScrollConfig.ARROW_SCROLL_PX;
                const horizontal = isHorizontalMode();
                const rtl = isHorizontalRTLMode();
                const pageScrollAmount = (horizontal ? viewportEl.clientWidth : viewportEl.clientHeight) * ScrollConfig.PAGE_SCROLL_RATIO;

                let handled = false;

                // RTL flips the horizontal direction: Next page (Right/Down) effectively moves the scroll left (negative delta)
                const getHDelta = (baseAmount) => rtl ? -baseAmount : baseAmount;

                switch (event.key) {
                    case 'ArrowDown':
                    case 's':
                    case 'S':
                        if (horizontal) viewportEl.scrollBy({ left: getHDelta(scrollAmount), behavior: 'auto' });
                        else viewportEl.scrollBy({ top: scrollAmount, behavior: 'auto' });
                        handled = true;
                        break;
                    case 'ArrowRight':
                    case 'd':
                    case 'D':
                        if (horizontal) {
                            viewportEl.scrollBy({ left: getHDelta(scrollAmount), behavior: 'auto' });
                            handled = true;
                        }
                        break;
                    case 'ArrowUp':
                    case 'w':
                    case 'W':
                        if (horizontal) viewportEl.scrollBy({ left: getHDelta(-scrollAmount), behavior: 'auto' });
                        else viewportEl.scrollBy({ top: -scrollAmount, behavior: 'auto' });
                        handled = true;
                        break;
                    case 'ArrowLeft':
                    case 'a':
                    case 'A':
                        if (horizontal) {
                            viewportEl.scrollBy({ left: getHDelta(-scrollAmount), behavior: 'auto' });
                            handled = true;
                        }
                        break;
                    case ' ': // Space
                        const delta = event.shiftKey ? -pageScrollAmount : pageScrollAmount;
                        if (horizontal) viewportEl.scrollBy({ left: getHDelta(delta), behavior: 'auto' });
                        else viewportEl.scrollBy({ top: delta, behavior: 'auto' });
                        handled = true;
                        break;
                }

                if (handled) {
                    event.preventDefault();
                }
            }
        }

        // Ctrl+R：刷新内容
        if (event.ctrlKey && (event.key === 'r' || event.key === 'R')) {
            event.preventDefault();
            loadSelectedItems();
        }

        // Ctrl+E：导出PDF
        if (event.ctrlKey && event.key === 'e') {
            event.preventDefault();
            exportCurrentImagesToPDF();
        }
    });
}

// 显示 Toast 消息（通用）
export function showToast(message, type = 'success', duration = 3000, id = null) {
    if (id) {
        const existingToast = document.getElementById(id);
        if (existingToast) existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast-message ${type} ${id ? id : ''}`;
    if (id) toast.id = id;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        if (document.body.contains(toast)) {
            toast.remove();
        }
    }, duration);
}

// 清除所有残留的 toast 和进度指示器
export function clearAllToasts() {
    document.querySelectorAll('.toast-message').forEach(el => el.remove());
    const progress = document.getElementById('export-progress-indicator');
    if (progress) progress.remove();
}

// 显示导出进度
export function showExportProgress(current, total, message) {
    if (message === undefined) message = i18next.t('pdf.processing');
    let progressIndicator = document.getElementById('export-progress-indicator');

    if (!progressIndicator) {
        progressIndicator = document.createElement('div');
        progressIndicator.id = 'export-progress-indicator';
        document.body.appendChild(progressIndicator);
    }

    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
    progressIndicator.innerHTML = `
        <div style="margin-bottom: 15px;">${message}</div>
        <div style="font-size: 24px; font-weight: bold;">${percentage}%</div>
        <div style="margin-top: 10px; font-size: 14px; color: #aaa;">${current} / ${total}</div>
        <div class="progress-bar-container">
            <div class="progress-bar-fill" style="width: ${percentage}%;"></div>
        </div>
    `;
}

// 隐藏导出进度
export function hideExportProgress() {
    const progressIndicator = document.getElementById('export-progress-indicator');
    if (progressIndicator) {
        progressIndicator.remove();
    }
}

// 顺序切换到下一个主题
function cycleNextTheme() {
    currentThemeIndex = (currentThemeIndex + 1) % ALL_THEMES.length;
    applyTheme(ALL_THEMES[currentThemeIndex]);
}

// 初始化主题切换按钮（悬浮显示面板，点击顺序切换）
export function initThemeButton() {
    const themeButton = document.getElementById('theme-button');
    const themePanel = document.getElementById('theme-panel');
    if (!themeButton || !themePanel || themeButton._initialized) return;
    themeButton._initialized = true;

    let hideTimer = null;

    function showPanel() {
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        updateSwatchActive();
        themePanel.classList.add('visible');
    }

    function scheduleHide() {
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
            themePanel.classList.remove('visible');
            hideTimer = null;
        }, 300);
    }

    // 悬浮按钮 → 显示面板
    themeButton.addEventListener('mouseenter', showPanel);
    themeButton.addEventListener('mouseleave', scheduleHide);

    // 悬浮面板 → 保持面板可见
    themePanel.addEventListener('mouseenter', () => {
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    });
    themePanel.addEventListener('mouseleave', scheduleHide);

    // 点击按钮 → 顺序切换主题
    themeButton.addEventListener('click', (e) => {
        e.stopPropagation();
        cycleNextTheme();
    });

    // 点击色卡 → 切换到指定主题
    themePanel.querySelectorAll('.theme-swatch').forEach(swatch => {
        swatch.addEventListener('click', (e) => {
            e.stopPropagation();
            const theme = swatch.getAttribute('data-theme');
            applyTheme(theme);
        });
    });
}

// 更新色卡的选中状态
function updateSwatchActive() {
    const panel = document.getElementById('theme-panel');
    if (!panel) return;
    const current = ALL_THEMES[currentThemeIndex];
    panel.querySelectorAll('.theme-swatch').forEach(s => {
        s.classList.toggle('active', s.getAttribute('data-theme') === current);
    });
}

// 初始化排版模式切换按钮
export function initModeButton() {
    const modeButton = document.getElementById('mode-button');
    if (!modeButton || modeButton._initialized) return;
    modeButton._initialized = true;

    modeButton.addEventListener('click', () => {
        toggleReadingMode();
        updateModeButtonIcon();
    });

    updateModeButtonIcon();
}

export function updateModeButtonIcon() {
    const modeButton = document.getElementById('mode-button');
    if (!modeButton) return;
    const iconSpan = modeButton.querySelector('.mode-icon');
    if (!iconSpan) return;

    if (isHorizontalLTRMode()) {
        iconSpan.textContent = '⇒';
        modeButton.title = i18next.t('mode.switchToLTR');
    } else if (isHorizontalRTLMode()) {
        iconSpan.textContent = '⇐';
        modeButton.title = i18next.t('mode.switchToRTL');
    } else {
        iconSpan.textContent = '⇕';
        modeButton.title = i18next.t('mode.switchToVertical');
    }
}

// ==================== 快捷键帮助面板 ====================
function createHelpOverlay() {
    let overlay = document.getElementById('help-overlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'help-overlay';
    overlay.innerHTML = `
        <div id="help-panel">
            <h2>${i18next.t('help.title')}</h2>
            <div id="help-panel-body">
                <table>
                    <tr><td><kbd>W</kbd> / <kbd>S</kbd> / <kbd>↑</kbd> / <kbd>↓</kbd></td><td>${i18next.t('help.scrollDown')}</td></tr>
                    <tr><td><kbd>Space</kbd></td><td>${i18next.t('help.pageDown')}</td></tr>
                    <tr><td><kbd>Shift</kbd> + <kbd>Space</kbd></td><td>${i18next.t('help.pageUp')}</td></tr>
                    <tr><td><kbd>M</kbd></td><td>${i18next.t('help.switchMode')}</td></tr>
                    <tr><td><kbd>B</kbd></td><td>${i18next.t('help.switchTheme')}</td></tr>
                    <tr><td><kbd>Ctrl</kbd> + <kbd>Wheel</kbd></td><td>${i18next.t('help.ctrlWheel')}</td></tr>
                    <tr><td><kbd>LClick</kbd> + <kbd>Wheel</kbd></td><td>${i18next.t('help.leftClickWheel')}</td></tr>
                    <tr><td><kbd>Ctrl</kbd> + <kbd>+</kbd></td><td>${i18next.t('help.zoomIn')}</td></tr>
                    <tr><td><kbd>Ctrl</kbd> + <kbd>-</kbd></td><td>${i18next.t('help.zoomOut')}</td></tr>
                    <tr><td><kbd>Ctrl</kbd> + <kbd>0</kbd></td><td>${i18next.t('help.zoomReset')}</td></tr>
                    <tr><td><kbd>Ctrl</kbd> + <kbd>R</kbd></td><td>${i18next.t('help.refresh')}</td></tr>
                    <tr><td><kbd>Ctrl</kbd> + <kbd>E</kbd></td><td>${i18next.t('help.exportPdf')}</td></tr>
                    <tr><td><kbd>Ctrl</kbd> + <kbd>W</kbd></td><td>${i18next.t('help.closeWindow')}</td></tr>
                    <tr><td><kbd>Shift</kbd> + <kbd>T</kbd></td><td>${i18next.t('help.pinWindow')}</td></tr>
                    <tr><td><kbd>F</kbd></td><td>${i18next.t('help.fullscreen')}</td></tr>
                    <tr><td><kbd>Esc</kbd></td><td>${i18next.t('help.exitFullscreen')}</td></tr>
                    <tr><td><kbd>H</kbd></td><td>${i18next.t('help.hideUI')}</td></tr>
                    <tr><td><kbd>I</kbd></td><td>${i18next.t('help.showHelp')}</td></tr>
                    <tr><td>${i18next.t('help.dragToScroll')}</td><td></td></tr>
                </table>
                <div class="help-footer">${i18next.t('help.clickAnywhere')}</div>
            </div>
        </div>
    `;

    // 点击遮罩层（面板外部）关闭
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            toggleHelpOverlay();
        }
    });

    document.body.appendChild(overlay);
    return overlay;
}

function toggleHelpOverlay() {
    let overlay = document.getElementById('help-overlay');
    if (!overlay) {
        overlay = createHelpOverlay();
        // 强制 reflow 后再添加 visible，确保过渡动画生效
        void overlay.offsetHeight;
        overlay.classList.add('visible');
    } else if (overlay.classList.contains('visible')) {
        overlay.classList.remove('visible');
    } else {
        // 重新生成内容（语言可能已切换）
        overlay.remove();
        overlay = createHelpOverlay();
        void overlay.offsetHeight;
        overlay.classList.add('visible');
    }
}

// 初始化帮助按钮
export function initHelpButton() {
    const helpButton = document.getElementById('help-button');
    if (!helpButton || helpButton._initialized) return;
    helpButton._initialized = true;

    helpButton.addEventListener('click', () => {
        toggleHelpOverlay();
    });
}

// 缩放步进值（10%）
const ZOOM_BUTTON_STEP = 0.1;

// 初始化缩放控制按钮
export function initZoomButton() {
    const zoomButton = document.getElementById('zoom-button');
    if (!zoomButton || zoomButton._initialized) return;
    zoomButton._initialized = true;

    const zoomPlus = zoomButton.querySelector('.zoom-plus');
    const zoomMinus = zoomButton.querySelector('.zoom-minus');
    const zoomReset = zoomButton.querySelector('.zoom-reset');

    // 点击放大
    if (zoomPlus) {
        zoomPlus.addEventListener('click', (e) => {
            e.stopPropagation();
            const oldZoom = getCurrentZoom();
            let newZoom = oldZoom + ZOOM_BUTTON_STEP;
            newZoom = Math.min(ZoomConfig.MAX_ZOOM, newZoom);
            if (newZoom !== oldZoom) {
                applyZoomWithMouseCenter(newZoom, oldZoom);
                showScrollbars();
            }
        });
    }

    // 点击重置为100%
    if (zoomReset) {
        zoomReset.addEventListener('click', (e) => {
            e.stopPropagation();
            const oldZoom = getCurrentZoom();
            if (Math.abs(oldZoom - 1.0) > 0.001) {
                applyZoomWithMouseCenter(1.0, oldZoom);
                showScrollbars();
            }
        });
    }

    // 点击缩小
    if (zoomMinus) {
        zoomMinus.addEventListener('click', (e) => {
            e.stopPropagation();
            const oldZoom = getCurrentZoom();
            let newZoom = oldZoom - ZOOM_BUTTON_STEP;
            newZoom = Math.max(ZoomConfig.MIN_ZOOM, newZoom);
            if (newZoom !== oldZoom) {
                applyZoomWithMouseCenter(newZoom, oldZoom);
                showScrollbars();
            }
        });
    }

    // 鼠标悬停在按钮上时，滚轮控制缩放
    zoomButton.addEventListener('mouseenter', () => {
        document.body.classList.add('zoom-button-hover');
    });

    zoomButton.addEventListener('mouseleave', () => {
        document.body.classList.remove('zoom-button-hover');
    });

    // 滚轮事件 - 只在悬停时生效
    zoomButton.addEventListener('wheel', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const delta = e.deltaY > 0 ? -ZOOM_BUTTON_STEP : ZOOM_BUTTON_STEP;
        const oldZoom = getCurrentZoom();
        let newZoom = oldZoom + delta;
        newZoom = Math.max(ZoomConfig.MIN_ZOOM, Math.min(ZoomConfig.MAX_ZOOM, newZoom));

        if (Math.abs(newZoom - oldZoom) > 0.001) {
            applyZoomWithMouseCenter(newZoom, oldZoom);
            showScrollbars();
        }
    }, { passive: false });
}
