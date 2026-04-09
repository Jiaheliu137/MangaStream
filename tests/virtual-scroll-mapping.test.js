/**
 * 虚拟坐标映射 + 滚动条逻辑 — 纯数学测试
 * 运行: node tests/virtual-scroll-mapping.test.js
 *
 * 测试两个 bug:
 * 1. 跳转 >26000 页被 Chromium scrollHeight 上限 clamp
 * 2. 缩放改变滚动条位置（应该不变）
 */

const MAX_SAFE_SCROLL_UNSCALED = 6_000_000;

// ==================== 被测函数（从 imageLoader.js 提取的纯逻辑） ====================

function getCompressionRatio(totalSize) {
    if (totalSize <= MAX_SAFE_SCROLL_UNSCALED) return 1;
    return MAX_SAFE_SCROLL_UNSCALED / totalSize;
}

/** scrollTop → 逻辑偏移（解压缩） */
function physicalToLogical(scrollPos, zoom, compressionRatio) {
    return scrollPos / zoom / compressionRatio;
}

/** 逻辑偏移 → scrollTop（压缩） */
function logicalToPhysical(logicalOffset, zoom, compressionRatio) {
    return logicalOffset * compressionRatio * zoom;
}

/** 滚动条位置比例（应与缩放无关） */
function scrollbarRatio(scrollPos, zoom, totalSize, viewportSize) {
    const ratio = getCompressionRatio(totalSize);
    const logicalPos = physicalToLogical(scrollPos, zoom, ratio);
    const logicalViewport = viewportSize / zoom;
    const maxLogical = totalSize - logicalViewport;
    if (maxLogical <= 0) return 0;
    return Math.max(0, Math.min(1, logicalPos / maxLogical));
}

// ==================== 测试工具 ====================

let passed = 0, failed = 0;

function assert(condition, msg) {
    if (condition) {
        passed++;
    } else {
        failed++;
        console.error(`  FAIL: ${msg}`);
    }
}

function assertApprox(actual, expected, tolerance, msg) {
    const ok = Math.abs(actual - expected) <= tolerance;
    if (ok) {
        passed++;
    } else {
        failed++;
        console.error(`  FAIL: ${msg} — expected ~${expected}, got ${actual}`);
    }
}

function describe(name, fn) {
    console.log(`\n${name}`);
    fn();
}

function it(name, fn) {
    try {
        fn();
    } catch (e) {
        failed++;
        console.error(`  FAIL: ${name} — ${e.message}`);
    }
}

// ==================== 测试用例 ====================

describe('getCompressionRatio', () => {
    it('returns 1 for small datasets', () => {
        assert(getCompressionRatio(5_000_000) === 1, 'totalSize=5M should be ratio=1');
        assert(getCompressionRatio(6_000_000) === 1, 'totalSize=6M should be ratio=1');
    });

    it('compresses large datasets', () => {
        const ratio = getCompressionRatio(120_000_000);
        assertApprox(ratio, 6/120, 0.0001, 'totalSize=120M');
        assert(ratio < 1, 'ratio should be < 1 for 120M');
    });

    it('compression keeps physical total under MAX_SAFE', () => {
        const totalSize = 120_000_000;
        const ratio = getCompressionRatio(totalSize);
        const physicalTotal = totalSize * ratio;
        assert(physicalTotal <= MAX_SAFE_SCROLL_UNSCALED, `physicalTotal=${physicalTotal} should be <= ${MAX_SAFE_SCROLL_UNSCALED}`);
    });
});

describe('logicalToPhysical / physicalToLogical roundtrip', () => {
    it('identity when no compression needed', () => {
        const totalSize = 5_000_000;
        const ratio = getCompressionRatio(totalSize);
        const zoom = 1.0;
        const logical = 2_500_000;

        const physical = logicalToPhysical(logical, zoom, ratio);
        const back = physicalToLogical(physical, zoom, ratio);

        assertApprox(physical, logical, 0.01, 'physical should equal logical');
        assertApprox(back, logical, 0.01, 'roundtrip should recover logical');
    });

    it('compresses correctly for large dataset', () => {
        const totalSize = 120_000_000;
        const ratio = getCompressionRatio(totalSize);
        const zoom = 1.0;
        const logical = 60_000_000; // middle of 120M

        const physical = logicalToPhysical(logical, zoom, ratio);
        assert(physical <= MAX_SAFE_SCROLL_UNSCALED, `physical=${physical} should be under MAX_SAFE`);
        assertApprox(physical, 3_000_000, 1, 'middle of 120M maps to 3M');

        const back = physicalToLogical(physical, zoom, ratio);
        assertApprox(back, logical, 0.01, 'roundtrip should recover logical');
    });

    it('works at extreme end of range (page 99999 of 100000)', () => {
        const totalSize = 120_000_000;
        const ratio = getCompressionRatio(totalSize);
        const zoom = 1.0;
        const logical = 119_000_000; // near the end

        const physical = logicalToPhysical(logical, zoom, ratio);
        assert(physical <= MAX_SAFE_SCROLL_UNSCALED, `physical=${physical} should be under MAX_SAFE`);

        const back = physicalToLogical(physical, zoom, ratio);
        assertApprox(back, logical, 0.01, 'roundtrip at extreme end');
    });

    it('respects zoom factor', () => {
        const totalSize = 120_000_000;
        const ratio = getCompressionRatio(totalSize);
        const zoom = 3.0;
        const logical = 60_000_000;

        const physical = logicalToPhysical(logical, zoom, ratio);
        assertApprox(physical, 60_000_000 * ratio * zoom, 0.01, 'physical includes zoom');

        const back = physicalToLogical(physical, zoom, ratio);
        assertApprox(back, logical, 0.01, 'roundtrip with zoom=3');
    });

    it('physical total at max zoom stays under Chromium limit', () => {
        const totalSize = 120_000_000;
        const ratio = getCompressionRatio(totalSize);
        const maxZoom = 5.0;
        const physicalTotal = totalSize * ratio * maxZoom;
        assert(physicalTotal <= 33_554_432, `physicalTotal at 5x zoom = ${physicalTotal} should be < 33554432`);
    });
});

