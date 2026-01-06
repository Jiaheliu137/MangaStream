// 图片加载与懒加载模块（使用IntersectionObserver优化）
import { STANDARD_MANGA_WIDTH, SUPPORTED_IMAGE_FORMATS, LazyLoadConfig, AnimationConfig } from './constants.js';
import { resetContentPosition, applyContentPosition, getCurrentZoom } from './zoom.js';
import { updateHorizontalScroll, updateVerticalScrollbar } from './scrollbar.js';
import { throttle } from './utils.js';

// 懒加载状态
let lazyLoadingInProgress = false;
let totalFilteredItems = [];
let currentLoadedIndex = 0;
let isFirstLoad = true;
let intersectionObserver = null;

// 获取图片路径
function getImagePath(item) {
    if (item.filePath) {
        return item.filePath;
    } else if (item.path) {
        return item.path;
    } else if (item.url && item.url.startsWith('file://')) {
        return item.url.replace('file://', '');
    }
    return '';
}

// 检查是否为支持的图片格式
function isSupportedFormat(imagePath) {
    const fileName = imagePath.toLowerCase();
    return SUPPORTED_IMAGE_FORMATS.some(format => fileName.endsWith(format));
}

// 创建图片元素
function createImageElement(item, index) {
    const imagePath = getImagePath(item);
    if (!imagePath) return null;

    // 创建图片容器
    const imgContainer = document.createElement('div');
    imgContainer.className = 'image-wrapper';
    imgContainer.style.width = `${STANDARD_MANGA_WIDTH}px`;

    // 创建图片元素
    const img = document.createElement('img');
    img.className = 'seamless-image lazy-image';
    img.alt = item.name || '未命名';
    img.style.width = `${STANDARD_MANGA_WIDTH}px`;
    img.style.maxWidth = `${STANDARD_MANGA_WIDTH}px`;
    img.style.height = 'auto';
    img.dataset.index = index;
    img.dataset.src = `file://${imagePath}`; // 使用data-src存储真实路径

    imgContainer.appendChild(img);

    return imgContainer;
}

// 使用IntersectionObserver实现懒加载
function setupIntersectionObserver() {
    // 如果已存在observer，先断开
    if (intersectionObserver) {
        intersectionObserver.disconnect();
    }

    // 创建新的IntersectionObserver
    intersectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;

                // 如果图片还没有加载
                if (img.dataset.src && !img.src) {
                    img.src = img.dataset.src;
                    img.classList.remove('lazy-image');

                    // 加载完成后停止观察
                    img.onload = () => {
                        intersectionObserver.unobserve(img);
                    };

                    img.onerror = () => {
                        console.error('图片加载失败:', img.dataset.src);
                        intersectionObserver.unobserve(img);
                    };
                }
            }
        });
    }, {
        root: document.querySelector('#viewport'),
        rootMargin: '500px', // 提前500px开始加载
        threshold: 0.01
    });
}

// 为所有图片设置固定尺寸
export function setImageFixedSize() {
    const images = document.querySelectorAll('.seamless-image');
    if (images.length === 0) return;

    const uniformWidth = STANDARD_MANGA_WIDTH;

    images.forEach(img => {
        if (img.complete) {
            applyFixedWidthToImage(img, uniformWidth);
        } else {
            img.onload = () => applyFixedWidthToImage(img, uniformWidth);
        }
    });
}

// 应用固定宽度到图片
function applyFixedWidthToImage(img, width) {
    img.style.width = `${width}px`;
    img.style.maxWidth = `${width}px`;

    const wrapper = img.closest('.image-wrapper');
    if (wrapper) {
        wrapper.style.width = `${width}px`;
    }
}

// 更新计数指示器
function updateCountIndicator(currentIndex, totalCount) {
    let totalCountIndicator = document.getElementById('total-count-indicator');
    if (!totalCountIndicator) {
        totalCountIndicator = document.createElement('div');
        totalCountIndicator.id = 'total-count-indicator';
        document.body.appendChild(totalCountIndicator);
    }

    totalCountIndicator.textContent = `${currentIndex}/${totalCount}`;
}

// 初始化滚动位置跟踪器
function initScrollPositionTracker() {
    const viewport = document.querySelector('#viewport');
    if (!viewport) return;

    const throttledScrollHandler = throttle(function() {
        if (totalFilteredItems.length === 0) return;

        const imageContainers = document.querySelectorAll('.image-wrapper');
        if (imageContainers.length === 0) return;

        const viewportRect = viewport.getBoundingClientRect();
        const viewportTop = viewport.scrollTop;
        const viewportCenter = viewportTop + (viewportRect.height / 2);

        let currentImageIndex = 0;
        let minDistance = Infinity;

        imageContainers.forEach((container, index) => {
            const containerRect = container.getBoundingClientRect();
            const containerTop = viewport.scrollTop + containerRect.top - viewportRect.top;
            const containerCenter = containerTop + (containerRect.height / 2);

            const distance = Math.abs(viewportCenter - containerCenter);
            if (distance < minDistance) {
                minDistance = distance;
                currentImageIndex = index + 1;
            }
        });

        updateCountIndicator(currentImageIndex, totalFilteredItems.length);
    }, 100);

    viewport.addEventListener('scroll', throttledScrollHandler);

    setTimeout(() => {
        throttledScrollHandler();
    }, 500);
}

