// 滚动条管理模块
import { AnimationConfig } from './constants.js';
import { getCurrentZoom, getCurrentOffset, setCurrentOffset, applyContentPosition } from './zoom.js';

// 滚动条状态
let isDraggingScrollbar = false;
let scrollbarStartX = 0;
let scrollbarStartY = 0;
let scrollbarHideTimer = null;
let horizontalScrollbarHideTimer = null;
let verticalScrollbarHideTimer = null;

// 显示所有滚动条
export function showScrollbars() {
    const horizontalContainer = document.getElementById('custom-scrollbar-container');
    const verticalContainer = document.getElementById('vertical-scrollbar-container');

    if (horizontalContainer) horizontalContainer.classList.add('active');
    if (verticalContainer) verticalContainer.classList.add('active');

    resetScrollbarHideTimer();
}

// 显示水平滚动条
export function showHorizontalScrollbar() {
    const horizontalContainer = document.getElementById('custom-scrollbar-container');
    if (horizontalContainer) {
        horizontalContainer.classList.add('active');
        if (horizontalScrollbarHideTimer) {
            clearTimeout(horizontalScrollbarHideTimer);
            horizontalScrollbarHideTimer = null;
        }
    }
}

// 显示垂直滚动条
export function showVerticalScrollbar() {
    const verticalContainer = document.getElementById('vertical-scrollbar-container');
    const viewport = document.querySelector('#viewport');

    if (!verticalContainer || !viewport) return;

    const contentHeight = viewport.scrollHeight;
    const viewportHeight = viewport.clientHeight;

    if (contentHeight > viewportHeight) {
        verticalContainer.style.display = 'block';
        verticalContainer.classList.add('active');

        if (verticalScrollbarHideTimer) {
            clearTimeout(verticalScrollbarHideTimer);
            verticalScrollbarHideTimer = null;
        }
    } else {
        verticalContainer.style.display = 'none';
        verticalContainer.classList.remove('active');
    }
}

// 隐藏所有滚动条
function hideScrollbars() {
    const horizontalContainer = document.getElementById('custom-scrollbar-container');
    const verticalContainer = document.getElementById('vertical-scrollbar-container');

    if (horizontalContainer) horizontalContainer.classList.remove('active');
    if (verticalContainer) verticalContainer.classList.remove('active');
}

// 隐藏水平滚动条
function hideHorizontalScrollbar() {
    const horizontalContainer = document.getElementById('custom-scrollbar-container');
    if (horizontalContainer) horizontalContainer.classList.remove('active');
}

// 隐藏垂直滚动条
function hideVerticalScrollbar() {
    const verticalContainer = document.getElementById('vertical-scrollbar-container');
    if (verticalContainer) verticalContainer.classList.remove('active');
}

// 重置滚动条隐藏计时器
function resetScrollbarHideTimer() {
    if (scrollbarHideTimer) clearTimeout(scrollbarHideTimer);
    scrollbarHideTimer = setTimeout(hideScrollbars, AnimationConfig.SCROLLBAR_HIDE_DELAY);
}

// 重置水平滚动条隐藏计时器
export function resetHorizontalScrollbarHideTimer() {
    if (horizontalScrollbarHideTimer) clearTimeout(horizontalScrollbarHideTimer);
    horizontalScrollbarHideTimer = setTimeout(hideHorizontalScrollbar, AnimationConfig.SCROLLBAR_HIDE_DELAY);
}

// 重置垂直滚动条隐藏计时器
export function resetVerticalScrollbarHideTimer() {
    if (verticalScrollbarHideTimer) clearTimeout(verticalScrollbarHideTimer);
    verticalScrollbarHideTimer = setTimeout(hideVerticalScrollbar, AnimationConfig.SCROLLBAR_HIDE_DELAY);
}

// 更新水平滚动条
export function updateHorizontalScroll(zoomLevel) {
    const imageWrapper = document.querySelector('.image-wrapper');
    if (!imageWrapper) return;

    const windowWidth = window.innerWidth;
    const contentWidth = imageWrapper.offsetWidth * zoomLevel;

    if (contentWidth > windowWidth) {
        const scrollbarContainer = document.getElementById('custom-scrollbar-container');
        if (scrollbarContainer) {
            scrollbarContainer.style.display = 'block';
        }

        const viewport = document.querySelector('#viewport');
        if (viewport) {
            viewport.classList.add('has-scrollbar');
        }

        showCustomScrollbar(imageWrapper, contentWidth, windowWidth);
    } else {
        hideCustomScrollbar();
    }
}

