// 缩放功能模块 — 基于 CSS zoom 的简化实现
// CSS zoom 会真正改变布局尺寸，浏览器自动处理溢出和滚动，
// 不再需要手动 translate 偏移和交叉轴边界钳制。
import { ZoomConfig } from './constants.js';
import { updateVerticalScrollbar, updateCrossAxisScrollbar, showScrollbars } from './scrollbar.js';
import { isHorizontalMode, isHorizontalRTLMode } from './modeManager.js';
import { getDragLogicalScroll, updateDragSnapshot } from './drag.js';
import { forceRenderVisibleItems } from './imageLoader.js';

// 全局缩放状态
let currentZoom = ZoomConfig.DEFAULT_ZOOM;
let zoomLevelTimeout = null;
let isLeftMouseDown = false;

// 获取当前缩放比例
export function getCurrentZoom() {
    return currentZoom;
}

// 应用内容的缩放（仅设置 CSS zoom，布局由浏览器自动处理）
export function applyContentPosition() {
    const container = document.querySelector('#image-container');
    if (!container) return;
    container.style.zoom = currentZoom;
    updateCrossAxisScrollbar();
}

// 重置交叉轴滚动（模式切换时调用）
export function resetContentPosition() {
    const viewport = document.querySelector('#viewport');
    if (viewport) {
        if (isHorizontalMode()) {
            viewport.scrollTop = 0;
        } else {
            viewport.scrollLeft = 0;
        }
    }
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

// 应用缩放并按比例保持滚动位置
export function applyZoomWithMouseCenter(newZoom, oldZoom) {
    if (Math.abs(newZoom - oldZoom) < 0.001) return;

    const viewport = document.querySelector('#viewport');
    const scaleRatio = newZoom / oldZoom;

    // 拖拽中优先使用逻辑滚动位置（未被 Chrome 舍入），避免多次缩放的误差累积
    const dragScroll = getDragLogicalScroll();
    const oldScrollTop = dragScroll ? dragScroll.top : (viewport ? viewport.scrollTop : 0);
    const oldScrollLeft = dragScroll ? dragScroll.left : (viewport ? viewport.scrollLeft : 0);

    // 缩放前检测交叉轴是否已有溢出（未溢出时 scrollLeft=0 但内容由 margin auto 居中，
    // 公式 (0+cx)*ratio-cx 会算错，需要特殊处理）
    const hadCrossOverflowX = viewport ? viewport.scrollWidth > viewport.clientWidth : false;
    const hadCrossOverflowY = viewport ? viewport.scrollHeight > viewport.clientHeight : false;

    // 设置新的 zoom（改变布局尺寸，更新滚动范围）
    currentZoom = newZoom;
    applyContentPosition();

    // 主轴：阅读起始边锚定（顶部/左边/右边不动，内容向阅读方向展开）
    // 交叉轴：中心锚定（放大后保持居中）
    let newScrollLeft = 0, newScrollTop = 0;
    if (viewport) {
        if (isHorizontalMode()) {
            newScrollLeft = oldScrollLeft * scaleRatio;
            // 交叉轴 Y
            if (hadCrossOverflowY) {
                const cy = viewport.clientHeight / 2;
                newScrollTop = (oldScrollTop + cy) * scaleRatio - cy;
            } else {
                newScrollTop = (viewport.scrollHeight - viewport.clientHeight) / 2;
            }
        } else {
            newScrollTop = oldScrollTop * scaleRatio;
            // 交叉轴 X
            if (hadCrossOverflowX) {
                const cx = viewport.clientWidth / 2;
                newScrollLeft = (oldScrollLeft + cx) * scaleRatio - cx;
            } else {
                newScrollLeft = (viewport.scrollWidth - viewport.clientWidth) / 2;
            }
        }
        viewport.scrollLeft = newScrollLeft;
        viewport.scrollTop = newScrollTop;
    }

    // 先让虚拟滚动更新 spacer（scrollHeight 才准确），再更新滚动条
    forceRenderVisibleItems();
    updateVerticalScrollbar();
    updateCrossAxisScrollbar();
    showZoomLevel(newZoom);
    showScrollbars();
    updateDragSnapshot(newScrollLeft, newScrollTop);
}

// 以鼠标位置为主轴锚点缩放（左键+滚轮触发）
// 竖向：鼠标 Y 对应的那行像素不动；横向：鼠标 X 对应的那列像素不动
// 交叉轴保持中心锚定
function applyZoomAtMousePosition(newZoom, oldZoom, mouseX, mouseY) {
    if (Math.abs(newZoom - oldZoom) < 0.001) return;

    const viewport = document.querySelector('#viewport');
    const scaleRatio = newZoom / oldZoom;

    const dragScroll = getDragLogicalScroll();
    const oldScrollTop = dragScroll ? dragScroll.top : (viewport ? viewport.scrollTop : 0);
    const oldScrollLeft = dragScroll ? dragScroll.left : (viewport ? viewport.scrollLeft : 0);

    // 缩放前检测交叉轴溢出状态
    const hadCrossOverflowX = viewport ? viewport.scrollWidth > viewport.clientWidth : false;
    const hadCrossOverflowY = viewport ? viewport.scrollHeight > viewport.clientHeight : false;

    // viewport 相对于页面的偏移（标题栏等）
    const rect = viewport ? viewport.getBoundingClientRect() : { left: 0, top: 0 };
    const mouseInViewportX = mouseX - rect.left;
    const mouseInViewportY = mouseY - rect.top;

    currentZoom = newZoom;
    applyContentPosition();

    let newScrollLeft = 0, newScrollTop = 0;
    if (viewport) {
        if (isHorizontalMode()) {
            // 主轴 X：鼠标所在竖线锚定
            newScrollLeft = (oldScrollLeft + mouseInViewportX) * scaleRatio - mouseInViewportX;
            // 交叉轴 Y
            if (hadCrossOverflowY) {
                const cy = viewport.clientHeight / 2;
                newScrollTop = (oldScrollTop + cy) * scaleRatio - cy;
            } else {
                newScrollTop = (viewport.scrollHeight - viewport.clientHeight) / 2;
            }
        } else {
            // 主轴 Y：鼠标所在横线锚定
            newScrollTop = (oldScrollTop + mouseInViewportY) * scaleRatio - mouseInViewportY;
            // 交叉轴 X
            if (hadCrossOverflowX) {
                const cx = viewport.clientWidth / 2;
                newScrollLeft = (oldScrollLeft + cx) * scaleRatio - cx;
            } else {
                newScrollLeft = (viewport.scrollWidth - viewport.clientWidth) / 2;
            }
        }
        viewport.scrollLeft = newScrollLeft;
        viewport.scrollTop = newScrollTop;
    }

    // 先让虚拟滚动更新 spacer（scrollHeight 才准确），再更新滚动条
    forceRenderVisibleItems();
    updateVerticalScrollbar();
    updateCrossAxisScrollbar();
    showZoomLevel(newZoom);
    showScrollbars();
    updateDragSnapshot(newScrollLeft, newScrollTop);
}

// 应用缩放（便捷入口）
export function applyZoom(zoomLevel) {
    applyZoomWithMouseCenter(zoomLevel, currentZoom);
}

// 初始化缩放功能
export function initZoomFeature() {
    resetContentPosition();

    // 追踪左键状态
    document.addEventListener('mousedown', (e) => {
        if (e.button === 0) isLeftMouseDown = true;
    });
    document.addEventListener('mouseup', (e) => {
        if (e.button === 0) isLeftMouseDown = false;
    });

    // 监听滚轮事件
    document.addEventListener('wheel', (event) => {
        // 左键+滚轮：以鼠标位置为主轴锚点缩放
        if (isLeftMouseDown && !event.ctrlKey) {
            event.preventDefault();

            const delta = event.deltaY > 0 ? -ZoomConfig.ZOOM_STEP : ZoomConfig.ZOOM_STEP;
            const oldZoom = currentZoom;
            let newZoom = oldZoom * (1 + delta);
            newZoom = Math.max(ZoomConfig.MIN_ZOOM, Math.min(ZoomConfig.MAX_ZOOM, newZoom));

            if (Math.abs(newZoom - oldZoom) < 0.01) return;

            applyZoomAtMousePosition(newZoom, oldZoom, event.clientX, event.clientY);
            return;
        }

        // Ctrl+滚轮：阅读起始边锚定缩放
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
            // 横向模式：将垂直滚轮转换为水平滚动
            const viewport = document.getElementById('viewport');
            if (viewport && event.deltaY !== 0) {
                const delta = isHorizontalRTLMode() ? -event.deltaY : event.deltaY;
                viewport.scrollLeft += delta;
                event.preventDefault();
            }
        }
    }, { passive: false });

    // Ctrl+0 重置缩放
    document.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.key === '0') {
            event.preventDefault();
            const oldZoom = currentZoom;
            applyZoomWithMouseCenter(1.0, oldZoom);
        }
    });
}
