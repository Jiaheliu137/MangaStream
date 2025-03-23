const { addAbortSignal } = require('stream');

// 全局变量定义区
let currentZoom = 1.0; // 修改初始默认缩放比例为100%，后续会根据图片尺寸自动调整
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

// 添加全局变量记录初始窗口宽度
let initialWindowWidth = null;

// 使用模块模式组织缩放功能相关代码
const ZoomModule = {
	currentZoom: 1.0, // 修改为100%，将根据图片尺寸动态调整
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
		
		// 仅显示水平滚动条
		showHorizontalScrollbar();
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
		
		// 更新全局偏移量
		currentOffsetX = newOffsetX;
		
		// 应用新位置
		applyContentPosition();
		
		// 仅显示水平滚动条
		showHorizontalScrollbar();
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
		
		// 确保水平滚动条在拖动过程中保持可见
		if (horizontalScrollbarHideTimer) clearTimeout(horizontalScrollbarHideTimer);
		showHorizontalScrollbar();
		
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
	
	// 仅确保水平滚动条在拖动期间保持可见
	showHorizontalScrollbar();
	
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
	
	// 启动水平滚动条自动隐藏计时器
	resetHorizontalScrollbarHideTimer();
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
	
	// 更新垂直滚动条状态
	updateVerticalScrollbar();
	
	// 显示当前缩放级别指示器
	showZoomLevel(newZoom);
	
	// 缩放时同时显示水平和垂直滚动条
	showScrollbars();
	
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
	
	// 滚轮滚动结束检测计时器
	let wheelEndTimer = null;
	
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
		// 普通滚轮事件（非缩放）
		else {
			// 清除之前的滚轮结束检测计时器
			if (wheelEndTimer) {
				clearTimeout(wheelEndTimer);
			}
			
			// 如果垂直有滚动，仅显示垂直滚动条
			if (event.deltaY !== 0) {
				showVerticalScrollbar();
				
				// 设置新的计时器，滚轮停止一段时间后重置滚动条隐藏计时器
				wheelEndTimer = setTimeout(() => {
					// 当滚轮滚动停止后，启动隐藏计时器
					resetVerticalScrollbarHideTimer();
					wheelEndTimer = null;
				}, 150); // 滚轮停止150毫秒后认为滚动结束
			}
			
			// 如果水平有滚动，仅显示水平滚动条
			if (event.deltaX !== 0) {
				showHorizontalScrollbar();
				
				// 设置滚轮停止后自动隐藏水平滚动条
				wheelEndTimer = setTimeout(() => {
					resetHorizontalScrollbarHideTimer();
					wheelEndTimer = null;
				}, 150);
			}
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
		
		// 记录是否有水平或垂直移动
		let hasHorizontalMovement = false;
		let hasVerticalMovement = false;
		
		// 更新水平偏移量，并添加限制
		if (horizontalEnabled && dx !== 0) {
			hasHorizontalMovement = true;
			
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
			
			// 仅显示水平滚动条
			showHorizontalScrollbar();
		}
		
		// 使用垂直滚动而不是偏移
		if (dy !== 0) {
			hasVerticalMovement = true;
			
			// 获取viewport元素
			const viewport = document.querySelector('#viewport');
			if (viewport) {
				viewport.scrollBy(0, -dy); // 负值使得拖动方向与滚动方向一致
				
				// 仅显示垂直滚动条
				showVerticalScrollbar();
			}
		}
		
		// 应用新位置
		applyContentPosition();
		
		// 只有在有水平移动时才更新水平滚动条位置
		if (hasHorizontalMovement) {
			updateScrollbarPosition();
		}
		
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
				
				// 更新当前加载的项目ID列表
				currentLoadedItemIds = items.map(item => item.id || '');
				
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
					showLoading(false);
					return;
				}
				
				// 直接显示选中的图片
				displaySelectedItems(items);
			}).catch(err => {
				console.error('获取选中项目时出错:', err);
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
				showLoading(false);
			});
		}, 200); // 200ms延迟，与CSS过渡时间匹配
	} catch (error) {
		console.error('加载选中项目失败:', error);
		// 显示错误提示给用户
		showErrorMessage('加载图片失败，请重试');
		showLoading(false);
	}
}

// 检查两个数组是否相等的辅助函数
function arraysEqual(arr1, arr2) {
	if (arr1.length !== arr2.length) return false;
	for (let i = 0; i < arr1.length; i++) {
		if (arr1[i] !== arr2[i]) return false;
	}
	return true;
}

