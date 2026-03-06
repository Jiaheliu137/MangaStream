// 滚动条管理模块 - 重构版本：抽象通用逻辑，减少重复代码 (#8)
import { AnimationConfig } from './constants.js';
import { getCurrentZoom, getCurrentOffset, setCurrentOffset, applyContentPosition } from './zoom.js';

// ==================== 通用滚动条控制器 ====================

/**
 * 创建滚动条控制器实例
 * @param {string} containerSelector - 滚动条容器选择器
 * @param {string} barSelector - 滚动条选择器
 * @param {string} handleSelector - 滚动条手柄选择器
 */
function createScrollbarController(containerSelector, barSelector, handleSelector) {
    let hideTimer = null;

    function getElements() {
        return {
            container: document.getElementById(containerSelector),
            bar: document.getElementById(barSelector),
            handle: document.getElementById(handleSelector)
        };
    }

    function show() {
        const { container } = getElements();
        if (container) {
            container.classList.add('active');
            clearHideTimer();
        }
    }

    function hide() {
        const { container } = getElements();
        if (container) container.classList.remove('active');
    }

    function clearHideTimer() {
        if (hideTimer) {
            clearTimeout(hideTimer);
            hideTimer = null;
        }
    }

    function resetHideTimer() {
        clearHideTimer();
        hideTimer = setTimeout(hide, AnimationConfig.SCROLLBAR_HIDE_DELAY);
    }

    function setDisplay(visible) {
        const { container } = getElements();
        if (container) {
            container.style.display = visible ? 'block' : 'none';
            if (!visible) {
                container.classList.remove('active');
                clearHideTimer();
            }
        }
    }

    function enablePointerEvents() {
        const { container, bar, handle } = getElements();
        if (container) container.style.pointerEvents = 'auto';
        if (bar) bar.style.pointerEvents = 'auto';
        if (handle) handle.style.pointerEvents = 'auto';
    }

    return { getElements, show, hide, clearHideTimer, resetHideTimer, setDisplay, enablePointerEvents };
}

// ==================== 创建水平/垂直滚动条实例 ====================

const horizontalScrollbar = createScrollbarController(
    'custom-scrollbar-container',
    'custom-scrollbar',
    'custom-scrollbar-handle'
);

const verticalScrollbar = createScrollbarController(
    'vertical-scrollbar-container',
    'vertical-scrollbar',
    'vertical-scrollbar-handle'
);

// ==================== 导出的显示/隐藏函数 ====================

export function showScrollbars() {
    horizontalScrollbar.show();
    verticalScrollbar.show();

    // 统一隐藏定时器
    horizontalScrollbar.resetHideTimer();
    verticalScrollbar.resetHideTimer();
}

export function showHorizontalScrollbar() {
    horizontalScrollbar.show();
}

export function showVerticalScrollbar() {
    const viewport = document.querySelector('#viewport');
    if (!viewport) return;

    const contentHeight = viewport.scrollHeight;
    const viewportHeight = viewport.clientHeight;

    if (contentHeight > viewportHeight) {
        verticalScrollbar.setDisplay(true);
        verticalScrollbar.show();
    } else {
        verticalScrollbar.setDisplay(false);
    }
}

export function resetHorizontalScrollbarHideTimer() {
    horizontalScrollbar.resetHideTimer();
}

export function resetVerticalScrollbarHideTimer() {
    verticalScrollbar.resetHideTimer();
}

// ==================== 水平滚动条逻辑 ====================

export function updateHorizontalScroll(zoomLevel) {
    const imageWrapper = document.querySelector('.image-wrapper');
    if (!imageWrapper) return;

    const windowWidth = window.innerWidth;
    const contentWidth = imageWrapper.offsetWidth * zoomLevel;

    if (contentWidth > windowWidth) {
        horizontalScrollbar.setDisplay(true);

        const viewport = document.querySelector('#viewport');
        if (viewport) viewport.classList.add('has-scrollbar');

        updateScrollbarDimensions(contentWidth, windowWidth);
        updateScrollbarPosition();
    } else {
        hideCustomScrollbar();
    }
}

function updateScrollbarDimensions(contentWidth, windowWidth) {
    const { bar } = horizontalScrollbar.getElements();
    if (!bar) return;

    const ratio = windowWidth / contentWidth;
    const scrollbarWidth = Math.max(30, windowWidth * ratio);
    bar.style.width = `${scrollbarWidth}px`;
}

export function updateScrollbarPosition() {
    const imageWrapper = document.querySelector('.image-wrapper');
    const { bar, container } = horizontalScrollbar.getElements();

    if (!imageWrapper || !bar || !container) return;

    const windowWidth = window.innerWidth;
    const contentWidth = imageWrapper.offsetWidth * getCurrentZoom();

    if (contentWidth <= windowWidth) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';

    const ratio = windowWidth / contentWidth;
    const scrollbarWidth = Math.max(30, windowWidth * ratio);
    bar.style.width = `${scrollbarWidth}px`;

    const totalScrollableWidth = contentWidth - windowWidth;
    const { x: currentOffsetX } = getCurrentOffset();
    const scrollRatio = 0.5 - (currentOffsetX / totalScrollableWidth);
    const clampedRatio = Math.max(0, Math.min(1, scrollRatio));
    const scrollbarMaxMove = windowWidth - scrollbarWidth;

    bar.style.left = `${clampedRatio * scrollbarMaxMove}px`;
}

function hideCustomScrollbar() {
    horizontalScrollbar.setDisplay(false);
    const viewport = document.querySelector('#viewport');
    if (viewport) viewport.classList.remove('has-scrollbar');
}

// ==================== 垂直滚动条逻辑 ====================

