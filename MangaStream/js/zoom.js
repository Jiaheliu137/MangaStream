// 缩放功能模块 — 基于 CSS zoom 的简化实现
// CSS zoom 会真正改变布局尺寸，浏览器自动处理溢出和滚动，
// 不再需要手动 translate 偏移和交叉轴边界钳制。
import { ZoomConfig } from './constants.js';
import { updateVerticalScrollbar, updateCrossAxisScrollbar, showScrollbars } from './scrollbar.js';
import { isHorizontalMode, isHorizontalRTLMode } from './modeManager.js';
import { getDragLogicalScroll, updateDragSnapshot, setDragSuppressed } from './drag.js';
import { forceRenderVisibleItems, physicalToLogical, logicalToPhysical, getCompressionRatio, getTotalSize } from './imageLoader.js';

// 全局缩放状态
let currentZoom = ZoomConfig.DEFAULT_ZOOM;
let zoomLevelTimeout = null;
let isLeftMouseDown = false;
let dragSuppressionTimer = null;

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

    const dragScroll = getDragLogicalScroll();
    const oldScrollTop = dragScroll ? dragScroll.top : (viewport ? viewport.scrollTop : 0);
    const oldScrollLeft = dragScroll ? dragScroll.left : (viewport ? viewport.scrollLeft : 0);

    const hadCrossOverflowX = viewport ? viewport.scrollWidth > viewport.clientWidth : false;
    const hadCrossOverflowY = viewport ? viewport.scrollHeight > viewport.clientHeight : false;

    // 缩放前：用分段公式转换到逻辑坐标（使用 oldZoom）
    const mainAxisScroll = isHorizontalMode() ? Math.abs(oldScrollLeft) : oldScrollTop;
    const logicalMainAxis = physicalToLogical(mainAxisScroll);

    // 设置新的 zoom
    currentZoom = newZoom;
    applyContentPosition();

    // 主轴：分段公式保持逻辑位置不变
    // 交叉轴：中心锚定（无压缩，用线性公式）
    let newScrollLeft = 0, newScrollTop = 0;
    if (viewport) {
        const newMainAxisPhysical = logicalToPhysical(logicalMainAxis);
        if (isHorizontalMode()) {
            newScrollLeft = isHorizontalRTLMode() ? -newMainAxisPhysical : newMainAxisPhysical;
            if (hadCrossOverflowY) {
                const cy = viewport.clientHeight / 2;
                newScrollTop = (oldScrollTop + cy) * scaleRatio - cy;
            } else {
                newScrollTop = (viewport.scrollHeight - viewport.clientHeight) / 2;
            }
        } else {
            newScrollTop = newMainAxisPhysical;
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

    forceRenderVisibleItems();
    updateVerticalScrollbar();
    updateCrossAxisScrollbar();
    showZoomLevel(newZoom);
    showScrollbars();
    // 必须用 adjustment 后的实际 viewport 值，否则下次缩放读到旧基准 → 画面跳动
    updateDragSnapshot(
        viewport ? viewport.scrollLeft : newScrollLeft,
        viewport ? viewport.scrollTop : newScrollTop
    );
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

    const hadCrossOverflowX = viewport ? viewport.scrollWidth > viewport.clientWidth : false;
    const hadCrossOverflowY = viewport ? viewport.scrollHeight > viewport.clientHeight : false;

    const rect = viewport ? viewport.getBoundingClientRect() : { left: 0, top: 0 };
    const mouseInViewportX = mouseX - rect.left;
    const mouseInViewportY = mouseY - rect.top;

    // 缩放前：直接计算鼠标处的逻辑坐标（使用 oldZoom）
    // 不能用 logicalAtTop + mouseInViewport/zoom 线性化，因为分段映射在区域边界不是线性的
    const mainAxisScroll = isHorizontalMode() ? Math.abs(oldScrollLeft) : oldScrollTop;
    const mousePhysicalOffset = isHorizontalMode() ? mouseInViewportX : mouseInViewportY;
    const logicalAtMouse = physicalToLogical(mainAxisScroll + mousePhysicalOffset);

    currentZoom = newZoom;
    applyContentPosition();

    // 缩放后：鼠标处的逻辑位置不变，反算新的 scrollTop
    let newScrollLeft = 0, newScrollTop = 0;
    if (viewport) {
        const newPhysicalAtMouse = logicalToPhysical(logicalAtMouse);
        if (isHorizontalMode()) {
            const rawLeft = newPhysicalAtMouse - mouseInViewportX;
            newScrollLeft = isHorizontalRTLMode() ? -rawLeft : rawLeft;
            if (hadCrossOverflowY) {
                const cy = viewport.clientHeight / 2;
                newScrollTop = (oldScrollTop + cy) * scaleRatio - cy;
            } else {
                newScrollTop = (viewport.scrollHeight - viewport.clientHeight) / 2;
            }
        } else {
            newScrollTop = newPhysicalAtMouse - mouseInViewportY;
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

    forceRenderVisibleItems();

    // forceRenderVisibleItems 的 adjustment 按视口顶部保持，
    // 但本函数的锚点是鼠标位置——当两者落在分段映射的不同区域时
    // adjustment 会把鼠标锚点拉偏。用更新后的 renderedRange 重新定位。
    if (viewport) {
        const correctedPhysical = logicalToPhysical(logicalAtMouse);
        if (isHorizontalMode()) {
            const rawLeft = correctedPhysical - mouseInViewportX;
            viewport.scrollLeft = isHorizontalRTLMode() ? -rawLeft : rawLeft;
        } else {
            viewport.scrollTop = correctedPhysical - mouseInViewportY;
        }
    }

    updateVerticalScrollbar();
    updateCrossAxisScrollbar();
    showZoomLevel(newZoom);
    showScrollbars();
    // 必须用 adjustment 后的实际 viewport 值，否则下次缩放读到旧基准 → 画面跳动
    updateDragSnapshot(
        viewport ? viewport.scrollLeft : newScrollLeft,
        viewport ? viewport.scrollTop : newScrollTop
    );
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

            // 抑制拖拽：左键按下时 isDragging=true，mousemove 会覆盖缩放设的 scrollTop
            setDragSuppressed(true);
            clearTimeout(dragSuppressionTimer);
            applyZoomAtMousePosition(newZoom, oldZoom, event.clientX, event.clientY);
            // 最后一次 wheel 事件后 150ms 恢复拖拽
            dragSuppressionTimer = setTimeout(() => setDragSuppressed(false), 150);
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
        } else if (!event.shiftKey) {
            // 非修饰键滚轮：主轴滚动
            const viewport = document.getElementById('viewport');
            if (!viewport || event.deltaY === 0) return;
            const ratio = getCompressionRatio();

            if (isHorizontalMode()) {
                // 横向模式：垂直滚轮 → 水平滚动
                if (ratio < 1) {
                    event.preventDefault();
                    const direction = event.deltaY > 0 ? 1 : -1;
                    const rtlSign = isHorizontalRTLMode() ? -1 : 1;
                    const currentLogical = physicalToLogical(Math.abs(viewport.scrollLeft));
                    const targetLogical = Math.max(0, Math.min(getTotalSize(), currentLogical + direction * 300));
                    viewport.scrollLeft = logicalToPhysical(targetLogical) * rtlSign;
                } else {
                    const delta = isHorizontalRTLMode() ? -event.deltaY : event.deltaY;
                    viewport.scrollLeft += delta;
                    event.preventDefault();
                }
            } else {
                // 竖向模式：压缩激活时归一化滚动速度
                if (ratio < 1) {
                    event.preventDefault();
                    const direction = event.deltaY > 0 ? 1 : -1;
                    const currentLogical = physicalToLogical(viewport.scrollTop);
                    const targetLogical = Math.max(0, Math.min(getTotalSize(), currentLogical + direction * 300));
                    viewport.scrollTop = logicalToPhysical(targetLogical);
                }
                // ratio >= 1: 让浏览器默认处理
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
