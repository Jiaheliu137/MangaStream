// 全局变量，用于存储当前缩放比例
let currentZoom = 1.0; // 默认缩放为100%

eagle.onPluginCreate((plugin) => {
	console.log('eagle.onPluginCreate');
	
	// 不要在这里立即调用loadSelectedItems()
	// 而是在插件初始化完成后调用
	
	// 添加缩放功能
	initZoomFeature();
});

eagle.onPluginRun(() => {
	console.log('eagle.onPluginRun');
	// 在插件运行时获取选中的项目
	loadSelectedItems();
});

// 添加防抖函数
function debounce(func, wait) {
	let timeout;
	return function(...args) {
		const context = this;
		clearTimeout(timeout);
		timeout = setTimeout(() => func.apply(context, args), wait);
	};
}

// 添加/恢复检查横向滚动条的函数
function updateHorizontalScroll(zoom) {
	const container = document.querySelector('#image-container');
	const containerWidth = container.getBoundingClientRect().width;
	const windowWidth = window.innerWidth;
	
	document.body.style.overflowX = containerWidth * zoom > windowWidth ? 'auto' : 'hidden';
}

// 修正缩放函数，确保不干扰窗口大小调整时的视图稳定性
function applyZoomWithMouseCenter(newZoom, oldZoom, mouseX, mouseY) {
	const container = document.querySelector('#image-container');
	
	// 获取当前滚动位置
	const scrollY = window.scrollY || window.pageYOffset;
	
	// 计算当前视口顶部在文档中的位置
	const viewportTopPosition = scrollY;
	
	// 获取容器位置信息
	const containerRect = container.getBoundingClientRect();
	const containerTop = containerRect.top + scrollY;
	
	// 计算视口顶部在容器中的相对位置比例（使用百分比而非像素值）
	const relativeTopPositionRatio = (viewportTopPosition - containerTop) / (containerRect.height * oldZoom);
	
	// 设置变换原点为顶部中心
	container.style.transformOrigin = 'top center';
	
	// 应用新的缩放比例
	container.style.transform = `scale(${newZoom})`;
	
	// ⚠️ 关键添加: 更新CSS变量，用于在resize期间维持缩放
	document.documentElement.style.setProperty('--current-zoom', newZoom);
	
	// 简化计算，使用百分比位置恢复视图位置
	const newContainerHeight = containerRect.height * newZoom;
	const newScrollPosition = containerTop + (relativeTopPositionRatio * newContainerHeight);
	
	// 设置新的滚动位置
	window.scrollTo({
		left: 0, // 保持水平居中
		top: newScrollPosition,
		behavior: 'auto' // 立即滚动，避免延迟
	});
	
	// 更新横向滚动条状态
	updateHorizontalScroll(newZoom);
	
	// 显示缩放级别
	showZoomLevel(newZoom);
	
	// 确保全局currentZoom变量被正确更新
	currentZoom = newZoom;
}

// 确保内容居中的辅助函数
function ensureCenteredContent() {
	const container = document.querySelector('#image-container');
	
	// 确保容器自身居中
	container.style.margin = '0 auto';
	container.style.display = 'flex';
	container.style.flexDirection = 'column';
	container.style.alignItems = 'center';
	container.style.width = '100%';
	
	// 确保图片包装器居中显示图片
	const imageWrappers = document.querySelectorAll('.image-wrapper');
	imageWrappers.forEach(wrapper => {
		wrapper.style.display = 'flex';
		wrapper.style.justifyContent = 'center';
		wrapper.style.width = '100%';
	});
}

// 调整容器宽度函数 - 删除可能影响居中的代码
function adjustContainerWidth(zoom) {
	// 不做任何可能影响居中布局的操作
	// 只处理滚动条显示/隐藏
	const container = document.querySelector('#image-container');
	const windowWidth = window.innerWidth;
	
	if (container.scrollWidth * zoom > windowWidth) {
		document.body.style.overflowX = 'auto';
	} else {
		document.body.style.overflowX = 'hidden';
	}
}

// 应用缩放的核心函数
function applyZoom(newZoom) {
	const container = document.querySelector('#image-container');
	
	// 获取当前滚动位置
	const scrollY = window.scrollY;
	
	// 获取容器位置信息
	const containerRect = container.getBoundingClientRect();
	const containerTop = containerRect.top + scrollY;
	
	// 计算视口顶部在容器中的相对位置比例
	const relativeTopPositionRatio = (scrollY - containerTop) / (containerRect.height * currentZoom);
	
	// 应用缩放
	container.style.transform = `scale(${newZoom})`;
	container.style.transformOrigin = 'top center';
	
	// 更新CSS变量
	document.documentElement.style.setProperty('--current-zoom', newZoom);
	
	// 计算并设置新的滚动位置
	const newContainerHeight = containerRect.height * newZoom;
	const newScrollPosition = containerTop + (relativeTopPositionRatio * newContainerHeight);
	window.scrollTo(0, newScrollPosition);
	
	// 更新UI状态
	updateUI(newZoom);
	
	// 更新当前缩放级别
	currentZoom = newZoom;
}

