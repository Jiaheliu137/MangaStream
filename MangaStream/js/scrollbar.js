// 滚动条管理模块 - 重构版本：抽象通用逻辑，减少重复代码 (#8)
import { AnimationConfig } from './constants.js';
import { getCurrentZoom, getCurrentOffset, setCurrentOffset, applyContentPosition } from './zoom.js';
import { isHorizontalMode, isHorizontalRTLMode, getStandardSizeValue } from './modeManager.js';

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
    // This updates the CROSS AXIS scrollbar
    const crossAxisScrollbar = isHorizontalMode() ? verticalScrollbar : horizontalScrollbar;
    const { bar, container } = crossAxisScrollbar.getElements();

    if (!bar || !container) return;

    const windowSize = isHorizontalMode() ? window.innerHeight : window.innerWidth;
    const contentSize = getStandardSizeValue() * getCurrentZoom();

    if (contentSize <= windowSize) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';

    const ratio = windowSize / contentSize;
    const scrollbarSize = Math.max(30, windowSize * ratio);

    if (isHorizontalMode()) {
        bar.style.height = `${scrollbarSize}px`;
    } else {
        bar.style.width = `${scrollbarSize}px`;
    }

    const totalScrollableSize = contentSize - windowSize;
    const { x: currentOffset } = getCurrentOffset(); // We conceptually map cross axis offset to X uniformly in zoom.js for now

    // 0 Offset is purely centered.
    // If it's horizontal mode, we map to vertical scrollbar (top down)
    // If it's vertical mode, we map to horizontal scrollbar (left right)
    let scrollRatio;
    if (isHorizontalMode()) {
        // Vertical cross axis: currentOffset is Y shift
        scrollRatio = 0.5 - (currentOffset / totalScrollableSize); // wait! In zoom.js, Y offset translates to translateY
    } else {
        scrollRatio = 0.5 - (currentOffset / totalScrollableSize);
    }

    const clampedRatio = Math.max(0, Math.min(1, scrollRatio));
    const scrollbarMaxMove = windowSize - scrollbarSize;

    if (isHorizontalMode()) {
        bar.style.top = `${clampedRatio * scrollbarMaxMove}px`;
    } else {
        bar.style.left = `${clampedRatio * scrollbarMaxMove}px`;
    }
}

function hideCustomScrollbar() {
    horizontalScrollbar.setDisplay(false);
    const viewport = document.querySelector('#viewport');
    if (viewport) viewport.classList.remove('has-scrollbar');
}

// ==================== 原生关联滚动条 (主轴) 逻辑 ====================

export function updateVerticalScrollbar() {
    // This updates the MAIN AXIS scrollbar
    const viewport = document.querySelector('#viewport');
    const mainAxisScrollbar = isHorizontalMode() ? horizontalScrollbar : verticalScrollbar;
    const { bar: mainBar, container: mainContainer } = mainAxisScrollbar.getElements();

    // 隐藏另一个轴的主滚动条（如果有显示的话，为了防止干扰）
    const unusedScrollbar = isHorizontalMode() ? verticalScrollbar : horizontalScrollbar;
    // We only hide it if it's not being used by cross-axis!
    // But updateScrollbarPosition handles the cross axis visibility!

    if (!viewport || !mainBar || !mainContainer) return;

    const contentSize = isHorizontalMode() ? viewport.scrollWidth : viewport.scrollHeight;
    const viewportSize = isHorizontalMode() ? viewport.clientWidth : viewport.clientHeight;

    if (contentSize <= viewportSize) {
        mainAxisScrollbar.setDisplay(false);
        return;
    }

    mainContainer.style.display = 'block';

    const ratio = viewportSize / contentSize;
    const scrollbarSize = Math.max(30, viewportSize * ratio);

    if (isHorizontalMode()) {
        mainBar.style.width = `${scrollbarSize}px`;
    } else {
        mainBar.style.height = `${scrollbarSize}px`;
    }

    const scrollPos = isHorizontalMode() ? Math.abs(viewport.scrollLeft) : viewport.scrollTop;

    // RTL handling: the thumb is drawn left-to-right from 0. 
    // In RTL, scrollPos 0 means it's at the far right. 
    // We might want to invert the thumb physical location visually so the thumb is at the right edge when scrollPos=0?
    // Let's do that for intuitive tracking:
    let scrollRatio = scrollPos / (contentSize - viewportSize);
    if (isHorizontalMode() && isHorizontalRTLMode()) {
        // RTL starts at 0 = thumb at rightmost (1.0).
        scrollRatio = 1.0 - scrollRatio;
    }

    const maxScrollbarOffset = viewportSize - scrollbarSize;
    const scrollbarOffset = scrollRatio * maxScrollbarOffset;

    if (isHorizontalMode()) {
        mainBar.style.left = `${scrollbarOffset}px`;
    } else {
        mainBar.style.top = `${scrollbarOffset}px`;
    }

    const isDragging = document.body.classList.contains('dragging');
    if (!isDragging) {
        mainAxisScrollbar.show();
        mainAxisScrollbar.resetHideTimer();
    }
}

