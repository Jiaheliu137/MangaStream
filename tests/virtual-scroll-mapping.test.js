/**
 * 虚拟坐标映射 + 滚动条逻辑 — 纯数学测试
 * 运行: node tests/virtual-scroll-mapping.test.js
 *
 * 测试三层映射：
 * 1. 均匀压缩（全 spacer 状态，renderedRange={-1,-1}）
 * 2. 分段映射（spacerTop 压缩 | 内容 1:1 | spacerBottom 压缩）
 * 3. 缩放不改变滚动条比例
 */

const MAX_SAFE_SCROLL_UNSCALED = 6_000_000;

// ==================== 被测函数 ====================

function getCompressionRatio(totalSize) {
    if (totalSize <= MAX_SAFE_SCROLL_UNSCALED) return 1;
    return MAX_SAFE_SCROLL_UNSCALED / totalSize;
}

// 模拟 sizePrefixSum
function buildPrefixSum(count, avgSize) {
    const arr = new Array(count + 1);
    arr[0] = 0;
    for (let i = 0; i < count; i++) {
        arr[i + 1] = arr[i] + avgSize;
    }
    return arr;
}

function getOffsetForIndex(prefixSum, index) {
    return prefixSum[index] || 0;
}

/** 分段 physicalToLogical（与 imageLoader.js 同构） */
function physicalToLogicalRaw(scrollPos, zoom, totalSize, prefixSum, rangeStart, rangeEnd) {
    const ratio = getCompressionRatio(totalSize);
    if (ratio >= 1) return scrollPos / zoom;
    if (rangeStart === -1) return scrollPos / zoom / ratio;

    const contentStartLogical = getOffsetForIndex(prefixSum, rangeStart);
    const contentEndLogical = getOffsetForIndex(prefixSum, rangeEnd);
    const spacerTopPhysical = contentStartLogical * ratio * zoom;
    const contentEndPhysical = spacerTopPhysical + (contentEndLogical - contentStartLogical) * zoom;

    if (scrollPos <= spacerTopPhysical) {
        return scrollPos / zoom / ratio;
    } else if (scrollPos <= contentEndPhysical) {
        return contentStartLogical + (scrollPos - spacerTopPhysical) / zoom;
    } else {
        return contentEndLogical + (scrollPos - contentEndPhysical) / zoom / ratio;
    }
}

/** 分段 logicalToPhysical（与 imageLoader.js 同构） */
function logicalToPhysicalRaw(logicalOffset, zoom, totalSize, prefixSum, rangeStart, rangeEnd) {
    const ratio = getCompressionRatio(totalSize);
    if (ratio >= 1) return logicalOffset * zoom;
    if (rangeStart === -1) return logicalOffset * ratio * zoom;

    const contentStartLogical = getOffsetForIndex(prefixSum, rangeStart);
    const contentEndLogical = getOffsetForIndex(prefixSum, rangeEnd);

    if (logicalOffset <= contentStartLogical) {
        return logicalOffset * ratio * zoom;
    } else if (logicalOffset <= contentEndLogical) {
        return (contentStartLogical * ratio + (logicalOffset - contentStartLogical)) * zoom;
    } else {
        return (contentStartLogical * ratio + (contentEndLogical - contentStartLogical) + (logicalOffset - contentEndLogical) * ratio) * zoom;
    }
}

/** 滚动条位置比例（分段版） */
function scrollbarRatio(scrollPos, zoom, totalSize, viewportSize, prefixSum, rangeStart, rangeEnd) {
    const logicalPos = physicalToLogicalRaw(scrollPos, zoom, totalSize, prefixSum, rangeStart, rangeEnd);
    const logicalViewport = viewportSize / zoom;
    const maxLogical = totalSize - logicalViewport;
    if (maxLogical <= 0) return 0;
    return Math.max(0, Math.min(1, logicalPos / maxLogical));
}

// ==================== 测试工具 ====================

let passed = 0, failed = 0;

function assert(condition, msg) {
    if (condition) { passed++; } else { failed++; console.error(`  FAIL: ${msg}`); }
}

function assertApprox(actual, expected, tolerance, msg) {
    const ok = Math.abs(actual - expected) <= tolerance;
    if (ok) { passed++; } else { failed++; console.error(`  FAIL: ${msg} — expected ~${expected}, got ${actual}`); }
}

function describe(name, fn) { console.log(`\n${name}`); fn(); }
function it(name, fn) { try { fn(); } catch (e) { failed++; console.error(`  FAIL: ${name} — ${e.message}`); } }

