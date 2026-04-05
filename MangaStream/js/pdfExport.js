// PDF导出功能模块 - 每张图片独立页面，统一宽度，无留白
import { getCurrentImages, getImagePath } from './imageLoader.js';
import { STANDARD_MANGA_WIDTH, PDFConfig } from './constants.js';
import { showExportProgress, hideExportProgress } from './ui.js';
import { showToast } from './utils.js';

// 加载图片并缩放到统一宽度
async function loadAndResizeImage(imagePath, targetWidth) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';

        img.onload = () => {
            const scale = targetWidth / img.width;
            const scaledHeight = img.height * scale;

            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = scaledHeight;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, targetWidth, scaledHeight);

            try {
                const base64 = canvas.toDataURL('image/jpeg', PDFConfig.JPEG_QUALITY);
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
            reject(new Error(`${i18next.t('image.loadError')}: ${imagePath}`));
        };

        img.src = `file://${imagePath}`;
    });
}

// 确保 jsPDF 库已加载
async function ensureJsPDFLoaded() {
    if (typeof window.jspdf !== 'undefined') return;

    // 优先尝试从本地加载
    const localPath = './js/vendor/jspdf.umd.min.js';
    const cdnPath = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';

    const script = document.createElement('script');

    await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = () => {
            // 本地加载失败，尝试CDN
            console.warn('本地jsPDF加载失败，尝试从CDN加载...');
            const cdnScript = document.createElement('script');
            cdnScript.src = cdnPath;
            cdnScript.onload = resolve;
            cdnScript.onerror = () => reject(new Error('无法加载PDF库（本地和CDN均失败）'));
            document.head.appendChild(cdnScript);
        };
        script.src = localPath;
        document.head.appendChild(script);
    });

    // 等待库初始化
    await new Promise(resolve => setTimeout(resolve, 200));
}

// 导出PDF - 流式处理，逐张添加图片后释放内存 (#12)
async function exportToPDF(images) {
    try {
        showExportProgress(0, images.length, i18next.t('pdf.loading'));
        await ensureJsPDFLoaded();

        const { jsPDF } = window.jspdf;
        const targetWidth = STANDARD_MANGA_WIDTH;
        const pxToMm = 25.4 / 96;

        showExportProgress(0, images.length, i18next.t('pdf.processing'));

        // 流式处理：逐张加载、添加到 PDF、释放 (#12)
        let pdf = null;

        for (let i = 0; i < images.length; i++) {
            const item = images[i];
            const imagePath = getImagePath(item); // 使用共享的 getImagePath (#3)

            if (!imagePath) continue;

            try {
                showExportProgress(i + 1, images.length, i18next.t('pdf.processing'));
                const imgData = await loadAndResizeImage(imagePath, targetWidth);

                const widthMM = imgData.width * pxToMm;
                const heightMM = imgData.height * pxToMm;

                if (!pdf) {
                    // 创建第一个PDF页面
                    pdf = new jsPDF({
                        orientation: widthMM > heightMM ? 'landscape' : 'portrait',
                        unit: 'mm',
                        format: [widthMM, heightMM]
                    });
                } else {
                    // 添加新页面
                    pdf.addPage(
                        [widthMM, heightMM],
                        widthMM > heightMM ? 'landscape' : 'portrait'
                    );
                }

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

                // imgData 在此循环结束后自动释放引用
            } catch (err) {
                console.error(`处理图片失败 (${i + 1}/${images.length}):`, err);
            }
        }

        if (!pdf) {
            throw new Error(i18next.t('pdf.noProcessedImages'));
        }

        hideExportProgress();

        // 生成文件名
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `manga_${timestamp}.pdf`;

        pdf.save(filename);
        showToast(i18next.t('pdf.exportSuccess', { count: images.length }), 'success');

    } catch (err) {
        hideExportProgress();
        console.error('PDF export failed:', err);
        showToast(i18next.t('pdf.exportFailed') + err.message, 'error');
    }
}

// 导出为PDF的主函数
export async function exportCurrentImagesToPDF() {
    const images = getCurrentImages();

    if (!images || images.length === 0) {
        showToast(i18next.t('pdf.noImages'), 'error');
        return;
    }

    const confirmed = confirm(i18next.t('pdf.confirmExport', { count: images.length }));

    if (!confirmed) {
        return;
    }

    await exportToPDF(images);
}

// 初始化PDF导出按钮
export function initPDFExportButton() {
    const exportButton = document.createElement('div');
    exportButton.id = 'export-pdf-button';
    exportButton.className = 'action-button'; // 使用统一的按钮样式
    exportButton.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
            <path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2z"/>
            <path d="M13 12.67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z"/>
        </svg>
    `;
    exportButton.setAttribute('data-i18n-title', 'ui.exportPDF');

    exportButton.addEventListener('click', exportCurrentImagesToPDF);

    document.body.appendChild(exportButton);
}
