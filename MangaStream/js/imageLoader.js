// 图片加载模块 - 预计算精确高度虚拟滚动 + 增量DOM更新 + 对象级预解码复用
// 核心突破：预加载器创建的 Image 对象在 decode() 完成后，
//           直接被塞进 DOM —— 同一个JS对象，零重复解码。
import { SUPPORTED_IMAGE_FORMATS, AnimationConfig } from './constants.js';
import { isHorizontalMode, isHorizontalRTLMode, getStandardSizeValue, applyBodyModeClasses } from './modeManager.js';
import { resetContentPosition, applyContentPosition, getCurrentZoom } from './zoom.js';
// 注意：CSS zoom 方案下，applyContentPosition 仅设置 container.style.zoom，
// 交叉轴滚动由浏览器原生处理。
import { updateHorizontalScroll, updateVerticalScrollbar } from './scrollbar.js';
import { throttle } from './utils.js';

// ==================== 常量 ====================
const RENDER_BUFFER = 15;
const PRELOAD_AHEAD = 50;
let DIVIDER_SIZE = 1;

// ==================== 模块状态 ====================
let totalFilteredItems = [];
let isFirstLoad = true;

let sizePrefixSum = [];
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

export let pendingModeSwitchIndex = -1;

export function captureCurrentIndexForModeSwitch() {
    const textSpan = document.getElementById('total-count-text');
    if (textSpan && textSpan.dataset.currentIndex) {
        pendingModeSwitchIndex = parseInt(textSpan.dataset.currentIndex, 10);
    }
}

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

// ==================== 预计算主轴尺寸与前缀和 ====================

function precalculateSizes() {
    const n = totalFilteredItems.length;
    sizePrefixSum = new Array(n + 1);
    sizePrefixSum[0] = 0;

    const stdSize = getStandardSizeValue();

    for (let i = 0; i < n; i++) {
        const item = totalFilteredItems[i];
        let displaySize = 1000;

        if (item.width && item.height) {
            if (isHorizontalMode() && item.height > 0) {
                displaySize = item.width * (stdSize / item.height);
            } else if (!isHorizontalMode() && item.width > 0) {
                displaySize = item.height * (stdSize / item.width);
            }
        }

        const divider = (i < n - 1) ? DIVIDER_SIZE : 0;
        sizePrefixSum[i + 1] = sizePrefixSum[i] + displaySize + divider;
    }
}

function getTotalSize() {
    return sizePrefixSum[totalFilteredItems.length] || 0;
}

function getOffsetForIndex(index) {
    return sizePrefixSum[index] || 0;
}

