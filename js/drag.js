// 拖动功能模块
import { getCurrentZoom, getCurrentOffset, setCurrentOffset, applyContentPosition } from './zoom.js';
import { showHorizontalScrollbar, showVerticalScrollbar, updateScrollbarPosition } from './scrollbar.js';

// 拖动状态
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

// 检查是否应该启用水平拖动
function shouldEnableHorizontalDrag() {
    const imageWrapper = document.querySelector('.image-wrapper');
    if (!imageWrapper) return false;

    const containerWidth = imageWrapper.offsetWidth * getCurrentZoom();
    const windowWidth = window.innerWidth;
    return containerWidth > windowWidth;
}

// 更新光标样式
function updateCursorStyle() {
    const container = document.querySelector('#image-container');
    if (!container) return;

    container.style.cursor = 'default';

    if (shouldEnableHorizontalDrag()) {
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

        const horizontalEnabled = shouldEnableHorizontalDrag();

        let hasHorizontalMovement = false;
        let hasVerticalMovement = false;

        // 更新水平偏移量
        if (horizontalEnabled && dx !== 0) {
            hasHorizontalMovement = true;

            const imageWrapper = document.querySelector('.image-wrapper');
            if (imageWrapper) {
                const { x: currentOffsetX } = getCurrentOffset();
                const newOffsetX = currentOffsetX + dx;

                const windowWidth = window.innerWidth;
                const contentWidth = imageWrapper.offsetWidth * getCurrentZoom();
                const totalScrollableWidth = contentWidth - windowWidth;

                const minOffset = -totalScrollableWidth / 2;
                const maxOffset = totalScrollableWidth / 2;

                const clampedOffsetX = Math.max(minOffset, Math.min(maxOffset, newOffsetX));
                setCurrentOffset(clampedOffsetX, undefined);

                showHorizontalScrollbar();
            }
        }

        // 使用垂直滚动
        if (dy !== 0) {
            hasVerticalMovement = true;

            const viewport = document.querySelector('#viewport');
            if (viewport) {
                viewport.scrollBy(0, -dy);
                showVerticalScrollbar();
            }
        }

        applyContentPosition();

        if (hasHorizontalMovement) {
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

        if (!shouldEnableHorizontalDrag()) {
            setCurrentOffset(0, undefined);
            applyContentPosition();
        }
    }

    document.addEventListener('mouseup', endDrag);
    document.addEventListener('mouseleave', endDrag);

    // 全局API，供缩放后调用
    window.updateAfterZoom = updateCursorStyle;
}

// 导出更新光标样式函数
export { updateCursorStyle };
