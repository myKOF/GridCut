import { MetadataDetector } from './MetadataDetector.js';
import { AlphaSegmenter } from './AlphaSegmenter.js';
import { BackgroundSegmenter } from './BackgroundSegmenter.js';
import { MorphologicalProcessor } from './MorphologicalProcessor.js';
import { ConnectedComponentDetector } from './ConnectedComponentDetector.js';
import { ComponentGrouper } from './ComponentGrouper.js';
import { GutterDetector } from './GutterDetector.js';
import { BoundingBoxRefiner } from './BoundingBoxRefiner.js';

/**
 * AtlasAnalyzer
 * 智慧圖集分析主協調器 (Pipeline Facade)
 * 完全遵循 CV 辨識流程與解耦架構 (Phase 2 整合形態學與元件聚合)
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
     * @param {number} [options.morphCloseRadius=2] 形態學閉合半徑
     * @param {number} [options.groupDistance=6] 元件聚合間距
     * @param {Object|string} [metadata] 可選的外部 metadata (TexturePacker, Phaser, JSON 等)
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
        if (source instanceof HTMLCanvasElement) {
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
            morphCloseRadius = 2,
            groupDistance = 6
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
        // 封閉發光、粒子空洞與斷線碎片，使同一物件內部凝聚
        let mask = rawMask;
        if (morphCloseRadius > 0) {
            mask = MorphologicalProcessor.close(rawMask, width, height, morphCloseRadius);
        }

        // 4. 8-連通成分標記 (8-connected CCL)
        const rawComponents = ConnectedComponentDetector.findComponents(mask, width, height, {
            minPixelCount: Math.max(4, Math.floor(minSize * minSize * 0.15))
        });

        // 5. 元件聚合 (Component Grouping - Union-Find)
        // 依幾何間距、重疊與包含關係，將衛星碎片與特效聚合同一 Sprite
        const groupedBoxes = (groupDistance > 0)
            ? ComponentGrouper.group(rawComponents, { groupDistance, minSize, imgWidth: width, imgHeight: height })
            : rawComponents;

        // 6. Gutter 投影分析切分複合粘連區塊
        // 安全防護：若連通成分標記因像素緊密接觸僅辨識出 <= 2 個超大區塊，啟用整圖全局投影自適應切分
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

        // 7. 緊湊外接框微調、多維度信心評估、Padding 與防溢限制
        const refinedSprites = BoundingBoxRefiner.refine(splitBoxes, rawMask, width, height, {
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
                count: refinedSprites.length,
                durationMs
            }
        };
    }
}
