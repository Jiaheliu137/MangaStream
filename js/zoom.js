// 缩放功能模块
import { ZoomConfig } from './constants.js';
import { updateHorizontalScroll, updateVerticalScrollbar, showScrollbars } from './scrollbar.js';

// 全局缩放状态
let currentZoom = ZoomConfig.DEFAULT_ZOOM;
let zoomLevelTimeout = null;
let currentOffsetX = 0;
let currentOffsetY = 0;

// 获取当前缩放比例
export function getCurrentZoom() {
    return currentZoom;
}

// 获取当前偏移量
export function getCurrentOffset() {
    return { x: currentOffsetX, y: currentOffsetY };
}

// 设置偏移量
export function setCurrentOffset(x, y) {
    if (x !== undefined) currentOffsetX = x;
    if (y !== undefined) currentOffsetY = y;
}

// 应用内容的位置和缩放变换
export function applyContentPosition() {
    const container = document.querySelector('#image-container');
    if (!container) return;

    container.style.transform = `translateX(calc(-50% + ${currentOffsetX}px)) scale(${currentZoom})`;
}

// 重置内容位置到水平居中状态
export function resetContentPosition() {
    currentOffsetX = 0;
    applyContentPosition();
}

// 显示缩放级别指示器
export function showZoomLevel(zoomLevel) {
    let zoomLevelElement = document.getElementById('zoom-level');

    if (!zoomLevelElement) {
        zoomLevelElement = document.createElement('div');
        zoomLevelElement.id = 'zoom-level';
        document.body.appendChild(zoomLevelElement);
    }

    zoomLevelElement.textContent = `${Math.round(zoomLevel * 100)}%`;
    zoomLevelElement.style.opacity = '1';

    clearTimeout(zoomLevelTimeout);
    zoomLevelTimeout = setTimeout(() => {
        zoomLevelElement.style.opacity = '0';
    }, 1500);
}

// 以鼠标位置为中心应用缩放变换
export function applyZoomWithMouseCenter(newZoom, oldZoom) {
    const container = document.querySelector('#image-container');
    if (!container) return;

    document.body.classList.add('scaling');

    const viewport = document.querySelector('#viewport');
    const scrollTop = viewport ? viewport.scrollTop : 0;

    const scaleRatio = newZoom / oldZoom;
    currentOffsetX = currentOffsetX * scaleRatio;
    currentZoom = newZoom;

    applyContentPosition();
    updateHorizontalScroll(newZoom);

    if (viewport) {
        const newScrollTop = scrollTop * scaleRatio;
        viewport.scrollTop = newScrollTop;
    }

    updateVerticalScrollbar();
    showZoomLevel(newZoom);
    showScrollbars();

    setTimeout(() => {
        document.body.classList.remove('scaling');
    }, 100);
}

// 应用缩放
export function applyZoom(zoomLevel) {
    applyZoomWithMouseCenter(zoomLevel, currentZoom);
}

// 初始化缩放功能
export function initZoomFeature() {
    resetContentPosition();

    let wheelEndTimer = null;

    // 监听滚轮事件
    document.addEventListener('wheel', (event) => {
        if (event.ctrlKey) {
            event.preventDefault();

            const delta = event.deltaY > 0 ? -ZoomConfig.ZOOM_STEP : ZoomConfig.ZOOM_STEP;
            const oldZoom = currentZoom;
            let newZoom = oldZoom * (1 + delta);

            newZoom = Math.max(ZoomConfig.MIN_ZOOM, Math.min(ZoomConfig.MAX_ZOOM, newZoom));

            if (Math.abs(newZoom - oldZoom) < 0.01) {
                return;
            }

            applyZoomWithMouseCenter(newZoom, oldZoom);
        }
    }, { passive: false });

    // Ctrl+0 重置缩放
    document.addEventListener('keydown', (event) => {
        if (event.ctrlKey && (event.key === '0' || event.keyCode === 48)) {
            event.preventDefault();
            const oldZoom = currentZoom;
            currentOffsetX = 0;
            applyZoomWithMouseCenter(1.0, oldZoom);
        }
    });
}
