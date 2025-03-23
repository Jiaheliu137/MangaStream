const { addAbortSignal } = require('stream');

// 全局变量定义区
let currentZoom = 0.6; // 初始默认缩放比例为60%
let zoomLevelTimeout; // 控制缩放级别指示器显示的定时器
let isDraggingScrollbar = false; // 标记是否正在拖动自定义滚动条
let scrollbarStartX = 0; // 记录滚动条拖动的初始X坐标
let currentOffsetX = 0; // 漫画内容的当前水平偏移量
let currentOffsetY = 0; // 漫画内容的当前垂直偏移量

// 记录当前已加载漫画项目的ID数组
let currentLoadedItemIds = [];

// 滚动条自动隐藏定时器
let scrollbarHideTimer;

// 缓存关键DOM元素引用以提高性能
const imageContainer = document.querySelector('#image-container');
const viewport = document.querySelector('#viewport');
const customScrollbarContainer = document.getElementById('custom-scrollbar-container');

// 使用模块模式组织缩放功能相关代码
const ZoomModule = {
	currentZoom: 0.6,
	zoomLevelTimeout: null,
	
	init() {
		// 初始化缩放功能
	},
	
	applyZoom(newZoom) {
		// 应用新的缩放比例
	}
	// 其他缩放相关方法
};

// 使用模块模式组织滚动功能相关代码
const ScrollModule = {
	isDragging: false,
	startPosition: { x: 0, y: 0 },
	
	init() {
		this.initHorizontalScrollbar();
		this.initVerticalScrollbar();
		this.setupEvents();
	},
	
	initHorizontalScrollbar() {
		// 初始化水平滚动条
	},
	
	initVerticalScrollbar() {
		// 初始化垂直滚动条
	},
	
	// 通用滚动条拖动处理函数
	handleScrollbarDrag(e, direction) {
		// 处理水平或垂直方向的拖动逻辑
	}
};

// 插件创建时的入口点
eagle.onPluginCreate((plugin) => {
	console.log('eagle.onPluginCreate');
	
	// 注意：不在此处立即加载选中项目
	// 而是等待插件完全初始化后再加载
	
	// 初始化缩放功能
	initZoomFeature();
	
	// 初始化自定义滚动条
	initCustomScrollbar();
});

// 插件运行时的入口点
eagle.onPluginRun(() => {
	console.log('eagle.onPluginRun');
	// 获取并加载当前选中的漫画项目
	loadSelectedItems();
});

// 防抖函数：限制高频率事件的触发频次
function debounce(func, wait) {
	let timeout;
	return function(...args) {
		const context = this;
		clearTimeout(timeout);
		timeout = setTimeout(() => func.apply(context, args), wait);
	};
}

// 更新水平滚动条状态和显示
function updateHorizontalScroll(zoomLevel) {
	if (!imageContainer) return;
	
	const windowWidth = window.innerWidth;
	const contentWidth = imageContainer.scrollWidth * zoomLevel;
	
	// 当内容宽度超过视窗宽度时，准备显示自定义滚动条
	if (contentWidth > windowWidth) {
		// 结构上显示滚动条容器，但保持透明状态
		const scrollbarContainer = document.getElementById('custom-scrollbar-container');
		if (scrollbarContainer) {
			scrollbarContainer.style.display = 'block';
			// 添加样式确保滚动条不会遮挡内容
			scrollbarContainer.style.position = 'absolute';
			scrollbarContainer.style.bottom = '0';
			scrollbarContainer.style.zIndex = '100';
		}
		
		// 保留这行，但不再影响实际视口高度
		const viewport = document.querySelector('#viewport');
		if (viewport) {
			viewport.classList.add('has-scrollbar');
		}
		
		// 更新滚动条尺寸和位置
		showCustomScrollbar(imageContainer, contentWidth, windowWidth);
	} else {
		// 内容宽度小于视窗时，隐藏滚动条
		hideCustomScrollbar();
	}
}

// 重置内容位置到水平居中状态
function resetContentPosition() {
	const container = document.querySelector('#image-container');
	if (!container) return;
	
	// 重置水平偏移为0（即居中位置）
	currentOffsetX = 0;
	
	// 应用重置后的位置
	applyContentPosition();
}

// 应用内容的位置和缩放变换
function applyContentPosition() {
	const container = document.querySelector('#image-container');
	if (!container) return;
	
	// 使用CSS变换应用水平偏移和缩放，垂直方向使用原生滚动
	container.style.transform = `translateX(calc(-50% + ${currentOffsetX}px)) scale(${currentZoom})`;
}

// 确保DOM元素在操作期间不受CSS过渡效果影响
function ensureNoTransitions(element) {
	if (!element) return;
	
	// 保存原始过渡属性
	const originalTransition = element.style.transition;
	
	// 临时禁用所有过渡效果
	element.style.transition = 'none';
	
	// 强制浏览器重新计算样式
	void element.offsetWidth;
	
	// 返回一个函数用于还原原始过渡效果
	return () => {
		// 延迟恢复过渡效果以确保不干扰当前操作
		setTimeout(() => {
			element.style.transition = originalTransition;
		}, 50);
	};
}

