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

    refreshButton.addEventListener('click', () => {
        loadSelectedItems();
    });
}

// 初始化固定按钮
export function initPinButton() {
    const pinButton = document.getElementById('pin-button');
    if (!pinButton) return;
    const pinImage = pinButton.querySelector('img');
    let isPinned = false;

    pinButton.addEventListener('click', () => {
        isPinned = !isPinned;

        if (isPinned) {
            pinButton.classList.add('active');
            pinImage.src = './resources/pin-active.png';
            pinImage.title = '取消固定窗口';
            eagle.window.setAlwaysOnTop(true)
                .then(() => eagle.window.focus())
                .catch(err => console.error('设置窗口置顶失败:', err));
        } else {
            pinButton.classList.remove('active');
            pinImage.src = './resources/pin-deactive.png';
            pinImage.title = '固定窗口在最前端';
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
            let newZoom = oldZoom * 1.05;
            newZoom = Math.min(ZoomConfig.MAX_ZOOM, newZoom);

            applyZoomWithMouseCenter(newZoom, oldZoom);
            showScrollbars();
        }

        // Ctrl+减号(-)：缩小
        if (event.ctrlKey && event.key === '-') {
            event.preventDefault();

            const oldZoom = getCurrentZoom();
            let newZoom = oldZoom * 0.95;
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

            const refreshButton = document.getElementById('refresh-button');
            const pinButton = document.getElementById('pin-button');
            const exportButton = document.getElementById('export-pdf-button');
            const themeButton = document.getElementById('theme-button');

            if (refreshButton) {
                refreshButton.style.display = uiComponentsVisible ? 'flex' : 'none';
            }

            if (pinButton) {
                pinButton.style.display = uiComponentsVisible ? 'flex' : 'none';
            }

            if (exportButton) {
                exportButton.style.display = uiComponentsVisible ? 'flex' : 'none';
            }

            if (themeButton) {
                themeButton.style.display = uiComponentsVisible ? 'flex' : 'none';
            }
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

        // Ctrl+R：刷新
        if (event.ctrlKey && event.key === 'r') {
            event.preventDefault();
            loadSelectedItems();
        }

        // 键盘滚动控制 (W/S, Up/Down, Space)
        if (!isInputFocused && !event.ctrlKey && !event.altKey && !event.metaKey) {
            const viewportEl = document.getElementById('viewport');
            if (viewportEl) {
                const scrollAmount = 150; // 每次方向键/WS滚动的像素
                const pageScrollAmount = viewportEl.clientHeight * 0.8; // 空格键翻页量（80%视口高度）

                let handled = false;
                switch (event.key) {
                    case 'ArrowDown':
                    case 's':
                    case 'S':
                        viewportEl.scrollBy({ top: scrollAmount, behavior: 'auto' });
                        handled = true;
                        break;
                    case 'ArrowUp':
                    case 'w':
                    case 'W':
                        viewportEl.scrollBy({ top: -scrollAmount, behavior: 'auto' });
                        handled = true;
                        break;
                    case ' ': // Space
                        if (event.shiftKey) {
                            viewportEl.scrollBy({ top: -pageScrollAmount, behavior: 'auto' });
                        } else {
                            viewportEl.scrollBy({ top: pageScrollAmount, behavior: 'auto' });
                        }
                        handled = true;
                        break;
                }

                if (handled) {
                    event.preventDefault();
                }
            }
        }

        // Ctrl+E：导出PDF
        if (event.ctrlKey && event.key === 'e') {
            event.preventDefault();
            exportCurrentImagesToPDF();
        }
    });
}

// 显示 Toast 消息（通用）
export function showToast(message, type = 'success', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast-message ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
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
    if (!themeButton) return;

    themeButton.addEventListener('click', toggleTheme);
}
