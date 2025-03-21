// 全局变量，用于存储当前缩放比例
let currentZoom = 1;

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
function updateHorizontalScroll(zoomLevel) {
	const container = document.querySelector('#image-container');
	const windowWidth = window.innerWidth;
	const contentWidth = container.scrollWidth * zoomLevel;
	
	// 如果内容宽度超过窗口宽度，启用横向滚动
	if (contentWidth > windowWidth) {
		document.body.style.overflowX = 'auto';
	} else {
		document.body.style.overflowX = 'hidden';
	}
}

// 保持居中的同时实现平滑缩放
function applyZoomWithMouseCenter(newZoom, oldZoom, mouseX, mouseY) {
	const container = document.querySelector('#image-container');
	
	// 添加一个标志，标记我们正在进行缩放操作
	document.body.classList.add('scaling');
	
	// 获取当前滚动位置和视口信息
	const scrollX = window.scrollX || window.pageXOffset;
	const scrollY = window.scrollY || window.pageYOffset;
	
	// 计算当前视口顶部在文档中的位置
	const viewportTopPosition = scrollY;
	
	// 获取容器位置信息
	const containerRect = container.getBoundingClientRect();
	const containerTop = containerRect.top + scrollY;
	
	// 计算视口顶部在容器中的相对位置
	const relativeTopPosition = (viewportTopPosition - containerTop) / oldZoom;
	
	// 使用requestAnimationFrame确保变换在下一帧渲染
	requestAnimationFrame(() => {
		// 设置变换原点为顶部中心
		container.style.transformOrigin = 'top center';
		
		// 应用新的缩放比例，使用硬件加速
		container.style.transform = `scale(${newZoom})`;
		container.style.willChange = 'transform';
		
		// 计算缩放后应该滚动到的新位置
		const newTopPosition = containerTop + (relativeTopPosition * newZoom);
		
		// 更新横向滚动条状态
		updateHorizontalScroll(newZoom);
		
		// 设置滚动位置
		window.scrollTo({
			left: scrollX, // 保持水平滚动位置
			top: newTopPosition,
			behavior: 'auto'
		});
		
		// 确保应用了正确的居中样式
		ensureCenteredContent();
		
		// 显示缩放百分比
		showZoomLevel(newZoom);
		
		// 移除缩放标志
		document.body.classList.remove('scaling');
		
		// 调用更新光标样式的函数（如果存在）
		if (window.updateAfterZoom) {
			window.updateAfterZoom();
		}
	});
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

// 恢复内容居中显示的功能
function adjustContentAlignment() {
	const container = document.querySelector('#image-container');
	const imageWrappers = document.querySelectorAll('.image-wrapper');
	
	// 恢复所有图片的居中样式
	imageWrappers.forEach(wrapper => {
		wrapper.style.width = '100%';
		wrapper.style.display = 'flex';
		wrapper.style.justifyContent = 'center';
		wrapper.style.alignItems = 'flex-start';
	});
	
	// 确保容器样式设置正确
	container.style.width = '100%';
	container.style.display = 'flex';
	container.style.flexDirection = 'column';
	container.style.alignItems = 'center';
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

// 初始化缩放功能
function initZoomFeature() {
	// 确保初始状态下内容居中
	ensureCenteredContent();
	
	// 设置当前缩放比例为默认值
	if (typeof currentZoom === 'undefined') {
		currentZoom = 1.0;
	}
	
	// 监听滚轮事件
	document.addEventListener('wheel', (event) => {
		// 只有按住Ctrl键时才进行缩放
		if (event.ctrlKey) {
			event.preventDefault();
			
			// 根据滚轮方向确定缩放方向
			const delta = event.deltaY > 0 ? -0.05 : 0.05;
			
			// 计算新的缩放比例
			const oldZoom = currentZoom;
			let newZoom = oldZoom * (1 + delta);
			
			// 设置缩放限制
			const minZoom = 0.2;
			const maxZoom = 5.0;
			newZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));
			
			// 如果缩放比例几乎没变，就跳过
			if (Math.abs(newZoom - oldZoom) < 0.01) {
				return;
			}
			
			// 更新当前缩放值
			currentZoom = newZoom;
			
			// 应用缩放（使用视口顶部中心）
			applyZoomWithMouseCenter(currentZoom, oldZoom, window.innerWidth / 2, 0);
			
			// 显示缩放比例
			showZoomLevel(currentZoom);
		}
	}, { passive: false });
	
	// Ctrl+0 重置缩放
	document.addEventListener('keydown', (event) => {
		if (event.ctrlKey && (event.key === '0' || event.keyCode === 48)) {
			event.preventDefault();
			const oldZoom = currentZoom;
			currentZoom = 1.0;
			applyZoomWithMouseCenter(currentZoom, oldZoom, window.innerWidth / 2, 0);
			showZoomLevel(currentZoom);
		}
	});
	
	// 窗口大小变化时重新确保居中
	// 初始化拖动功能
	initDragFeature();
	
	// 监听窗口大小变化，确保内容始终居中
	window.addEventListener('resize', initializePlugin);
}

