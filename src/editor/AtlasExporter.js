/**
 * AtlasExporter
 * 專責圖集切圖與多種格式匯出：
 * 1. Export Selected PNG (單張匯出選中 Sprite)
 * 2. Export All PNG (批量匯出)
 * 3. Export ZIP (打包全部 PNG 與 atlas.json)
 * 4. Export atlas.json
 * 保證完整保留原始 Alpha 通道
 */
export class AtlasExporter {
    /**
     * 從來源圖像裁切單一 Sprite 產生 Canvas
     * @param {HTMLImageElement|HTMLCanvasElement} sourceImg 
     * @param {{x: number, y: number, width: number, height: number}} sprite 
     * @returns {HTMLCanvasElement}
     */
    static cropSpriteCanvas(sourceImg, sprite) {
        const sw = Math.max(1, Math.round(sprite.width));
        const sh = Math.max(1, Math.round(sprite.height));
        const sx = Math.round(sprite.x);
        const sy = Math.round(sprite.y);

        const canvas = document.createElement('canvas');
        canvas.width = sw;
        canvas.height = sh;
        const ctx = canvas.getContext('2d');

        // 保留透明度：clearRect
        ctx.clearRect(0, 0, sw, sh);
        ctx.drawImage(sourceImg, sx, sy, sw, sh, 0, 0, sw, sh);
        return canvas;
    }

    /**
     * 將 Canvas 轉為 Blob
     */
    static canvasToBlob(canvas, format = 'image/png', quality = 0.95) {
        return new Promise((resolve) => {
            canvas.toBlob((blob) => resolve(blob), format, quality);
        });
    }

    /**
     * 下載單一檔案
     */
    static downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * 1. Export Selected PNG
     */
    static async exportSelected(sourceImg, sprite, options = {}) {
        const format = options.format || 'image/png';
        const prefix = options.prefix || 'sprite_';
        const ext = format === 'image/jpeg' ? 'jpg' : (format === 'image/webp' ? 'webp' : 'png');

        const canvas = this.cropSpriteCanvas(sourceImg, sprite);
        const blob = await this.canvasToBlob(canvas, format, 0.95);
        const filename = `${sprite.id || prefix + 'selected'}.${ext}`;
        this.downloadBlob(blob, filename);
    }

    /**
     * 2. 產生 atlas.json 物件
     */
    static generateAtlasJSON(sourceImg, sprites, imageName = 'atlas.png') {
        const width = sourceImg.naturalWidth || sourceImg.width;
        const height = sourceImg.naturalHeight || sourceImg.height;

        return {
            image: imageName,
            size: {
                w: width,
                h: height
            },
            sprites: sprites.map(s => ({
                id: s.id,
                x: Math.round(s.x),
                y: Math.round(s.y),
                width: Math.round(s.width),
                height: Math.round(s.height)
            }))
        };
    }

    /**
     * 3. Export atlas.json 檔案
     */
    static exportJSON(sourceImg, sprites, filename = 'atlas.json', imageName = 'atlas.png') {
        const data = this.generateAtlasJSON(sourceImg, sprites, imageName);
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        this.downloadBlob(blob, filename);
    }

    /**
     * 4. Export ZIP (打包全部 PNG 與 atlas.json)
     * @param {HTMLImageElement|HTMLCanvasElement} sourceImg 
     * @param {Array} sprites 
     * @param {Object} options 
     * @param {Function} [onProgress]
     */
    static async exportZIP(sourceImg, sprites, options = {}, onProgress = null) {
        if (!window.JSZip) {
            throw new Error('JSZip 庫尚未載入');
        }

        const format = options.format || 'image/png';
        const prefix = options.prefix || '';
        const ext = format === 'image/jpeg' ? 'jpg' : (format === 'image/webp' ? 'webp' : 'png');
        const includeJson = options.includeJson !== false;
        const imageName = options.imageName || 'atlas.png';

        const zip = new JSZip();
        const total = sprites.length;

        for (let i = 0; i < total; i++) {
            const s = sprites[i];
            const canvas = this.cropSpriteCanvas(sourceImg, s);
            const blob = await this.canvasToBlob(canvas, format, 0.95);
            const fname = `${s.id || (prefix + String(i + 1).padStart(3, '0'))}.${ext}`;
            zip.file(fname, blob);

            if (onProgress) {
                const percent = Math.round(((i + 1) / (total + 1)) * 100);
                onProgress(i + 1, total, percent);
            }

            if (i % 8 === 0) {
                await new Promise(r => setTimeout(r, 2));
            }
        }

        if (includeJson) {
            const jsonContent = JSON.stringify(this.generateAtlasJSON(sourceImg, sprites, imageName), null, 2);
            zip.file('atlas.json', jsonContent);
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' }, (meta) => {
            if (onProgress) {
                onProgress(total, total, Math.round(meta.percent));
            }
        });

        const zipName = options.zipFilename || `atlas_export_${Date.now()}.zip`;
        this.downloadBlob(zipBlob, zipName);
    }
}