// 更新UI状态的辅助函数 (合并多个更新函数)
function updateUI(zoom) {
	// 显示缩放级别
	showZoomLevel(zoom);
	
	// 更新横向滚动条状态
	updateHorizontalScroll(zoom);
	
	// 更新容器类和光标样式
	updateContainerState();
}

// 初始化缩放功能
function initZoomFeature() {
	// 确保初始状态下内容居中
	ensureCenteredContent();
	
	// 设置当前缩放比例为默认值
	if (typeof currentZoom === 'undefined') {
		currentZoom = 1.0;
	}
	
	// 滚轮缩放
	document.addEventListener('wheel', (e) => {
		if (!e.ctrlKey) return;
		e.preventDefault();
		
		// 计算新的缩放值
		const delta = e.deltaY > 0 ? -0.05 : 0.05;
		const newZoom = currentZoom * (1 + delta);
		
		// 应用缩放限制
		const limitedZoom = Math.max(0.2, Math.min(5.0, newZoom));
		if (Math.abs(limitedZoom - currentZoom) < 0.01) return;
		
		// 应用新缩放值
		applyZoom(limitedZoom);
	}, { passive: false });
	
	// Ctrl+0 重置缩放
	document.addEventListener('keydown', (e) => {
		if (e.ctrlKey && (e.key === '0' || e.keyCode === 48)) {
			e.preventDefault();
			applyZoom(1.0);
		}
	});
	
	// 窗口大小变化时重新确保居中
	// 初始化拖动功能
	initDragFeature();
	
	// 监听窗口大小变化，确保内容始终居中
	window.addEventListener('resize', initializePlugin);
}

// 优化拖动功能
function initDragFeature() {
	let isDragging = false;
	let lastMouseX, lastMouseY;
	
	// 检查是否应该启用水平拖动
	function shouldEnableDrag() {
		const container = document.querySelector('#image-container');
		const containerWidth = container.getBoundingClientRect().width;
		const windowWidth = window.innerWidth;
		return containerWidth * currentZoom > windowWidth;
	}
	
	// 鼠标按下事件
	document.addEventListener('mousedown', (e) => {
		// 忽略非左键点击和交互元素
		if (e.button !== 0 || ['BUTTON', 'A', 'INPUT'].includes(e.target.tagName)) return;
		
		e.preventDefault();
		isDragging = true;
		lastMouseX = e.clientX;
		lastMouseY = e.clientY;
		
		// 更新光标样式
		document.body.classList.add('dragging');
		document.body.style.cursor = shouldEnableDrag() ? 'grabbing' : 'ns-resize';
	});
	
	// 鼠标移动事件
	document.addEventListener('mousemove', (e) => {
		if (!isDragging) return;
		
		const dx = lastMouseX - e.clientX;
		const dy = lastMouseY - e.clientY;
		
		// 只在内容大于窗口时允许水平滚动
		window.scrollBy({
			left: shouldEnableDrag() ? dx : 0,
			top: dy,
			behavior: 'auto'
		});
		
		lastMouseX = e.clientX;
		lastMouseY = e.clientY;
	}, { passive: true });
	
	// 结束拖动
	const endDrag = () => {
		if (!isDragging) return;
		isDragging = false;
		
		// 恢复光标样式
		document.body.classList.remove('dragging');
		document.body.style.cursor = '';
		
		// 确保内容水平居中（当内容小于窗口宽度时）
		if (!shouldEnableDrag() && window.scrollX !== 0) {
			window.scrollTo({ left: 0, top: window.scrollY, behavior: 'auto' });
		}
	};
	
	document.addEventListener('mouseup', endDrag);
	document.addEventListener('mouseleave', endDrag);
}

// 保留原来的applyZoom函数，但修改为调用新函数
function applyZoom(zoomLevel) {
	// 使用视口中心作为缩放中心点
	applyZoomWithMouseCenter(zoomLevel, currentZoom, window.innerWidth / 2, window.innerHeight / 2);
}

