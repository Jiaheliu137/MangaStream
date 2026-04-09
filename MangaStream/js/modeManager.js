// 模式管理模块 (Mode Manager)
// 负责处理竖向(Vertical)和横向(Horizontal)阅读模式的切换和状态管理

import { READING_MODES, STANDARD_MANGA_WIDTH, STANDARD_MANGA_HEIGHT } from './constants.js';
import { loadSelectedItems, captureCurrentIndexForModeSwitch, reloadForModeSwitch } from './imageLoader.js';
import { showToast } from './ui.js';

let currentMode = READING_MODES.VERTICAL;
let isModeSwitching = false;

export function getReadingMode() {
    return currentMode;
}

export function isHorizontalMode() {
    return currentMode === READING_MODES.HORIZONTAL_LTR || currentMode === READING_MODES.HORIZONTAL_RTL;
}

export function isHorizontalLTRMode() {
    return currentMode === READING_MODES.HORIZONTAL_LTR;
}

export function isHorizontalRTLMode() {
    return currentMode === READING_MODES.HORIZONTAL_RTL;
}

export function applyBodyModeClasses() {
    // 切换视图 body class，由 CSS 处理 flex-direction
    document.body.classList.remove('horizontal-mode', 'horizontal-rtl-mode');

    if (isHorizontalLTRMode()) {
        document.body.classList.add('horizontal-mode');
    } else if (isHorizontalRTLMode()) {
        document.body.classList.add('horizontal-rtl-mode');
        document.body.classList.add('horizontal-mode'); // Keep base horizontal styles
    }
}

export function setReadingMode(mode) {
    if (Object.values(READING_MODES).includes(mode)) {
        if (currentMode === mode) return; // 无变化
        if (isModeSwitching) return; // 防止快速连按导致重叠切换

        isModeSwitching = true;
        currentMode = mode;

        // 快速路径：复用已有数据，跳过 Eagle API 调用
        // 注意：不在这里直接调用 applyBodyModeClasses，交由 reloadForModeSwitch 在黑屏后异步执行，防止穿帮。
        reloadForModeSwitch();
    }
}

export function toggleReadingMode() {
    const modes = [READING_MODES.VERTICAL, READING_MODES.HORIZONTAL_LTR, READING_MODES.HORIZONTAL_RTL];
    const currentIndex = modes.indexOf(currentMode);
    const newMode = modes[(currentIndex + 1) % modes.length];

    captureCurrentIndexForModeSwitch();
    setReadingMode(newMode);

    let modeName = '';
    switch (newMode) {
        case READING_MODES.VERTICAL: modeName = i18next.t('mode.vertical'); break;
        case READING_MODES.HORIZONTAL_LTR: modeName = i18next.t('mode.horizontalLTR'); break;
        case READING_MODES.HORIZONTAL_RTL: modeName = i18next.t('mode.horizontalRTL'); break;
    }
    showToast(i18next.t('mode.currentMode', { mode: modeName }), 'info', 1500, 'mode-toast');

    return newMode;
}

export function clearModeSwitchLock() {
    isModeSwitching = false;
}

export function getStandardSizeValue() {
    return isHorizontalMode() ? STANDARD_MANGA_HEIGHT : STANDARD_MANGA_WIDTH;
}