// 简化拖动实现，直接使用原生滚动
function initDragFeature() {
	const container = document.querySelector('#image-container');
	let isDragging = false;
	let lastMouseX, lastMouseY;
	
	// 检查是否应该启用水平拖动
	function shouldEnableHorizontalDrag() {
		const containerWidth = container.getBoundingClientRect().width;
		const windowWidth = window.innerWidth;
		return containerWidth * currentZoom > windowWidth;
	}
	
	// 更新容器的光标样式
	function updateCursorStyle() {
		if (shouldEnableHorizontalDrag()) {
			container.style.cursor = 'grab'; // 可拖动时显示小手
		} else {
			container.style.cursor = 'default'; // 不可拖动时显示默认光标
		}
	}
	
	// 初始化时更新光标样式
	updateCursorStyle();
	
	// 鼠标按下事件
	container.addEventListener('mousedown', (e) => {
		// 忽略右键和中键点击
		if (e.button !== 0) return;
		
		// 忽略交互元素上的点击
		if (e.target.tagName === 'BUTTON' || 
			e.target.tagName === 'A' || 
			e.target.tagName === 'INPUT') {
			return;
		}
		
		e.preventDefault();
		isDragging = true;
		lastMouseX = e.clientX;
		lastMouseY = e.clientY;
		
		// 更新光标样式为抓取状态
		if (shouldEnableHorizontalDrag()) {
			document.body.style.cursor = 'grabbing';
			container.style.cursor = 'grabbing';
		} else {
			document.body.style.cursor = 'ns-resize'; // 只能垂直拖动
		}
		
		// 添加拖动状态类
		document.body.classList.add('dragging');
	});
	
	// 鼠标移动事件 - 使用passive事件减少抖动
	document.addEventListener('mousemove', (e) => {
		if (!isDragging) return;
		
		// 计算鼠标移动距离
		const dx = lastMouseX - e.clientX;
		const dy = lastMouseY - e.clientY;
		
		// 如果内容宽度小于窗口宽度，禁止水平滚动
		const horizontalEnabled = shouldEnableHorizontalDrag();
		
		// 更新滚动位置 - 使用scrollBy实现更平滑的滚动
		window.scrollBy({
			left: horizontalEnabled ? dx : 0,
			top: dy,
			behavior: 'auto' // 使用即时滚动
		});
		
		// 更新鼠标位置
		lastMouseX = e.clientX;
		lastMouseY = e.clientY;
		
	}, { passive: true }); // 使用passive事件提高性能
	
	// 鼠标释放事件
	function endDrag() {
		if (!isDragging) return;
		isDragging = false;
		
		// 恢复光标样式
		document.body.style.cursor = '';
		updateCursorStyle();
		
		// 移除拖动状态类
		document.body.classList.remove('dragging');
		
		// 如果内容宽度小于窗口宽度，确保水平居中
		if (!shouldEnableHorizontalDrag() && window.scrollX !== 0) {
			window.scrollTo({
				left: 0,
				top: window.scrollY,
				behavior: 'auto'
			});
		}
	}
	
	// 添加鼠标释放和离开事件
	document.addEventListener('mouseup', endDrag);
	document.addEventListener('mouseleave', endDrag);
	
	// 窗口大小变化时更新状态
	window.addEventListener('resize', () => {
		updateCursorStyle();
		
		// 如果内容小于窗口宽度，确保居中
		if (!shouldEnableHorizontalDrag() && window.scrollX !== 0) {
			window.scrollTo({
				left: 0,
				top: window.scrollY,
				behavior: 'auto'
			});
		}
	});
	
	// 全局API，供缩放后调用
	window.updateAfterZoom = updateCursorStyle;
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
function showZoomLevel(zoomLevel) {
	// 获取或创建显示缩放级别的元素
	let zoomLevelElement = document.getElementById('zoom-level');
	
	if (!zoomLevelElement) {
		zoomLevelElement = document.createElement('div');
		zoomLevelElement.id = 'zoom-level';
		document.body.appendChild(zoomLevelElement);
	}
	
	// 设置缩放百分比文本
	zoomLevelElement.textContent = `${Math.round(zoomLevel * 100)}%`;
	
	// 显示元素
	zoomLevelElement.style.opacity = '1';
	
	// 设置自动隐藏
	clearTimeout(window.zoomLevelTimeout);
	window.zoomLevelTimeout = setTimeout(() => {
		zoomLevelElement.style.opacity = '0';
	}, 1500);
}

// 初始化插件时重置布局和样式
function initializePlugin() {
	// 重置容器样式，确保内容始终居中
	const container = document.querySelector('#image-container');
	if (container) {
		container.style.width = '100%';
		container.style.margin = '0 auto';
		container.style.display = 'flex';
		container.style.flexDirection = 'column';
		container.style.alignItems = 'center';
		container.style.transform = 'scale(1)';
		container.style.transformOrigin = 'top center';
	}
	
	// 重置所有图片包装器
	const imageWrappers = document.querySelectorAll('.image-wrapper');
	imageWrappers.forEach(wrapper => {
		wrapper.style.width = '100%';
		wrapper.style.display = 'flex';
		wrapper.style.justifyContent = 'center';
		wrapper.style.alignItems = 'flex-start';
	});
}

// 页面加载时初始化所有功能
document.addEventListener('DOMContentLoaded', () => {
	// 初始化缩放功能
	initZoomFeature();
	
	// 确保居中
	ensureCenteredContent();
	
	// 检查是否需要显示横向滚动条
	updateHorizontalScroll(currentZoom || 1.0);
	
	// 显示初始缩放级别
	showZoomLevel(currentZoom || 1.0);
});

// 确保窗口大小变化时重新检查
window.addEventListener('resize', () => {
	ensureCenteredContent();
	updateHorizontalScroll(currentZoom || 1.0);
});

// 添加对容器类的管理
function updateContainerClasses() {
	const container = document.querySelector('#image-container');
	const windowWidth = window.innerWidth;
	const containerWidth = container.getBoundingClientRect().width;
	
	// 根据内容宽度与窗口宽度的关系设置类
	if (containerWidth * currentZoom > windowWidth) {
		container.classList.add('draggable');
		container.classList.remove('non-draggable');
	} else {
		container.classList.remove('draggable');
		container.classList.add('non-draggable');
	}
}

// 初始更新类
document.addEventListener('DOMContentLoaded', updateContainerClasses);

// 将此函数绑定到窗口大小变化和缩放事件
window.addEventListener('resize', updateContainerClasses);