// 新增函数：计算最小缩放比例
function calculateMinZoom() {
	const container = document.querySelector('#image-container');
	const containerHeight = container.scrollHeight;
	const windowHeight = window.innerHeight;
	
	// 确保容器至少填满窗口高度
	return Math.max(0.1, windowHeight / containerHeight);
}

// 调整容器高度以适应缩放
function adjustContainerHeight(container, zoomLevel) {
	// 获取容器内容的实际高度（不包括缩放的影响）
	const contentHeight = container.scrollHeight / (container.style.transform ? parseFloat(container.style.transform.replace('scale(', '').replace(')', '')) || 1 : 1);
	
	// 计算缩放后的高度
	const scaledHeight = contentHeight * zoomLevel;
	
	// 获取窗口可视区域高度
	const windowHeight = window.innerHeight;
	
	// 如果缩放后高度小于窗口高度，设置容器的最小高度为窗口高度
	if (scaledHeight < windowHeight) {
		container.style.minHeight = `${windowHeight / zoomLevel}px`;
	} else {
		// 否则重置最小高度
		container.style.minHeight = 'auto';
	}
}

// 加载选中项目的函数
function loadSelectedItems() {
	eagle.item.getSelected().then(items => {
		console.log('选中的项目:', items.length);
		displaySelectedItems(items);
	}).catch(err => {
		console.error('获取选中项目时出错:', err);
		eagle.log.error('获取选中项目时出错: ' + err.message);
		document.querySelector('#image-container').innerHTML = '<p class="no-images">获取选中项目时出错，请重试</p>';
	});
}

// 显示选中的项目
function displaySelectedItems(items) {
	const container = document.querySelector('#image-container');
	
	if (!items || items.length === 0) {
		container.innerHTML = '<p class="no-images">请先在Eagle中选择一个或多个图片</p>';
		return;
	}
	
	// 清空容器
	container.innerHTML = '';
	
	// 按照顺序加载图片
	items.forEach((item, index) => {
		// 尝试获取图片的本地路径
		let imagePath = '';
		if (item.filePath) {
			imagePath = item.filePath;
		} else if (item.path) {
			imagePath = item.path;
		} else if (item.url && item.url.startsWith('file://')) {
			imagePath = item.url.replace('file://', '');
		}
		
		// 创建图片容器元素（用于居中）
		const imgContainer = document.createElement('div');
		imgContainer.className = 'image-wrapper';
		
		// 创建图片元素
		const img = document.createElement('img');
		img.className = 'seamless-image';
		img.alt = item.name || '未命名';
		
		// 检查文件是否存在
		const fs = require('fs');
		let imageExists = false;
		try {
			if (imagePath) {
				imageExists = fs.existsSync(imagePath);
			}
		} catch (err) {
			console.error('检查文件是否存在时出错:', err);
		}
		
		// 设置图片源
		if (imageExists) {
			img.src = `file://${imagePath}`;
		} else if (item.thumbnail) {
			img.src = item.thumbnail;
		} else if (item.url) {
			img.src = item.url;
		} else {
			// 如果没有可用的图片源，创建一个占位符
			const placeholder = document.createElement('div');
			placeholder.className = 'image-placeholder';
			placeholder.textContent = '无法加载图片';
			container.appendChild(placeholder);
			return; // 跳过当前项
		}
		
		// 添加图片到容器
		imgContainer.appendChild(img);
		container.appendChild(imgContainer);
		
		// 如果不是最后一张图片，添加分割线
		if (index < items.length - 1) {
			const divider = document.createElement('div');
			divider.className = 'image-divider';
			container.appendChild(divider);
		}
	});
}

eagle.onPluginShow(() => {
	console.log('eagle.onPluginShow');
	// 每次显示插件时刷新选中的项目
	loadSelectedItems();
});

eagle.onPluginHide(() => {
	console.log('eagle.onPluginHide');
});

eagle.onPluginBeforeExit((event) => {
	console.log('eagle.onPluginBeforeExit');
});

// 恢复显示缩放级别的函数
function showZoomLevel(zoom) {
	let zoomDisplay = document.getElementById('zoom-level');
	if (!zoomDisplay) {
		zoomDisplay = document.createElement('div');
		zoomDisplay.id = 'zoom-level';
		document.body.appendChild(zoomDisplay);
	}
	
	zoomDisplay.textContent = `${Math.round(zoom * 100)}%`;
	zoomDisplay.style.opacity = '1';
	
	clearTimeout(window.zoomDisplayTimeout);
	window.zoomDisplayTimeout = setTimeout(() => {
		zoomDisplay.style.opacity = '0';
	}, 1500);
}