// ==================== 测试参数 ====================

const ITEM_COUNT = 100000;
const AVG_SIZE = 1200;
const TOTAL_SIZE = ITEM_COUNT * AVG_SIZE; // 120,000,000
const RATIO = getCompressionRatio(TOTAL_SIZE); // 0.05
const PREFIX_SUM = buildPrefixSum(ITEM_COUNT, AVG_SIZE);
const VIEWPORT_SIZE = 800;

// ==================== 测试用例 ====================

describe('getCompressionRatio', () => {
    it('returns 1 for small datasets', () => {
        assert(getCompressionRatio(5_000_000) === 1, 'totalSize=5M should be ratio=1');
        assert(getCompressionRatio(6_000_000) === 1, 'totalSize=6M should be ratio=1');
    });

    it('compresses large datasets', () => {
        assertApprox(RATIO, 0.05, 0.0001, 'totalSize=120M → ratio=0.05');
        assert(RATIO < 1, 'ratio should be < 1');
    });
});

describe('Uniform mapping (renderedRange={-1,-1})', () => {
    it('roundtrips correctly', () => {
        const logical = 60_000_000;
        const physical = logicalToPhysicalRaw(logical, 1.0, TOTAL_SIZE, PREFIX_SUM, -1, -1);
        assertApprox(physical, logical * RATIO, 0.01, 'uniform logicalToPhysical');
        const back = physicalToLogicalRaw(physical, 1.0, TOTAL_SIZE, PREFIX_SUM, -1, -1);
        assertApprox(back, logical, 0.01, 'uniform roundtrip');
    });

    it('physical total under MAX_SAFE', () => {
        const physical = logicalToPhysicalRaw(TOTAL_SIZE, 1.0, TOTAL_SIZE, PREFIX_SUM, -1, -1);
        assert(physical <= MAX_SAFE_SCROLL_UNSCALED, `physical=${physical} should be <= ${MAX_SAFE_SCROLL_UNSCALED}`);
    });
});

describe('Piecewise mapping continuity', () => {
    const rangeStart = 49980;
    const rangeEnd = 50020;
    const contentStartLogical = getOffsetForIndex(PREFIX_SUM, rangeStart);
    const contentEndLogical = getOffsetForIndex(PREFIX_SUM, rangeEnd);

    it('continuous at spacerTop/content boundary', () => {
        const zoom = 1.0;
        // Approach boundary from spacer side
        const boundary = contentStartLogical * RATIO * zoom;
        const fromSpacer = physicalToLogicalRaw(boundary - 0.01, zoom, TOTAL_SIZE, PREFIX_SUM, rangeStart, rangeEnd);
        const fromContent = physicalToLogicalRaw(boundary + 0.01, zoom, TOTAL_SIZE, PREFIX_SUM, rangeStart, rangeEnd);
        assertApprox(fromSpacer, contentStartLogical, 1, 'spacer side of boundary');
        assertApprox(fromContent, contentStartLogical, 1, 'content side of boundary');
    });

    it('continuous at content/spacerBottom boundary', () => {
        const zoom = 1.0;
        const spacerTopPhysical = contentStartLogical * RATIO * zoom;
        const boundary = spacerTopPhysical + (contentEndLogical - contentStartLogical) * zoom;
        const fromContent = physicalToLogicalRaw(boundary - 0.01, zoom, TOTAL_SIZE, PREFIX_SUM, rangeStart, rangeEnd);
        const fromSpacer = physicalToLogicalRaw(boundary + 0.01, zoom, TOTAL_SIZE, PREFIX_SUM, rangeStart, rangeEnd);
        assertApprox(fromContent, contentEndLogical, 1, 'content side of bottom boundary');
        assertApprox(fromSpacer, contentEndLogical, 1, 'spacerBottom side of bottom boundary');
    });
});