// 平滑滚动动画实现
function animateScroll(startValue, endValue, duration, updateFunc, completeFunc) {
	// 避免调试日志干扰性能
	// console.log(`开始动画: 从 ${startValue} 到 ${endValue}, 持续 ${duration}ms`);
	
	// 取消可能正在进行的动画
	if (window.currentScrollAnimation) {
		console.log('中断之前的动画');
		cancelAnimationFrame(window.currentScrollAnimation);
		window.currentScrollAnimation = null;
	}
	
	// 确保滚动条在整个动画过程中保持可见
	showScrollbars();
	
	// 禁用可能干扰动画的CSS过渡效果
	const horizontalScrollbar = document.getElementById('custom-scrollbar');
	const verticalScrollbar = document.getElementById('vertical-scrollbar');
	
	if (horizontalScrollbar) horizontalScrollbar.style.transition = 'none';
	if (verticalScrollbar) verticalScrollbar.style.transition = 'none';
	
	const startTime = performance.now();
	const change = endValue - startValue;
	let lastUpdateTime = startTime;
	let lastValue = startValue;
	
	// 缓动函数：easeInOutCubic提供更平滑的动画效果
	function easeInOutCubic(t) {
		return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
	}
	
	// 动画帧处理函数
	function animate(currentTime) {
		const elapsedTime = currentTime - startTime;
		const progress = Math.min(elapsedTime / duration, 1);
		const easedProgress = easeInOutCubic(progress);
		const currentValue = startValue + change * easedProgress;
		
		// 计算并记录每秒帧数（用于性能监控）
		const fps = Math.round(1000 / (currentTime - lastUpdateTime));
		// 仅在调试模式下显示帧率信息
		// if (elapsedTime % 1000 < 20) {
		//    console.log(`动画进度: ${Math.round(progress * 100)}%, 值: ${Math.round(currentValue)}, FPS: ${fps}`);
		// }
		
		// 应用当前计算的滚动位置值
		try {
			updateFunc(currentValue);
			lastValue = currentValue;
		} catch (err) {
			console.error('动画更新函数出错:', err);
		}
		
		lastUpdateTime = currentTime;
		
		// 继续请求下一动画帧或完成动画
		if (progress < 1) {
			window.currentScrollAnimation = requestAnimationFrame(animate);
		} else {
			console.log(`动画完成: 最终值 ${Math.round(currentValue)}`);
			window.currentScrollAnimation = null;
			
			// 恢复滚动条的CSS过渡效果
			if (horizontalScrollbar) horizontalScrollbar.style.transition = '';
			if (verticalScrollbar) verticalScrollbar.style.transition = '';
			
			// 执行动画完成回调函数（如果有）
			if (completeFunc) completeFunc();
		}
	}
	
	// 启动第一帧动画
	console.log('启动动画帧');
	window.currentScrollAnimation = requestAnimationFrame(animate);
}

// 初始化自定义滚动条
function initCustomScrollbar() {
	const scrollbarContainer = document.getElementById('custom-scrollbar-container');
	const scrollbar = document.getElementById('custom-scrollbar');
	const scrollbarHandle = document.getElementById('custom-scrollbar-handle');
	
	if (!scrollbarContainer || !scrollbar || !scrollbarHandle) {
		console.error('找不到水平滚动条元素');
		return;
	}
	
	// 确保滚动条相关元素可以接收鼠标事件
	scrollbarContainer.style.pointerEvents = 'auto';
	scrollbar.style.pointerEvents = 'auto';
	scrollbarHandle.style.pointerEvents = 'auto';
	
	// 滚动条轨道点击事件处理
	scrollbar.addEventListener('mousedown', (e) => {
		// 忽略手柄元素上的点击事件，由手柄自己的事件处理器处理
		if (e.target === scrollbarHandle) return;
		
		// 阻止事件冒泡和默认行为以避免干扰
		e.stopPropagation();
		e.preventDefault();
		
		const container = document.querySelector('#image-container');
		if (!container) return;
		
		const containerRect = container.getBoundingClientRect();
		const windowWidth = window.innerWidth;
		const contentWidth = containerRect.width; // 包含缩放后的内容宽度
		
		// 获取滚动条的尺寸和位置信息
		const scrollbarRect = scrollbar.getBoundingClientRect();
		const scrollbarWidth = parseInt(scrollbar.style.width || '100');
		const scrollbarMaxMove = windowWidth - scrollbarWidth;
		
		// 获取鼠标点击位置相对于视窗的X坐标
		const clickX = e.clientX;
		
		// 计算目标位置：将滚动条中心对准点击位置
		let targetScrollbarLeft = clickX - (scrollbarWidth / 2);
		
		// 约束滚动条位置在可移动范围内
		targetScrollbarLeft = Math.max(0, Math.min(scrollbarMaxMove, targetScrollbarLeft));
		
		// 计算内容总的可滚动宽度
		const totalScrollableWidth = contentWidth - windowWidth;
		
		console.log(`水平滚动条点击 - 直接移动到 ${targetScrollbarLeft}`);
		
		// 立即更新滚动条位置
		scrollbar.style.left = `${targetScrollbarLeft}px`;
		
		// 根据滚动条位置计算内容的滚动比例
		const scrollRatio = targetScrollbarLeft / scrollbarMaxMove;
		
		// 计算内容的新偏移量（中心点偏移逻辑）
		const newOffsetX = (0.5 - scrollRatio) * totalScrollableWidth;
		
		// 更新全局偏移量状态
		currentOffsetX = newOffsetX;
		
		// 应用内容的新位置
		applyContentPosition();
		
		// 重置滚动条自动隐藏计时器
		showScrollbars();
	});
	
	// 滚动条容器背景点击事件处理
	scrollbarContainer.addEventListener('mousedown', (e) => {
		// 仅处理直接点击容器背景的情况
		if (e.target !== scrollbarContainer) return;
		
		// 阻止事件冒泡和默认行为
		e.stopPropagation();
		e.preventDefault();
		
		const container = document.querySelector('#image-container');
		if (!container) return;
		
		const containerRect = container.getBoundingClientRect();
		const windowWidth = window.innerWidth;
		const contentWidth = containerRect.width; // 包含缩放后的内容宽度
		
		// 获取滚动条相关尺寸信息
		const scrollbarWidth = parseInt(scrollbar.style.width || '100');
		const scrollbarMaxMove = windowWidth - scrollbarWidth;
		
		// 滚动条中心对准鼠标点击位置
		let targetScrollbarLeft = e.clientX - (scrollbarWidth / 2);
		
		// 约束滚动条位置在有效范围内
		targetScrollbarLeft = Math.max(0, Math.min(scrollbarMaxMove, targetScrollbarLeft));
		
		// 计算内容的总可滚动宽度
		const totalScrollableWidth = contentWidth - windowWidth;
		
		console.log(`水平滚动条容器点击 - 直接移动到 ${targetScrollbarLeft}`);
		
		// 立即更新滚动条位置
		scrollbar.style.left = `${targetScrollbarLeft}px`;
		
		// 计算内容的滚动比例
		const scrollRatio = targetScrollbarLeft / scrollbarMaxMove;
		
		// 基于比例计算内容的新偏移量
		const newOffsetX = (0.5 - scrollRatio) * totalScrollableWidth;
		
		// 更新全局偏移量状态
		// 更新全局偏移量
		currentOffsetX = newOffsetX;
		
		// 应用新位置
		applyContentPosition();
		
		// 确保滚动条保持可见
		showScrollbars();
	});
	
	// 滚动条手柄拖动
	scrollbarHandle.addEventListener('mousedown', (e) => {
		// 阻止事件冒泡和默认行为
		e.stopPropagation();
		e.preventDefault();
		
		isDraggingScrollbar = true;
		scrollbarStartX = e.clientX;
		
		// 添加拖动状态类
		document.body.classList.add('dragging');
		
		// 确保滚动条在拖动过程中保持可见
		showScrollbars();
		
		// 在控制台输出调试信息
		console.log('开始拖动水平滚动条');
	});
	
	// 初始设置时绑定事件
	document.addEventListener('mousemove', handleScrollbarDrag);
	document.addEventListener('mouseup', endScrollbarDrag);
}

