// 图片加载模块 - 预计算精确高度虚拟滚动 + 增量DOM更新 + 对象级预解码复用
// 核心突破：预加载器创建的 Image 对象在 decode() 完成后，
//           直接被塞进 DOM —— 同一个JS对象，零重复解码。
import { STANDARD_MANGA_WIDTH, SUPPORTED_IMAGE_FORMATS, AnimationConfig } from './constants.js';
import { resetContentPosition, applyContentPosition, getCurrentZoom } from './zoom.js';
import { updateHorizontalScroll, updateVerticalScrollbar } from './scrollbar.js';
import { throttle } from './utils.js';

// ==================== 常量 ====================
const RENDER_BUFFER = 15;
const PRELOAD_AHEAD = 50;
const DIVIDER_HEIGHT = 1;

// ==================== 模块状态 ====================
let totalFilteredItems = [];
let isFirstLoad = true;

let heightPrefixSum = [];
let renderedRange = { start: -1, end: -1 };
let containerEl = null;
let viewportEl = null;
let spacerTopEl = null;
let spacerBottomEl = null;
let contentWrapperEl = null;
let scrollListenerAttached = false;
let isRendering = false;

// ==================== 预解码缓存 ====================
// key = 图片索引, value = 已经设置好 src 并调用过 decode() 的 HTMLImageElement
// 当 createImageElement 需要该索引时，直接把这个 img 对象接管到 DOM 里，
// 因为是 同一个JS对象，浏览器不需要重新解码，像素已经在内存里了。
let decodedImageCache = new Map();
let lastPreloadCenter = -1;

// ==================== 公共工具函数 ====================

export function getImagePath(item) {
    if (item.filePath) return item.filePath;
    if (item.path) return item.path;
    if (item.url && item.url.startsWith('file://')) return item.url.replace('file://', '');
    return '';
}

function isSupportedFormat(imagePath) {
    const fileName = imagePath.toLowerCase();
    return SUPPORTED_IMAGE_FORMATS.some(format => fileName.endsWith(format));
}

// ==================== 预计算高度与前缀和 ====================

function precalculateHeights() {
    const n = totalFilteredItems.length;
    heightPrefixSum = new Array(n + 1);
    heightPrefixSum[0] = 0;

    for (let i = 0; i < n; i++) {
        const item = totalFilteredItems[i];
        let displayHeight = 1000;
        if (item.width && item.height && item.width > 0) {
            displayHeight = item.height * (STANDARD_MANGA_WIDTH / item.width);
        }
        const divider = (i < n - 1) ? DIVIDER_HEIGHT : 0;
        heightPrefixSum[i + 1] = heightPrefixSum[i] + displayHeight + divider;
    }
}

function getTotalHeight() {
    return heightPrefixSum[totalFilteredItems.length] || 0;
}

function getOffsetForIndex(index) {
    return heightPrefixSum[index] || 0;
}

function findIndexByOffset(offset) {
    if (totalFilteredItems.length === 0) return 0;
    let low = 0, high = totalFilteredItems.length - 1;
    while (low < high) {
        const mid = (low + high) >> 1;
        if (heightPrefixSum[mid + 1] <= offset) {
            low = mid + 1;
        } else {
            high = mid;
        }
    }
    return Math.max(0, Math.min(low, totalFilteredItems.length - 1));
}

// ==================== 预解码引擎 ====================

// 预加载指定范围的图片：创建 Image 对象、设置 src、调用 decode()。
// 跳过已经在 DOM 渲染范围内的索引（它们已经有自己的 img 元素了）。
function preloadImages(centerIndex) {
    if (Math.abs(centerIndex - lastPreloadCenter) < 3) return;
    lastPreloadCenter = centerIndex;

    const preloadStart = Math.max(0, centerIndex - 5);
    const preloadEnd = Math.min(totalFilteredItems.length, centerIndex + PRELOAD_AHEAD);

    for (let i = preloadStart; i < preloadEnd; i++) {
        // 已经在缓存里了
        if (decodedImageCache.has(i)) continue;
        // 已经在 DOM 里了（正在被浏览器直接解码渲染）
        if (renderedRange.start !== -1 && i >= renderedRange.start && i < renderedRange.end) continue;

        const item = totalFilteredItems[i];
        const imagePath = getImagePath(item);
        if (!imagePath) continue;

        const itemHeight = getOffsetForIndex(i + 1) - getOffsetForIndex(i) - (i < totalFilteredItems.length - 1 ? DIVIDER_HEIGHT : 0);

        // 创建一个完整配置好的 img 元素，后续可以直接塞进 DOM
        const img = new Image();
        img.className = 'seamless-image';
        img.alt = item.name || '未命名';
        img.style.width = `${STANDARD_MANGA_WIDTH}px`;
        img.style.height = `${itemHeight}px`;
        img.dataset.index = i;
        img.loading = 'eager';
        img.src = `file://${imagePath}`;

        decodedImageCache.set(i, img);

        // 关键：decode() 命令浏览器立刻解码这张图的原始像素。
        // 解码完成后，这个 img 对象就持有解码后的位图数据。
        // 后续我们把这个 同一个对象 appendChild 到 DOM 时，浏览器发现位图已在，零延迟绘制。
        img.decode().catch(() => {
            decodedImageCache.delete(i);
        });
    }

    // 防止内存无限膨胀
    if (decodedImageCache.size > PRELOAD_AHEAD * 3) {
        const entriesToRemove = decodedImageCache.size - PRELOAD_AHEAD * 2;
        let removed = 0;
        for (const [key] of decodedImageCache) {
            if (removed >= entriesToRemove) break;
            decodedImageCache.delete(key);
            removed++;
        }
    }
}