function findIndexByOffset(offset) {
    if (totalFilteredItems.length === 0) return 0;
    let low = 0, high = totalFilteredItems.length - 1;
    while (low < high) {
        const mid = (low + high) >> 1;
        if (sizePrefixSum[mid + 1] <= offset) {
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

        const itemSpan = getOffsetForIndex(i + 1) - getOffsetForIndex(i) - (i < totalFilteredItems.length - 1 ? DIVIDER_SIZE : 0);

        // 创建一个完整配置好的 img 元素，后续可以直接塞进 DOM
        const img = new Image();
        img.className = 'seamless-image';
        img.alt = item.name || i18next.t('image.unnamed');

        if (isHorizontalMode()) {
            img.style.height = `${getStandardSizeValue()}px`;
            img.style.width = `${itemSpan}px`;
            img.style.maxHeight = `${getStandardSizeValue()}px`;
            img.style.maxWidth = 'none';
        } else {
            img.style.width = `${getStandardSizeValue()}px`;
            img.style.height = `${itemSpan}px`;
            img.style.maxWidth = `${getStandardSizeValue()}px`;
            img.style.maxHeight = 'none';
        }

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
    imgContainer.dataset.virtualIndex = index;

    const stdSize = getStandardSizeValue();
    const itemSize = getOffsetForIndex(index + 1) - getOffsetForIndex(index) - (index < totalFilteredItems.length - 1 ? DIVIDER_SIZE : 0);

    if (isHorizontalMode()) {
        imgContainer.style.height = `${stdSize}px`;
        imgContainer.style.width = `${itemSize}px`;
        if (index < totalFilteredItems.length - 1) imgContainer.style.marginRight = `${DIVIDER_SIZE}px`;
    } else {
        imgContainer.style.width = `${stdSize}px`;
        imgContainer.style.height = `${itemSize}px`;
        if (index < totalFilteredItems.length - 1) imgContainer.style.marginBottom = `${DIVIDER_SIZE}px`;
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
        img.dataset.index = index;
        img.loading = 'eager';

        if (isHorizontalMode()) {
            img.style.height = `${stdSize}px`;
            img.style.width = `${itemSize}px`;
            img.style.maxHeight = `${stdSize}px`;
            img.style.maxWidth = 'none';
        } else {
            img.style.width = `${stdSize}px`;
            img.style.height = `${itemSize}px`;
            img.style.maxWidth = `${stdSize}px`;
            img.style.maxHeight = 'none';
        }

        img.src = `file://${imagePath}`;
    }

    img.onerror = () => {
        console.error('图片加载失败:', imagePath);
    };

    imgContainer.appendChild(img);
    return imgContainer;
}

// ==================== 虚拟滚动核心 ====================

// 获取当前可见的图片索引范围
function getVisibleRange() {
    if (!viewportEl || totalFilteredItems.length === 0) {
        return { start: 0, end: 0 };
    }

    const zoom = getCurrentZoom();
    // Use Math.abs for horizontal scrollLeft so RTL negative coordinate natively maps to positive distance
    const rawScrollLeft = Math.abs(viewportEl.scrollLeft);
    const scrollPos = isHorizontalMode() ? rawScrollLeft : viewportEl.scrollTop;
    const clientSize = isHorizontalMode() ? viewportEl.clientWidth : viewportEl.clientHeight;

    const topOffset = scrollPos / zoom;
    const bottomOffset = (scrollPos + clientSize) / zoom;

    const firstVisible = findIndexByOffset(topOffset);
    let lastVisible = findIndexByOffset(bottomOffset);

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
            let removeFromTop = Math.max(0, start - oldStart); // Corrected logic for removing from top
            while (removeFromTop > 0 && contentWrapperEl.firstElementChild) {
                contentWrapperEl.removeChild(contentWrapperEl.firstElementChild);
                removeFromTop--;
            }

            // 2. 从底部移除
            let removeFromBottom = Math.max(0, oldEnd - end); // Corrected logic for removing from bottom
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

        const topSize = getOffsetForIndex(start);
        const bottomSize = getTotalSize() - getOffsetForIndex(end);

        if (isHorizontalMode()) {
            spacerTopEl.style.width = `${Math.max(0, topSize)}px`;
            spacerBottomEl.style.width = `${Math.max(0, bottomSize)}px`;
            spacerTopEl.style.height = `${getStandardSizeValue()}px`;
            spacerBottomEl.style.height = `${getStandardSizeValue()}px`;
        } else {
            spacerTopEl.style.height = `${Math.max(0, topSize)}px`;
            spacerBottomEl.style.height = `${Math.max(0, bottomSize)}px`;
            spacerTopEl.style.width = `${getStandardSizeValue()}px`;
            spacerBottomEl.style.width = `${getStandardSizeValue()}px`;
        }

        updateCurrentPositionIndicator();
    } finally {
        requestAnimationFrame(() => {
            isRendering = false;
        });
    }
}

// ==================== 位置指示器与快速跳转 ====================

let isJumpInputFocused = false;

function updateCurrentPositionIndicator() {
    if (!viewportEl || totalFilteredItems.length === 0 || isJumpInputFocused) return;

    const zoom = getCurrentZoom();
    const scrollPos = isHorizontalMode() ? Math.abs(viewportEl.scrollLeft) : viewportEl.scrollTop;

    const clientSize = isHorizontalMode() ? viewportEl.clientWidth : viewportEl.clientHeight;
    // 使用视口中心点来判断当前看到的是哪一张图
    const unscaledCenter = (scrollPos + clientSize / 2) / zoom;

    const currentIndex = findIndexByOffset(unscaledCenter) + 1;
    updateCountIndicator(currentIndex, totalFilteredItems.length);
}

function updateCountIndicator(currentIndex, totalCount) {
    let container = document.getElementById('total-count-indicator');

    // 初始化 DOM 和事件绑定（仅一次）
    if (!container) {
        container = document.createElement('div');
        container.id = 'total-count-indicator';

        const textSpan = document.createElement('span');
        textSpan.id = 'total-count-text';
        textSpan.setAttribute('data-hover-text', i18next.t('ui.jumpPageHint') || "输入指定页码回车跳转");

        const inputField = document.createElement('input');
        inputField.id = 'page-jump-input';
        inputField.type = 'number';
        inputField.min = 1;
        inputField.style.display = 'none';
        // 屏蔽键盘快捷键的冒泡（比如按 f 键不会全屏）
        inputField.addEventListener('keydown', e => e.stopPropagation());

        container.appendChild(textSpan);
        container.appendChild(inputField);
        document.body.appendChild(container);

        // 绑定点击进入输入模式
        container.addEventListener('click', () => {
            if (isJumpInputFocused) return;
            textSpan.style.display = 'none';
            inputField.style.display = 'inline-block';
            inputField.value = textSpan.dataset.currentIndex || 1;
            inputField.max = textSpan.dataset.totalCount || 1;
            inputField.focus();
            inputField.select();
            isJumpInputFocused = true;
        });

        // 执行跳转的逻辑
        const executeJump = () => {
            if (!isJumpInputFocused) return;
            isJumpInputFocused = false;

            inputField.style.display = 'none';
            textSpan.style.display = 'inline-block';

            let targetPage = parseInt(inputField.value, 10);
            const maxPage = parseInt(textSpan.dataset.totalCount, 10);

            if (isNaN(targetPage) || targetPage < 1) targetPage = 1;
            if (targetPage > maxPage) targetPage = maxPage;

            jumpToPage(targetPage);
        };

        inputField.addEventListener('blur', executeJump);
        inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                inputField.blur(); // 借用 blur 事件触发 executeJump
            } else if (e.key === 'Escape') {
                e.preventDefault();
                isJumpInputFocused = false;
                inputField.style.display = 'none';
                textSpan.style.display = 'inline-block';
            }
        });
    }

    // 更新显示的文字（如果不是在输入状态）
    if (!isJumpInputFocused) {
        const textSpan = container.querySelector('#total-count-text');
        if (textSpan) {
            textSpan.textContent = `${currentIndex} / ${totalCount}`;
            textSpan.dataset.currentIndex = currentIndex;
            textSpan.dataset.totalCount = totalCount;
        }
    }
}