// 处理滚动条拖动
function handleScrollbarDrag(e) {
	if (!isDraggingScrollbar) return;
	
	// 确保滚动条在拖动期间保持可见
	showScrollbars();
	
	const container = document.querySelector('#image-container');
	const scrollbar = document.getElementById('custom-scrollbar');
	
	if (!container || !scrollbar) return;
	
	const containerRect = container.getBoundingClientRect();
	const windowWidth = window.innerWidth;
	const contentWidth = containerRect.width; // 已经包含缩放
	
	// 获取滚动条宽度和最大移动距离
	const scrollbarWidth = parseInt(scrollbar.style.width);
	const scrollbarMaxMove = windowWidth - scrollbarWidth;
	
	// 计算拖动距离
	const dragDistance = e.clientX - scrollbarStartX;
	
	// 计算拖动后的滚动条位置
	let currentScrollbarLeft = parseInt(scrollbar.style.left || '0');
	let newScrollbarLeft = currentScrollbarLeft + dragDistance;
	
	// 确保滚动条在有效范围内
	newScrollbarLeft = Math.max(0, Math.min(scrollbarMaxMove, newScrollbarLeft));
	
	// 应用滚动条的新位置
	scrollbar.style.left = `${newScrollbarLeft}px`;
	
	// 计算新位置对应的滚动比例
	const scrollRatio = newScrollbarLeft / scrollbarMaxMove;
	
	// 计算内容的总可滚动宽度
	const totalScrollableWidth = contentWidth - windowWidth;
	
	// 计算内容的新偏移量（方向与滚动条运动相反）
	// 滚动条左移（scrollRatio接近0）→ 内容右移（偏移量正值）
	// 滚动条右移（scrollRatio接近1）→ 内容左移（偏移量负值）
	const newOffsetX = (0.5 - scrollRatio) * totalScrollableWidth;
	
	// 更新全局内容偏移量
	currentOffsetX = newOffsetX;
	
	// 应用内容的新位置
	applyContentPosition();
	
	// 更新拖动参考起始位置
	scrollbarStartX = e.clientX;
}

// 处理滚动条拖动结束事件
function endScrollbarDrag() {
	if (!isDraggingScrollbar) return;
	
	// 重置拖动状态标记
	isDraggingScrollbar = false;
	
	// 移除全局拖动状态样式类
	document.body.classList.remove('dragging');
	
	// 启动滚动条自动隐藏计时器
	resetScrollbarHideTimer();
}

// 显示自定义水平滚动条并计算其尺寸位置
function showCustomScrollbar(container, contentWidth, windowWidth) {
	const scrollbarContainer = document.getElementById('custom-scrollbar-container');
	const scrollbar = document.getElementById('custom-scrollbar');
	const viewport = document.querySelector('#viewport');
	
	if (!scrollbarContainer || !scrollbar) return;
	
	// 显示滚动条容器元素
	scrollbarContainer.style.display = 'block';
	
	// 为视口添加滚动条存在标记类，以调整视口尺寸
	if (viewport) {
		viewport.classList.add('has-scrollbar');
	}
	
	// 根据内容和视窗尺寸计算滚动条宽度
	updateScrollbarDimensions(container, contentWidth, windowWidth);
	
	// 更新滚动条位置以匹配当前内容偏移
	updateScrollbarPosition();
}

// 根据内容和视窗比例计算更新滚动条尺寸
function updateScrollbarDimensions(container, contentWidth, windowWidth) {
	const scrollbarContainer = document.getElementById('custom-scrollbar-container');
	const scrollbar = document.getElementById('custom-scrollbar');
	const scrollbarHandle = document.getElementById('custom-scrollbar-handle');
	
	if (!scrollbarContainer || !scrollbar || !scrollbarHandle) return;
	
	// 计算视窗与内容宽度的比例
	const ratio = windowWidth / contentWidth;
	
	// 根据比例计算滚动条宽度（设置最小宽度确保可用性）
	const scrollbarWidth = Math.max(30, windowWidth * ratio); // 最小宽度30px
	
	// 应用计算后的滚动条宽度
	scrollbar.style.width = `${scrollbarWidth}px`;
}