// 显示选中的图片
export function displaySelectedItems(items, useAnimation = true) {
    const container = document.querySelector('#image-container');

    if (!items || items.length === 0) {
        container.innerHTML = '<p class="no-images">请先在Eagle中选择一个或多个图片</p>';
        return;
    }

    container.innerHTML = '';
    currentLoadedIndex = 0;
    lazyLoadingInProgress = false;

    // 筛选支持的图片格式
    const filteredItems = items.filter(item => {
        const imagePath = getImagePath(item);
        return imagePath && isSupportedFormat(imagePath);
    });

    if (filteredItems.length === 0) {
        container.innerHTML = '<p class="no-images">当前选择中没有支持的图片格式<br>支持的格式：JPG、JPEG、PNG、GIF、WEBP</p>';
        return;
    }

    totalFilteredItems = filteredItems;

    // 设置IntersectionObserver
    setupIntersectionObserver();

    // 加载所有图片（使用懒加载）
    filteredItems.forEach((item, index) => {
        const imgContainer = createImageElement(item, index);
        if (imgContainer) {
            container.appendChild(imgContainer);

            // 添加分割线
            if (index < filteredItems.length - 1) {
                const divider = document.createElement('div');
                divider.className = 'image-divider';
                divider.style.backgroundColor = '#1e1e1e';
                container.appendChild(divider);
            }

            // 将图片添加到观察列表
            const img = imgContainer.querySelector('img');
            if (img && intersectionObserver) {
                intersectionObserver.observe(img);
            }
        }
    });

    // 初始化第一张图片
    const firstImg = container.querySelector('img');
    if (firstImg && firstImg.dataset.src) {
        firstImg.src = firstImg.dataset.src;
        firstImg.classList.remove('lazy-image');

        firstImg.onload = () => {
            setImageFixedSize();
            resetContentPosition();
            applyContentPosition();
            updateHorizontalScroll(getCurrentZoom());
            updateVerticalScrollbar();

            if (useAnimation) {
                container.classList.remove('fading-out');
                container.classList.add('fading-in');
            }
        };
    }

    // 显示总数信息
    if (totalFilteredItems.length > 0) {
        updateCountIndicator(1, totalFilteredItems.length);
        initScrollPositionTracker();
    }

    if (useAnimation) {
        setTimeout(() => {
            container.classList.remove('fading-out');
            container.classList.add('fading-in');

            setTimeout(() => {
                container.classList.remove('fading-in');
            }, AnimationConfig.FADE_IN_DURATION);
        }, 100);
    }
}

// 加载选中的项目
export function loadSelectedItems() {
    console.log('loadSelectedItems');

    const container = document.querySelector('#image-container');
    if (!container) return;

    // 获取刷新按钮并添加旋转动画
    const refreshButton = document.getElementById('refresh-button');
    if (refreshButton) {
        refreshButton.classList.add('refreshing');
        setTimeout(() => {
            refreshButton.classList.remove('refreshing');
        }, 500);
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
            container.innerHTML = '<p class="no-images">获取选中项目时出错，请重试</p>';
        });
    } else {
        // 非首次加载，使用淡入淡出动画
        container.style.transition = `opacity ${AnimationConfig.FADE_OUT_DURATION}ms ease-out`;
        container.style.opacity = '0';

        setTimeout(() => {
            eagle.item.getSelected().then(items => {
                if (!items || items.length === 0) {
                    container.innerHTML = '<p class="no-images">请先在Eagle中选择一个或多个图片</p>';
                    return;
                }

                container.innerHTML = '';
                displaySelectedItems(items, true);

                container.style.transition = `opacity ${AnimationConfig.FADE_IN_DURATION}ms ease-in`;
                container.style.opacity = '1';

                setTimeout(() => {
                    container.style.transition = '';
                }, AnimationConfig.FADE_IN_DURATION);
            }).catch(err => {
                console.error('获取选中项目时出错:', err);
                container.innerHTML = '<p class="no-images">获取选中项目时出错，请重试</p>';
            });
        }, AnimationConfig.FADE_OUT_DURATION);
    }
}

// 获取当前加载的图片列表（用于PDF导出）
export function getCurrentImages() {
    return totalFilteredItems;
}
