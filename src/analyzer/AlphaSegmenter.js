/**
 * AlphaSegmenter
 * 基於圖片 Alpha 通道進行前景與背景分割
 */
export class AlphaSegmenter {
    /**
     * 檢測圖片是否具備透明 Alpha 通道
     * @param {Uint8ClampedArray} data 
     * @param {number} width 
     * @param {number} height 
     * @returns {boolean}
     */
    static hasAlphaChannel(data, width, height) {
        const totalPixels = width * height;
        const step = Math.max(1, Math.floor(totalPixels / 5000));
        for (let i = 3; i < data.length; i += step * 4) {
            if (data[i] < 240) {
                return true;
            }
        }
        return false;
    }

    /**
     * 根據 Alpha 門檻產生二值化前景遮罩 (1: 前景, 0: 背景)
     * @param {ImageData} imageData 
     * @param {number} alphaThreshold (0 - 255)
     * @returns {{hasAlpha: boolean, mask: Uint8Array, fgCount: number}}
     */
    static segment(imageData, alphaThreshold = 15) {
        const { width, height, data } = imageData;
        const totalPixels = width * height;
        const mask = new Uint8Array(totalPixels);
        let fgCount = 0;

        const hasAlpha = this.hasAlphaChannel(data, width, height);

        for (let i = 0; i < totalPixels; i++) {
            const a = data[i * 4 + 3];
            if (a > alphaThreshold) {
                mask[i] = 1;
                fgCount++;
            } else {
                mask[i] = 0;
            }
        }

        return {
            hasAlpha,
            mask,
            fgCount
        };
    }
}