export function updateVerticalScrollbar() {
    const viewport = document.querySelector('#viewport');
    const { bar: verticalBar, container: verticalContainer } = verticalScrollbar.getElements();

    if (!viewport || !verticalBar || !verticalContainer) return;

    const contentHeight = viewport.scrollHeight;
    const viewportHeight = viewport.clientHeight;

    if (contentHeight <= viewportHeight) {
        verticalScrollbar.setDisplay(false);
        return;
    }

    verticalContainer.style.display = 'block';

    const ratio = viewportHeight / contentHeight;
    const scrollbarHeight = Math.max(30, viewportHeight * ratio);
    verticalBar.style.height = `${scrollbarHeight}px`;

    const scrollRatio = viewport.scrollTop / (contentHeight - viewportHeight);
    const maxScrollbarOffset = viewportHeight - scrollbarHeight;
    const scrollbarTop = scrollRatio * maxScrollbarOffset;

    verticalBar.style.top = `${scrollbarTop}px`;

    const isDragging = document.body.classList.contains('dragging');
    if (!isDragging) {
        verticalScrollbar.show();
        verticalScrollbar.resetHideTimer();
    }
}

// ==================== 滚动条拖动处理 ====================

let isDraggingScrollbar = false;
let scrollbarStartX = 0;
let scrollbarStartY = 0;

function handleScrollbarDrag(e) {
    if (!isDraggingScrollbar) return;

    horizontalScrollbar.show();

    const imageWrapper = document.querySelector('.image-wrapper');
    const { bar } = horizontalScrollbar.getElements();

    if (!imageWrapper || !bar) return;

    const windowWidth = window.innerWidth;
    const contentWidth = imageWrapper.offsetWidth * getCurrentZoom();
    const scrollbarWidth = parseInt(bar.style.width);
    const scrollbarMaxMove = windowWidth - scrollbarWidth;

    const dragDistance = e.clientX - scrollbarStartX;
    let currentScrollbarLeft = parseInt(bar.style.left || '0');
    let newScrollbarLeft = currentScrollbarLeft + dragDistance;

    newScrollbarLeft = Math.max(0, Math.min(scrollbarMaxMove, newScrollbarLeft));
    bar.style.left = `${newScrollbarLeft}px`;

    const scrollRatio = newScrollbarLeft / scrollbarMaxMove;
    const totalScrollableWidth = contentWidth - windowWidth;
    const newOffsetX = (0.5 - scrollRatio) * totalScrollableWidth;

    setCurrentOffset(newOffsetX, undefined);
    applyContentPosition();

    scrollbarStartX = e.clientX;
}

function endScrollbarDrag() {
    if (!isDraggingScrollbar) return;

    isDraggingScrollbar = false;
    document.body.classList.remove('dragging');
    horizontalScrollbar.resetHideTimer();
}

// ==================== 初始化函数 ====================

export function initCustomScrollbar() {
    const { container, bar, handle } = horizontalScrollbar.getElements();

    if (!container || !bar || !handle) {
        console.error('找不到水平滚动条元素');
        return;
    }

    horizontalScrollbar.enablePointerEvents();

    handle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();

        isDraggingScrollbar = true;
        scrollbarStartX = e.clientX;

        document.body.classList.add('dragging');
        horizontalScrollbar.clearHideTimer();
        horizontalScrollbar.show();
    });

    document.addEventListener('mousemove', handleScrollbarDrag);
    document.addEventListener('mouseup', endScrollbarDrag);
}

export function initVerticalScrollbar() {
    const viewport = document.querySelector('#viewport');
    const { container, bar, handle } = verticalScrollbar.getElements();

    if (!viewport || !container || !bar || !handle) {
        console.error('找不到垂直滚动条元素');
        return;
    }

    updateVerticalScrollbar();

    viewport.addEventListener('scroll', updateVerticalScrollbar);
    window.addEventListener('resize', updateVerticalScrollbar);

    verticalScrollbar.enablePointerEvents();

    let isDraggingVerticalScrollbar = false;

    handle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();

        isDraggingVerticalScrollbar = true;
        scrollbarStartY = e.clientY;

        document.body.classList.add('dragging');
        showScrollbars();
    });

    function handleVerticalScrollbarDrag(e) {
        if (!isDraggingVerticalScrollbar) return;

        showVerticalScrollbar();

        const viewport = document.querySelector('#viewport');
        if (!viewport) return;

        const dragDistance = e.clientY - scrollbarStartY;
        const contentHeight = viewport.scrollHeight;
        const viewportHeight = viewport.clientHeight;

        const scrollRatio = dragDistance / viewportHeight;
        const scrollDelta = scrollRatio * (contentHeight - viewportHeight);
        viewport.scrollTop += scrollDelta;
        scrollbarStartY = e.clientY;
    }

    function endVerticalScrollbarDrag() {
        if (!isDraggingVerticalScrollbar) return;

        isDraggingVerticalScrollbar = false;
        document.body.classList.remove('dragging');
        verticalScrollbar.resetHideTimer();
    }

    document.addEventListener('mousemove', handleVerticalScrollbarDrag);
    document.addEventListener('mouseup', endVerticalScrollbarDrag);
}

export function setupScrollbarVisibility() {
    let scrollEndTimer = null;

    const viewport = document.querySelector('#viewport');
    if (viewport) {
        viewport.addEventListener('scroll', () => {
            showVerticalScrollbar();

            if (scrollEndTimer) {
                clearTimeout(scrollEndTimer);
            }

            scrollEndTimer = setTimeout(() => {
                verticalScrollbar.resetHideTimer();
                scrollEndTimer = null;
            }, AnimationConfig.SCROLL_END_DELAY);
        });
    }
}