// ==================== DOM 创建 ====================

function createImageElement(item, index) {
    const imagePath = getImagePath(item);
    if (!imagePath) return null;

    const imgContainer = document.createElement('div');
    imgContainer.className = 'image-wrapper';
    imgContainer.style.width = `${STANDARD_MANGA_WIDTH}px`;
    imgContainer.dataset.virtualIndex = index;

    const itemHeight = getOffsetForIndex(index + 1) - getOffsetForIndex(index) - (index < totalFilteredItems.length - 1 ? DIVIDER_HEIGHT : 0);
    imgContainer.style.height = `${itemHeight}px`;

    if (index < totalFilteredItems.length - 1) {
        imgContainer.style.marginBottom = `${DIVIDER_HEIGHT}px`;
    }

    // ★ 核心：优先从预解码缓存中取出已经 decode 好的 Image 对象
    // 如果命中缓存，这个 img 的位图已经在内存里，appendChild 后浏览器零延迟绘制
    let img = decodedImageCache.get(index);
    if (img) {
        decodedImageCache.delete(index); // 转移所有权到 DOM
    } else {
        // 缓存未命中（首次加载或滚动太快超过预加载范围），正常创建
        img = document.createElement('img');
        img.className = 'seamless-image';
        img.alt = item.name || '未命名';
        img.style.width = `${STANDARD_MANGA_WIDTH}px`;
        img.style.height = `${itemHeight}px`;
        img.dataset.index = index;
        img.loading = 'eager';
        img.src = `file://${imagePath}`;
    }

    img.onerror = () => {
        console.error('图片加载失败:', imagePath);
    };

    imgContainer.appendChild(img);
    return imgContainer;
}

// ==================== 虚拟滚动核心 ====================

function getVisibleRange() {
    if (!viewportEl || totalFilteredItems.length === 0) {
        return { start: 0, end: 0 };
    }

    const zoom = getCurrentZoom();
    const scrollTop = viewportEl.scrollTop / zoom;
    const viewportHeight = viewportEl.clientHeight / zoom;

    const firstVisible = findIndexByOffset(scrollTop);
    const lastVisible = findIndexByOffset(scrollTop + viewportHeight);

    const start = Math.max(0, firstVisible - RENDER_BUFFER);
    const end = Math.min(totalFilteredItems.length, lastVisible + RENDER_BUFFER + 1);

    return { start, end };
}

