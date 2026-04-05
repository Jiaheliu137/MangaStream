// 工具函数模块

// 防抖函数：限制高频率事件的触发频次
export function debounce(func, wait) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// 节流函数：限制函数在特定时间内只能执行一次
export function throttle(func, limit) {
    let lastFunc;
    let lastRan;
    return function () {
        const context = this;
        const args = arguments;
        if (!lastRan) {
            func.apply(context, args);
            lastRan = Date.now();
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(function () {
                if ((Date.now() - lastRan) >= limit) {
                    func.apply(context, args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
        }
    };
}

// Toast 提示消息（从 ui.js 提取，打破 modeManager ↔ ui 循环依赖）
export function showToast(message, type = 'success', duration = 3000, id = null) {
    if (id) {
        const existingToast = document.getElementById(id);
        if (existingToast) existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast-message ${type} ${id ? id : ''}`;
    if (id) toast.id = id;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        if (document.body.contains(toast)) {
            toast.remove();
        }
    }, duration);
}