// 显示自定义水平滚动条
function showCustomScrollbar(container, contentWidth, windowWidth) {
    const scrollbarContainer = document.getElementById('custom-scrollbar-container');
    const scrollbar = document.getElementById('custom-scrollbar');
    const viewport = document.querySelector('#viewport');

    if (!scrollbarContainer || !scrollbar) return;

    scrollbarContainer.style.display = 'block';

    if (viewport) {
        viewport.classList.add('has-scrollbar');
    }

    updateScrollbarDimensions(container, contentWidth, windowWidth);
    updateScrollbarPosition();
}

// 更新滚动条尺寸
function updateScrollbarDimensions(container, contentWidth, windowWidth) {
    const scrollbar = document.getElementById('custom-scrollbar');
    if (!scrollbar) return;

    const ratio = windowWidth / contentWidth;
    const scrollbarWidth = Math.max(30, windowWidth * ratio);
    scrollbar.style.width = `${scrollbarWidth}px`;
}

// 更新滚动条位置
export function updateScrollbarPosition() {
    const imageWrapper = document.querySelector('.image-wrapper');
    const scrollbar = document.getElementById('custom-scrollbar');
    const scrollbarContainer = document.getElementById('custom-scrollbar-container');

    if (!imageWrapper || !scrollbar || !scrollbarContainer) return;

    const windowWidth = window.innerWidth;
    const contentWidth = imageWrapper.offsetWidth * getCurrentZoom();

    if (contentWidth <= windowWidth) {
        scrollbarContainer.style.display = 'none';
        return;
    }

    scrollbarContainer.style.display = 'block';

    const ratio = windowWidth / contentWidth;
    const scrollbarWidth = Math.max(30, windowWidth * ratio);
    scrollbar.style.width = `${scrollbarWidth}px`;

    const totalScrollableWidth = contentWidth - windowWidth;
    const { x: currentOffsetX } = getCurrentOffset();
    const scrollRatio = 0.5 - (currentOffsetX / totalScrollableWidth);
    const clampedRatio = Math.max(0, Math.min(1, scrollRatio));
    const scrollbarMaxMove = windowWidth - scrollbarWidth;

    scrollbar.style.left = `${clampedRatio * scrollbarMaxMove}px`;
}

// 隐藏自定义水平滚动条
function hideCustomScrollbar() {
    const scrollbarContainer = document.getElementById('custom-scrollbar-container');
    const viewport = document.querySelector('#viewport');

    if (scrollbarContainer) {
        scrollbarContainer.style.display = 'none';
    }

    if (viewport) {
        viewport.classList.remove('has-scrollbar');
    }
}

// 更新垂直滚动条
export function updateVerticalScrollbar() {
    const viewport = document.querySelector('#viewport');
    const verticalScrollbar = document.getElementById('vertical-scrollbar');
    const verticalScrollbarContainer = document.getElementById('vertical-scrollbar-container');

    if (!viewport || !verticalScrollbar || !verticalScrollbarContainer) return;

    const contentHeight = viewport.scrollHeight;
    const viewportHeight = viewport.clientHeight;

    if (contentHeight <= viewportHeight) {
        verticalScrollbarContainer.style.display = 'none';
        verticalScrollbarContainer.classList.remove('active');
        if (verticalScrollbarHideTimer) {
            clearTimeout(verticalScrollbarHideTimer);
            verticalScrollbarHideTimer = null;
        }
        return;
    }

    verticalScrollbarContainer.style.display = 'block';

    const ratio = viewportHeight / contentHeight;
    const scrollbarHeight = Math.max(30, viewportHeight * ratio);
    verticalScrollbar.style.height = `${scrollbarHeight}px`;

    const scrollRatio = viewport.scrollTop / (contentHeight - viewportHeight);
    const maxScrollbarOffset = viewportHeight - scrollbarHeight;
    const scrollbarTop = scrollRatio * maxScrollbarOffset;

    verticalScrollbar.style.top = `${scrollbarTop}px`;

    const isDragging = document.body.classList.contains('dragging');
    if (!isDragging) {
        verticalScrollbarContainer.classList.add('active');
        resetVerticalScrollbarHideTimer();
    }
}

