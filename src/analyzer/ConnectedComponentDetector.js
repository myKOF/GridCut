/**
 * ConnectedComponentDetector
 * 執行 8-connected Connected Component Labeling (CCL)
 * 找出所有前景連通區域並計算特徵 (x, y, width, height, pixelCount, centerX, centerY)
 */
export class ConnectedComponentDetector {
    /**
     * @param {Uint8Array} mask 1 表示前景, 0 表示背景
     * @param {number} width 遮罩寬度
     * @param {number} height 遮罩高度
     * @param {Object} options
     * @param {number} [options.minPixelCount=4] 忽略過小的噪點
     * @returns {Array<{id: number, x: number, y: number, width: number, height: number, pixelCount: number, centerX: number, centerY: number}>}
     */
    static findComponents(mask, width, height, options = {}) {
        const minPixelCount = options.minPixelCount || 4;
        const totalPixels = width * height;
        const visited = new Uint8Array(totalPixels);
        const queue = new Int32Array(totalPixels);
        const components = [];
        let nextId = 1;

        // 8-鄰域偏移量 (dx, dy)
        const neighborOffsets = [
            -1, -width - 1, -width, -width + 1,
            1, width + 1, width, width - 1
        ];

        for (let y = 0; y < height; y++) {
            const rowOffset = y * width;
            for (let x = 0; x < width; x++) {
                const idx = rowOffset + x;
                if (mask[idx] === 0 || visited[idx] === 1) continue;

                // 啟動 8-連通 BFS
                let head = 0;
                let tail = 0;
                queue[tail++] = idx;
                visited[idx] = 1;

                let minX = x, maxX = x;
                let minY = y, maxY = y;
                let sumX = 0, sumY = 0;
                let pixelCount = 0;

                while (head < tail) {
                    const curr = queue[head++];
                    const px = curr % width;
                    const py = (curr / width) | 0;

                    if (px < minX) minX = px;
                    if (px > maxX) maxX = px;
                    if (py < minY) minY = py;
                    if (py > maxY) maxY = py;

                    sumX += px;
                    sumY += py;
                    pixelCount++;

                    // 檢查 8 鄰域
                    for (let dy = -1; dy <= 1; dy++) {
                        const ny = py + dy;
                        if (ny < 0 || ny >= height) continue;
                        const nRow = ny * width;

                        for (let dx = -1; dx <= 1; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            const nx = px + dx;
                            if (nx < 0 || nx >= width) continue;

                            const nIdx = nRow + nx;
                            if (mask[nIdx] === 1 && visited[nIdx] === 0) {
                                visited[nIdx] = 1;
                                queue[tail++] = nIdx;
                            }
                        }
                    }
                }

                if (pixelCount >= minPixelCount) {
                    const compW = maxX - minX + 1;
                    const compH = maxY - minY + 1;

                    components.push({
                        id: nextId++,
                        x: minX,
                        y: minY,
                        width: compW,
                        height: compH,
                        pixelCount,
                        centerX: sumX / pixelCount,
                        centerY: sumY / pixelCount
                    });
                }
            }
        }

        return components;
    }
}
