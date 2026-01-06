// PDF导出功能模块 - 每张图片独立页面，统一宽度，无留白
import { getCurrentImages } from './imageLoader.js';
import { STANDARD_MANGA_WIDTH } from './constants.js';

// 显示导出进度
function showExportProgress(current, total, message = '正在导出PDF...') {
    let progressIndicator = document.getElementById('export-progress-indicator');

    if (!progressIndicator) {
        progressIndicator = document.createElement('div');
        progressIndicator.id = 'export-progress-indicator';
        progressIndicator.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 30px 50px;
            border-radius: 10px;
            z-index: 10000;
            font-size: 18px;
            text-align: center;
            min-width: 300px;
        `;
        document.body.appendChild(progressIndicator);
    }

    const percentage = Math.round((current / total) * 100);
    progressIndicator.innerHTML = `
        <div style="margin-bottom: 15px;">${message}</div>
        <div style="font-size: 24px; font-weight: bold;">${percentage}%</div>
        <div style="margin-top: 10px; font-size: 14px; color: #aaa;">${current} / ${total}</div>
        <div style="margin-top: 15px; width: 100%; height: 8px; background-color: #333; border-radius: 4px; overflow: hidden;">
            <div style="width: ${percentage}%; height: 100%; background-color: #4CAF50; transition: width 0.3s;"></div>
        </div>
    `;
}

// 隐藏导出进度
function hideExportProgress() {
    const progressIndicator = document.getElementById('export-progress-indicator');
    if (progressIndicator) {
        progressIndicator.remove();
    }
}

// 显示错误消息
function showErrorMessage(message) {
    const errorBox = document.createElement('div');
    errorBox.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: rgba(244, 67, 54, 0.95);
        color: white;
        padding: 15px 30px;
        border-radius: 5px;
        z-index: 10001;
        font-size: 16px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    `;
    errorBox.textContent = message;
    document.body.appendChild(errorBox);

    setTimeout(() => {
        errorBox.remove();
    }, 3000);
}

// 显示成功消息
function showSuccessMessage(message) {
    const successBox = document.createElement('div');
    successBox.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: rgba(76, 175, 80, 0.95);
        color: white;
        padding: 15px 30px;
        border-radius: 5px;
        z-index: 10001;
        font-size: 16px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    `;
    successBox.textContent = message;
    document.body.appendChild(successBox);

    setTimeout(() => {
        successBox.remove();
    }, 3000);
}

// 加载图片并缩放到统一宽度
async function loadAndResizeImage(imagePath, targetWidth) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';

        img.onload = () => {
            // 计算缩放比例
            const scale = targetWidth / img.width;
            const scaledHeight = img.height * scale;

            // 创建canvas，使用缩放后的尺寸
            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = scaledHeight;

            const ctx = canvas.getContext('2d');
            // 将图片绘制到canvas上，自动缩放
            ctx.drawImage(img, 0, 0, targetWidth, scaledHeight);

            try {
                const base64 = canvas.toDataURL('image/jpeg', 0.95);
                resolve({
                    base64,
                    width: targetWidth,
                    height: scaledHeight
                });
            } catch (err) {
                reject(err);
            }
        };

        img.onerror = () => {
            reject(new Error(`无法加载图片: ${imagePath}`));
        };

        img.src = `file://${imagePath}`;
    });
}