// ==================== 滚动事件处理 ====================

export function jumpToPage(pageNumber) {
    if (pageNumber < 1 || pageNumber > totalFilteredItems.length || !viewportEl) return;

    // pageNumber 是 1-based, 转换为 0-based
    const index = pageNumber - 1;

    // 获取该索引在虚拟列表中的主轴偏移量
    const targetOffset = getOffsetForIndex(index);
    const zoom = getCurrentZoom();

    // 计算目标图片的整体主轴范围（高度/宽度）
    const pageSize = getOffsetForIndex(Math.min(index + 1, totalFilteredItems.length)) - targetOffset;

    // 视口的物理尺寸（屏幕大小，不受 zoom 影响）
    const clientSize = isHorizontalMode() ? viewportEl.clientWidth : viewportEl.clientHeight;

    // 核心物理运算：图片在虚拟空间的中心坐标 * 放大倍率 - 屏幕的一半 = 最终需要卷动的物理像素
    // 这样能保证指定序号的图片中心恰好落在屏幕中心
    const unscaledCenter = targetOffset + pageSize / 2;
    const centeredOffset = Math.max(0, unscaledCenter * zoom - clientSize / 2);

    // 提前撑开虚拟 DOM 高/宽，防止浏览器因当前 DOM 高度不足而将 scrollLeft/scrollTop 强制截断 (Clamp to 0)
    if (spacerBottomEl) {
        // spacerBottomEl 在 image-container 内部，CSS zoom 会自动放大其布局尺寸，
        // 所以这里用未缩放的 totalSize 即可，不需要手动乘 zoom。
        const totalSize = getTotalSize();
        if (isHorizontalMode()) {
            spacerBottomEl.style.width = `${totalSize}px`;
            // 强制触发浏览器同步重排 (Reflow)，更新底层 ScrollWidth 边界
            void viewportEl.scrollWidth;
        } else {
            spacerBottomEl.style.height = `${totalSize}px`;
            // 强制触发重排，更新 ScrollHeight 边界
            void viewportEl.scrollHeight;
        }
    }

    if (isHorizontalMode()) {
        const rtlMultiplier = isHorizontalRTLMode() ? -1 : 1;
        viewportEl.scrollLeft = centeredOffset * rtlMultiplier;
    } else {
        viewportEl.scrollTop = centeredOffset;
    }

    // 同步渲染确保立刻显示 DOM 切片，而不是等待节流后的 scroll 事件
    renderVisibleItems();
}

