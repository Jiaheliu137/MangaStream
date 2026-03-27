// 缩放功能模块
import { ZoomConfig } from './constants.js';
import { updateHorizontalScroll, updateVerticalScrollbar, showScrollbars } from './scrollbar.js';

// 全局缩放状态
import { isHorizontalMode, isHorizontalRTLMode, getStandardSizeValue } from './modeManager.js';

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
    const imageWrapper = document.querySelector('.image-wrapper');
    const viewport = document.querySelector('#viewport');
    if (!imageWrapper || !viewport) return;

    const windowSize = isHorizontalMode() ? window.innerHeight : window.innerWidth;

    if (isHorizontalMode()) {
        const STANDARD_MANGA_HEIGHT = getStandardSizeValue();
        const contentHeight = STANDARD_MANGA_HEIGHT * currentZoom;
        const maxOffsetY = Math.max(0, (contentHeight - windowSize) / 2);

        // Y轴边界限制 (因为 currentOffsetX 被我们在水平模式下复用为纵向交叉轴！)
        let clampedOffsetY = Math.max(-maxOffsetY, Math.min(maxOffsetY, currentOffsetX));
        currentOffsetX = clampedOffsetY; // 写回

        const container = document.querySelector('#image-container');
        if (container) {
            container.style.transform = `translateY(calc(-50% + ${currentOffsetX}px)) scale(${currentZoom})`;

            // 重要：RTL必须从 right center 缩放
            container.style.transformOrigin = document.body.classList.contains('horizontal-rtl-mode') ? 'right center' : 'left center';
        }
    } else {
        const STANDARD_MANGA_WIDTH = getStandardSizeValue(); // Assuming this is how STANDARD_MANGA_WIDTH is obtained
        const contentWidth = STANDARD_MANGA_WIDTH * currentZoom;
        const maxOffsetX = Math.max(0, (contentWidth - windowSize) / 2);

        // X轴边界限制
        let clampedOffsetX = Math.max(-maxOffsetX, Math.min(maxOffsetX, currentOffsetX));
        currentOffsetX = clampedOffsetX;

        const container = document.querySelector('#image-container');
        if (container) {
            container.style.transform = `translateX(calc(-50% + ${currentOffsetX}px)) scale(${currentZoom})`;
        }
    }

    updateHorizontalScroll(currentZoom);
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
    if (Math.abs(newZoom - oldZoom) < 0.001) return;

    const viewport = document.querySelector('#viewport');

    if (isHorizontalMode()) {
        const scrollLeft = viewport ? viewport.scrollLeft : 0;
        const scaleRatio = newZoom / oldZoom;
        const newScrollLeft = scrollLeft * scaleRatio;
        if (viewport) viewport.scrollLeft = newScrollLeft;
    } else {
        const scrollTop = viewport ? viewport.scrollTop : 0;
        const scaleRatio = newZoom / oldZoom;
        const newScrollTop = scrollTop * scaleRatio;
        if (viewport) viewport.scrollTop = newScrollTop;
    }

    currentZoom = newZoom;
    applyContentPosition();
    updateVerticalScrollbar();
    showZoomLevel(newZoom);
    showScrollbars();
}

// 应用缩放
export function applyZoom(zoomLevel) {
    applyZoomWithMouseCenter(zoomLevel, currentZoom);
}

// 初始化缩放功能
export function initZoomFeature() {
    resetContentPosition();

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
        } else if (isHorizontalMode() && !event.shiftKey) {
            const viewport = document.getElementById('viewport');
            if (viewport && event.deltaY !== 0) {
                const delta = isHorizontalRTLMode() ? -event.deltaY : event.deltaY;
                viewport.scrollLeft += delta;
                event.preventDefault(); // 阻止原生的垂直滚动
            }
        }
    }, { passive: false });

    // Ctrl+0 重置缩放
    document.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.key === '0') {
            event.preventDefault();
            const oldZoom = currentZoom;
            currentOffsetX = 0;
            applyZoomWithMouseCenter(1.0, oldZoom);
        }
    });
}
