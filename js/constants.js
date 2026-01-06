// 常量定义模块

// 标准漫画宽度固定为800像素
export const STANDARD_MANGA_WIDTH = 800;

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

// 懒加载配置
export const LazyLoadConfig = {
    INITIAL_LOAD_COUNT: 300,   // 初始加载300张
    BATCH_LOAD_COUNT: 30,      // 每批次加载30张
    LOAD_THRESHOLD: 2000       // 距底部2000像素时触发加载
};

// 缩放限制
export const ZoomConfig = {
    MIN_ZOOM: 0.2,
    MAX_ZOOM: 5.0,
    DEFAULT_ZOOM: 1.0,
    ZOOM_STEP: 0.05
};
