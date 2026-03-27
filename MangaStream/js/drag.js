// 拖动功能模块
import { getCurrentZoom, getCurrentOffset, setCurrentOffset, applyContentPosition } from './zoom.js';
import { showHorizontalScrollbar, showVerticalScrollbar, updateScrollbarPosition } from './scrollbar.js';

import { isHorizontalMode, getStandardSizeValue } from './modeManager.js';

// 拖动状态
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

// 检查是否应该启用副轴拖拽（垂直模式下为水平，水平模式下为垂直）
function shouldEnableCrossAxisDrag() {
    const imageWrapper = document.querySelector('.image-wrapper');
    if (!imageWrapper) return false;

    if (isHorizontalMode()) {
        const containerHeight = getStandardSizeValue() * getCurrentZoom();
        return containerHeight > window.innerHeight;
    } else {
        const containerWidth = getStandardSizeValue() * getCurrentZoom();
        return containerWidth > window.innerWidth;
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
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;

        document.body.style.cursor = 'grabbing';
        container.style.cursor = 'grabbing';
        document.body.classList.add('dragging');
    });

    // 鼠标移动事件
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;

        const crossAxisEnabled = shouldEnableCrossAxisDrag();

        let hasCrossMovement = false;
        let hasMainMovement = false;

        if (isHorizontalMode()) {
            // 主轴是 X，副轴是 Y
            if (dx !== 0) {
                viewport.scrollBy(-dx, 0);
                showHorizontalScrollbar();
                hasMainMovement = true;
            }
            if (crossAxisEnabled && dy !== 0) {
                hasCrossMovement = true;
                const { x: currentOffsetY } = getCurrentOffset(); // Wait, we still use x/y offset in zoom.js? zoom.js currently uses currentOffsetX.
                // It's still called currentOffsetX, so let's reuse it logically as CrossAxisOffset.
                const newOffsetX = currentOffsetY + dy;

                const windowHeight = window.innerHeight;
                const contentHeight = getStandardSizeValue() * getCurrentZoom();
                const totalScrollableHeight = contentHeight - windowHeight;

                const minOffset = -totalScrollableHeight / 2;
                const maxOffset = totalScrollableHeight / 2;

                const clampedOffset = Math.max(minOffset, Math.min(maxOffset, newOffsetX));
                setCurrentOffset(clampedOffset, undefined);
                showVerticalScrollbar();
            }
        } else {
            // 主轴是 Y，副轴是 X
            if (crossAxisEnabled && dx !== 0) {
                hasCrossMovement = true;
                const { x: currentOffsetX } = getCurrentOffset();
                const newOffsetX = currentOffsetX + dx;

                const windowWidth = window.innerWidth;
                const contentWidth = getStandardSizeValue() * getCurrentZoom();
                const totalScrollableWidth = contentWidth - windowWidth;

                const minOffset = -totalScrollableWidth / 2;
                const maxOffset = totalScrollableWidth / 2;

                const clampedOffsetX = Math.max(minOffset, Math.min(maxOffset, newOffsetX));
                setCurrentOffset(clampedOffsetX, undefined);

                showHorizontalScrollbar();
            }

            if (dy !== 0) {
                hasMainMovement = true;
                viewport.scrollBy(0, -dy);
                showVerticalScrollbar();
            }
        }

        applyContentPosition();

        if (hasCrossMovement) {
            updateScrollbarPosition();
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

        if (!shouldEnableCrossAxisDrag()) {
            setCurrentOffset(0, undefined);
            applyContentPosition();
        }
    }

    document.addEventListener('mouseup', endDrag);
    document.addEventListener('mouseleave', endDrag);
}

// 导出更新光标样式函数
export { updateCursorStyle };