// 处理滚动条拖动
function handleScrollbarDrag(e) {
    if (!isDraggingScrollbar) return;

    showHorizontalScrollbar();

    const imageWrapper = document.querySelector('.image-wrapper');
    const scrollbar = document.getElementById('custom-scrollbar');

    if (!imageWrapper || !scrollbar) return;

    const windowWidth = window.innerWidth;
    const contentWidth = imageWrapper.offsetWidth * getCurrentZoom();
    const scrollbarWidth = parseInt(scrollbar.style.width);
    const scrollbarMaxMove = windowWidth - scrollbarWidth;

    const dragDistance = e.clientX - scrollbarStartX;
    let currentScrollbarLeft = parseInt(scrollbar.style.left || '0');
    let newScrollbarLeft = currentScrollbarLeft + dragDistance;

    newScrollbarLeft = Math.max(0, Math.min(scrollbarMaxMove, newScrollbarLeft));
    scrollbar.style.left = `${newScrollbarLeft}px`;

    const scrollRatio = newScrollbarLeft / scrollbarMaxMove;
    const totalScrollableWidth = contentWidth - windowWidth;
    const newOffsetX = (0.5 - scrollRatio) * totalScrollableWidth;

    setCurrentOffset(newOffsetX, undefined);
    applyContentPosition();

    scrollbarStartX = e.clientX;
}

// 结束滚动条拖动
function endScrollbarDrag() {
    if (!isDraggingScrollbar) return;

    isDraggingScrollbar = false;
    document.body.classList.remove('dragging');
    resetHorizontalScrollbarHideTimer();
}

// 初始化自定义滚动条
export function initCustomScrollbar() {
    const scrollbarContainer = document.getElementById('custom-scrollbar-container');
    const scrollbar = document.getElementById('custom-scrollbar');
    const scrollbarHandle = document.getElementById('custom-scrollbar-handle');

    if (!scrollbarContainer || !scrollbar || !scrollbarHandle) {
        console.error('找不到水平滚动条元素');
        return;
    }

    scrollbarContainer.style.pointerEvents = 'auto';
    scrollbar.style.pointerEvents = 'auto';
    scrollbarHandle.style.pointerEvents = 'auto';

    // 滚动条手柄拖动
    scrollbarHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();

        isDraggingScrollbar = true;
        scrollbarStartX = e.clientX;

        document.body.classList.add('dragging');

        if (horizontalScrollbarHideTimer) clearTimeout(horizontalScrollbarHideTimer);
        showHorizontalScrollbar();
    });

    document.addEventListener('mousemove', handleScrollbarDrag);
    document.addEventListener('mouseup', endScrollbarDrag);
}

// 初始化垂直滚动条
export function initVerticalScrollbar() {
    const viewport = document.querySelector('#viewport');
    const verticalScrollbarContainer = document.getElementById('vertical-scrollbar-container');
    const verticalScrollbar = document.getElementById('vertical-scrollbar');
    const verticalScrollbarHandle = document.getElementById('vertical-scrollbar-handle');

    if (!viewport || !verticalScrollbarContainer || !verticalScrollbar || !verticalScrollbarHandle) {
        console.error('找不到垂直滚动条元素');
        return;
    }

    updateVerticalScrollbar();

    viewport.addEventListener('scroll', updateVerticalScrollbar);
    window.addEventListener('resize', updateVerticalScrollbar);

    verticalScrollbarContainer.style.pointerEvents = 'auto';
    verticalScrollbar.style.pointerEvents = 'auto';
    verticalScrollbarHandle.style.pointerEvents = 'auto';

    let isDraggingVerticalScrollbar = false;

    // 垂直滚动条手柄拖动
    verticalScrollbarHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();

        isDraggingVerticalScrollbar = true;
        scrollbarStartY = e.clientY;

        document.body.classList.add('dragging');
        showScrollbars();
    });

    // 处理垂直滚动条拖动
    function handleVerticalScrollbarDrag(e) {
        if (!isDraggingVerticalScrollbar) return;

        showVerticalScrollbar();

        const viewport = document.querySelector('#viewport');
        if (!viewport) return;

        const dragDistance = e.clientY - scrollbarStartY;
        const contentHeight = viewport.scrollHeight;
        const viewportHeight = viewport.clientHeight;
        const currentScrollTop = viewport.scrollTop;

        const scrollRatio = dragDistance / viewportHeight;
        const scrollDelta = scrollRatio * (contentHeight - viewportHeight);
        const newScrollTop = currentScrollTop + scrollDelta;

        viewport.scrollTop = newScrollTop;
        scrollbarStartY = e.clientY;
    }

    // 结束垂直滚动条拖动
    function endVerticalScrollbarDrag() {
        if (!isDraggingVerticalScrollbar) return;

        isDraggingVerticalScrollbar = false;
        document.body.classList.remove('dragging');
        resetVerticalScrollbarHideTimer();
    }

    document.addEventListener('mousemove', handleVerticalScrollbarDrag);
    document.addEventListener('mouseup', endVerticalScrollbarDrag);
}

// 设置滚动条可见性
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
                resetVerticalScrollbarHideTimer();
                scrollEndTimer = null;
            }, AnimationConfig.SCROLL_END_DELAY);
        });
    }
}
