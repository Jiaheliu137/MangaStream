// 滚动条管理模块 - CSS zoom 重构版
// 交叉轴滚动现在由浏览器原生处理（CSS zoom 改变真实布局尺寸），
// 滚动条只需读取 viewport 的原生滚动位置即可。
import { AnimationConfig } from './constants.js';
import { isHorizontalMode, isHorizontalRTLMode } from './modeManager.js';

// ==================== 通用滚动条控制器 ====================

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

// ==================== 交叉轴滚动条（CSS zoom 方案：读取 viewport 原生滚动） ====================

/**
 * 更新交叉轴滚动条的可见性、尺寸和位置。
 * 竖向模式下交叉轴是水平方向（horizontalScrollbar），
 * 横向模式下交叉轴是垂直方向（verticalScrollbar）。
 */
export function updateCrossAxisScrollbar() {
    const viewport = document.querySelector('#viewport');
    if (!viewport) return;

    const crossScrollbar = isHorizontalMode() ? verticalScrollbar : horizontalScrollbar;
    const { bar, container } = crossScrollbar.getElements();
    if (!bar || !container) return;

    let scrollSize, clientSize, scrollPos;
    if (isHorizontalMode()) {
        scrollSize = viewport.scrollHeight;
        clientSize = viewport.clientHeight;
        scrollPos = viewport.scrollTop;
    } else {
        scrollSize = viewport.scrollWidth;
        clientSize = viewport.clientWidth;
        scrollPos = viewport.scrollLeft;
    }

    if (scrollSize <= clientSize) {
        crossScrollbar.setDisplay(false);
        if (!isHorizontalMode()) {
            viewport.classList.remove('has-scrollbar');
        }
        return;
    }

    crossScrollbar.setDisplay(true);
    if (!isHorizontalMode()) {
        viewport.classList.add('has-scrollbar');
    }

    // 滚动条尺寸
    const ratio = clientSize / scrollSize;
    const scrollbarSize = Math.max(30, clientSize * ratio);

    if (isHorizontalMode()) {
        bar.style.height = `${scrollbarSize}px`;
    } else {
        bar.style.width = `${scrollbarSize}px`;
    }

    // 滚动条位置
    const maxScroll = scrollSize - clientSize;
    const scrollRatio = maxScroll > 0 ? scrollPos / maxScroll : 0;
    const clampedRatio = Math.max(0, Math.min(1, scrollRatio));
    const scrollbarMaxMove = clientSize - scrollbarSize;

    if (isHorizontalMode()) {
        bar.style.top = `${clampedRatio * scrollbarMaxMove}px`;
    } else {
        bar.style.left = `${clampedRatio * scrollbarMaxMove}px`;
    }
}

// 兼容旧调用签名
export function updateHorizontalScroll() {
    updateCrossAxisScrollbar();
}

export function updateScrollbarPosition() {
    updateCrossAxisScrollbar();
}

// ==================== 主轴滚动条 ====================

export function updateVerticalScrollbar() {
    // 拖拽滚动条期间跳过：避免 scroll 事件反馈环路覆盖拖拽设置的位置
    if (isDraggingVerticalScrollbarFlag || isDraggingScrollbar) return;

    const viewport = document.querySelector('#viewport');
    const mainAxisScrollbar = isHorizontalMode() ? horizontalScrollbar : verticalScrollbar;
    const { bar: mainBar, container: mainContainer } = mainAxisScrollbar.getElements();

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

    let scrollRatio = scrollPos / (contentSize - viewportSize);
    if (isHorizontalMode() && isHorizontalRTLMode()) {
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
let isDraggingVerticalScrollbarFlag = false; // 模块级标志，供 scroll 监听器判断
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

    const viewport = document.querySelector('#viewport');
    if (!viewport) { scrollbarStartX = e.clientX; return; }

    if (isHorizontalMode()) {
        // 横向模式：水平滚动条是主轴 → viewport.scrollLeft
        const contentWidth = viewport.scrollWidth;
        const viewportWidth = viewport.clientWidth;
        if (isHorizontalRTLMode()) {
            scrollRatio = 1.0 - scrollRatio;
        }
        const targetLeft = scrollRatio * (contentWidth - viewportWidth);
        viewport.scrollTo({ left: isHorizontalRTLMode() ? -targetLeft : targetLeft });
    } else {
        // 竖向模式：水平滚动条是交叉轴 → viewport.scrollLeft
        const contentWidth = viewport.scrollWidth;
        const viewportWidth = viewport.clientWidth;
        const targetLeft = scrollRatio * (contentWidth - viewportWidth);
        viewport.scrollLeft = targetLeft;
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

    // 滚动事件同时更新主轴和交叉轴滚动条
    viewport.addEventListener('scroll', () => {
        updateVerticalScrollbar();
        updateCrossAxisScrollbar();
    });
    window.addEventListener('resize', () => {
        updateVerticalScrollbar();
        updateCrossAxisScrollbar();
    });

    verticalScrollbar.enablePointerEvents();

    let isDraggingVerticalScrollbar = false;

    handle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();

        isDraggingVerticalScrollbar = true;
        isDraggingVerticalScrollbarFlag = true;
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
            // 横向模式：垂直滚动条是交叉轴 → viewport.scrollTop
            const contentHeight = viewport.scrollHeight;
            const viewportHeight = viewport.clientHeight;
            viewport.scrollTop = scrollRatio * (contentHeight - viewportHeight);
        } else {
            // 竖向模式：垂直滚动条是主轴 → viewport.scrollTop
            const contentHeight = viewport.scrollHeight;
            const viewportHeight = viewport.clientHeight;
            viewport.scrollTo({ top: scrollRatio * (contentHeight - viewportHeight) });
        }

        scrollbarStartY = e.clientY;
    }

    function endVerticalScrollbarDrag() {
        if (!isDraggingVerticalScrollbar) return;

        isDraggingVerticalScrollbar = false;
        isDraggingVerticalScrollbarFlag = false;
        document.body.classList.remove('dragging');
        // 松手后用当前 viewport 状态刷新一次滚动条位置
        updateVerticalScrollbar();
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
                horizontalScrollbar.resetHideTimer();
                scrollEndTimer = null;
            }, AnimationConfig.SCROLL_END_DELAY);
        });
    }
}
