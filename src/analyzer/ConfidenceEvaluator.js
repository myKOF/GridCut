/**
 * ConfidenceEvaluator
 * 多維度 Sprite 邊界框信心度評估器
 * 依據邊界乾淨度、Gutter 隔離度、填滿密度與形狀常態性進行客觀評分。
 */
export class ConfidenceEvaluator {
    /**
     * 評估單一外接框之信心分數
     * @param {{x: number, y: number, width: number, height: number, pixelCount?: number}} box 
     * @param {Uint8Array} mask 
     * @param {number} imgWidth 
     * @param {number} imgHeight 
     * @returns {{score: number, category: 'high'|'med'|'low', breakdown: {border: number, gutter: number, density: number, shape: number}}}
     */
    static evaluate(box, mask, imgWidth, imgHeight) {
        const bx = Math.round(box.x);
        const by = Math.round(box.y);
        const bw = Math.round(box.width);
        const bh = Math.round(box.height);

        if (bw <= 0 || bh <= 0) {
            return { score: 0.1, category: 'low', breakdown: { border: 0, gutter: 0, density: 0, shape: 0 } };
        }

        // 1. 邊界乾淨度 (Border Cleanliness - 權重 35%)
        // 檢查框體四週外擴 1~2px 範圍是否乾淨，若切斷前景像素則嚴重扣分
        let outerFgCount = 0;
        let outerTotal = 0;
        const margin = 2;

        const checkMinX = Math.max(0, bx - margin);
        const checkMaxX = Math.min(imgWidth - 1, bx + bw + margin - 1);
        const checkMinY = Math.max(0, by - margin);
        const checkMaxY = Math.min(imgHeight - 1, by + bh + margin - 1);

        for (let y = checkMinY; y <= checkMaxY; y++) {
            const rowOffset = y * imgWidth;
            for (let x = checkMinX; x <= checkMaxX; x++) {
                // 排除框體內部，只計算外環 margin
                if (x >= bx && x < bx + bw && y >= by && y < by + bh) continue;

                outerTotal++;
                if (mask[rowOffset + x] === 1) {
                    outerFgCount++;
                }
            }
        }

        const outerPollution = outerTotal > 0 ? (outerFgCount / outerTotal) : 0;
        const borderScore = Math.max(0, 1.0 - (outerPollution * 3.0));

        // 2. 框內實際前景像素密度 (Fill Density - 權重 25%)
        let innerFgCount = 0;
        const innerSampleStep = Math.max(1, Math.floor(Math.sqrt(bw * bh) / 50));
        let sampledTotal = 0;

        for (let y = by; y < by + bh; y += innerSampleStep) {
            if (y < 0 || y >= imgHeight) continue;
            const rowOffset = y * imgWidth;
            for (let x = bx; x < bx + bw; x += innerSampleStep) {
                if (x < 0 || x >= imgWidth) continue;
                sampledTotal++;
                if (mask[rowOffset + x] === 1) {
                    innerFgCount++;
                }
            }
        }

        const density = sampledTotal > 0 ? (innerFgCount / sampledTotal) : 0.5;
        let densityScore = 1.0;
        if (density < 0.1) {
            densityScore = Math.max(0.2, density * 8.0); // 過於稀疏
        } else if (density > 0.95 && bw * bh > 1000) {
            densityScore = 0.85; // 整片填滿的大方塊可能為背景殘留
        }

        // 3. Gutter 隔離度 (Gutter Isolation - 權重 25%)
        // 檢查框體的上下左右邊緣外是否有無前景像素的通道
        let hasTopGutter = true, hasBottomGutter = true, hasLeftGutter = true, hasRightGutter = true;

        if (by > 0) {
            const topRow = (by - 1) * imgWidth;
            for (let x = bx; x < bx + bw; x++) {
                if (mask[topRow + x] === 1) { hasTopGutter = false; break; }
            }
        }
        if (by + bh < imgHeight) {
            const bottomRow = (by + bh) * imgWidth;
            for (let x = bx; x < bx + bw; x++) {
                if (mask[bottomRow + x] === 1) { hasBottomGutter = false; break; }
            }
        }
        if (bx > 0) {
            for (let y = by; y < by + bh; y++) {
                if (mask[y * imgWidth + (bx - 1)] === 1) { hasLeftGutter = false; break; }
            }
        }
        if (bx + bw < imgWidth) {
            for (let y = by; y < by + bh; y++) {
                if (mask[y * imgWidth + (bx + bw)] === 1) { hasRightGutter = false; break; }
            }
        }

        const gutterCleanCount = (hasTopGutter ? 1 : 0) + (hasBottomGutter ? 1 : 0) + (hasLeftGutter ? 1 : 0) + (hasRightGutter ? 1 : 0);
        const gutterScore = gutterCleanCount / 4.0;

        // 4. 形狀常態性 (Aspect & Size Sanity - 權重 15%)
        const aspect = Math.max(bw / Math.max(1, bh), bh / Math.max(1, bw));
        let shapeScore = 1.0;
        if (aspect > 6.0) {
            shapeScore = Math.max(0.3, 1.0 - (aspect - 6.0) * 0.1);
        }
        if (bw < 8 || bh < 8) {
            shapeScore *= 0.7;
        }

        // 綜合加權分數
        const finalScore = parseFloat((borderScore * 0.35 + gutterScore * 0.25 + densityScore * 0.25 + shapeScore * 0.15).toFixed(2));
        const clampedScore = Math.max(0.1, Math.min(1.0, finalScore));

        const category = clampedScore >= 0.8 ? 'high' : (clampedScore >= 0.5 ? 'med' : 'low');

        return {
            score: clampedScore,
            category,
            breakdown: {
                border: parseFloat(borderScore.toFixed(2)),
                gutter: parseFloat(gutterScore.toFixed(2)),
                density: parseFloat(densityScore.toFixed(2)),
                shape: parseFloat(shapeScore.toFixed(2))
            }
        };
    }
}