// 基于当前内容偏移量更新滚动条位置
function updateScrollbarPosition() {
	const container = document.querySelector('#image-container');
	const scrollbarContainer = document.getElementById('custom-scrollbar-container');
	const scrollbar = document.getElementById('custom-scrollbar');
	
	if (!container || !scrollbarContainer || !scrollbar) return;
	
	const containerRect = container.getBoundingClientRect();
	const windowWidth = window.innerWidth;
	const contentWidth = containerRect.width; // 包含缩放后的内容宽度
	
	// 内容宽度不足时隐藏滚动条
	if (contentWidth <= windowWidth) {
		scrollbarContainer.style.display = 'none';
		return;
	}
	
	// 确保滚动条容器可见
	scrollbarContainer.style.display = 'block';
	
	// 计算并设置滚动条宽度
	const ratio = windowWidth / contentWidth;
	const scrollbarWidth = Math.max(30, windowWidth * ratio);
	scrollbar.style.width = `${scrollbarWidth}px`;
	
	// 计算内容总可滚动宽度
	const totalScrollableWidth = contentWidth - windowWidth;
	
	// 将当前内容偏移量转换为滚动条位置比例
	// currentOffsetX范围：-totalScrollableWidth/2 至 +totalScrollableWidth/2
	// 正偏移表示内容偏左，对应滚动条偏右
	const scrollRatio = 0.5 - (currentOffsetX / totalScrollableWidth);
	
	// 限制滚动比例在有效范围(0-1)内
	const clampedRatio = Math.max(0, Math.min(1, scrollRatio));
	
	// 计算滚动条可移动的最大距离
	const scrollbarMaxMove = windowWidth - scrollbarWidth;
	
	// 应用滚动条的新位置
	scrollbar.style.left = `${clampedRatio * scrollbarMaxMove}px`;
}

// 隐藏自定义水平滚动条
function hideCustomScrollbar() {
	const scrollbarContainer = document.getElementById('custom-scrollbar-container');
	const viewport = document.querySelector('#viewport');
	
	if (scrollbarContainer) {
		scrollbarContainer.style.display = 'none';
	}
	
	// 移除视口滚动条存在标记类，恢复原始尺寸
	if (viewport) {
		viewport.classList.remove('has-scrollbar');
	}
}

// 以鼠标位置为中心应用缩放变换
function applyZoomWithMouseCenter(newZoom, oldZoom) {
	const container = document.querySelector('#image-container');
	if (!container) return;
	
	// 标记缩放状态开始
	document.body.classList.add('scaling');
	
	// 获取视窗和内容尺寸信息
	const containerRect = container.getBoundingClientRect();
	const windowWidth = window.innerWidth;
	const windowHeight = window.innerHeight;
	
	// 获取当前视口的垂直滚动位置
	const viewport = document.querySelector('#viewport');
	const scrollTop = viewport ? viewport.scrollTop : 0;
	
	// 计算垂直中心点位置作为缩放参考点
	const mouseY = containerRect.top + containerRect.height / 2;
	
	// 计算新旧缩放比例
	const scaleRatio = newZoom / oldZoom;
	
	// 记录原始水平位置比例（用于保持相对位置）
	const contentWidth = containerRect.width;
	const horizontalRatio = (currentOffsetX / contentWidth) || 0;
	
	// 按比例缩放水平偏移量，保持相对位置
	currentOffsetX = currentOffsetX * scaleRatio;
	
	// 更新全局缩放系数
	currentZoom = newZoom;
	
	// 应用新的变换
	applyContentPosition();
	
	// 更新水平滚动条状态以反映新的缩放
	updateHorizontalScroll(newZoom);
	
	// 保持视口中心不变，调整垂直滚动位置
	if (viewport) {
		const newScrollTop = scrollTop * scaleRatio;
		viewport.scrollTop = newScrollTop;
	}
	
	// 显示当前缩放级别指示器
	showZoomLevel(newZoom);
	
	// 移除缩放标记
	setTimeout(() => {
		document.body.classList.remove('scaling');
	}, 100);
}

// 确保内容居中的辅助函数
function ensureCenteredContent() {
	resetContentPosition();
}

// 恢复内容居中显示的功能
function adjustContentAlignment() {
	resetContentPosition();
}

// 调整容器宽度函数
function adjustContainerWidth(zoom) {
	updateHorizontalScroll(zoom);
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
			
			// 应用缩放
			applyZoomWithMouseCenter(newZoom, oldZoom);
		}
	}, { passive: false });
	
	// Ctrl+0 重置缩放
	document.addEventListener('keydown', (event) => {
		if (event.ctrlKey && (event.key === '0' || event.keyCode === 48)) {
			event.preventDefault();
			const oldZoom = currentZoom;
			currentOffsetX = 0; // 重置水平偏移
			applyZoomWithMouseCenter(1.0, oldZoom);
		}
	});
	
	// 初始化拖动功能
	initDragFeature();
	
	// 监听窗口大小变化，确保内容始终居中
	window.addEventListener('resize', initializePlugin);
}

// 简化拖动实现，直接使用偏移量
function initDragFeature() {
	const container = document.querySelector('#image-container');
	const viewport = document.querySelector('#viewport');
	if (!container || !viewport) return;
	
	let isDragging = false;
	let lastMouseX, lastMouseY;
	
	// 检查是否应该启用水平拖动
	function shouldEnableHorizontalDrag() {
		const containerWidth = container.getBoundingClientRect().width;
		const windowWidth = window.innerWidth;
		return containerWidth > windowWidth;
	}
	
	// 更新光标样式
	function updateCursorStyle() {
		// 即使可以拖动，也保持默认箭头光标
		container.style.cursor = 'default';
		
		// 仍然添加draggable类，但不再设置grab光标样式
		if (shouldEnableHorizontalDrag()) {
			container.classList.add('draggable');
		} else {
			container.classList.remove('draggable');
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
		
		// 无条件设置为抓取状态的手型光标
			document.body.style.cursor = 'grabbing';
			container.style.cursor = 'grabbing';
		
		// 添加拖动状态类
		document.body.classList.add('dragging');
	});
	
	// 鼠标移动事件
	document.addEventListener('mousemove', (e) => {
		if (!isDragging) return;
		
		// 计算鼠标移动距离
		const dx = e.clientX - lastMouseX;
		const dy = e.clientY - lastMouseY;
		
		// 是否允许水平拖动
		const horizontalEnabled = shouldEnableHorizontalDrag();
		
		// 更新水平偏移量，并添加限制
		if (horizontalEnabled) {
			// 计算新的偏移量
			const newOffsetX = currentOffsetX + dx;
			
			// 获取容器和窗口宽度
			const container = document.querySelector('#image-container');
			const containerRect = container.getBoundingClientRect();
			const windowWidth = window.innerWidth;
			const contentWidth = containerRect.width;
			
			// 计算总的可滚动距离
			const totalScrollableWidth = contentWidth - windowWidth;
			
			// 限制偏移量在允许的范围内
			// 与滚动条范围保持一致：[-totalScrollableWidth/2, totalScrollableWidth/2]
			const minOffset = -totalScrollableWidth/2;
			const maxOffset = totalScrollableWidth/2;
			
			// 应用限制
			currentOffsetX = Math.max(minOffset, Math.min(maxOffset, newOffsetX));
		}
		
		// 使用垂直滚动而不是偏移
		if (dy !== 0) {
			// 获取viewport元素
			const viewport = document.querySelector('#viewport');
			if (viewport) {
				viewport.scrollBy(0, -dy); // 负值使得拖动方向与滚动方向一致
			}
		}
		
		// 应用新位置
		applyContentPosition();
		
		// 更新滚动条位置
		updateScrollbarPosition();
		
		// 更新鼠标位置
		lastMouseX = e.clientX;
		lastMouseY = e.clientY;
		
	}, { passive: true });
	
	// 鼠标释放事件
	function endDrag() {
		if (!isDragging) return;
		isDragging = false;
		
		// 恢复为默认箭头光标
		document.body.style.cursor = '';
		container.style.cursor = 'default';
		
		// 移除拖动状态类
		document.body.classList.remove('dragging');
		
		// 如果内容宽度小于窗口宽度，确保水平居中
		if (!shouldEnableHorizontalDrag()) {
			currentOffsetX = 0;
			applyContentPosition();
		}
	}
	
	// 添加鼠标释放和离开事件
	document.addEventListener('mouseup', endDrag);
	document.addEventListener('mouseleave', endDrag);
	
	// 全局API，供缩放后调用
	window.updateAfterZoom = updateCursorStyle;
}

