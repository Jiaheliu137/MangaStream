// 键盘快捷键和UI控制模块
import { applyZoomWithMouseCenter, getCurrentZoom, setCurrentOffset } from './zoom.js';
import { showScrollbars } from './scrollbar.js';
import { loadSelectedItems } from './imageLoader.js';
import { exportCurrentImagesToPDF } from './pdfExport.js';
import { ZoomConfig } from './constants.js';

// UI组件可见性状态
let uiComponentsVisible = true;

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
        // Ctrl+加号或等号(+/=)：放大
        if (event.ctrlKey && (event.key === '+' || event.key === '=' || event.keyCode === 187)) {
            event.preventDefault();

            const oldZoom = getCurrentZoom();
            let newZoom = oldZoom * 1.05;
            newZoom = Math.min(ZoomConfig.MAX_ZOOM, newZoom);

            applyZoomWithMouseCenter(newZoom, oldZoom);
            showScrollbars();
        }

        // Ctrl+减号(-)：缩小
        if (event.ctrlKey && (event.key === '-' || event.keyCode === 189)) {
            event.preventDefault();

            const oldZoom = getCurrentZoom();
            let newZoom = oldZoom * 0.95;
            newZoom = Math.max(ZoomConfig.MIN_ZOOM, newZoom);

            applyZoomWithMouseCenter(newZoom, oldZoom);
            showScrollbars();
        }

        // F键：进入全屏
        if (event.key.toLowerCase() === 'f') {
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
        if (event.key.toLowerCase() === 'h') {
            event.preventDefault();

            uiComponentsVisible = !uiComponentsVisible;

            const refreshButton = document.getElementById('refresh-button');
            const pinButton = document.getElementById('pin-button');
            const exportButton = document.getElementById('export-pdf-button');

            if (refreshButton) {
                refreshButton.style.display = uiComponentsVisible ? 'flex' : 'none';
            }

            if (pinButton) {
                pinButton.style.display = uiComponentsVisible ? 'flex' : 'none';
            }

            if (exportButton) {
                exportButton.style.display = uiComponentsVisible ? 'flex' : 'none';
            }
        }

        // P键：切换固定窗口
        if (event.key.toLowerCase() === 'p') {
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
        if (event.ctrlKey && (event.key === 'w' || event.keyCode === 87)) {
            event.preventDefault();

            if (typeof eagle !== 'undefined' && eagle.window && typeof eagle.window.hide === 'function') {
                eagle.window.hide().catch(err => {
                    console.error('隐藏窗口失败:', err);
                });
            }
        }

        // Ctrl+R：刷新
        if (event.ctrlKey && (event.key === 'r' || event.keyCode === 82)) {
            event.preventDefault();
            loadSelectedItems();
        }

        // Ctrl+E：导出PDF
        if (event.ctrlKey && (event.key === 'e' || event.keyCode === 69)) {
            event.preventDefault();
            exportCurrentImagesToPDF();
        }
    });
}

// 添加样式
export function addStyles() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes lazy-spin {
            to { transform: rotate(360deg); }
        }

        .loading-message {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 40px;
            color: #888;
            text-align: center;
            width: 100%;
            font-size: 16px;
        }

        .loading-message .spinner {
            width: 24px;
            height: 24px;
            margin-right: 12px;
            border: 2px solid rgba(120, 120, 120, 0.3);
            border-top-color: #888;
            border-radius: 50%;
            animation: lazy-spin 1s linear infinite;
        }

        #image-container.fading-out {
            opacity: 0;
            transition: opacity 500ms ease-out;
        }

        #image-container.fading-in {
            opacity: 1;
            transition: opacity 500ms ease-in;
        }

        #total-count-indicator {
            position: fixed;
            top: 10px;
            left: 10px;
            background-color: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 5px 10px;
            border-radius: 4px;
            z-index: 1000;
            transition: opacity 0.5s ease;
            pointer-events: none;
            font-size: 14px;
            font-weight: bold;
            opacity: 0.8;
            user-select: none;
        }

        /* 懒加载图片占位 */
        .lazy-image {
            background-color: #2a2a2a;
            min-height: 200px;
        }
    `;
    document.head.appendChild(style);
}