// 添加支持的图片格式白名单
const SUPPORTED_IMAGE_FORMATS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];

// 简化 displaySelectedItems 函数
function displaySelectedItems(items) {
    const container = document.querySelector('#image-container');
    
    if (!items || items.length === 0) {
        container.innerHTML = '<p class="no-images">请先在Eagle中选择一个或多个图片</p>';
        showLoading(false);
        return;
    }
    
    // 清空容器
    container.innerHTML = '';
    
    // 过滤出支持的图片格式
    let filteredItems = items.filter(item => {
        // 获取文件路径
        let filePath = '';
        if (item.filePath) {
            filePath = item.filePath;
        } else if (item.path) {
            filePath = item.path;
        } else if (item.url && item.url.startsWith('file://')) {
            filePath = item.url.replace('file://', '');
        }
        
        // 检查文件扩展名是否在支持列表中
        const fileName = filePath || item.name || '';
        return SUPPORTED_IMAGE_FORMATS.some(format => 
            fileName.toLowerCase().endsWith(format)
        );
    });
    
    // 注意：不再进行自定义排序，保持Eagle原始的排序顺序
    
    // 如果过滤后没有有效图片，显示提示
    if (filteredItems.length === 0) {
        container.innerHTML = '<p class="no-images">选中的项目中没有支持的图片格式</p>';
        showLoading(false);
        return;
    }
    
    // 记录要加载的图片总数
    const totalImages = filteredItems.length;
    let loadedImages = 0;
    
    // 按照Eagle原始顺序加载图片
    filteredItems.forEach((item, index) => {
        // 获取图片的本地路径
        let imagePath = item.filePath || item.path || 
                       (item.url && item.url.startsWith('file://') ? item.url.replace('file://', '') : '');
        
        // 创建图片容器元素
        const imgContainer = document.createElement('div');
        imgContainer.className = 'image-wrapper';
        imgContainer.style.width = '100%';
        
        // 创建图片元素
        const img = document.createElement('img');
        img.className = 'seamless-image';
        img.alt = item.name || '未命名';
        img.style.width = '100%';
        img.style.height = 'auto';
        
        // 设置图片加载完成的处理函数
        img.onload = function() {
            loadedImages++;
            
            // 所有图片加载完成后处理
            if (loadedImages === totalImages) {
                // 设置图片固定尺寸
                setImageFixedSize();
                
                // 重置内容位置
                resetContentPosition();
                
                // 添加过渡效果
                container.classList.remove('fading-out');
                container.classList.add('fading-in');
                
                // 动画完成后移除类
                setTimeout(() => {
                    container.classList.remove('fading-in');
                }, 300);
                
                // 隐藏加载指示器
                showLoading(false);
            }
        };
        
        // 设置图片加载失败的处理函数
        img.onerror = function() {
            console.error(`图片加载失败: ${imagePath}`);
            loadedImages++;
            
            // 创建错误占位符
            const errorPlaceholder = document.createElement('div');
            errorPlaceholder.className = 'image-error';
            errorPlaceholder.textContent = '图片加载失败';
            errorPlaceholder.style.width = '100%';
            errorPlaceholder.style.textAlign = 'center';
            errorPlaceholder.style.color = '#ff6b6b';
            
            // 替换图片元素
            if (imgContainer.contains(img)) {
                imgContainer.replaceChild(errorPlaceholder, img);
            }
            
            // 所有图片加载完成后检查
            if (loadedImages === totalImages) {
                container.classList.remove('fading-out');
                container.classList.add('fading-in');
                setTimeout(() => {
                    container.classList.remove('fading-in');
                }, 300);
                showLoading(false);
            }
        };
        
        // 设置图片源
        const fs = require('fs');
        if (imagePath && fs.existsSync(imagePath)) {
            img.src = `file://${imagePath}`;
        } else if (item.thumbnail) {
            img.src = item.thumbnail;
        } else if (item.url) {
            img.src = item.url;
        } else {
            // 没有可用图片源，创建占位符
            const placeholder = document.createElement('div');
            placeholder.className = 'image-placeholder';
            placeholder.textContent = '无法加载图片';
            placeholder.style.width = '100%';
            placeholder.style.textAlign = 'center';
            placeholder.style.color = '#999';
            
            imgContainer.appendChild(placeholder);
            container.appendChild(imgContainer);
            loadedImages++;
            
            if (loadedImages === totalImages) {
                showLoading(false);
            }
            
            return;
        }
        
        // 添加图片到容器
        imgContainer.appendChild(img);
        container.appendChild(imgContainer);
        
        // 如果不是最后一张图片，添加分割线
        if (index < filteredItems.length - 1) {
            const divider = document.createElement('div');
            divider.className = 'image-divider';
            divider.style.backgroundColor = '#1e1e1e';
            container.appendChild(divider);
        }
    });
}