// 导出PDF
async function exportToPDF(images) {
    try {
        // 动态加载jsPDF库
        if (typeof window.jspdf === 'undefined') {
            showExportProgress(0, images.length, '正在加载PDF库...');

            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';

            await new Promise((resolve, reject) => {
                script.onload = resolve;
                script.onerror = () => reject(new Error('无法加载PDF库'));
                document.head.appendChild(script);
            });

            await new Promise(resolve => setTimeout(resolve, 500));
        }

        const { jsPDF } = window.jspdf;

        showExportProgress(0, images.length, '正在处理图片...');

        // 统一宽度（与插件一致）
        const targetWidth = STANDARD_MANGA_WIDTH; // 800px

        // 预加载并缩放所有图片到统一宽度
        const processedImages = [];
        for (let i = 0; i < images.length; i++) {
            const item = images[i];
            const imagePath = item.filePath || item.path ||
                (item.url && item.url.startsWith('file://') ? item.url.replace('file://', '') : '');

            if (!imagePath) continue;

            try {
                showExportProgress(i + 1, images.length, '正在处理图片...');
                // 加载并缩放图片到统一宽度
                const imgData = await loadAndResizeImage(imagePath, targetWidth);
                processedImages.push(imgData);
            } catch (err) {
                console.error(`处理图片失败 (${i + 1}/${images.length}):`, err);
            }
        }

        if (processedImages.length === 0) {
            throw new Error('没有成功处理的图片');
        }

        showExportProgress(0, processedImages.length, '正在生成PDF...');

        // 像素转毫米的转换比例
        // 使用96 DPI（更常见的屏幕DPI）
        const pxToMm = 25.4 / 96;

        // 创建第一个PDF页面
        const firstImg = processedImages[0];
        const firstWidthMM = firstImg.width * pxToMm;
        const firstHeightMM = firstImg.height * pxToMm;

        let pdf = new jsPDF({
            orientation: firstWidthMM > firstHeightMM ? 'landscape' : 'portrait',
            unit: 'mm',
            format: [firstWidthMM, firstHeightMM]
        });

        // 添加第一张图片
        pdf.addImage(
            firstImg.base64,
            'JPEG',
            0,
            0,
            firstWidthMM,
            firstHeightMM,
            undefined,
            'FAST'
        );

        showExportProgress(1, processedImages.length, '正在生成PDF...');

        // 添加剩余的图片
        for (let i = 1; i < processedImages.length; i++) {
            showExportProgress(i + 1, processedImages.length, '正在生成PDF...');

            const imgData = processedImages[i];
            const widthMM = imgData.width * pxToMm;
            const heightMM = imgData.height * pxToMm;

            // 添加新页面，页面尺寸等于图片尺寸
            pdf.addPage(
                [widthMM, heightMM],
                widthMM > heightMM ? 'landscape' : 'portrait'
            );

            // 添加图片，填满整个页面
            pdf.addImage(
                imgData.base64,
                'JPEG',
                0,
                0,
                widthMM,
                heightMM,
                undefined,
                'FAST'
            );
        }

        hideExportProgress();

        // 生成文件名
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `manga_${timestamp}.pdf`;

        // 保存PDF
        pdf.save(filename);

        showSuccessMessage(`PDF导出成功！共 ${processedImages.length} 张图片`);

    } catch (err) {
        hideExportProgress();
        console.error('导出PDF失败:', err);
        showErrorMessage('导出PDF失败: ' + err.message);
    }
}

// 导出为PDF的主函数
export async function exportCurrentImagesToPDF() {
    const images = getCurrentImages();

    if (!images || images.length === 0) {
        showErrorMessage('没有可导出的图片');
        return;
    }

    // 确认导出
    const confirmed = confirm(`确定要将当前 ${images.length} 张图片导出为PDF吗？\n\n所有图片将统一宽度为800px，高度按比例缩放。\n每张图片独立成页，无留白。\n\n这可能需要一些时间，请耐心等待。`);

    if (!confirmed) {
        return;
    }

    await exportToPDF(images);
}

// 初始化PDF导出按钮
export function initPDFExportButton() {
    // 创建导出按钮
    const exportButton = document.createElement('div');
    exportButton.id = 'export-pdf-button';
    exportButton.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
            <path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2z"/>
            <path d="M13 12.67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z"/>
        </svg>
    `;
    exportButton.title = '导出为PDF';
    exportButton.style.cssText = `
        position: fixed;
        right: 20px;
        bottom: 70px;
        width: 40px;
        height: 40px;
        background-color: rgba(30, 30, 30, 0.3);
        border-radius: 50%;
        display: flex;
        justify-content: center;
        align-items: center;
        cursor: pointer;
        z-index: 1000;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
        transition: all 0.2s ease;
        opacity: 0.5;
    `;

    // 悬停效果
    exportButton.addEventListener('mouseenter', () => {
        exportButton.style.backgroundColor = 'rgba(50, 50, 50, 0.9)';
        exportButton.style.transform = 'scale(1.05)';
        exportButton.style.opacity = '1';
    });

    exportButton.addEventListener('mouseleave', () => {
        exportButton.style.backgroundColor = 'rgba(30, 30, 30, 0.3)';
        exportButton.style.transform = 'scale(1)';
        exportButton.style.opacity = '0.5';
    });

    exportButton.addEventListener('mousedown', () => {
        exportButton.style.transform = 'scale(0.95)';
    });

    exportButton.addEventListener('mouseup', () => {
        exportButton.style.transform = 'scale(1.05)';
    });

    // 点击事件
    exportButton.addEventListener('click', exportCurrentImagesToPDF);

    document.body.appendChild(exportButton);
}