// 添加函数来设置图片的固定尺寸
function setImageFixedSize() {
	const images = document.querySelectorAll('.seamless-image');
	images.forEach(img => {
		// 如果图片已加载，设置其固定宽度
		if (img.complete) {
			setImageWidth(img);
		} else {
			// 如果图片尚未加载，等待加载完成后设置
			img.onload = () => setImageWidth(img);
		}
	});
}

// 设置图片固定宽度
function setImageWidth(img) {
	// 获取图片的原始宽度
	const naturalWidth = img.naturalWidth;
	
	// 设置图片的固定宽度为原始宽度
	img.style.width = `${naturalWidth}px`;
	
	// 确保包装器宽度也是固定的
	const wrapper = img.closest('.image-wrapper');
	if (wrapper) {
		wrapper.style.width = `${naturalWidth}px`;
	}
}

// 加载图片时设置固定尺寸
function loadImages(imageUrls) {
	const container = document.querySelector('#image-container');
	container.innerHTML = '';
	
	imageUrls.forEach((url, index) => {
		const wrapper = document.createElement('div');
		wrapper.className = 'image-wrapper';
		
		const img = document.createElement('img');
		img.className = 'seamless-image';
		img.src = url;
		img.alt = `Image ${index + 1}`;
		
		// 加载完成后设置固定尺寸
		img.onload = () => setImageWidth(img);
		
		wrapper.appendChild(img);
		container.appendChild(wrapper);
	});
}

// 修改initializePlugin函数
function initializePlugin() {
	// 重置容器样式
	const container = document.querySelector('#image-container');
	if (container) {
		// 使用固定宽度而非百分比
		container.style.width = 'auto';
		container.style.margin = '0 auto';
		container.style.display = 'flex';
		container.style.flexDirection = 'column';
		container.style.alignItems = 'center';
		
		// 应用当前缩放比例
		if (typeof currentZoom !== 'undefined') {
			container.style.transform = `scale(${currentZoom})`;
		} else {
			container.style.transform = 'scale(1)';
			currentZoom = 1;
		}
		
		container.style.transformOrigin = 'top center';
	}
	
	// 设置所有图片包装器为固定宽度
	const imageWrappers = document.querySelectorAll('.image-wrapper');
	imageWrappers.forEach(wrapper => {
		wrapper.style.width = 'auto'; // 使用固定宽度
		wrapper.style.display = 'flex';
		wrapper.style.justifyContent = 'center';
		wrapper.style.alignItems = 'flex-start';
	});
	
	// 设置所有图片为固定尺寸
	setImageFixedSize();
	
	// 设置CSS变量
	document.documentElement.style.setProperty('--current-zoom', currentZoom);
	
	// 初始化功能
	initZoomFeature();
	initDragFeature();
	setImageFixedSize();
	updateContainerState();
	showZoomLevel(currentZoom);
	
	// 添加窗口调整大小事件处理
	window.addEventListener('resize', handleResize);
}

// 合并 DOMContentLoaded 事件处理
document.addEventListener('DOMContentLoaded', () => {
	// 初始化缩放功能
	initZoomFeature();
	
	// 初始化插件
	initializePlugin();
	
	// 显示初始缩放级别
	showZoomLevel(currentZoom);
});

// 合并 updateContainerClasses() 和 updateCursorStyle() 函数
// 它们都处理容器的拖动相关状态

function updateContainerState() {
	const container = document.querySelector('#image-container');
	const windowWidth = window.innerWidth;
	const containerWidth = container.getBoundingClientRect().width;
	const isDraggable = containerWidth * currentZoom > windowWidth;
	
	// 更新类和光标样式
	container.classList.toggle('draggable', isDraggable);
	container.classList.toggle('non-draggable', !isDraggable);
	container.style.cursor = isDraggable ? 'grab' : 'default';
	
	// 更新横向滚动条
	document.body.style.overflowX = isDraggable ? 'auto' : 'hidden';
	
	// 确保内容水平居中（当内容小于窗口宽度时）
	if (!isDraggable && window.scrollX !== 0) {
		window.scrollTo({ left: 0, top: window.scrollY, behavior: 'auto' });
	}
}

// 处理窗口调整大小
function handleResize() {
	const container = document.querySelector('#image-container');
	if (!container) return;
	
	// 标记正在调整大小
	document.body.classList.add('resizing');
	
	// 确保缩放不变
	container.style.transform = `scale(${currentZoom})`;
	
	// 更新UI状态
	updateContainerState();
	
	// 延迟移除调整大小标记
	clearTimeout(window.resizeTimeout);
	window.resizeTimeout = setTimeout(() => {
		document.body.classList.remove('resizing');
	}, 200);
}