describe('Piecewise roundtrip', () => {
    const rangeStart = 49980;
    const rangeEnd = 50020;

    it('roundtrips in spacerTop region', () => {
        const logical = 10000 * AVG_SIZE; // index 10000, far before content
        const physical = logicalToPhysicalRaw(logical, 1.0, TOTAL_SIZE, PREFIX_SUM, rangeStart, rangeEnd);
        const back = physicalToLogicalRaw(physical, 1.0, TOTAL_SIZE, PREFIX_SUM, rangeStart, rangeEnd);
        assertApprox(back, logical, 0.01, 'spacerTop roundtrip');
    });

    it('roundtrips in content region', () => {
        const logical = 50000 * AVG_SIZE; // index 50000, inside content
        const physical = logicalToPhysicalRaw(logical, 1.0, TOTAL_SIZE, PREFIX_SUM, rangeStart, rangeEnd);
        const back = physicalToLogicalRaw(physical, 1.0, TOTAL_SIZE, PREFIX_SUM, rangeStart, rangeEnd);
        assertApprox(back, logical, 0.01, 'content region roundtrip');
    });

    it('roundtrips in spacerBottom region', () => {
        const logical = 90000 * AVG_SIZE; // index 90000, far after content
        const physical = logicalToPhysicalRaw(logical, 1.0, TOTAL_SIZE, PREFIX_SUM, rangeStart, rangeEnd);
        const back = physicalToLogicalRaw(physical, 1.0, TOTAL_SIZE, PREFIX_SUM, rangeStart, rangeEnd);
        assertApprox(back, logical, 0.01, 'spacerBottom roundtrip');
    });

    it('roundtrips with zoom=3', () => {
        const logical = 50000 * AVG_SIZE;
        const physical = logicalToPhysicalRaw(logical, 3.0, TOTAL_SIZE, PREFIX_SUM, rangeStart, rangeEnd);
        const back = physicalToLogicalRaw(physical, 3.0, TOTAL_SIZE, PREFIX_SUM, rangeStart, rangeEnd);
        assertApprox(back, logical, 0.01, 'content region roundtrip zoom=3');
    });
});

describe('Piecewise vs uniform: content region divergence', () => {
    const rangeStart = 49980;
    const rangeEnd = 50020;

    it('uniform formula gives WRONG result in content region', () => {
        const zoom = 1.0;
        const logical = 50000 * AVG_SIZE; // 60,000,000
        const physical = logicalToPhysicalRaw(logical, zoom, TOTAL_SIZE, PREFIX_SUM, rangeStart, rangeEnd);

        // Uniform decode (the OLD bug):
        const uniformLogical = physical / zoom / RATIO;
        // Piecewise decode (correct):
        const piecewiseLogical = physicalToLogicalRaw(physical, zoom, TOTAL_SIZE, PREFIX_SUM, rangeStart, rangeEnd);

        // Uniform should be WRONG (20x overshoot in content region)
        const uniformError = Math.abs(uniformLogical - logical);
        const piecewiseError = Math.abs(piecewiseLogical - logical);

        assert(uniformError > 100000, `uniform error ${uniformError} should be large (was the bug)`);
        assert(piecewiseError < 1, `piecewise error ${piecewiseError} should be < 1`);
    });
});

describe('jumpToPage accuracy (piecewise)', () => {
    it('page 50000 maps exactly with piecewise formula', () => {
        const zoom = 1.0;
        const index = 49999; // 0-based for page 50000
        const targetOffset = getOffsetForIndex(PREFIX_SUM, index);
        const pageSize = AVG_SIZE;
        const unscaledCenter = targetOffset + pageSize / 2;
        const clientSize = 800;

        // Simulate jumpToPage: after renderVisibleItems, range is set
        const rangeStart = index - 15; // RENDER_BUFFER
        const rangeEnd = Math.min(ITEM_COUNT, index + 16);

        // Exact physical position using piecewise
        const exactPhysical = logicalToPhysicalRaw(unscaledCenter, zoom, TOTAL_SIZE, PREFIX_SUM, rangeStart, rangeEnd) - clientSize / 2;

        // Recover the page from the exact position
        const recoveredCenter = physicalToLogicalRaw(exactPhysical + clientSize / 2, zoom, TOTAL_SIZE, PREFIX_SUM, rangeStart, rangeEnd);
        const recoveredPage = Math.floor(recoveredCenter / AVG_SIZE);
        assertApprox(recoveredPage, index, 0, `page 50000: recovered page should be exactly ${index}, got ${recoveredPage}`);
    });

    it('page 99999 maps exactly', () => {
        const zoom = 1.0;
        const index = 99998;
        const targetOffset = getOffsetForIndex(PREFIX_SUM, index);
        const pageSize = AVG_SIZE;
        const unscaledCenter = targetOffset + pageSize / 2;
        const clientSize = 800;

        const rangeStart = Math.max(0, index - 15);
        const rangeEnd = Math.min(ITEM_COUNT, index + 16);

        const exactPhysical = logicalToPhysicalRaw(unscaledCenter, zoom, TOTAL_SIZE, PREFIX_SUM, rangeStart, rangeEnd) - clientSize / 2;
        const recoveredCenter = physicalToLogicalRaw(exactPhysical + clientSize / 2, zoom, TOTAL_SIZE, PREFIX_SUM, rangeStart, rangeEnd);
        const recoveredPage = Math.floor(recoveredCenter / AVG_SIZE);
        assertApprox(recoveredPage, index, 0, `page 99999: recovered ${recoveredPage}`);
    });
});

