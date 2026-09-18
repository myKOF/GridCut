/**
 * MetadataDetector
 * 負責檢測與讀取常見圖集 metadata (TexturePacker, Phaser, Pixi, 自訂 JSON 等)
 * 若有提供 metadata，直接提取 Sprite 矩形區域作為最高優先級結果。
 */
export class MetadataDetector {
    /**
     * 嘗試從 JSON 物件或字串解析 Sprite 矩形
     * @param {Object|string} metadata 
     * @returns {Array<{id: string, x: number, y: number, width: number, height: number, confidence: number, source: string}>|null}
     */
    static parse(metadata) {
        if (!metadata) return null;

        let data = metadata;
        if (typeof metadata === 'string') {
            try {
                data = JSON.parse(metadata);
            } catch (e) {
                console.warn('Metadata JSON 解析失敗:', e);
                return null;
            }
        }

        if (typeof data !== 'object' || data === null) return null;

        const sprites = [];

        // 格式 1: GridCut 標準格式 { sprites: [ { id, x, y, width, height } ] }
        if (Array.isArray(data.sprites) && data.sprites.length > 0) {
            for (let i = 0; i < data.sprites.length; i++) {
                const s = data.sprites[i];
                if (typeof s.x === 'number' && typeof s.y === 'number' && typeof s.width === 'number' && typeof s.height === 'number') {
                    sprites.push({
                        id: s.id || `sprite_${String(i + 1).padStart(3, '0')}`,
                        x: Math.round(s.x),
                        y: Math.round(s.y),
                        width: Math.round(s.width),
                        height: Math.round(s.height),
                        confidence: 1.0,
                        source: 'metadata'
                    });
                }
            }
            if (sprites.length > 0) return sprites;
        }

        // 格式 2: TexturePacker / Pixi JSON Hash { frames: { "anim_01.png": { frame: { x, y, w, h } } } }
        if (data.frames && typeof data.frames === 'object' && !Array.isArray(data.frames)) {
            let idx = 1;
            for (const [key, val] of Object.entries(data.frames)) {
                const f = val.frame || val;
                if (typeof f.x === 'number' && typeof f.y === 'number' && typeof f.w === 'number' && typeof f.h === 'number') {
                    sprites.push({
                        id: key || `sprite_${String(idx).padStart(3, '0')}`,
                        x: Math.round(f.x),
                        y: Math.round(f.y),
                        width: Math.round(f.w),
                        height: Math.round(f.h),
                        confidence: 1.0,
                        source: 'metadata'
                    });
                    idx++;
                }
            }
            if (sprites.length > 0) return sprites;
        }

        // 格式 3: TexturePacker / Phaser JSON Array { frames: [ { filename, frame: { x, y, w, h } } ] }
        if (Array.isArray(data.frames) && data.frames.length > 0) {
            for (let i = 0; i < data.frames.length; i++) {
                const item = data.frames[i];
                const f = item.frame || item;
                if (typeof f.x === 'number' && typeof f.y === 'number' && typeof f.w === 'number' && typeof f.h === 'number') {
                    sprites.push({
                        id: item.filename || `sprite_${String(i + 1).padStart(3, '0')}`,
                        x: Math.round(f.x),
                        y: Math.round(f.y),
                        width: Math.round(f.w),
                        height: Math.round(f.h),
                        confidence: 1.0,
                        source: 'metadata'
                    });
                }
            }
            if (sprites.length > 0) return sprites;
        }

        return null;
    }
}
