// 拖动功能模块 — CSS zoom 重构版
// 使用绝对滚动定位（而非增量 scrollBy），避免 Chrome CSS zoom 亚像素舍入累积漂移。
import { showHorizontalScrollbar, showVerticalScrollbar } from './scrollbar.js';
import { isHorizontalMode } from './modeManager.js';

// 拖动状态
let isDragging = false;
let dragStartMouseX = 0;
let dragStartMouseY = 0;
let dragStartScrollLeft = 0;
let dragStartScrollTop = 0;
let lastMouseX = 0;
let lastMouseY = 0;
// 逻辑滚动位置：拖拽期间不从 viewport 回读（避免 Chrome 舍入污染）
let logicalScrollLeft = 0;
let logicalScrollTop = 0;

// 检查是否应该启用副轴拖拽（通过 viewport 真实溢出判断）
function shouldEnableCrossAxisDrag() {
    const viewport = document.querySelector('#viewport');
    if (!viewport) return false;

    if (isHorizontalMode()) {
        return viewport.scrollHeight > viewport.clientHeight;
    } else {
        return viewport.scrollWidth > viewport.clientWidth;
    }
}

// 更新光标样式
function updateCursorStyle() {
    const container = document.querySelector('#image-container');
    if (!container) return;

    container.style.cursor = 'default';

    if (shouldEnableCrossAxisDrag()) {
        container.classList.add('draggable');
    } else {
        container.classList.remove('draggable');
    }
}

// 初始化拖动功能
export function initDragFeature() {
    const container = document.querySelector('#image-container');
    const viewport = document.querySelector('#viewport');
    if (!container || !viewport) return;

    updateCursorStyle();

    // 鼠标按下事件
    container.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;

        if (e.target.tagName === 'BUTTON' ||
            e.target.tagName === 'A' ||
            e.target.tagName === 'INPUT') {
            return;
        }

        e.preventDefault();
        isDragging = true;
        dragStartMouseX = e.clientX;
        dragStartMouseY = e.clientY;
        dragStartScrollLeft = viewport.scrollLeft;
        dragStartScrollTop = viewport.scrollTop;
        logicalScrollLeft = viewport.scrollLeft;
        logicalScrollTop = viewport.scrollTop;

        document.body.style.cursor = 'grabbing';
        container.style.cursor = 'grabbing';
        document.body.classList.add('dragging');
    });

    // 鼠标移动事件
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        // 使用绝对定位而非增量 scrollBy，避免 Chrome CSS zoom 下的亚像素舍入累积漂移
        const totalDx = e.clientX - dragStartMouseX;
        const totalDy = e.clientY - dragStartMouseY;

        const crossAxisEnabled = shouldEnableCrossAxisDrag();

        if (isHorizontalMode()) {
            logicalScrollLeft = dragStartScrollLeft - totalDx;
            viewport.scrollLeft = logicalScrollLeft;
            showHorizontalScrollbar();
            if (crossAxisEnabled) {
                logicalScrollTop = dragStartScrollTop - totalDy;
                viewport.scrollTop = logicalScrollTop;
                showVerticalScrollbar();
            }
        } else {
            logicalScrollTop = dragStartScrollTop - totalDy;
            viewport.scrollTop = logicalScrollTop;
            showVerticalScrollbar();
            if (crossAxisEnabled) {
                logicalScrollLeft = dragStartScrollLeft - totalDx;
                viewport.scrollLeft = logicalScrollLeft;
                showHorizontalScrollbar();
            }
        }

        lastMouseX = e.clientX;
        lastMouseY = e.clientY;

    }, { passive: true });

    // 鼠标释放事件
    function endDrag() {
        if (!isDragging) return;
        isDragging = false;

        document.body.style.cursor = '';
        container.style.cursor = 'default';
        document.body.classList.remove('dragging');
    }

    document.addEventListener('mouseup', endDrag);
    document.addEventListener('mouseleave', endDrag);
}

// 拖拽中获取逻辑滚动位置（未被 Chrome 舍入的精确值）
// 缩放时用此值代替 viewport.scrollLeft/Top 做计算，避免舍入累积
export function getDragLogicalScroll() {
    if (!isDragging) return null;
    return { left: logicalScrollLeft, top: logicalScrollTop };
}

// 缩放发生时更新拖拽快照，传入缩放计算出的精确滚动值
export function updateDragSnapshot(computedScrollLeft, computedScrollTop) {
    if (!isDragging) return;
    logicalScrollLeft = computedScrollLeft;
    logicalScrollTop = computedScrollTop;
    dragStartScrollLeft = computedScrollLeft;
    dragStartScrollTop = computedScrollTop;
    dragStartMouseX = lastMouseX;
    dragStartMouseY = lastMouseY;
}

// 导出更新光标样式函数
export { updateCursorStyle };
