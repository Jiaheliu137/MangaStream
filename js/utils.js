// 工具函数模块

// 防抖函数：限制高频率事件的触发频次
export function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// 节流函数：限制函数在特定时间内只能执行一次
export function throttle(func, limit) {
    let lastFunc;
    let lastRan;
    return function() {
        const context = this;
        const args = arguments;
        if (!lastRan) {
            func.apply(context, args);
            lastRan = Date.now();
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(function() {
                if ((Date.now() - lastRan) >= limit) {
                    func.apply(context, args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
        }
    };
}

// 确保DOM元素在操作期间不受CSS过渡效果影响
export function ensureNoTransitions(element) {
    if (!element) return;

    const originalTransition = element.style.transition;
    element.style.transition = 'none';
    void element.offsetWidth;

    return () => {
        setTimeout(() => {
            element.style.transition = originalTransition;
        }, 500);
    };
}

// DOM缓存对象
export const DOM = {
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