describe('Zoom invariance: scrollbar ratio stays constant', () => {
    const rangeStart = 49980;
    const rangeEnd = 50020;

    it('scrollbar ratio unchanged across zoom levels (piecewise)', () => {
        const logicalPos = 50000 * AVG_SIZE;

        // At zoom 1x
        const sp1 = logicalToPhysicalRaw(logicalPos, 1.0, TOTAL_SIZE, PREFIX_SUM, rangeStart, rangeEnd);
        const r1 = scrollbarRatio(sp1, 1.0, TOTAL_SIZE, VIEWPORT_SIZE, PREFIX_SUM, rangeStart, rangeEnd);

        // At zoom 2x
        const sp2 = logicalToPhysicalRaw(logicalPos, 2.0, TOTAL_SIZE, PREFIX_SUM, rangeStart, rangeEnd);
        const r2 = scrollbarRatio(sp2, 2.0, TOTAL_SIZE, VIEWPORT_SIZE, PREFIX_SUM, rangeStart, rangeEnd);

        // At zoom 5x
        const sp5 = logicalToPhysicalRaw(logicalPos, 5.0, TOTAL_SIZE, PREFIX_SUM, rangeStart, rangeEnd);
        const r5 = scrollbarRatio(sp5, 5.0, TOTAL_SIZE, VIEWPORT_SIZE, PREFIX_SUM, rangeStart, rangeEnd);

        assertApprox(r1, r2, 0.001, `zoom 1x (${r1.toFixed(4)}) vs 2x (${r2.toFixed(4)})`);
        assertApprox(r1, r5, 0.005, `zoom 1x (${r1.toFixed(4)}) vs 5x (${r5.toFixed(4)})`);
    });

    it('scrollbar ratio matches logical position percentage', () => {
        const zoom = 1.0;
        // At 50% position
        const halfLogical = TOTAL_SIZE / 2;
        const sp = logicalToPhysicalRaw(halfLogical, zoom, TOTAL_SIZE, PREFIX_SUM, rangeStart, rangeEnd);
        const r = scrollbarRatio(sp, zoom, TOTAL_SIZE, VIEWPORT_SIZE, PREFIX_SUM, rangeStart, rangeEnd);
        assertApprox(r, 0.5, 0.01, `50% position → ratio ${r.toFixed(4)}`);
    });
});

describe('Scroll position adjustment simulation', () => {
    it('adjustment preserves logical position across range change', () => {
        const zoom = 1.0;
        // Old range: items 100-150
        const oldStart = 100, oldEnd = 150;
        // scrollPos in content region of old range
        const logical = 120 * AVG_SIZE; // item 120, inside old range
        const scrollPos = logicalToPhysicalRaw(logical, zoom, TOTAL_SIZE, PREFIX_SUM, oldStart, oldEnd);

        // New range: items 110-160 (scrolled down a bit)
        const newStart = 110, newEnd = 160;
        const logicalBefore = physicalToLogicalRaw(scrollPos, zoom, TOTAL_SIZE, PREFIX_SUM, oldStart, oldEnd);
        const physicalAfter = logicalToPhysicalRaw(logicalBefore, zoom, TOTAL_SIZE, PREFIX_SUM, newStart, newEnd);
        const adjustment = physicalAfter - scrollPos;
        const adjustedScrollPos = scrollPos + adjustment;

        // Verify adjusted position maps to same logical position
        const logicalAfterAdjust = physicalToLogicalRaw(adjustedScrollPos, zoom, TOTAL_SIZE, PREFIX_SUM, newStart, newEnd);
        assertApprox(logicalAfterAdjust, logical, 0.01, `adjustment preserved logical pos: ${logicalAfterAdjust} vs ${logical}`);
    });
});

// ==================== 结果 ====================

console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
    console.log('SOME TESTS FAILED');
    process.exit(1);
} else {
    console.log('ALL TESTS PASSED');
    process.exit(0);
}