// 应用统一宽度显示
function applyUniformWidthDisplay() {
    const container = document.querySelector('#image-container');
    if (!container) return;
    
    // 确保容器宽度为100%
    container.style.width = '100%';
    
    // 获取所有图片
    const images = container.querySelectorAll('.seamless-image');
    
    // 设置所有图片宽度为100%
    images.forEach(img => {
        img.style.width = '100%';
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
    });
    
    // 重置内容位置
    resetContentPosition();
    
    // 应用位置
    applyContentPosition();
    
    // 重置缩放为1.0
    currentZoom = 1.0;
    
    // 更新水平滚动条
    updateHorizontalScroll(currentZoom);
    
    // 更新垂直滚动条
    updateVerticalScrollbar();
    
    // 显示缩放级别
    showZoomLevel(currentZoom);
    
    // 添加过渡效果
    container.classList.remove('fading-out');
    container.classList.add('fading-in');
    
    // 动画完成后移除类
    setTimeout(() => {
        container.classList.remove('fading-in');
    }, 300);
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
	if (images.length === 0) return;
	
	// 只在第一次调用时保存初始窗口宽度
	if (initialWindowWidth === null) {
		initialWindowWidth = window.innerWidth;
	}
	
	// 使用保存的初始窗口宽度，而不是当前窗口宽度
	const uniformWidth = initialWindowWidth;
	
	// 应用统一宽度到所有图片
	images.forEach(img => {
		// 对于已加载的图片，直接设置宽度
		if (img.complete) {
			applyFixedWidthToImage(img, uniformWidth);
		} else {
			// 对于尚未加载的图片，等待加载完成后设置
			img.onload = () => applyFixedWidthToImage(img, uniformWidth);
		}
	});
}

// 新增：为单个图片应用固定宽度
function applyFixedWidthToImage(img, width) {
	// 设置图片的固定宽度
	img.style.width = `${width}px`;
	img.style.maxWidth = `${width}px`;
	
	// 确保包装器宽度也是固定的
	const wrapper = img.closest('.image-wrapper');
	if (wrapper) {
		wrapper.style.width = `${width}px`;
	}
}

// 修改initializePlugin函数
function initializePlugin() {
	// 重置容器样式和位置
	resetContentPosition();
	
	// 重新应用缩放
	const container = document.querySelector('#image-container');
	if (container) {
		// 恢复使用setImageFixedSize，确保图片保持固定原始尺寸
		setImageFixedSize();
		
		// 更新自定义水平滚动条
		updateHorizontalScroll(currentZoom);
		
		// 更新垂直滚动条
		updateVerticalScrollbar();
	}
	
	// 更新光标样式
	if (window.updateAfterZoom) {
		window.updateAfterZoom();
	}
}

// 修改计算和应用最佳缩放比例函数，保持漫画尺寸不变
function calculateAndApplyBestZoom() {
	// 保持当前缩放级别，不改变图片实际尺寸
	const container = document.querySelector('#image-container');
	if (container) {
		// 不重新设置图片尺寸，仅重置位置
		// 注释掉这行，防止在窗口调整大小时重设图片尺寸
		// setImageFixedSize();
		
		// 重置内容位置到中心
		resetContentPosition();
		
		// 应用位置和缩放，但保持缩放级别不变
		applyContentPosition();
		
		// 更新滚动条
		updateHorizontalScroll(currentZoom);
		updateVerticalScrollbar();
	}
}

