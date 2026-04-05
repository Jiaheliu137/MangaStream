// 常量定义模块

// 标准漫画尺寸固定为800像素
export const STANDARD_MANGA_WIDTH = 800;
export const STANDARD_MANGA_HEIGHT = 800; // 横向模式下的默认高度

export const READING_MODES = {
    VERTICAL: 'vertical',
    HORIZONTAL_LTR: 'horizontal_ltr',
    HORIZONTAL_RTL: 'horizontal_rtl'
};

// 动画配置参数
export const AnimationConfig = {
    FADE_OUT_DURATION: 500,    // 淡出动画持续时间(毫秒)
    FADE_IN_DURATION: 500,     // 淡入动画持续时间(毫秒)
    FADE_OVERLAP: 500,         // 淡入淡出重叠时间(毫秒)
    SCROLLBAR_HIDE_DELAY: 500, // 滚动条自动隐藏延迟时间(毫秒)
    SCROLL_END_DELAY: 150      // 滚动结束检测延迟时间(毫秒)
};

// 支持的图片格式白名单
export const SUPPORTED_IMAGE_FORMATS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

// 缩放限制
export const ZoomConfig = {
    MIN_ZOOM: 0.2,
    MAX_ZOOM: 5.0,
    DEFAULT_ZOOM: 1.0,
    ZOOM_STEP: 0.05,
    ZOOM_BUTTON_STEP: 0.1,          // 缩放按钮每次步进值(10%)
    ZOOM_EPSILON: 0.001,            // 缩放比较精度
    ZOOM_INDICATOR_DURATION: 1500   // 缩放指示器显示时长(ms)
};

// 虚拟滚动配置
export const VirtualScrollConfig = {
    RENDER_BUFFER: 15,              // 可视区域外额外渲染的图片数量
    PRELOAD_AHEAD: 50,              // 预解码的图片数量
    DEFAULT_IMAGE_SIZE: 1000,       // 无尺寸信息时的默认图片尺寸(px)
    SCROLL_THROTTLE: 50,            // 滚动事件节流间隔(ms)
    EAGLE_FOLDER_QUERY_LIMIT: 10000 // Eagle 文件夹查询上限
};

// 键盘与滚动配置
export const ScrollConfig = {
    KEYBOARD_SCROLL_AMOUNT: 150,    // 方向键每次滚动距离(px)
    PAGE_SCROLL_RATIO: 0.8          // 翻页比例(视口的80%)
};

// 滚动条配置
export const ScrollbarConfig = {
    MIN_SIZE: 30                    // 滚动条手柄最小尺寸(px)
};

// UI 配置
export const UIConfig = {
    MODE_TOAST_DURATION: 1500,      // 模式切换提示显示时长(ms)
    INIT_SCROLLBAR_DELAY: 500,      // 初始化后滚动条更新延时(ms)
    RESIZE_DEBOUNCE: 300,           // 窗口resize防抖间隔(ms)
    RESIZE_CLASS_DELAY: 200         // resizing class移除延时(ms)
};

// PDF 导出配置
export const PDFConfig = {
    JPEG_QUALITY: 0.95              // JPEG 压缩质量
};