// 纯增量式 DOM 渲染 —— 只在边缘增删，不碰中间节点
function renderVisibleItems() {
    if (isRendering) return;

    const { start, end } = getVisibleRange();

    if (start === renderedRange.start && end === renderedRange.end) {
        updateCurrentPositionIndicator();
        return;
    }

    if (!contentWrapperEl) return;

    isRendering = true;

    try {
        const oldStart = renderedRange.start;
        const oldEnd = renderedRange.end;

        const hasOverlap = oldStart !== -1 && start < oldEnd && end > oldStart;

        if (!hasOverlap) {
            // 无重叠：完全重建
            contentWrapperEl.innerHTML = '';
            const fragment = document.createDocumentFragment();
            for (let i = start; i < end; i++) {
                const el = createImageElement(totalFilteredItems[i], i);
                if (el) fragment.appendChild(el);
            }
            contentWrapperEl.appendChild(fragment);
        } else {
            // 有重叠：只动边缘

            // 1. 从顶部移除
            let removeFromTop = Math.max(0, start - oldStart);
            while (removeFromTop > 0 && contentWrapperEl.firstElementChild) {
                contentWrapperEl.removeChild(contentWrapperEl.firstElementChild);
                removeFromTop--;
            }

            // 2. 从底部移除
            let removeFromBottom = Math.max(0, oldEnd - end);
            while (removeFromBottom > 0 && contentWrapperEl.lastElementChild) {
                contentWrapperEl.removeChild(contentWrapperEl.lastElementChild);
                removeFromBottom--;
            }

            // 3. 在顶部插入
            const prependEnd = Math.min(oldStart, end);
            if (start < prependEnd) {
                const fragment = document.createDocumentFragment();
                for (let i = start; i < prependEnd; i++) {
                    const el = createImageElement(totalFilteredItems[i], i);
                    if (el) fragment.appendChild(el);
                }
                contentWrapperEl.insertBefore(fragment, contentWrapperEl.firstChild);
            }

            // 4. 在底部追加
            const appendStart = Math.max(oldEnd, start);
            if (appendStart < end) {
                const fragment = document.createDocumentFragment();
                for (let i = appendStart; i < end; i++) {
                    const el = createImageElement(totalFilteredItems[i], i);
                    if (el) fragment.appendChild(el);
                }
                contentWrapperEl.appendChild(fragment);
            }
        }

        renderedRange = { start, end };

        const topHeight = getOffsetForIndex(start);
        const bottomHeight = getTotalHeight() - getOffsetForIndex(end);
        spacerTopEl.style.height = `${Math.max(0, topHeight)}px`;
        spacerBottomEl.style.height = `${Math.max(0, bottomHeight)}px`;

        updateCurrentPositionIndicator();
    } finally {
        requestAnimationFrame(() => {
            isRendering = false;
        });
    }
}

// ==================== 位置指示器 ====================

function updateCurrentPositionIndicator() {
    if (!viewportEl || totalFilteredItems.length === 0) return;
    const zoom = getCurrentZoom();
    const scrollTop = viewportEl.scrollTop;
    const viewportHeight = viewportEl.clientHeight;
    const unscaledCenter = (scrollTop + viewportHeight / 2) / zoom;
    const currentIndex = findIndexByOffset(unscaledCenter) + 1;
    updateCountIndicator(currentIndex, totalFilteredItems.length);
}

function updateCountIndicator(currentIndex, totalCount) {
    let el = document.getElementById('total-count-indicator');
    if (!el) {
        el = document.createElement('div');
        el.id = 'total-count-indicator';
        document.body.appendChild(el);
    }
    el.textContent = `${currentIndex}/${totalCount}`;
}

// ==================== 滚动事件处理 ====================

const throttledScrollHandler = throttle(function () {
    renderVisibleItems();

    if (viewportEl && totalFilteredItems.length > 0) {
        const zoom = getCurrentZoom();
        const centerIndex = findIndexByOffset(viewportEl.scrollTop / zoom);
        preloadImages(centerIndex);
    }
}, 50);

function attachScrollListener() {
    if (scrollListenerAttached || !viewportEl) return;
    viewportEl.addEventListener('scroll', throttledScrollHandler);
    scrollListenerAttached = true;
}

function detachScrollListener() {
    if (!scrollListenerAttached || !viewportEl) return;
    viewportEl.removeEventListener('scroll', throttledScrollHandler);
    scrollListenerAttached = false;
}

// ==================== 公共 API ====================

export function setImageFixedSize() {
    const wrappers = document.querySelectorAll('.image-wrapper');
    const images = document.querySelectorAll('.seamless-image');
    wrappers.forEach(wrap => wrap.style.width = `${STANDARD_MANGA_WIDTH}px`);
    images.forEach(img => {
        img.style.width = `${STANDARD_MANGA_WIDTH}px`;
        img.style.maxWidth = `${STANDARD_MANGA_WIDTH}px`;
    });
}

