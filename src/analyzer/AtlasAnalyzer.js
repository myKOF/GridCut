import { MetadataDetector } from './MetadataDetector.js';
import { AlphaSegmenter } from './AlphaSegmenter.js';
import { BackgroundSegmenter } from './BackgroundSegmenter.js';
import { MorphologicalProcessor } from './MorphologicalProcessor.js';
import { ConnectedComponentDetector } from './ConnectedComponentDetector.js';
import { ComponentGrouper } from './ComponentGrouper.js';
import { GutterDetector } from './GutterDetector.js';
import { WatershedSegmenter } from './WatershedSegmenter.js';
import { BoundingBoxRefiner } from './BoundingBoxRefiner.js';

/**
 * AtlasAnalyzer
 * 智慧圖集分析主協調器 (Pipeline Facade)
 * 完全遵循 CV 辨識流程與解耦架構 (Phase 3 整合 Distance Transform 與 Watershed 分水嶺)
 */
export class AtlasAnalyzer {
    /**
     * 對圖集進行完整自動辨識分析
     * @param {HTMLImageElement|HTMLCanvasElement} source 
     * @param {Object} options
     * @param {string} [options.bgType='auto'] 'auto' | 'alpha' | 'dark' | 'light'
     * @param {number} [options.alphaThreshold=15]
     * @param {number} [options.bgTolerance=28]
     * @param {number} [options.minSize=16]
     * @param {number} [options.mergeGap=0]
     * @param {number} [options.padding=0]
     * @param {number} [options.morphCloseRadius=0] 形態學閉合半徑
     * @param {number} [options.groupDistance=0] 元件聚合間距
     * @param {boolean} [options.enableWatershed=true] 是否啟用分水嶺沾黏分離
     * @param {number} [options.watershedDistance=14] 分水嶺核心峰值最小距離
     * @param {number} [options.watershedThreshold=4.0] 分水嶺核心最小距離門檻
     * @param {Object|string} [metadata] 可選的外部 metadata
     * @returns {Promise<{sprites: Array, stats: Object}>}
     */
    static async analyze(source, options = {}, metadata = null) {
        const startTime = performance.now();

        // 1. 最高優先級：Metadata 檢測
        if (metadata) {
            const parsed = MetadataDetector.parse(metadata);
            if (parsed && parsed.length > 0) {
                return {
                    sprites: parsed,
                    stats: {
                        source: 'metadata',
                        count: parsed.length,
                        durationMs: Math.round(performance.now() - startTime)
                    }
                };
            }
        }

        // 準備 Canvas 與 ImageData
        const width = source.naturalWidth || source.width;
        const height = source.naturalHeight || source.height;

        let canvas;
        let ctx;
        if ((typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) || (source && typeof source.getContext === 'function')) {
            canvas = source;
            ctx = canvas.getContext('2d', { willReadFrequently: true });
        } else {
            canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(source, 0, 0, width, height);
        }

        const imageData = ctx.getImageData(0, 0, width, height);

        const {
            bgType = 'auto',
            alphaThreshold = 15,
            bgTolerance = 28,
            minSize = 16,
            mergeGap = 0,
            padding = 0,
            morphCloseRadius = 0,
            groupDistance = 0,
            enableWatershed = true,
            watershedDistance = 14,
            watershedThreshold = 4.0
        } = options;

        // 2. 前景遮罩分割 (Foreground Segmentation)
        const hasAlpha = AlphaSegmenter.hasAlphaChannel(imageData.data, width, height);
        let rawMask;
        let segMode = 'alpha';

        if (bgType === 'alpha' || (bgType === 'auto' && hasAlpha)) {
            const segResult = AlphaSegmenter.segment(imageData, alphaThreshold);
            rawMask = segResult.mask;
            segMode = 'alpha';
        } else {
            const segResult = BackgroundSegmenter.segment(imageData, {
                bgType,
                bgTolerance
            });
            rawMask = segResult.mask;
            segMode = 'background';
        }

        // 3. 形態學閉合處理 (Morphological Closing)
        let mask = rawMask;
        if (morphCloseRadius > 0) {
            mask = MorphologicalProcessor.close(rawMask, width, height, morphCloseRadius);
        }

        // 4. 8-連通成分標記 (8-connected CCL)
        const rawComponents = ConnectedComponentDetector.findComponents(mask, width, height, {
            minPixelCount: Math.max(4, Math.floor(minSize * minSize * 0.15))
        });

        // 5. 元件聚合 (Component Grouping - Union-Find)
        const groupedBoxes = (groupDistance > 0)
            ? ComponentGrouper.group(rawComponents, { groupDistance, minSize, imgWidth: width, imgHeight: height })
            : rawComponents;

        // 6. Gutter 投影分析切分複合粘連區塊
        let candidateBoxes = groupedBoxes;
        if (groupedBoxes.length <= 2 && (width >= minSize * 2 || height >= minSize * 2)) {
            candidateBoxes = [{ x: 0, y: 0, width, height }];
        }

        const splitBoxes = [];
        for (const comp of candidateBoxes) {
            const splits = GutterDetector.splitBoxByGutters(
                { x: comp.x, y: comp.y, width: comp.width, height: comp.height },
                rawMask,
                width,
                height,
                { minSubSize: minSize, gutterThreshold: 0 }
            );
            splitBoxes.push(...splits);
        }

        // 6.5. Watershed 分水嶺沾黏分離 (處理非正交、斜向或不規則相碰圖形)
        let finalBoxes = splitBoxes;
        let watershedSplitCount = 0;

        if (enableWatershed) {
            finalBoxes = [];
            for (const b of splitBoxes) {
                if (b.width >= minSize * 1.5 || b.height >= minSize * 1.5) {
                    const wsSplits = WatershedSegmenter.separateTouchingSprites(
                        b,
                        rawMask,
                        width,
                        height,
                        {
                            minPeakDistance: watershedDistance,
                            minPeakThreshold: watershedThreshold,
                            minSubSize: minSize
                        }
                    );
                    if (wsSplits.length > 1) {
                        watershedSplitCount += (wsSplits.length - 1);
                    }
                    finalBoxes.push(...wsSplits);
                } else {
                    finalBoxes.push(b);
                }
            }
        }

        // 7. 緊湊外接框微調、多維度信心評估、Padding 與防溢限制
        const refinedSprites = BoundingBoxRefiner.refine(finalBoxes, rawMask, width, height, {
            minSize,
            mergeGap,
            padding
        });

        const durationMs = Math.round(performance.now() - startTime);

        return {
            sprites: refinedSprites,
            stats: {
                source: 'cv_pipeline',
                segMode,
                hasAlpha,
                rawComponentCount: rawComponents.length,
                groupedCount: groupedBoxes.length,
                gutterSplitCount: splitBoxes.length,
                watershedSplitCount,
                count: refinedSprites.length,
                durationMs
            }
        };
    }
}