describe('Bug 1: jumpToPage >26000 should reach correct position', () => {
    it('page 50000 of 100000 maps to reachable physical offset', () => {
        const totalSize = 120_000_000;
        const avgPageSize = 1200;
        const ratio = getCompressionRatio(totalSize);
        const zoom = 1.0;
        const targetOffset = 49999 * avgPageSize; // page 50000, 0-based = 49999
        const unscaledCenter = targetOffset + avgPageSize / 2;
        const clientSize = 800; // viewport height

        const centeredOffset = Math.max(0, unscaledCenter * ratio * zoom - clientSize / 2);

        assert(centeredOffset < MAX_SAFE_SCROLL_UNSCALED, `centeredOffset=${centeredOffset} should be < MAX_SAFE`);
        assert(centeredOffset > 0, 'centeredOffset should be positive');

        // Verify we can recover the correct page
        const recoveredLogical = physicalToLogical(centeredOffset + clientSize / 2, zoom, ratio);
        const recoveredPage = Math.floor(recoveredLogical / avgPageSize);
        assertApprox(recoveredPage, 49999, 1, `recovered page should be ~49999, got ${recoveredPage}`);
    });

    it('page 99999 of 100000 maps to reachable physical offset', () => {
        const totalSize = 120_000_000;
        const avgPageSize = 1200;
        const ratio = getCompressionRatio(totalSize);
        const zoom = 1.0;
        const targetOffset = 99998 * avgPageSize;
        const unscaledCenter = targetOffset + avgPageSize / 2;
        const clientSize = 800;

        const centeredOffset = Math.max(0, unscaledCenter * ratio * zoom - clientSize / 2);

        assert(centeredOffset < MAX_SAFE_SCROLL_UNSCALED, `centeredOffset=${centeredOffset} should be < MAX_SAFE`);
    });
});

describe('Bug 2: zoom should NOT change scrollbar position', () => {
    it('scrollbar ratio stays constant across zoom levels', () => {
        const totalSize = 120_000_000;
        const logicalPos = 60_000_000; // at page ~50000
        const viewportSize = 800; // physical viewport height

        // At zoom 1x
        const ratio1 = getCompressionRatio(totalSize);
        const scrollPos1 = logicalToPhysical(logicalPos, 1.0, ratio1);
        const barRatio1 = scrollbarRatio(scrollPos1, 1.0, totalSize, viewportSize);

        // At zoom 2x (scrollPos doubles because of zoom anchor formula)
        const scrollPos2 = logicalToPhysical(logicalPos, 2.0, ratio1);
        const barRatio2 = scrollbarRatio(scrollPos2, 2.0, totalSize, viewportSize);

        // At zoom 5x
        const scrollPos5 = logicalToPhysical(logicalPos, 5.0, ratio1);
        const barRatio5 = scrollbarRatio(scrollPos5, 5.0, totalSize, viewportSize);

        assertApprox(barRatio1, barRatio2, 0.001, `zoom 1x (${barRatio1}) vs 2x (${barRatio2})`);
        assertApprox(barRatio1, barRatio5, 0.001, `zoom 1x (${barRatio1}) vs 5x (${barRatio5})`);
    });

    it('scrollbar ratio matches logical position percentage', () => {
        const totalSize = 120_000_000;
        const viewportSize = 800;
        const zoom = 1.0;
        const ratio = getCompressionRatio(totalSize);

        // At 50% position
        const halfLogical = totalSize / 2;
        const scrollPos = logicalToPhysical(halfLogical, zoom, ratio);
        const barRatio = scrollbarRatio(scrollPos, zoom, totalSize, viewportSize);
        assertApprox(barRatio, 0.5, 0.01, `50% position should give ~0.5 scrollbar ratio, got ${barRatio}`);

        // At 25% position
        const quarterLogical = totalSize / 4;
        const scrollPos25 = logicalToPhysical(quarterLogical, zoom, ratio);
        const barRatio25 = scrollbarRatio(scrollPos25, zoom, totalSize, viewportSize);
        assertApprox(barRatio25, 0.25, 0.01, `25% position should give ~0.25 scrollbar ratio, got ${barRatio25}`);
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