// 保留原来的applyZoom函数，但修改为调用新函数
function applyZoom(zoomLevel) {
	// 使用视口中心作为缩放中心点
	applyZoomWithMouseCenter(zoomLevel, currentZoom);
}

// 简化后的loadSelectedItems函数
function loadSelectedItems() {
	// 显示加载状态
	showLoading(true);
	
	try {
		// 在获取新内容前添加淡出效果
		const container = document.querySelector('#image-container');
		if (container) {
			// 添加过渡类
			container.classList.add('fading-out');
		}
		
		// 短暂延迟后获取新内容，让淡出动画有时间执行
		setTimeout(() => {
			eagle.item.getSelected().then(items => {
				console.log('选中的项目:', items.length);
				
				// 检查选中的项目是否与当前加载的项目相同
				const newItemIds = items.map(item => item.id || '');
				const isSameContent = arraysEqual(newItemIds, currentLoadedItemIds);
				
				// 如果内容相同，取消刷新操作
				if (isSameContent && currentLoadedItemIds.length > 0) {
					console.log('所选项目未发生变化，取消刷新');
					// 移除淡出效果，恢复原样
					if (container) {
						container.classList.remove('fading-out');
					}
					return;
				}
				
				// 更新当前加载的项目ID列表
				currentLoadedItemIds = newItemIds;
				
				// 如果没有项目，直接显示提示
				if (!items || items.length === 0) {
					if (container) {
						container.innerHTML = '<p class="no-images">请先在Eagle中选择一个或多个图片</p>';
						// 完成后移除过渡类并添加淡入类
						container.classList.remove('fading-out');
						container.classList.add('fading-in');
						
						// 动画完成后移除类
						setTimeout(() => {
							container.classList.remove('fading-in');
						}, 300);
					}
					return;
				}
				
				// 使用计算好的缩放比例显示图片
				displaySelectedItems(items);
			}).catch(err => {
				console.error('获取选中项目时出错:', err);
				eagle.log.error('获取选中项目时出错: ' + err.message);
				if (container) {
					container.innerHTML = '<p class="no-images">获取选中项目时出错，请重试</p>';
					// 完成后移除过渡类
					container.classList.remove('fading-out');
					container.classList.add('fading-in');
					
					// 动画完成后移除类
					setTimeout(() => {
						container.classList.remove('fading-in');
					}, 300);
				}
				showErrorMessage('加载图片失败，请重试');
			});
		}, 200); // 200ms延迟，与CSS过渡时间匹配
	} catch (error) {
		console.error('加载选中项目失败:', error);
		// 显示错误提示给用户
		showErrorMessage('加载图片失败，请重试');
	}
	
	// 完成加载后
	setTimeout(() => {
		// 更新光标样式
		if (window.updateAfterZoom) {
			window.updateAfterZoom();
		}
		showLoading(false);
	}, 100);
}

// 检查两个数组是否相等的辅助函数
function arraysEqual(arr1, arr2) {
	if (arr1.length !== arr2.length) return false;
	for (let i = 0; i < arr1.length; i++) {
		if (arr1[i] !== arr2[i]) return false;
	}
	return true;
}

// 修改displaySelectedItems函数，删除自动计算缩放的部分
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
	
	// 在图片加载后初始化位置，直接应用60%的缩放
	setTimeout(() => {
		resetContentPosition();
		applyContentPosition();
		updateHorizontalScroll(currentZoom);
		showZoomLevel(currentZoom);
		
		// 完成后移除淡出类并添加淡入类
		container.classList.remove('fading-out');
		container.classList.add('fading-in');
		
		// 动画完成后移除类
		setTimeout(() => {
			container.classList.remove('fading-in');
		}, 300);
	}, 100);
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
	clearTimeout(zoomLevelTimeout);
	zoomLevelTimeout = setTimeout(() => {
		zoomLevelElement.style.opacity = '0';
	}, 1500);
}

// 为所有图片设置固定尺寸
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

// 修改initializePlugin函数
function initializePlugin() {
	// 重置容器样式和位置
	resetContentPosition();
	
	// 重新应用缩放
	const container = document.querySelector('#image-container');
	if (container) {
	// 设置所有图片为固定尺寸
	setImageFixedSize();
	
		// 更新自定义滚动条
	updateHorizontalScroll(currentZoom);
	}
	
	// 更新光标样式
	if (window.updateAfterZoom) {
		window.updateAfterZoom();
	}
}