// ==================== 滚动条拖动处理 ====================

let isDraggingScrollbar = false;
let scrollbarStartX = 0;
let scrollbarStartY = 0;

function handleScrollbarDrag(e) {
    if (!isDraggingScrollbar) return;

    horizontalScrollbar.show();

    const { bar } = horizontalScrollbar.getElements();
    if (!bar) return;

    const dragDistance = e.clientX - scrollbarStartX;
    const windowWidth = window.innerWidth;
    const scrollbarWidth = parseInt(bar.style.width || '0');
    const scrollbarMaxMove = windowWidth - scrollbarWidth;

    let currentScrollbarLeft = parseInt(bar.style.left || '0');
    let newScrollbarLeft = currentScrollbarLeft + dragDistance;
    newScrollbarLeft = Math.max(0, Math.min(scrollbarMaxMove, newScrollbarLeft));
    bar.style.left = `${newScrollbarLeft}px`;

    let scrollRatio = newScrollbarLeft / scrollbarMaxMove;

    if (isHorizontalMode()) {
        // Horizontal Mode: horizontal scrollbar is MAIN axis (viewport scrollLeft)
        const viewport = document.querySelector('#viewport');
        if (viewport) {
            const contentWidth = viewport.scrollWidth;
            const viewportWidth = viewport.clientWidth;
            if (isHorizontalRTLMode()) {
                scrollRatio = 1.0 - scrollRatio; // Invert explicitly for RTL drag
            }
            const targetLeft = scrollRatio * (contentWidth - viewportWidth);
            // In RTL negative mapping native scrollLeft requires absolute map matching. Native `scrollLeft` might be negative.
            viewport.scrollTo({ left: isHorizontalRTLMode() ? -targetLeft : targetLeft });
        }
    } else {
        // Vertical Mode: horizontal scrollbar is CROSS axis (currentOffsetX zoom pan)
        const imageWrapper = document.querySelector('.image-wrapper');
        if (imageWrapper) {
            const contentWidth = imageWrapper.offsetWidth * getCurrentZoom();
            const totalScrollableWidth = Math.max(0, contentWidth - windowWidth);
            const newOffsetX = (scrollRatio - 0.5) * totalScrollableWidth; // In UI, Left=0(Ratio 0)= -Max/2, Right=1= +Max/2
            setCurrentOffset(newOffsetX, undefined);
            applyContentPosition();
        }
    }

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

        const { bar } = verticalScrollbar.getElements();
        if (!bar) return;

        const dragDistance = e.clientY - scrollbarStartY;
        const windowHeight = window.innerHeight;
        const scrollbarHeight = parseInt(bar.style.height || '0');
        const scrollbarMaxMove = windowHeight - scrollbarHeight;

        let currentScrollbarTop = parseInt(bar.style.top || '0');
        let newScrollbarTop = currentScrollbarTop + dragDistance;
        newScrollbarTop = Math.max(0, Math.min(scrollbarMaxMove, newScrollbarTop));
        bar.style.top = `${newScrollbarTop}px`;

        const scrollRatio = newScrollbarTop / scrollbarMaxMove;

        if (isHorizontalMode()) {
            // Horizontal Mode: vertical scrollbar is CROSS axis (currentOffsetX zoom pan on Y axis)
            const STANDARD_MANGA_HEIGHT = getStandardSizeValue();
            const contentHeight = STANDARD_MANGA_HEIGHT * getCurrentZoom();
            const totalScrollableHeight = Math.max(0, contentHeight - windowHeight);

            // In zoom.js, Y pan offset is mapped as: (0.5 - scrollRatio) => Center is 0, Top is +Max/2, Bottom is -Max/2
            const newOffsetY = (0.5 - scrollRatio) * totalScrollableHeight;
            setCurrentOffset(newOffsetY, undefined); // Cross axis offset stored in currentOffsetX var
            applyContentPosition();
        } else {
            // Vertical Mode: vertical scrollbar is MAIN axis (viewport scrollTop)
            const viewport = document.querySelector('#viewport');
            if (viewport) {
                const contentHeight = viewport.scrollHeight;
                const viewportHeight = viewport.clientHeight;
                const scrollDelta = scrollRatio * (contentHeight - viewportHeight);
                viewport.scrollTo({ top: scrollDelta });
            }
        }

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