export function displaySelectedItems(items, useAnimation = true) {
    containerEl = document.querySelector('#image-container');
    viewportEl = document.querySelector('#viewport');

    if (!containerEl || !viewportEl) return;

    if (!items || items.length === 0) {
        containerEl.innerHTML = '<p class="no-images">请先在Eagle中选择一个或多个图片</p>';
        return;
    }

    detachScrollListener();
    containerEl.innerHTML = '';
    renderedRange = { start: -1, end: -1 };
    isRendering = false;
    decodedImageCache.clear();
    lastPreloadCenter = -1;

    const filteredItems = items.filter(item => {
        const imagePath = getImagePath(item);
        return imagePath && isSupportedFormat(imagePath);
    });

    if (filteredItems.length === 0) {
        containerEl.innerHTML = '<p class="no-images">当前选择中没有支持的图片格式<br>支持的格式：JPG、JPEG、PNG、GIF、WEBP</p>';
        return;
    }

    totalFilteredItems = filteredItems;

    precalculateHeights();

    // 立即预加载开头的图片
    preloadImages(0);

    spacerTopEl = document.createElement('div');
    spacerTopEl.id = 'virtual-spacer-top';
    spacerTopEl.style.width = `${STANDARD_MANGA_WIDTH}px`;

    contentWrapperEl = document.createElement('div');
    contentWrapperEl.id = 'virtual-content';
    contentWrapperEl.style.width = '100%';
    contentWrapperEl.style.display = 'flex';
    contentWrapperEl.style.flexDirection = 'column';
    contentWrapperEl.style.alignItems = 'center';
    contentWrapperEl.style.overflowAnchor = 'none';

    spacerBottomEl = document.createElement('div');
    spacerBottomEl.id = 'virtual-spacer-bottom';
    spacerBottomEl.style.width = `${STANDARD_MANGA_WIDTH}px`;

    containerEl.appendChild(spacerTopEl);
    containerEl.appendChild(contentWrapperEl);
    containerEl.appendChild(spacerBottomEl);

    resetContentPosition();
    applyContentPosition();
    updateHorizontalScroll(getCurrentZoom());

    renderVisibleItems();
    attachScrollListener();

    setTimeout(() => updateVerticalScrollbar(), 100);
    updateCountIndicator(1, totalFilteredItems.length);

    if (useAnimation) {
        setTimeout(() => {
            containerEl.classList.remove('fading-out');
            containerEl.classList.add('fading-in');
            setTimeout(() => containerEl.classList.remove('fading-in'), AnimationConfig.FADE_IN_DURATION);
        }, 100);
    }
}

function createErrorMessageWithRetry(message) {
    return `
        <div class="no-images">
            <p>${message}</p>
            <button id="retry-button"
                    style="margin-top: 10px; padding: 8px 20px; background: #555; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                重试
            </button>
        </div>
    `;
}

export function loadSelectedItems() {
    console.log('loadSelectedItems');

    const container = document.querySelector('#image-container');
    if (!container) return;

    detachScrollListener();
    isRendering = false;

    const refreshButton = document.getElementById('refresh-button');
    if (refreshButton) {
        refreshButton.classList.add('refreshing');
        setTimeout(() => refreshButton.classList.remove('refreshing'), 500);
    }

    if (isFirstLoad) {
        container.innerHTML = '<div class="loading-message"><div class="spinner"></div>正在加载图片...</div>';

        eagle.item.getSelected().then(items => {
            if (!items || items.length === 0) {
                container.innerHTML = '<p class="no-images">请先在Eagle中选择一个或多个图片</p>';
                return;
            }
            isFirstLoad = false;
            displaySelectedItems(items, false);
        }).catch(err => {
            console.error('获取选中项目时出错:', err);
            container.innerHTML = createErrorMessageWithRetry('获取选中项目时出错');
            const retryBtn = container.querySelector('#retry-button');
            if (retryBtn) retryBtn.addEventListener('click', () => loadSelectedItems());
        });
    } else {
        container.style.transition = `opacity ${AnimationConfig.FADE_OUT_DURATION}ms ease-out`;
        container.style.opacity = '0';

        setTimeout(() => {
            eagle.item.getSelected().then(items => {
                if (!items || items.length === 0) {
                    container.innerHTML = '<p class="no-images">请先在Eagle中选择一个或多个图片</p>';
                    container.style.opacity = '1';
                    return;
                }
                container.innerHTML = '';
                displaySelectedItems(items, true);
                container.style.transition = `opacity ${AnimationConfig.FADE_IN_DURATION}ms ease-in`;
                container.style.opacity = '1';
                setTimeout(() => { container.style.transition = ''; }, AnimationConfig.FADE_IN_DURATION);
            }).catch(err => {
                console.error('获取选中项目时出错:', err);
                container.innerHTML = createErrorMessageWithRetry('获取选中项目时出错');
                container.style.opacity = '1';
                const retryBtn = container.querySelector('#retry-button');
                if (retryBtn) retryBtn.addEventListener('click', () => loadSelectedItems());
            });
        }, AnimationConfig.FADE_OUT_DURATION);
    }
}

export function getCurrentImages() {
    return totalFilteredItems;
}