// 修改resize事件处理函数
window.addEventListener('resize', debounce(() => {
	// 标记正在调整大小
	document.body.classList.add('resizing');
	
	// 保持漫画尺寸不变，只更新位置和滚动条
	const oldZoom = currentZoom; // 保存当前缩放级别
	
	// 调用calculateAndApplyBestZoom更新布局但不改变图片尺寸
	calculateAndApplyBestZoom();
	
	// 确保缩放级别不变
	currentZoom = oldZoom;
	
	// 重新应用当前缩放以确保正确的变换
	applyContentPosition();
	
	// 更新自定义滚动条位置
	updateScrollbarPosition();
	
	// 延迟移除正在调整大小的标记
	setTimeout(() => {
		document.body.classList.remove('resizing');
	}, 200);
}, 300)); // 增加防抖延迟到300ms，给计算留出更多时间

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
	
	// 初始化完成后检查并处理滚动条状态
	setTimeout(() => {
		// 检查并更新垂直滚动条状态
		updateVerticalScrollbar();
		
		// 立即重置滚动条隐藏计时器，确保滚动条能自动隐藏
		resetVerticalScrollbarHideTimer();
		resetHorizontalScrollbarHideTimer();
	}, 500);
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
		
		// 仅显示垂直滚动条
		showVerticalScrollbar();
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
		
		// 仅显示垂直滚动条
		showVerticalScrollbar();
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
		
		// 仅确保垂直滚动条在拖动期间保持可见
		showVerticalScrollbar();
		
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
		
		// 重置垂直滚动条隐藏计时器
		resetVerticalScrollbarHideTimer();
	}
	
	// 添加全局事件监听
	document.addEventListener('mousemove', handleVerticalScrollbarDrag);
	document.addEventListener('mouseup', endVerticalScrollbarDrag);
}

// 修改updateVerticalScrollbar函数，增强检测逻辑
function updateVerticalScrollbar() {
	const viewport = document.querySelector('#viewport');
	const verticalScrollbar = document.getElementById('vertical-scrollbar');
	const verticalScrollbarHandle = document.getElementById('vertical-scrollbar-handle');
	const verticalScrollbarContainer = document.getElementById('vertical-scrollbar-container');
	
	if (!viewport || !verticalScrollbar || !verticalScrollbarHandle || !verticalScrollbarContainer) return;
	
	// 计算内容高度与视口高度比例
	const contentHeight = viewport.scrollHeight;
	const viewportHeight = viewport.clientHeight;
	
	// 如果内容高度小于或等于视口高度，隐藏滚动条
	if (contentHeight <= viewportHeight) {
		verticalScrollbarContainer.style.display = 'none';
		// 确保移除活动状态类
		verticalScrollbarContainer.classList.remove('active');
		// 强制清除任何可能存在的隐藏计时器
		if (verticalScrollbarHideTimer) {
			clearTimeout(verticalScrollbarHideTimer);
			verticalScrollbarHideTimer = null;
		}
		return;
	}
	
	// 内容超出视口时，确保滚动条容器可见
	verticalScrollbarContainer.style.display = 'block';
	
	const ratio = viewportHeight / contentHeight;
	
	// 设置滚动条高度
	const scrollbarHeight = Math.max(30, viewportHeight * ratio);
	verticalScrollbar.style.height = `${scrollbarHeight}px`;
	
	// 计算并设置滚动条位置
	const scrollRatio = viewport.scrollTop / (contentHeight - viewportHeight);
	const maxScrollbarOffset = viewportHeight - scrollbarHeight;
	const scrollbarTop = scrollRatio * maxScrollbarOffset;
	
	verticalScrollbar.style.top = `${scrollbarTop}px`;
	
	// 更新后短暂显示滚动条，然后自动隐藏（仅当不在拖动状态时）
	const isDragging = document.body.classList.contains('dragging');
	if (!isDragging) {
		// 添加活动类显示滚动条
		verticalScrollbarContainer.classList.add('active');
		// 启动隐藏计时器
		resetVerticalScrollbarHideTimer();
	}
}

// 显示滚动条函数，分离水平和垂直滚动条显示逻辑
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

// 显示水平滚动条
function showHorizontalScrollbar() {
	const horizontalContainer = document.getElementById('custom-scrollbar-container');
	if (horizontalContainer) {
		horizontalContainer.classList.add('active');
		// 确保清除计时器，防止滚动条意外消失
		if (horizontalScrollbarHideTimer) {
			clearTimeout(horizontalScrollbarHideTimer);
			horizontalScrollbarHideTimer = null;
		}
	}
}