const throttledScrollHandler = throttle(function () {
    renderVisibleItems();

    if (viewportEl && totalFilteredItems.length > 0) {
        const zoom = getCurrentZoom();
        const scrollPos = isHorizontalMode() ? Math.abs(viewportEl.scrollLeft) : viewportEl.scrollTop;
        const centerIndex = findIndexByOffset(scrollPos / zoom);
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
    const stdSize = getStandardSizeValue();

    if (isHorizontalMode()) {
        wrappers.forEach(wrap => {
            wrap.style.height = `${stdSize}px`;
        });
        images.forEach(img => {
            img.style.height = `${stdSize}px`;
            img.style.maxHeight = `${stdSize}px`;
            img.style.width = 'auto';
            img.style.maxWidth = 'none';
        });
    } else {
        wrappers.forEach(wrap => {
            wrap.style.width = `${stdSize}px`;
        });
        images.forEach(img => {
            img.style.width = `${stdSize}px`;
            img.style.maxWidth = `${stdSize}px`;
            img.style.height = 'auto';
            img.style.maxHeight = 'none';
        });
    }
}

// ==================== 模式切换快速路径 ====================
// 切换阅读模式时无需重新从 Eagle API 获取数据，直接复用已有的 totalFilteredItems
// 对于 10w+ 图片场景，跳过 eagle.item.getSelected() + 过滤 + 500ms 淡入淡出，瞬间完成

export function reloadForModeSwitch() {
    if (totalFilteredItems.length === 0) {
        // 首次加载还没有数据或者没图片，确保基础样式应用后走正常流程
        applyBodyModeClasses();
        loadSelectedItems();
        return;
    }

    containerEl = document.querySelector('#image-container');
    viewportEl = document.querySelector('#viewport');
    if (!containerEl || !viewportEl) return;

    // 淡出：keyframes 动画从 1→0，结束后 forwards 保持 opacity:0
    containerEl.classList.remove('visible');
    containerEl.classList.add('fading-out');

    // 延迟到淡出完成（屏幕变黑）后，再进行破坏性的 DOM 重建和页面跳转
    setTimeout(() => {
        // 淡出完成，移除动画类（base opacity:0 维持黑屏）
        containerEl.classList.remove('fading-out');

        // 在屏幕变黑时，切换真实的基础排版 CSS 属性（原从 setReadingMode 抽离）
        applyBodyModeClasses();

        detachScrollListener();
        containerEl.innerHTML = '';
        renderedRange = { start: -1, end: -1 };
        isRendering = false;
        decodedImageCache.clear();
        lastPreloadCenter = -1;

        const targetJumpIndex = pendingModeSwitchIndex;
        pendingModeSwitchIndex = -1;

        // 用新模式的主轴方向重新计算前缀和（纯算术，10w 张 < 50ms）
        precalculateSizes();

        // 从目标位置附近预加载，切换后目标页面图片优先解码
        preloadImages(targetJumpIndex > 0 ? targetJumpIndex - 1 : 0);

        const stdSize = getStandardSizeValue();
        const totalSize = getTotalSize();

        spacerTopEl = document.createElement('div');
        spacerTopEl.id = 'virtual-spacer-top';

        contentWrapperEl = document.createElement('div');
        contentWrapperEl.id = 'virtual-content';
        contentWrapperEl.style.width = isHorizontalMode() ? 'auto' : '100%';
        contentWrapperEl.style.height = isHorizontalMode() ? '100%' : 'auto';
        contentWrapperEl.style.display = 'flex';
        contentWrapperEl.style.flexDirection = isHorizontalMode() ? 'row' : 'column';
        contentWrapperEl.style.alignItems = 'center';
        contentWrapperEl.style.overflowAnchor = 'none';

        spacerBottomEl = document.createElement('div');
        spacerBottomEl.id = 'virtual-spacer-bottom';

        if (isHorizontalMode()) {
            spacerTopEl.style.height = `${stdSize}px`;
            spacerBottomEl.style.height = `${stdSize}px`;
            // 预先撑开完整主轴尺寸，保证 scrollLeft 目标值不被浏览器截断
            spacerBottomEl.style.width = `${totalSize}px`;
        } else {
            spacerTopEl.style.width = `${stdSize}px`;
            spacerBottomEl.style.width = `${stdSize}px`;
            // 预先撑开完整主轴尺寸，保证 scrollTop 目标值不被浏览器截断
            spacerBottomEl.style.height = `${totalSize}px`;
        }

        containerEl.appendChild(spacerTopEl);
        containerEl.appendChild(contentWrapperEl);
        containerEl.appendChild(spacerBottomEl);

        resetContentPosition();
        attachScrollListener();

        requestAnimationFrame(() => {
            // 设置 CSS zoom，浏览器会据此更新布局尺寸
            applyContentPosition();

            // 强制同步重排：让浏览器以 CSS zoom 后的布局尺寸更新滚动边界，
            // 此后设置的 scrollTop/Left 才不会被物理边界截断。
            void (isHorizontalMode() ? viewportEl.scrollWidth : viewportEl.scrollHeight);

            // 直接定位到目标页——滚动位置在第一次 renderVisibleItems 之前就已就绪，
            // 内容永远不会经过位置 0，彻底消除切换时的画面跳动。
            if (targetJumpIndex !== -1) {
                const index = targetJumpIndex - 1; // 转为 0-based
                const targetOffset = getOffsetForIndex(index);
                const zoom = getCurrentZoom();
                const pageSize = getOffsetForIndex(Math.min(index + 1, totalFilteredItems.length)) - targetOffset;
                const clientSize = isHorizontalMode() ? viewportEl.clientWidth : viewportEl.clientHeight;
                const centeredOffset = Math.max(0, (targetOffset + pageSize / 2) * zoom - clientSize / 2);

                if (isHorizontalMode()) {
                    viewportEl.scrollLeft = centeredOffset * (isHorizontalRTLMode() ? -1 : 1);
                } else {
                    viewportEl.scrollTop = centeredOffset;
                }
            }

            // 在已定位好的滚动位置上渲染，首帧即目标页
            renderVisibleItems();

            // renderVisibleItems 创建了 image-wrapper 后，滚动条才能正确计算尺寸
            updateHorizontalScroll();

            // 内容已就位，淡入：keyframes 动画从 0→1
            containerEl.classList.add('fading-in');
            setTimeout(() => {
                containerEl.classList.remove('fading-in');
                containerEl.classList.add('visible');
            }, AnimationConfig.FADE_IN_DURATION);
        });

        setTimeout(() => updateVerticalScrollbar(), 100);

    }, AnimationConfig.FADE_OUT_DURATION);
}

export function displaySelectedItems(items, useAnimation = true) {
    containerEl = document.querySelector('#image-container');
    viewportEl = document.querySelector('#viewport');

    if (!containerEl || !viewportEl) return;

    if (!items || items.length === 0) {
        containerEl.innerHTML = `<p class="no-images">${i18next.t('image.noImages')}</p>`;
        containerEl.classList.add('visible');
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
        containerEl.innerHTML = `<p class="no-images">${i18next.t('image.noSupportedFormat')}</p>`;
        containerEl.classList.add('visible');
        return;
    }

    totalFilteredItems = filteredItems;

    precalculateSizes();

    // 立即预加载开头的图片
    preloadImages(0);

    const stdSize = getStandardSizeValue();

    spacerTopEl = document.createElement('div');
    spacerTopEl.id = 'virtual-spacer-top';

    contentWrapperEl = document.createElement('div');
    contentWrapperEl.id = 'virtual-content';
    contentWrapperEl.style.width = isHorizontalMode() ? 'auto' : '100%';
    contentWrapperEl.style.height = isHorizontalMode() ? '100%' : 'auto';
    contentWrapperEl.style.display = 'flex';
    contentWrapperEl.style.flexDirection = isHorizontalMode() ? 'row' : 'column';
    contentWrapperEl.style.alignItems = 'center';
    contentWrapperEl.style.overflowAnchor = 'none';

    spacerBottomEl = document.createElement('div');
    spacerBottomEl.id = 'virtual-spacer-bottom';

    if (isHorizontalMode()) {
        spacerTopEl.style.height = `${stdSize}px`;
        spacerBottomEl.style.height = `${stdSize}px`;
    } else {
        spacerTopEl.style.width = `${stdSize}px`;
        spacerBottomEl.style.width = `${stdSize}px`;
    }

    containerEl.appendChild(spacerTopEl);
    containerEl.appendChild(contentWrapperEl);
    containerEl.appendChild(spacerBottomEl);

    resetContentPosition();

    // 先附加监听器，让后续操作生效
    attachScrollListener();

    const targetJumpIndex = pendingModeSwitchIndex;
    pendingModeSwitchIndex = -1;

    // 先渲染当前滚动位置的可见图片 (通常是0)
    renderVisibleItems();

    // 解决切换模式/重载后需要缩放或拖拽才应用 transform 约束的问题。
    requestAnimationFrame(() => {
        applyContentPosition();
        updateHorizontalScroll();

        // 第二个 rAF：布局稳定后跳转并淡入，与 reloadForModeSwitch 保持一致。
        requestAnimationFrame(() => {
            if (targetJumpIndex !== -1) {
                jumpToPage(targetJumpIndex);
            }
            containerEl.classList.add('fading-in');
            setTimeout(() => {
                containerEl.classList.remove('fading-in');
                containerEl.classList.add('visible');
            }, AnimationConfig.FADE_IN_DURATION);
        });
    });

    setTimeout(() => updateVerticalScrollbar(), 100);

    // 初始化页码指示器（仅首次创建时）
    if (document.getElementById('total-count-text') == null) {
        updateCountIndicator(1, totalFilteredItems.length);
    }
}

function createErrorMessageWithRetry(message) {
    return `
        <div class="no-images">
            <p>${message}</p>
            <button id="retry-button"
                    style="margin-top: 10px; padding: 8px 20px; background: #555; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                ${i18next.t('image.retryButton')}
            </button>
        </div>
    `;
}

// 递归获取文件夹下所有子文件夹的ID（包括自己）
// 使用 getAllHierarchy 参数获取完整层级结构
async function getAllSubFolderIds(folderId) {
    const collectedIds = [folderId];
    
    // 使用 get 获取文件夹，getAllHierarchy=true 返回完整层级结构
    const folders = await eagle.folder.get({
        ids: [folderId],
        getAllHierarchy: true,
        fullDetails: true
    });
    
    if (!folders || folders.length === 0) {
        return collectedIds;
    }
    
    const folder = folders[0];
    console.log(`文件夹 "${folder.name}" (ID: ${folder.id}) 的子文件夹数量:`, folder.children ? folder.children.length : 0);
    
    if (folder.children && folder.children.length > 0) {
        for (const child of folder.children) {
            const childIds = await getAllSubFolderIds(child.id);
            collectedIds.push(...childIds);
        }
    }
    
    return collectedIds;
}

// 获取当前选中文件夹的所有图片（包括所有子文件夹）
async function getFolderImages() {
    try {
        const folders = await eagle.folder.getSelected();
        if (!folders || folders.length === 0) {
            return null;
        }
        
        const rootFolder = folders[0];
        console.log(`开始获取文件夹 "${rootFolder.name}" 下的所有图片...`);
        
        // 递归获取所有子文件夹ID
        const allFolderIds = await getAllSubFolderIds(rootFolder.id);
        console.log(`找到 ${allFolderIds.length} 个文件夹`);
        
        // 并行获取所有文件夹的图片
        const promises = allFolderIds.map(folderId => 
            eagle.item.get({
                folders: [folderId],
                limit: 10000
            })
        );
        
        const results = await Promise.all(promises);
        
        // 合并所有结果
        let collectedItems = [];
        for (const items of results) {
            if (items && items.length > 0) {
                collectedItems.push(...items);
            }
        }
        
        console.log(`在所有子文件夹中共找到 ${collectedItems.length} 张图片`);
        
        if (collectedItems.length > 0) {
            return collectedItems;
        }
        return null;
    } catch (err) {
        console.error('获取文件夹图片时出错:', err);
        return null;
    }
}

// 加载图片的核心逻辑
async function loadImagesCore(items, useAnimation = true) {
    const container = document.querySelector('#image-container');
    if (!container) return;

    if (!items || items.length === 0) {
        container.innerHTML = `<p class="no-images">${i18next.t('image.noImagesAvailable')}</p>`;
        return;
    }
    isFirstLoad = false;
    displaySelectedItems(items, useAnimation);
}

// 处理初次加载（无选中图片时尝试获取文件夹图片）
async function handleFirstLoad(container) {
    container.innerHTML = `<div class="loading-message"><div class="spinner"></div>${i18next.t('image.loading')}</div>`;

    try {
        let items = await eagle.item.getSelected();
        
        // 如果没有选中图片，尝试获取当前选中文件夹的图片
        if (!items || items.length === 0) {
            console.log('没有选中图片，尝试获取当前文件夹的图片...');
            items = await getFolderImages();
        }
        
        if (!items || items.length === 0) {
            container.innerHTML = `<p class="no-images">${i18next.t('image.selectImageOrFolder')}</p>`;
            return;
        }
        
        await loadImagesCore(items, false);
    } catch (err) {
        console.error('获取选中项目时出错:', err);
        container.innerHTML = createErrorMessageWithRetry(i18next.t('image.loadError'));
        const retryBtn = container.querySelector('#retry-button');
        if (retryBtn) retryBtn.addEventListener('click', () => loadSelectedItems());
    }
}

// 处理非初次加载（刷新操作）
async function handleRefreshLoad(container) {
    container.style.transition = `opacity ${AnimationConfig.FADE_OUT_DURATION}ms ease-out`;
    container.style.opacity = '0';

    setTimeout(async () => {
        try {
            let items = await eagle.item.getSelected();
            
            // 如果没有选中图片，尝试获取当前选中文件夹的图片
            if (!items || items.length === 0) {
                console.log('没有选中图片，尝试获取当前文件夹的图片...');
                items = await getFolderImages();
            }
            
            if (!items || items.length === 0) {
                container.innerHTML = `<p class="no-images">${i18next.t('image.selectImageOrFolder')}</p>`;
                container.style.opacity = '1';
                return;
            }
            
            container.innerHTML = '';
            await loadImagesCore(items, true);
            container.style.transition = `opacity ${AnimationConfig.FADE_IN_DURATION}ms ease-in`;
            container.style.opacity = '1';
            setTimeout(() => { container.style.transition = ''; }, AnimationConfig.FADE_IN_DURATION);
        } catch (err) {
            console.error('Error loading selected items:', err);
            container.innerHTML = createErrorMessageWithRetry(i18next.t('image.loadError'));
            container.style.opacity = '1';
            const retryBtn = container.querySelector('#retry-button');
            if (retryBtn) retryBtn.addEventListener('click', () => loadSelectedItems());
        }
    }, AnimationConfig.FADE_OUT_DURATION);
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
        handleFirstLoad(container);
    } else {
        handleRefreshLoad(container);
    }
}

export function getCurrentImages() {
    return totalFilteredItems;
}