// 修改resize事件处理函数
window.addEventListener('resize', debounce(() => {
	// 标记正在调整大小
	document.body.classList.add('resizing');
	
	// 初始化插件
	initializePlugin();
	
	// 更新自定义滚动条位置
	updateScrollbarPosition();
	
	// 延迟移除正在调整大小的标记
	setTimeout(() => {
		document.body.classList.remove('resizing');
	}, 200);
}, 100));

// 确保在文档加载完成后调用
document.addEventListener('DOMContentLoaded', () => {
	// 初始化缩放功能
	initZoomFeature();
	
	// 初始化自定义滚动条
	initCustomScrollbar();
	
	// 设置图片固定尺寸
	setImageFixedSize();
	
	// 显示初始缩放级别
	showZoomLevel(currentZoom);
	
	// 初始化垂直滚动条
	initVerticalScrollbar();
	
	// 设置滚动条可见性
	setupScrollbarVisibility();
	
	// 初始化刷新按钮
	initRefreshButton();
	
	// 初始化键盘快捷键
	initKeyboardShortcuts();
});

// 初始化垂直滚动条函数
function initVerticalScrollbar() {
	const viewport = document.querySelector('#viewport');
	const verticalScrollbarContainer = document.getElementById('vertical-scrollbar-container');
	const verticalScrollbar = document.getElementById('vertical-scrollbar');
	const verticalScrollbarHandle = document.getElementById('vertical-scrollbar-handle');
	
	if (!viewport || !verticalScrollbarContainer || !verticalScrollbar || !verticalScrollbarHandle) {
		console.error('找不到垂直滚动条元素');
		return;
	}
	
	// 设置初始滚动条高度和位置
	updateVerticalScrollbar();
	
	// 监听滚动事件
	viewport.addEventListener('scroll', updateVerticalScrollbar);
	
	// 窗口大小改变时更新滚动条
	window.addEventListener('resize', updateVerticalScrollbar);
	
	// 确保滚动条容器总是可以接收点击事件
	verticalScrollbarContainer.style.pointerEvents = 'auto';
	verticalScrollbar.style.pointerEvents = 'auto';
	verticalScrollbarHandle.style.pointerEvents = 'auto';
	
	// 添加垂直滚动条拖动功能
	let isDraggingVerticalScrollbar = false;
	let scrollbarStartY = 0;
	
	// 点击滚动条背景时平滑滚动到对应位置
	verticalScrollbar.addEventListener('mousedown', (e) => {
		// 忽略手柄上的点击，由手柄自己处理
		if (e.target === verticalScrollbarHandle) return;
		
		// 阻止事件冒泡和默认行为
		e.stopPropagation();
		e.preventDefault();
		
		const viewport = document.querySelector('#viewport');
		if (!viewport) return;
		
		// 获取点击位置
		const clickY = e.clientY;
		const scrollbarRect = verticalScrollbar.getBoundingClientRect();
		
		// 获取视口和内容的高度
		const contentHeight = viewport.scrollHeight;
		const viewportHeight = viewport.clientHeight;
		
		// 计算滚动条高度和位置
		const scrollbarHeight = parseInt(verticalScrollbar.style.height || '100');
		const maxScrollbarOffset = viewportHeight - scrollbarHeight;
		
		// 目标位置：将滚动条的中心点对准点击位置
		let targetScrollbarTop = clickY - (scrollbarHeight / 2);
		
		// 确保滚动条在有效范围内
		targetScrollbarTop = Math.max(0, Math.min(maxScrollbarOffset, targetScrollbarTop));
		
		// 计算对应的滚动位置
		const scrollRatio = targetScrollbarTop / maxScrollbarOffset;
		const targetScrollTop = scrollRatio * (contentHeight - viewportHeight);
		
		// 直接设置滚动位置
		viewport.scrollTop = targetScrollTop;
		
		// 更新垂直滚动条位置
		verticalScrollbar.style.top = `${targetScrollbarTop}px`;
		
		// 确保滚动条保持可见
		showScrollbars();
	});
	
	// 滚动条容器点击事件，平滑滚动到点击位置
	verticalScrollbarContainer.addEventListener('mousedown', (e) => {
		// 只处理直接点击容器的情况，忽略点击滚动条或手柄的情况
		if (e.target !== verticalScrollbarContainer) return;
		
		// 阻止事件冒泡和默认行为
		e.stopPropagation();
		e.preventDefault();
		
		const viewport = document.querySelector('#viewport');
		if (!viewport) return;
		
		// 获取点击位置
		const clickY = e.clientY;
		
		// 计算滚动条高度和位置
		const contentHeight = viewport.scrollHeight;
		const viewportHeight = viewport.clientHeight;
		const scrollbarHeight = parseInt(verticalScrollbar.style.height || '100');
		
		// 目标位置：将滚动条的中心点对准点击位置
		let targetScrollbarTop = clickY - (scrollbarHeight / 2);
		
		// 确保滚动条在有效范围内
		const maxScrollbarOffset = viewportHeight - scrollbarHeight;
		targetScrollbarTop = Math.max(0, Math.min(maxScrollbarOffset, targetScrollbarTop));
		
		// 计算对应的滚动位置
		const scrollRatio = targetScrollbarTop / maxScrollbarOffset;
		const targetScrollTop = scrollRatio * (contentHeight - viewportHeight);
		
		// 直接设置滚动位置
		viewport.scrollTop = targetScrollTop;
		
		// 更新垂直滚动条位置
		verticalScrollbar.style.top = `${targetScrollbarTop}px`;
		
		// 确保滚动条保持可见
		showScrollbars();
	});
	
	// 垂直滚动条手柄拖动
	verticalScrollbarHandle.addEventListener('mousedown', (e) => {
		// 阻止事件冒泡和默认行为
		e.stopPropagation();
		e.preventDefault();
		
		isDraggingVerticalScrollbar = true;
		scrollbarStartY = e.clientY;
		
		// 添加拖动状态类
		document.body.classList.add('dragging');
		
		// 确保滚动条在拖动过程中保持可见
		showScrollbars();
		
		// 在控制台输出调试信息
		console.log('开始拖动垂直滚动条');
	});
	
	// 处理垂直滚动条拖动
	function handleVerticalScrollbarDrag(e) {
		if (!isDraggingVerticalScrollbar) return;
		
		// 确保滚动条在拖动期间保持可见
		showScrollbars();
		
		const viewport = document.querySelector('#viewport');
		if (!viewport) return;
		
		// 计算拖动距离
		const dragDistance = e.clientY - scrollbarStartY;
		
		// 获取视口和内容的高度
		const contentHeight = viewport.scrollHeight;
		const viewportHeight = viewport.clientHeight;
		
		// 获取当前滚动位置
		const currentScrollTop = viewport.scrollTop;
		
		// 计算拖动比例，并应用到滚动位置
		const scrollRatio = dragDistance / viewportHeight;
		const scrollDelta = scrollRatio * (contentHeight - viewportHeight);
		const newScrollTop = currentScrollTop + scrollDelta;
		
		// 应用新的滚动位置
		viewport.scrollTop = newScrollTop;
		
		// 更新起始位置
		scrollbarStartY = e.clientY;
	}
	
	// 结束垂直滚动条拖动
	function endVerticalScrollbarDrag() {
		if (!isDraggingVerticalScrollbar) return;
		
		isDraggingVerticalScrollbar = false;
		
		// 移除拖动状态类
		document.body.classList.remove('dragging');
		
		// 重置隐藏计时器
		resetScrollbarHideTimer();
	}
	
	// 添加全局事件监听
	document.addEventListener('mousemove', handleVerticalScrollbarDrag);
	document.addEventListener('mouseup', endVerticalScrollbarDrag);
}

