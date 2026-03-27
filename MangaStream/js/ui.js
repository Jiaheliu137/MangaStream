// 键盘快捷键和UI控制模块
import { applyZoomWithMouseCenter, getCurrentZoom, setCurrentOffset } from './zoom.js';
import { showScrollbars } from './scrollbar.js';
import { loadSelectedItems } from './imageLoader.js';
import { exportCurrentImagesToPDF } from './pdfExport.js';
import { ZoomConfig } from './constants.js';

// UI组件可见性状态
let uiComponentsVisible = true;

// 主题状态
const themes = ['theme-dark', 'theme-pure-black', 'theme-light'];
let currentThemeIndex = 0;

import { toggleReadingMode, isHorizontalMode, isHorizontalLTRMode, isHorizontalRTLMode } from './modeManager.js';

export function toggleTheme() {
    document.body.classList.remove(themes[currentThemeIndex]);
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    document.body.classList.add(themes[currentThemeIndex]);

    const iconData = ['◐', '✰', '☀'];
    const themeButton = document.getElementById('theme-button');
    if (themeButton) {
        const iconSpan = themeButton.querySelector('.theme-icon');
        if (iconSpan) {
            iconSpan.textContent = iconData[currentThemeIndex];
        }
    }
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

// 初始化固定按钮
export function initPinButton() {
    const pinButton = document.getElementById('pin-button');
    if (!pinButton) return;
    const pinIcon = pinButton.querySelector('.pin-icon');
    let isPinned = false;

    pinButton.addEventListener('click', () => {
        isPinned = !isPinned;

        if (isPinned) {
            pinButton.classList.add('active');
            pinIcon.textContent = '📌';
            pinButton.title = '取消固定窗口';
            eagle.window.setAlwaysOnTop(true)
                .then(() => eagle.window.focus())
                .catch(err => console.error('设置窗口置顶失败:', err));
        } else {
            pinButton.classList.remove('active');
            pinIcon.textContent = '📌';
            pinButton.title = '固定窗口在最前端';
            eagle.window.setAlwaysOnTop(false)
                .then(() => eagle.window.focus())
                .catch(err => console.error('取消窗口置顶失败:', err));
        }
    });
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

        // Esc键：退出全屏
        if (event.key === 'Escape') {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            }
        }

        // H键：隐藏/显示UI组件
        if (!isInputFocused && event.key.toLowerCase() === 'h') {
            event.preventDefault();

            uiComponentsVisible = !uiComponentsVisible;
            const displayValue = uiComponentsVisible ? 'flex' : 'none';

            ['refresh-button', 'pin-button', 'export-pdf-button', 'theme-button', 'mode-button', 'zoom-button'].forEach(id => {
                const btn = document.getElementById(id);
                if (btn) btn.style.display = displayValue;
            });
        }

        // M键：切换排版模式
        if (!isInputFocused && event.key.toLowerCase() === 'm') {
            event.preventDefault();
            toggleReadingMode();
            updateModeButtonIcon();
        }

        // T键：切换主题
        if (!isInputFocused && event.key.toLowerCase() === 't') {
            event.preventDefault();
            toggleTheme();
        }

        // P键：切换固定窗口
        if (!isInputFocused && event.key.toLowerCase() === 'p') {
            event.preventDefault();
            const pinButton = document.getElementById('pin-button');
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

            if (typeof eagle !== 'undefined' && eagle.window && typeof eagle.window.hide === 'function') {
                eagle.window.hide().catch(err => {
                    console.error('隐藏窗口失败:', err);
                });
            }
        }

        // 键盘滚动控制 (W/S/A/D, Up/Down/Left/Right, Space)
        if (!isInputFocused && !event.ctrlKey && !event.altKey && !event.metaKey) {
            const viewportEl = document.getElementById('viewport');
            if (viewportEl) {
                const scrollAmount = 150; // 每次方向键滚动的像素
                const horizontal = isHorizontalMode();
                const rtl = isHorizontalRTLMode();
                const pageScrollAmount = (horizontal ? viewportEl.clientWidth : viewportEl.clientHeight) * 0.8; // 空格键翻页量（80%视口大小）

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

// 显示导出进度
export function showExportProgress(current, total, message = '正在导出PDF...') {
    let progressIndicator = document.getElementById('export-progress-indicator');

    if (!progressIndicator) {
        progressIndicator = document.createElement('div');
        progressIndicator.id = 'export-progress-indicator';
        document.body.appendChild(progressIndicator);
    }

    const percentage = Math.round((current / total) * 100);
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

// 初始化主题切换按钮
export function initThemeButton() {
    const themeButton = document.getElementById('theme-button');
    if (!themeButton || themeButton._initialized) return;
    themeButton._initialized = true;

    themeButton.addEventListener('click', toggleTheme);
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
        modeButton.title = '切换排版模式 (M): 当前横向从左到右 (点击切换为横排向从右到左)';
    } else if (isHorizontalRTLMode()) {
        iconSpan.textContent = '⇐';
        modeButton.title = '切换排版模式 (M): 当前横向从右到左 (点击切换为竖向)';
    } else {
        iconSpan.textContent = '⇕';
        modeButton.title = '切换排版模式 (M): 当前竖向 (点击切换为横排向从左到右)';
    }
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
