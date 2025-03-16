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

// 初始化缩放功能
function initZoomFeature() {
	// 监听滚轮事件
	document.addEventListener('wheel', (event) => {
		// 只有按住Ctrl键时才进行缩放
		if (event.ctrlKey) {
			event.preventDefault();
			
			// 根据滚轮方向确定缩放方向
			const delta = event.deltaY > 0 ? -0.1 : 0.1;
			
			// 计算新的缩放比例，限制在0.1到5之间
			currentZoom = Math.max(0.1, Math.min(5, currentZoom + delta));
			
			// 应用缩放
			applyZoom(currentZoom);
			
			// 显示缩放比例
			showZoomLevel(currentZoom);
		}
	}, { passive: false });
	
	// 添加键盘事件监听，用于Ctrl+0重置缩放
	document.addEventListener('keydown', (event) => {
		// 检测Ctrl+0组合键
		if (event.ctrlKey && (event.key === '0' || event.keyCode === 48)) {
			event.preventDefault();
			// 重置缩放比例为1
			currentZoom = 1;
			// 应用缩放
			applyZoom(currentZoom);
			// 显示缩放比例
			showZoomLevel(currentZoom);
		}
	});
	
	// 初始化拖动功能
	initDragFeature();
}

// 初始化拖动功能
function initDragFeature() {
	const container = document.querySelector('#image-container');
	let isDragging = false;
	let startX, startY, scrollLeft, scrollTop;
	
	// 鼠标按下事件
	container.addEventListener('mousedown', (e) => {
		isDragging = true;
		container.style.cursor = 'grabbing';
		startX = e.pageX - container.offsetLeft;
		startY = e.pageY - container.offsetTop;
		scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
		scrollTop = window.pageYOffset || document.documentElement.scrollTop;
	});
	
	// 鼠标移动事件
	document.addEventListener('mousemove', (e) => {
		if (!isDragging) return;
		e.preventDefault();
		
		const x = e.pageX - container.offsetLeft;
		const y = e.pageY - container.offsetTop;
		const moveX = x - startX;
		const moveY = y - startY;
		
		// 设置滚动位置
		window.scrollTo(scrollLeft - moveX, scrollTop - moveY);
	});
	
	// 鼠标释放事件
	document.addEventListener('mouseup', () => {
		isDragging = false;
		container.style.cursor = 'default';
	});
	
	// 鼠标离开窗口事件
	document.addEventListener('mouseleave', () => {
		if (isDragging) {
			isDragging = false;
			container.style.cursor = 'default';
		}
	});
}

// 应用缩放到整个容器
function applyZoom(zoomLevel) {
	const container = document.querySelector('#image-container');
	
	// 使用transform对整个容器进行缩放
	container.style.transform = `scale(${zoomLevel})`;
	container.style.transformOrigin = 'top center';
	
	// 添加调整容器高度的代码，确保缩放后内容填满窗口
	adjustContainerHeight(container, zoomLevel);
	
	// 调整容器宽度，确保水平方向也能正确显示
	adjustContainerWidth(container, zoomLevel);
}

// 新增函数：调整容器高度以填满窗口
function adjustContainerHeight(container, zoomLevel) {
	// 获取容器的实际内容高度（缩放前）
	const contentHeight = container.scrollHeight;
	
	// 计算缩放后的内容高度
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

// 新增函数：调整容器宽度
function adjustContainerWidth(container, zoomLevel) {
	// 获取容器的实际内容宽度（缩放前）
	const contentWidth = container.scrollWidth;
	
	// 计算缩放后的内容宽度
	const scaledWidth = contentWidth * zoomLevel;
	
	// 获取窗口可视区域宽度
	const windowWidth = window.innerWidth;
	
	// 如果缩放后宽度大于窗口宽度，确保有足够的空间进行水平滚动
	if (scaledWidth > windowWidth) {
		// 设置body的overflow-x为auto以显示水平滚动条
		document.body.style.overflowX = 'auto';
		
		// 设置容器的最小宽度，确保有足够的空间
		container.style.minWidth = `${contentWidth}px`;
		
		// 设置容器的margin，确保缩放后内容居中
		container.style.marginLeft = 'auto';
		container.style.marginRight = 'auto';
	} else {
		// 如果缩放后宽度小于窗口宽度，则不需要水平滚动
		document.body.style.overflowX = 'hidden';
		container.style.minWidth = 'auto';
	}
}

// 添加窗口大小变化监听，以便在窗口大小变化时重新调整
window.addEventListener('resize', () => {
	// 重新应用当前缩放比例，这会触发高度调整
	applyZoom(currentZoom);
});

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

// 显示缩放比例的函数
function showZoomLevel(zoom) {
	// 检查是否已存在缩放指示器
	let zoomIndicator = document.getElementById('zoom-indicator');
	
	// 如果不存在，创建一个
	if (!zoomIndicator) {
		zoomIndicator = document.createElement('div');
		zoomIndicator.id = 'zoom-indicator';
		document.body.appendChild(zoomIndicator);
	}
	
	// 更新缩放指示器内容和样式
	zoomIndicator.textContent = `${Math.round(zoom * 100)}%`;
	zoomIndicator.style.display = 'block';
	
	// 2秒后隐藏
	clearTimeout(window.zoomIndicatorTimeout);
	window.zoomIndicatorTimeout = setTimeout(() => {
		zoomIndicator.style.display = 'none';
	}, 2000);
}