// 更新垂直滚动条位置和尺寸
function updateVerticalScrollbar() {
	const viewport = document.querySelector('#viewport');
	const verticalScrollbar = document.getElementById('vertical-scrollbar');
	const verticalScrollbarHandle = document.getElementById('vertical-scrollbar-handle');
	
	if (!viewport || !verticalScrollbar || !verticalScrollbarHandle) return;
	
	// 计算内容高度与视口高度比例
	const contentHeight = viewport.scrollHeight;
	const viewportHeight = viewport.clientHeight;
	const ratio = viewportHeight / contentHeight;
	
	// 设置滚动条高度
	const scrollbarHeight = Math.max(30, viewportHeight * ratio);
	verticalScrollbar.style.height = `${scrollbarHeight}px`;
	
	// 计算并设置滚动条位置
	const scrollRatio = viewport.scrollTop / (contentHeight - viewportHeight);
	const maxScrollbarOffset = viewportHeight - scrollbarHeight;
	const scrollbarTop = scrollRatio * maxScrollbarOffset;
	
	verticalScrollbar.style.top = `${scrollbarTop}px`;
}

// 显示滚动条函数
function showScrollbars() {
	// 获取滚动条容器
	const horizontalContainer = document.getElementById('custom-scrollbar-container');
	const verticalContainer = document.getElementById('vertical-scrollbar-container');
	
	// 添加活动类使滚动条显示
	if (horizontalContainer) horizontalContainer.classList.add('active');
	if (verticalContainer) verticalContainer.classList.add('active');
	
	// 重置隐藏计时器
	resetScrollbarHideTimer();
}

// 隐藏滚动条函数
function hideScrollbars() {
	// 获取滚动条容器
	const horizontalContainer = document.getElementById('custom-scrollbar-container');
	const verticalContainer = document.getElementById('vertical-scrollbar-container');
	
	// 移除活动类使滚动条隐藏
	if (horizontalContainer) horizontalContainer.classList.remove('active');
	if (verticalContainer) verticalContainer.classList.remove('active');
}

// 重置滚动条隐藏计时器
function resetScrollbarHideTimer() {
	// 清除现有计时器
	if (scrollbarHideTimer) clearTimeout(scrollbarHideTimer);
	
	// 设置新计时器，0.5秒后隐藏滚动条（修改为500毫秒）
	scrollbarHideTimer = setTimeout(hideScrollbars, 500);
}

// 修改监听事件，在滚动、鼠标移动和触摸时显示滚动条
function setupScrollbarVisibility() {
	// 监听viewport的滚动事件
	const viewport = document.querySelector('#viewport');
	if (viewport) {
		viewport.addEventListener('scroll', showScrollbars);
	}
	
	// 仅在特定元素上添加鼠标事件监听器
	const scrollbarHandle = document.getElementById('custom-scrollbar-handle');
	const verticalScrollbarHandle = document.getElementById('vertical-scrollbar-handle');
	const imageContainer = document.querySelector('#image-container');
	
	// 确保滚动条手柄在鼠标悬停和点击时显示
	if (scrollbarHandle) {
		scrollbarHandle.addEventListener('mouseenter', showScrollbars);
		scrollbarHandle.addEventListener('mousedown', showScrollbars);
	}
	
	if (verticalScrollbarHandle) {
		verticalScrollbarHandle.addEventListener('mouseenter', showScrollbars);
		verticalScrollbarHandle.addEventListener('mousedown', showScrollbars);
	}
	
	// 确保水平滚动条容器在鼠标悬停时显示
	const horizontalContainer = document.getElementById('custom-scrollbar-container');
	if (horizontalContainer) {
		horizontalContainer.addEventListener('mouseenter', showScrollbars);
		horizontalContainer.addEventListener('mousemove', showScrollbars);
		horizontalContainer.addEventListener('mousedown', showScrollbars);
	}
	
	// 确保垂直滚动条容器在鼠标悬停时显示
	const verticalContainer = document.getElementById('vertical-scrollbar-container');
	if (verticalContainer) {
		verticalContainer.addEventListener('mouseenter', showScrollbars);
		verticalContainer.addEventListener('mousemove', showScrollbars);
		verticalContainer.addEventListener('mousedown', showScrollbars);
	}
	
	// 添加滚动条交互事件
	const customScrollbar = document.getElementById('custom-scrollbar');
	if (customScrollbar) {
		customScrollbar.addEventListener('mouseenter', showScrollbars);
		customScrollbar.addEventListener('mousedown', showScrollbars);
	}
	
	const verticalScrollbar = document.getElementById('vertical-scrollbar');
	if (verticalScrollbar) {
		verticalScrollbar.addEventListener('mouseenter', showScrollbars);
		verticalScrollbar.addEventListener('mousedown', showScrollbars);
	}
	
	// 触摸事件
	document.addEventListener('touchstart', showScrollbars);
	document.addEventListener('touchmove', showScrollbars);
	
	// 初始化时先显示一次滚动条，然后自动隐藏
	showScrollbars();
}