// 显示垂直滚动条
function showVerticalScrollbar() {
	const verticalContainer = document.getElementById('vertical-scrollbar-container');
	const viewport = document.querySelector('#viewport');
	
	if (!verticalContainer || !viewport) return;
	
	// 检查内容高度和视口高度
	const contentHeight = viewport.scrollHeight;
	const viewportHeight = viewport.clientHeight;
	
	// 只有当内容高度大于视口高度时才显示滚动条
	if (contentHeight > viewportHeight) {
		// 确保滚动条容器可见
		verticalContainer.style.display = 'block';
		verticalContainer.classList.add('active');
		
		// 确保清除计时器，防止滚动条意外消失
		if (verticalScrollbarHideTimer) {
			clearTimeout(verticalScrollbarHideTimer);
			verticalScrollbarHideTimer = null;
		}
	} else {
		// 内容小于视口时确保滚动条隐藏
		verticalContainer.style.display = 'none';
		verticalContainer.classList.remove('active');
	}
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

// 重置滚动条隐藏计时器（全部滚动条）
function resetScrollbarHideTimer() {
	// 清除现有计时器
	if (scrollbarHideTimer) clearTimeout(scrollbarHideTimer);
	
	// 设置新计时器，0.5秒后隐藏滚动条（修改为500毫秒）
	scrollbarHideTimer = setTimeout(hideScrollbars, 500);
}

// 水平滚动条隐藏计时器
let horizontalScrollbarHideTimer;

// 垂直滚动条隐藏计时器
let verticalScrollbarHideTimer;

// 重置水平滚动条隐藏计时器
function resetHorizontalScrollbarHideTimer() {
	// 清除现有计时器
	if (horizontalScrollbarHideTimer) clearTimeout(horizontalScrollbarHideTimer);
	
	// 设置新计时器
	horizontalScrollbarHideTimer = setTimeout(hideHorizontalScrollbar, 500);
}

// 重置垂直滚动条隐藏计时器
function resetVerticalScrollbarHideTimer() {
	// 清除现有计时器
	if (verticalScrollbarHideTimer) clearTimeout(verticalScrollbarHideTimer);
	
	// 设置新计时器
	verticalScrollbarHideTimer = setTimeout(hideVerticalScrollbar, 500);
}

// 修改监听事件，在滚动、鼠标移动和触摸时显示滚动条
function setupScrollbarVisibility() {
	// 记录滚动停止检测计时器
	let scrollEndTimer = null;
	
	// 监听viewport的滚动事件
	const viewport = document.querySelector('#viewport');
	if (viewport) {
		viewport.addEventListener('scroll', () => {
			// 仅显示垂直滚动条
			showVerticalScrollbar();
			
			// 清除之前的滚动结束检测计时器
			if (scrollEndTimer) {
				clearTimeout(scrollEndTimer);
			}
			
			// 设置新的计时器，滚动停止一段时间后重置隐藏计时器
			scrollEndTimer = setTimeout(() => {
				// 当用户停止滚动后，启动隐藏计时器
				resetVerticalScrollbarHideTimer();
				scrollEndTimer = null;
			}, 150); // 滚动停止150毫秒后认为滚动结束
		});
	}
	
	// 获取滚动条容器
	const horizontalContainer = document.getElementById('custom-scrollbar-container');
	const verticalContainer = document.getElementById('vertical-scrollbar-container');
	const customScrollbar = document.getElementById('custom-scrollbar');
	const verticalScrollbar = document.getElementById('vertical-scrollbar');
	const scrollbarHandle = document.getElementById('custom-scrollbar-handle');
	const verticalScrollbarHandle = document.getElementById('vertical-scrollbar-handle');
	
	// 水平滚动条相关元素的事件处理
	if (horizontalContainer) {
		// 鼠标进入水平滚动条容器
		horizontalContainer.addEventListener('mouseenter', () => {
			if (horizontalScrollbarHideTimer) {
				clearTimeout(horizontalScrollbarHideTimer);
				horizontalScrollbarHideTimer = null;
			}
			showHorizontalScrollbar();
		});
		
		// 鼠标离开水平滚动条容器
		horizontalContainer.addEventListener('mouseleave', () => {
			// 只有当鼠标不在滚动条或滚动条手柄上时才重置计时器
			const isMouseOverScrollbar = document.querySelector(':hover') === customScrollbar;
			const isMouseOverHandle = document.querySelector(':hover') === scrollbarHandle;
			
			if (!isMouseOverScrollbar && !isMouseOverHandle) {
				resetHorizontalScrollbarHideTimer();
			}
		});
	}
	
	// 为水平滚动条和手柄添加事件
	if (customScrollbar) {
		customScrollbar.addEventListener('mouseenter', () => {
			if (horizontalScrollbarHideTimer) {
				clearTimeout(horizontalScrollbarHideTimer);
				horizontalScrollbarHideTimer = null;
			}
			showHorizontalScrollbar();
		});
		
		customScrollbar.addEventListener('mouseleave', () => {
			// 只有当鼠标不在容器或手柄上时才重置计时器
			const isMouseOverContainer = document.querySelector(':hover') === horizontalContainer;
			const isMouseOverHandle = document.querySelector(':hover') === scrollbarHandle;
			
			if (!isMouseOverContainer && !isMouseOverHandle) {
				resetHorizontalScrollbarHideTimer();
			}
		});
	}
	
	if (scrollbarHandle) {
		scrollbarHandle.addEventListener('mouseenter', () => {
			if (horizontalScrollbarHideTimer) {
				clearTimeout(horizontalScrollbarHideTimer);
				horizontalScrollbarHideTimer = null;
			}
			showHorizontalScrollbar();
		});
		
		scrollbarHandle.addEventListener('mouseleave', () => {
			// 只有当鼠标不在容器或滚动条上时才重置计时器
			const isMouseOverContainer = document.querySelector(':hover') === horizontalContainer;
			const isMouseOverScrollbar = document.querySelector(':hover') === customScrollbar;
			
			if (!isMouseOverContainer && !isMouseOverScrollbar) {
				resetHorizontalScrollbarHideTimer();
			}
		});
	}
	
	// 垂直滚动条相关元素的事件处理
	if (verticalContainer) {
		// 鼠标进入垂直滚动条容器
		verticalContainer.addEventListener('mouseenter', () => {
			if (verticalScrollbarHideTimer) {
				clearTimeout(verticalScrollbarHideTimer);
				verticalScrollbarHideTimer = null;
			}
			showVerticalScrollbar();
		});
		
		// 鼠标离开垂直滚动条容器
		verticalContainer.addEventListener('mouseleave', () => {
			// 只有当鼠标不在滚动条或滚动条手柄上时才重置计时器
			const isMouseOverScrollbar = document.querySelector(':hover') === verticalScrollbar;
			const isMouseOverHandle = document.querySelector(':hover') === verticalScrollbarHandle;
			
			if (!isMouseOverScrollbar && !isMouseOverHandle) {
				resetVerticalScrollbarHideTimer();
			}
		});
	}
	
	// 为垂直滚动条和手柄添加事件
	if (verticalScrollbar) {
		verticalScrollbar.addEventListener('mouseenter', () => {
			if (verticalScrollbarHideTimer) {
				clearTimeout(verticalScrollbarHideTimer);
				verticalScrollbarHideTimer = null;
			}
			showVerticalScrollbar();
		});
		
		verticalScrollbar.addEventListener('mouseleave', () => {
			// 只有当鼠标不在容器或手柄上时才重置计时器
			const isMouseOverContainer = document.querySelector(':hover') === verticalContainer;
			const isMouseOverHandle = document.querySelector(':hover') === verticalScrollbarHandle;
			
			if (!isMouseOverContainer && !isMouseOverHandle) {
				resetVerticalScrollbarHideTimer();
			}
		});
	}
	
	if (verticalScrollbarHandle) {
		verticalScrollbarHandle.addEventListener('mouseenter', () => {
			if (verticalScrollbarHideTimer) {
				clearTimeout(verticalScrollbarHideTimer);
				verticalScrollbarHideTimer = null;
			}
			showVerticalScrollbar();
		});
		
		verticalScrollbarHandle.addEventListener('mouseleave', () => {
			// 只有当鼠标不在容器或滚动条上时才重置计时器
			const isMouseOverContainer = document.querySelector(':hover') === verticalContainer;
			const isMouseOverScrollbar = document.querySelector(':hover') === verticalScrollbar;
			
			if (!isMouseOverContainer && !isMouseOverScrollbar) {
				resetVerticalScrollbarHideTimer();
			}
		});
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
		
		// 显示动画效果
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
			
			// 同时显示水平和垂直滚动条
			showScrollbars();
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
			
			// 同时显示水平和垂直滚动条
			showScrollbars();
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

// 从文件名中提取数字的辅助函数
function extractNumberFromFilename(filename) {
    // 匹配文件名中的数字部分
    const match = filename.match(/(\d+)/);
    if (match && match[1]) {
        // 将匹配到的数字字符串转换为数字
        return parseInt(match[1], 10);
    }
    return null;
}

