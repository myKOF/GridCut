/**
 * BackgroundSegmenter
 * 用於無透明通道或自訂背景圖集之色彩分析與前景分割
 */
export class BackgroundSegmenter {
    /**
     * 自動採樣邊緣取得背景代表色 (RGB)
     * @param {Uint8ClampedArray} data 
     * @param {number} width 
     * @param {number} height 
     * @returns {{r: number, g: number, b: number}}
     */
    static detectBackgroundColor(data, width, height) {
        let rSum = 0, gSum = 0, bSum = 0, count = 0;
        
        // 採樣四個角與邊界 10px 區域
        const sampleStep = Math.max(1, Math.floor(Math.min(width, height) / 80));
        
        // 上下邊緣
        for (let x = 0; x < width; x += sampleStep) {
            // 頂部
            let idx = x * 4;
            rSum += data[idx]; gSum += data[idx + 1]; bSum += data[idx + 2]; count++;
            // 底部
            idx = ((height - 1) * width + x) * 4;
            rSum += data[idx]; gSum += data[idx + 1]; bSum += data[idx + 2]; count++;
        }
        
        // 左右邊緣
        for (let y = 0; y < height; y += sampleStep) {
            // 左側
            let idx = (y * width) * 4;
            rSum += data[idx]; gSum += data[idx + 1]; bSum += data[idx + 2]; count++;
            // 右側
            idx = (y * width + (width - 1)) * 4;
            rSum += data[idx]; gSum += data[idx + 1]; bSum += data[idx + 2]; count++;
        }

        return {
            r: Math.round(rSum / Math.max(1, count)),
            g: Math.round(gSum / Math.max(1, count)),
            b: Math.round(bSum / Math.max(1, count))
        };
    }

    /**
     * 根據背景特徵與容差建立前景遮罩
     * @param {ImageData} imageData 
     * @param {Object} options
     * @param {string} options.bgType 'auto' | 'dark' | 'light' | 'custom'
     * @param {number} options.bgTolerance (5 - 100)
     * @param {{r: number, g: number, b: number}} [options.customBgColor]
     * @returns {{mask: Uint8Array, bgColor: {r: number, g: number, b: number}, fgCount: number, bounds: {minX: number, minY: number, maxX: number, maxY: number}}}
     */
    static segment(imageData, options = {}) {
        const { width, height, data } = imageData;
        const {
            bgType = 'auto',
            bgTolerance = 28,
            customBgColor = null
        } = options;

        const totalPixels = width * height;
        const mask = new Uint8Array(totalPixels);
        let fgCount = 0;

        const detectedBg = this.detectBackgroundColor(data, width, height);
        const bg = customBgColor || detectedBg;
        const bgBright = (bg.r + bg.g + bg.b) / 3;

        let minX = width, minY = height, maxX = 0, maxY = 0;

        for (let y = 0; y < height; y++) {
            const rowOffset = y * width;
            for (let x = 0; x < width; x++) {
                const idx = (rowOffset + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                const a = data[idx + 3];

                // 若包含透明像素，透明度低於 128 直接判定為背景
                if (a < 128) {
                    mask[rowOffset + x] = 0;
                    continue;
                }

                const dist = Math.abs(r - bg.r) + Math.abs(g - bg.g) + Math.abs(b - bg.b);
                const maxCh = Math.max(r, g, b);
                let isForeground = false;

                if (bgType === 'dark') {
                    isForeground = (maxCh > bgTolerance + 20) && (dist > bgTolerance * 1.4);
                } else if (bgType === 'light') {
                    const minCh = Math.min(r, g, b);
                    isForeground = (minCh < 255 - bgTolerance - 20) && (dist > bgTolerance * 1.4);
                } else {
                    if (bgBright < 75) {
                        isForeground = (maxCh > bgTolerance + 20) && (dist > bgTolerance * 1.4);
                    } else if (bgBright > 180) {
                        const minCh = Math.min(r, g, b);
                        isForeground = (minCh < 255 - bgTolerance - 20) && (dist > bgTolerance * 1.4);
                    } else {
                        isForeground = dist > (bgTolerance * 2.0);
                    }
                }

                if (isForeground) {
                    mask[rowOffset + x] = 1;
                    fgCount++;
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                } else {
                    mask[rowOffset + x] = 0;
                }
            }
        }

        if (maxX < minX) {
            minX = 0; maxX = width - 1; minY = 0; maxY = height - 1;
        }

        return {
            mask,
            bgColor: bg,
            fgCount,
            bounds: { minX, minY, maxX, maxY }
        };
    }
}