// 初始化刷新按钮功能
function initRefreshButton() {
	const refreshButton = document.getElementById('refresh-button');
	if (!refreshButton) return;
	
	// 添加点击事件
	refreshButton.addEventListener('click', () => {
		// 调用刷新函数
		loadSelectedItems();
		
		// 仅显示动画效果
		refreshButton.classList.add('refreshing');
		setTimeout(() => {
			refreshButton.classList.remove('refreshing');
		}, 500);
	});
}

// 初始化键盘快捷键
function initKeyboardShortcuts() {
	document.addEventListener('keydown', (event) => {
		// Ctrl+加号或等号(+/=)：放大
		if (event.ctrlKey && (event.key === '+' || event.key === '=' || event.keyCode === 187)) {
			event.preventDefault();
			
			// 计算新的缩放比例（增加5%）
			const oldZoom = currentZoom;
			let newZoom = oldZoom * 1.05;
			
			// 设置缩放限制
			const maxZoom = 5.0;
			newZoom = Math.min(maxZoom, newZoom);
			
			// 应用缩放
			applyZoomWithMouseCenter(newZoom, oldZoom);
		}
		
		// Ctrl+减号(-)：缩小
		if (event.ctrlKey && (event.key === '-' || event.keyCode === 189)) {
			event.preventDefault();
			
			// 计算新的缩放比例（减少5%）
			const oldZoom = currentZoom;
			let newZoom = oldZoom * 0.95;
			
			// 设置缩放限制
			const minZoom = 0.2;
			newZoom = Math.max(minZoom, newZoom);
			
			// 应用缩放
			applyZoomWithMouseCenter(newZoom, oldZoom);
		}
		
		// Ctrl+W：退出窗口
		if (event.ctrlKey && (event.key === 'w' || event.keyCode === 87)) {
			event.preventDefault();
			console.log('触发Ctrl+W关闭窗口');
			
			// 使用hide方法关闭窗口，而不是尝试调用不存在的close方法
			if (typeof eagle !== 'undefined' && eagle.window && typeof eagle.window.hide === 'function') {
				// 记录日志以便调试
				console.log('正在尝试使用eagle.window.hide()关闭窗口');
				
				eagle.window.hide().then(() => {
					console.log('窗口已成功隐藏');
				}).catch(err => {
					console.error('隐藏窗口失败:', err);
					
					// 如果hide方法失败，尝试使用其他可能的方法
					console.log('尝试使用其他方法关闭窗口');
					
					// 尝试minimize方法
					if (typeof eagle.window.minimize === 'function') {
						eagle.window.minimize().catch(e => 
							console.error('最小化窗口失败:', e)
						);
					}
				});
			} else {
				console.warn('eagle.window.hide API不可用');
				
				// 记录eagle对象的属性，帮助调试
				console.log('eagle对象可用:', typeof eagle !== 'undefined');
				if (typeof eagle !== 'undefined') {
					console.log('eagle.window对象可用:', typeof eagle.window !== 'undefined');
					if (typeof eagle.window !== 'undefined') {
						console.log('eagle.window可用的方法:', 
							Object.getOwnPropertyNames(eagle.window)
							.filter(prop => typeof eagle.window[prop] === 'function')
						);
					}
				}
			}
		}
		
		// Ctrl+R：刷新
		if (event.ctrlKey && (event.key === 'r' || event.keyCode === 82)) {
			event.preventDefault();
			
			// 显示刷新按钮动画
			const refreshButton = document.getElementById('refresh-button');
			if (refreshButton) {
				refreshButton.classList.add('refreshing');
				setTimeout(() => {
					refreshButton.classList.remove('refreshing');
				}, 500);
			}
			
			// 刷新图片
			loadSelectedItems();
		}
	});
}

// 添加错误提示函数
function showErrorMessage(message) {
	const errorBox = document.createElement('div');
	errorBox.className = 'error-message';
	errorBox.textContent = message;
	document.body.appendChild(errorBox);
	
	setTimeout(() => {
		errorBox.remove();
	}, 3000);
}

function showLoading(isLoading) {
	const loadingIndicator = document.getElementById('loading-indicator') || createLoadingIndicator();
	loadingIndicator.style.display = isLoading ? 'flex' : 'none';
}

function createLoadingIndicator() {
	const indicator = document.createElement('div');
	indicator.id = 'loading-indicator';
	indicator.innerHTML = '<div class="spinner"></div>';
	document.body.appendChild(indicator);
	return indicator;
}

// 清理不再需要的资源
function clearPreviousImages() {
	const oldImages = document.querySelectorAll('.image-container img');
	oldImages.forEach(img => {
		// 释放图片资源
		img.src = '';
		img.remove();
	});
}

function setupGlobalEvents() {
	document.addEventListener('mousemove', (e) => {
		// 根据当前状态调用相应处理函数
		if (ScrollModule.isDraggingHorizontal) {
			ScrollModule.handleHorizontalDrag(e);
		}
		if (ScrollModule.isDraggingVertical) {
			ScrollModule.handleVerticalDrag(e);
		}
	});
	
	document.addEventListener('mouseup', () => {
		// 统一处理结束拖动状态
		ScrollModule.endDrag();
	});
}

// 可以合并为枚举状态：
const DragState = {
	NONE: 'none',
	HORIZONTAL: 'horizontal',
	VERTICAL: 'vertical',
	CONTENT: 'content'
};

let currentDragState = DragState.NONE;

// 建议实现一个DOM缓存对象：
const DOM = {
	elements: {},
	
	get(selector) {
		if (!this.elements[selector]) {
			this.elements[selector] = document.querySelector(selector);
		}
		return this.elements[selector];
	},
	
	invalidateCache() {
		this.elements = {};
	}
};

// 使用时：
const container = DOM.get('#image-container');

