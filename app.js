// GridCut - Core Application Logic (Decoupled CV Pipeline + Modern Atlas Editor)

import { AtlasAnalyzer } from './src/analyzer/AtlasAnalyzer.js?v=2.3.0';
import { MetadataDetector } from './src/analyzer/MetadataDetector.js?v=2.3.0';
import { AlphaSegmenter } from './src/analyzer/AlphaSegmenter.js?v=2.3.0';
import { BackgroundSegmenter } from './src/analyzer/BackgroundSegmenter.js?v=2.3.0';
import { DebugVisualizer } from './src/analyzer/DebugVisualizer.js?v=2.3.0';
import { AtlasSlicerEditor } from './src/editor/AtlasSlicerEditor.js?v=2.3.0';
import { AtlasExporter } from './src/editor/AtlasExporter.js?v=2.3.0';
import { TileBrushManager } from './src/editor/TileBrushManager.js?v=2.3.0';

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM ELEMENTS ---
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const sourceImage = document.getElementById('sourceImage');
    const editorWrapper = document.getElementById('editorWrapper');
    const placeholderView = document.getElementById('placeholderView');

    // Mode Tabs
    const tabAutoMode = document.getElementById('tabAutoMode');
    const tabGridMode = document.getElementById('tabGridMode');
    const autoConfigSection = document.getElementById('autoConfigSection');
    const gridConfigSection = document.getElementById('gridConfigSection');
    const autoActions = document.getElementById('autoActions');
    const gridActions = document.getElementById('gridActions');
    const autoModeStats = document.getElementById('autoModeStats');
    const gridModeStats = document.getElementById('gridModeStats');

    // Auto Mode Controls
    const bgDetectTypeSelect = document.getElementById('bgDetectType');
    const erosionRadiusInput = document.getElementById('erosionRadius');
    const erosionRadiusVal = document.getElementById('erosionRadiusVal');
    const bgToleranceInput = document.getElementById('bgTolerance');
    const bgToleranceVal = document.getElementById('bgToleranceVal');
    const alphaThresholdInput = document.getElementById('alphaThreshold');
    const alphaThresholdVal = document.getElementById('alphaThresholdVal');
    const minSizeInput = document.getElementById('minSize');
    const mergeGapInput = document.getElementById('mergeGap');
    const boxPaddingInput = document.getElementById('boxPadding');
    const morphCloseRadiusInput = document.getElementById('morphCloseRadius');
    const morphCloseRadiusVal = document.getElementById('morphCloseRadiusVal');
    const groupDistanceInput = document.getElementById('groupDistance');
    const enableWatershedInput = document.getElementById('enableWatershed');
    const watershedDistanceInput = document.getElementById('watershedDistance');

    // Toolbar Buttons
    const runAutoDetectBtn = document.getElementById('runAutoDetectBtn');
    const autoDetectHeaderBtn = document.getElementById('autoDetectHeaderBtn');
    const toggleDrawBoxBtn = document.getElementById('toggleDrawBoxBtn');
    const drawBoxHeaderBtn = document.getElementById('drawBoxHeaderBtn');
    const watershedHeaderBtn = document.getElementById('watershedHeaderBtn');
    const toggleOverlayBtn = document.getElementById('toggleOverlayBtn');
    const toggleOverlayIcon = document.getElementById('toggleOverlayIcon');
    const toggleOverlayText = document.getElementById('toggleOverlayText');
    const toggleGridOverlayBtn = document.getElementById('toggleGridOverlayBtn');
    const toggleGridOverlayIcon = document.getElementById('toggleGridOverlayIcon');
    const toggleGridOverlayText = document.getElementById('toggleGridOverlayText');
    const clearBoxesBtn = document.getElementById('clearBoxesBtn');
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    const mergeBoxesBtn = document.getElementById('mergeBoxesBtn');
    const splitHBtn = document.getElementById('splitHBtn');
    const splitVBtn = document.getElementById('splitVBtn');
    const findUncertainBtn = document.getElementById('findUncertainBtn');

    // Selected Box Card & Inspector
    const selectedBoxCard = document.getElementById('selectedBoxCard');
    const selectedBoxTitle = document.getElementById('selectedBoxTitle');
    const selectedBoxConfidence = document.getElementById('selectedBoxConfidence');
    const deleteSelectedBoxBtn = document.getElementById('deleteSelectedBoxBtn');
    const boxPropX = document.getElementById('boxPropX');
    const boxPropY = document.getElementById('boxPropY');
    const boxPropW = document.getElementById('boxPropW');
    const boxPropH = document.getElementById('boxPropH');
    const exportSelectedBtn = document.getElementById('exportSelectedBtn');
    const splitSelectedHBtn = document.getElementById('splitSelectedHBtn');
    const splitSelectedVBtn = document.getElementById('splitSelectedVBtn');
    const splitSelectedWatershedBtn = document.getElementById('splitSelectedWatershedBtn');
    const confDetailRow = document.getElementById('confDetailRow');
    const confBorderText = document.getElementById('confBorderText');
    const confGutterText = document.getElementById('confGutterText');
    const confDensityText = document.getElementById('confDensityText');
    const boxPropReasonRow = document.getElementById('boxPropReasonRow');
    const boxPropReasonText = document.getElementById('boxPropReasonText');

    // Debug & Stage 6 Inputs
    const debugViewSelect = document.getElementById('debugViewSelect');
    const debugCanvas = document.getElementById('debugCanvas');
    const separatorConfidenceInput = document.getElementById('separatorConfidence');
    const gutterWidthInput = document.getElementById('gutterWidth');
    const minComponentAreaInput = document.getElementById('minComponentArea');
    const occupancyThresholdInput = document.getElementById('occupancyThreshold');

    // Grid Mode Inputs
    const tileWidthInput = document.getElementById('tileWidth');
    const tileHeightInput = document.getElementById('tileHeight');
    const resetCropBtn = document.getElementById('resetCropBtn');
    const gridCustomBadge = document.getElementById('gridCustomBadge');
    const resetUniformGridBtn = document.getElementById('resetUniformGridBtn');
    const clearInnerGridLinesBtn = document.getElementById('clearInnerGridLinesBtn');

    // Export Inputs & Buttons
    const exportFormatSelect = document.getElementById('exportFormat');
    const filePrefixInput = document.getElementById('filePrefix');
    const downloadBtn = document.getElementById('downloadBtn');
    const exportJsonBtn = document.getElementById('exportJsonBtn');

    // Info & Status
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const totalCountSpan = document.getElementById('totalCount');
    const origSizeAuto = document.getElementById('origSizeAuto');
    const boxesCountAuto = document.getElementById('boxesCountAuto');
    const sizeTypesCountAuto = document.getElementById('sizeTypesCountAuto');
    const selectedBoxStat = document.getElementById('selectedBoxStat');
    const sizeDistContainer = document.getElementById('sizeDistContainer');

    const origSizeSpan = document.getElementById('origSize');
    const cropSizeSpan = document.getElementById('cropSize');
    const colsCountSpan = document.getElementById('colsCount');
    const rowsCountSpan = document.getElementById('rowsCount');

    // Containers & Canvas
    const multiBoxContainer = document.getElementById('multiBoxContainer');
    const cropBox = document.getElementById('cropBox');
    const shadingOverlay = document.getElementById('shadingOverlay');
    const gridCanvas = document.getElementById('gridCanvas');
    const gridCtx = gridCanvas.getContext('2d');

    // Brush Toolbar Elements
    const brushToolbar = document.getElementById('brushToolbar');
    const brushPointerBtn = document.getElementById('brushPointerBtn');
    const brushIncludeBtn = document.getElementById('brushIncludeBtn');
    const brushExcludeBtn = document.getElementById('brushExcludeBtn');
    const brushEraserBtn = document.getElementById('brushEraserBtn');
    const brushSizeBtns = document.querySelectorAll('.brush-size-btn');
    const clearMarksBtn = document.getElementById('clearMarksBtn');
    const brushStatsBadge = document.getElementById('brushStatsBadge');
    const excludedCountNum = document.getElementById('excludedCountNum');

    // Loader Modal
    const loaderModal = document.getElementById('loaderModal');
    const progressText = document.getElementById('progressText');
    const progressBar = document.getElementById('progressBar');

    // Canvas Zoom Controls
    const canvasZoomControls = document.getElementById('canvasZoomControls');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomLevelDisplay = document.getElementById('zoomLevelDisplay');
    const resetViewBtn = document.getElementById('resetViewBtn');

    // --- APP STATE ---
    let originalImg = null;
    let currentImageFileName = 'atlas.png';
    let scaleRatio = 1; // Real Width / Rendered Width
    let currentMode = 'auto'; // 'auto' | 'grid'
    let cachedMetadata = null;
    let isDrawingMode = false;
    let currentDebugData = null;

    // Initialize AtlasSlicerEditor (UI Layer Decoupled)
    const slicerEditor = new AtlasSlicerEditor(multiBoxContainer, {
        onSelectionChange: (selectedSprites) => {
            updateInspectorUI(selectedSprites);
        },
        onSpritesChange: (allSprites) => {
            updateAutoModeStats(allSprites);
        },
        onHistoryChange: (historyState) => {
            if (undoBtn) undoBtn.disabled = !historyState.canUndo;
            if (redoBtn) redoBtn.disabled = !historyState.canRedo;
        }
    });

    // Initialize Tile Brush Manager (確定/取消 圖塊分割筆刷)
    const tileBrushManager = new TileBrushManager();
    slicerEditor.setBrushManager(tileBrushManager);
    let brushHoverPos = { col: -1, row: -1 };
    let isBrushPainting = false;

    // Grid Mode Crop Box State (Rendered CSS space)
    let cropBoxState = { x: 0, y: 0, w: 0, h: 0 };
    let isGridDragging = false;
    let gridDragType = null;
    let gridStartX = 0, gridStartY = 0;
    let startCropState = { x: 0, y: 0, w: 0, h: 0 };

    // Custom Grid Lines State (Manual non-uniform grid adjustment)
    const gridLinesState = {
        colLines: [], // relative X positions inside cropBox (0 < x < cropBoxState.w)
        rowLines: [], // relative Y positions inside cropBox (0 < y < cropBoxState.h)
        isCustomized: false,
        hoveredLine: null, // { type: 'col' | 'row', index: number }
        activeLine: null,  // { type: 'col' | 'row', index: number }
        dragLineInitPos: 0
    };

    // --- MODE SWITCHING ---

    function setMode(mode) {
        currentMode = mode;
        if (mode === 'auto') {
            tabAutoMode.classList.add('active');
            tabGridMode.classList.remove('active');
            autoConfigSection.style.display = 'flex';
            gridConfigSection.style.display = 'none';
            autoActions.style.display = 'flex';
            gridActions.style.display = 'none';
            autoModeStats.style.display = 'block';
            gridModeStats.style.display = 'none';

            multiBoxContainer.style.display = 'block';
            cropBox.style.display = 'none';
            shadingOverlay.style.display = 'none';
            if (gridCtx && gridCanvas) {
                gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
            }

            if (originalImg && slicerEditor.getSprites().length === 0) {
                runAutoDetection();
            } else {
                updateAutoModeStats();
            }
        } else {
            tabGridMode.classList.add('active');
            tabAutoMode.classList.remove('active');
            gridConfigSection.style.display = 'flex';
            autoConfigSection.style.display = 'none';
            gridActions.style.display = 'block';
            autoActions.style.display = 'none';
            gridModeStats.style.display = 'block';
            autoModeStats.style.display = 'none';

            multiBoxContainer.style.display = 'none';
            cropBox.style.display = 'block';
            shadingOverlay.style.display = 'block';

            if (originalImg) {
                updateCropBoxUI();
                recalculateAndDrawGrid();
            }
        }
        if (brushToolbar) {
            brushToolbar.style.display = originalImg ? 'inline-flex' : 'none';
        }
        updateDownloadButtonState();
    }

    tabAutoMode.addEventListener('click', () => setMode('auto'));
    tabGridMode.addEventListener('click', () => setMode('grid'));

    // --- UPLOAD & FILE INPUT HANDLERS ---
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleUploadedFiles(e.dataTransfer.files);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleUploadedFiles(e.target.files);
        }
    });

    function handleUploadedFiles(files) {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.name.toLowerCase().endsWith('.json') || file.type === 'application/json') {
                handleJsonFile(file);
                return;
            }
        }
        // Default to image file
        handleImageFile(files[0]);
    }

    function handleJsonFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            const parsed = MetadataDetector.parse(text);
            if (parsed && parsed.length > 0) {
                cachedMetadata = text;
                if (slicerEditor) {
                    slicerEditor.loadSprites(parsed);
                }
                statusText.textContent = `成功從 Metadata (${file.name}) 載入 ${parsed.length} 個 Sprite 框體！`;
            } else {
                alert('無法從該 JSON 中識別合法的 Sprite 座標資料（支援 TexturePacker、Phaser、GridCut JSON）。');
            }
        };
        reader.readAsText(file);
    }

    function handleImageFile(file) {
        if (!file.type.startsWith('image/')) {
            alert('請上傳有效的圖片檔案 (PNG, JPG, WebP) 或 Atlas JSON！');
            return;
        }

        currentImageFileName = file.name;

        const reader = new FileReader();
        reader.onload = (e) => {
            originalImg = new Image();
            originalImg.onload = () => {
                setupWorkspace();
            };
            originalImg.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // --- WORKSPACE SETUP ---

    function setupWorkspace() {
        if (!originalImg) return;

        sourceImage.src = originalImg.src;
        placeholderView.style.display = 'none';
        editorWrapper.style.display = 'inline-block';
        if (canvasZoomControls) canvasZoomControls.style.display = 'flex';

        downloadBtn.disabled = false;
        if (exportJsonBtn) exportJsonBtn.disabled = false;
        resetCropBtn.disabled = false;
        runAutoDetectBtn.disabled = false;
        autoDetectHeaderBtn.disabled = false;
        toggleDrawBoxBtn.disabled = false;
        drawBoxHeaderBtn.disabled = false;
        clearBoxesBtn.disabled = false;
        if (toggleOverlayBtn) toggleOverlayBtn.disabled = false;
        if (toggleGridOverlayBtn) toggleGridOverlayBtn.disabled = false;
        if (brushToolbar) brushToolbar.style.display = 'inline-flex';
        toggleOverlayVisibility(false);

        statusDot.classList.add('active');
        statusText.textContent = `圖片載入成功 (${originalImg.width} × ${originalImg.height} px)`;

        origSizeAuto.textContent = `${originalImg.width} × ${originalImg.height}`;
        origSizeSpan.textContent = `${originalImg.width} × ${originalImg.height}`;

        requestAnimationFrame(() => {
            calculateScale();
            slicerEditor.setSource(originalImg, scaleRatio);
            resetCropToFull();
            resetView();
            if (currentMode === 'auto') {
                runAutoDetection();
            }
        });
    }

    function calculateScale() {
        if (!originalImg) return;
        const containerRect = sourceImage.getBoundingClientRect();
        const renderW = sourceImage.clientWidth || containerRect.width;
        if (renderW > 0) {
            scaleRatio = originalImg.width / renderW;
        }
    }

    // ResizeObserver to handle window / panel resizing
    const resizeObserver = new ResizeObserver(() => {
        if (originalImg && editorWrapper.style.display !== 'none') {
            const prevScale = scaleRatio;
            calculateScale();
            if (prevScale && scaleRatio && prevScale !== scaleRatio) {
                const ratio = prevScale / scaleRatio;

                // Adjust grid crop box
                cropBoxState.x *= ratio;
                cropBoxState.y *= ratio;
                cropBoxState.w *= ratio;
                cropBoxState.h *= ratio;

                // Sync slicerEditor scale
                slicerEditor.setScaleRatio(scaleRatio);

                if (currentMode === 'grid') {
                    updateCropBoxUI();
                    recalculateAndDrawGrid();
                }
            }
        }
    });
    resizeObserver.observe(sourceImage);

    // ============================================================
    // AUTO-DETECTION CONTROLS & PIPELINE
    // ============================================================

    if (erosionRadiusInput && erosionRadiusVal) {
        erosionRadiusInput.addEventListener('input', () => {
            erosionRadiusVal.textContent = erosionRadiusInput.value;
        });
    }
    if (bgToleranceInput && bgToleranceVal) {
        bgToleranceInput.addEventListener('input', () => {
            bgToleranceVal.textContent = bgToleranceInput.value;
        });
    }
    if (alphaThresholdInput && alphaThresholdVal) {
        alphaThresholdInput.addEventListener('input', () => {
            alphaThresholdVal.textContent = alphaThresholdInput.value;
        });
    }
    if (morphCloseRadiusInput && morphCloseRadiusVal) {
        morphCloseRadiusInput.addEventListener('input', () => {
            morphCloseRadiusVal.textContent = morphCloseRadiusInput.value + 'px';
        });
    }

    runAutoDetectBtn.addEventListener('click', runAutoDetection);
    autoDetectHeaderBtn.addEventListener('click', runAutoDetection);

    async function runAutoDetection() {
        if (!originalImg) return;

        statusText.textContent = '正在進行 CV 智慧圖集分析 (Morph/CCL/Grouping/Gutter)...';

        const bgType = bgDetectTypeSelect ? bgDetectTypeSelect.value : 'auto';
        const alphaThreshold = alphaThresholdInput ? (isNaN(parseInt(alphaThresholdInput.value)) ? 15 : parseInt(alphaThresholdInput.value)) : 15;
        const bgTolerance = bgToleranceInput ? (isNaN(parseInt(bgToleranceInput.value)) ? 28 : parseInt(bgToleranceInput.value)) : 28;
        const minSize = minSizeInput ? Math.max(4, isNaN(parseInt(minSizeInput.value)) ? 16 : parseInt(minSizeInput.value)) : 16;
        const mergeGap = mergeGapInput ? Math.max(0, isNaN(parseInt(mergeGapInput.value)) ? 0 : parseInt(mergeGapInput.value)) : 0;
        const boxPadding = boxPaddingInput ? Math.max(0, isNaN(parseInt(boxPaddingInput.value)) ? 0 : parseInt(boxPaddingInput.value)) : 0;
        const morphCloseRadius = morphCloseRadiusInput ? Math.max(0, isNaN(parseInt(morphCloseRadiusInput.value)) ? 0 : parseInt(morphCloseRadiusInput.value)) : 0;
        const groupDistance = groupDistanceInput ? Math.max(0, isNaN(parseInt(groupDistanceInput.value)) ? 0 : parseInt(groupDistanceInput.value)) : 0;
        const enableWatershed = enableWatershedInput ? enableWatershedInput.checked : false;
        const watershedDistance = watershedDistanceInput ? Math.max(4, isNaN(parseInt(watershedDistanceInput.value)) ? 14 : parseInt(watershedDistanceInput.value)) : 14;

        // Stage 6: Minimum Sprite Constraints & XY-Cut settings
        const separatorConfidence = separatorConfidenceInput ? (parseFloat(separatorConfidenceInput.value) || 0.20) : 0.20;
        const gutterWidth = gutterWidthInput ? Math.max(1, parseInt(gutterWidthInput.value) || 1) : 1;
        const minComponentArea = minComponentAreaInput ? Math.max(1, parseInt(minComponentAreaInput.value) || 4) : 4;
        const occupancyThreshold = occupancyThresholdInput ? (parseFloat(occupancyThresholdInput.value) || 0.04) : 0.04;

        // Async execution to avoid freezing browser render
        setTimeout(async () => {
            try {
                const result = await AtlasAnalyzer.analyze(originalImg, {
                    bgType,
                    alphaThreshold,
                    bgTolerance,
                    minSize,
                    minSpriteWidth: minSize,
                    minSpriteHeight: minSize,
                    minSpriteArea: minSize * minSize,
                    minComponentArea,
                    mergeGap,
                    mergeDistance: mergeGap || groupDistance,
                    separatorConfidence,
                    gutterWidth,
                    occupancyThreshold,
                    padding: boxPadding,
                    morphCloseRadius,
                    groupDistance,
                    enableWatershed,
                    watershedDistance
                }, cachedMetadata);

                currentDebugData = result.debugData;
                slicerEditor.loadSprites(result.sprites);
                renderCurrentDebugView();

                const count = result.sprites.length;
                const wsInfo = result.stats.watershedSplitCount ? `, 分水嶺切出 +${result.stats.watershedSplitCount} 個` : '';
                statusText.textContent = `成功識別 ${count} 個 Sprite (耗時 ${result.stats.durationMs}ms, 候選區域: ${result.stats.candidateCount || '-'} 個, Gutter: ${result.stats.gutterCount || '-'} 條${wsInfo})`;
                if (findUncertainBtn) {
                    const uncertain = result.sprites.filter(s => (s.confidence || 1.0) < 0.8);
                    findUncertainBtn.disabled = uncertain.length === 0;
                }
            } catch (err) {
                console.error('Detection Error:', err);
                statusText.textContent = '自動識別發生錯誤：' + err.message;
            }
        }, 30);
    }

    // ============================================================
    // DEBUG VISUALIZATION CONTROLLER (PHASE 7)
    // ============================================================
    function renderCurrentDebugView() {
        if (!debugCanvas || !originalImg) return;
        const mode = debugViewSelect ? debugViewSelect.value : 'original';

        if (mode === 'original' || mode === 'none' || !currentDebugData) {
            debugCanvas.style.display = 'none';
            const ctx = debugCanvas.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
            return;
        }

        debugCanvas.style.display = 'block';
        const width = originalImg.naturalWidth || originalImg.width;
        const height = originalImg.naturalHeight || originalImg.height;
        DebugVisualizer.render(mode, currentDebugData, debugCanvas, width, height, slicerEditor.getSprites());
    }

    if (debugViewSelect) {
        debugViewSelect.addEventListener('change', () => {
            renderCurrentDebugView();
        });
    }

    // ============================================================
    // TOOLBAR & EDITOR INTERACTIONS
    // ============================================================

    function toggleDrawMode(enable) {
        isDrawingMode = typeof enable === 'boolean' ? enable : !isDrawingMode;
        slicerEditor.setDrawingMode(isDrawingMode);

        if (isDrawingMode) {
            toggleDrawBoxBtn.classList.add('active');
            drawBoxHeaderBtn.classList.add('btn-accent');
            drawBoxHeaderBtn.classList.remove('btn-secondary');
            statusText.textContent = '【手動繪框】請在圖片上按住滑鼠左鍵並拖曳拉出新框';
        } else {
            toggleDrawBoxBtn.classList.remove('active');
            drawBoxHeaderBtn.classList.remove('btn-accent');
            drawBoxHeaderBtn.classList.add('btn-secondary');
            statusText.textContent = '已退出手動繪框模式';
        }
    }

    toggleDrawBoxBtn.addEventListener('click', () => toggleDrawMode());
    drawBoxHeaderBtn.addEventListener('click', () => toggleDrawMode());

    // Undo / Redo
    if (undoBtn) undoBtn.addEventListener('click', () => slicerEditor.undo());
    if (redoBtn) redoBtn.addEventListener('click', () => slicerEditor.redo());

    // Merge & Split
    if (mergeBoxesBtn) {
        mergeBoxesBtn.addEventListener('click', () => slicerEditor.mergeSelected());
    }
    if (splitHBtn) {
        splitHBtn.addEventListener('click', () => slicerEditor.splitSelected('horizontal'));
    }
    if (splitVBtn) {
        splitVBtn.addEventListener('click', () => slicerEditor.splitSelected('vertical'));
    }

    if (splitSelectedHBtn) {
        splitSelectedHBtn.addEventListener('click', () => slicerEditor.splitSelected('horizontal'));
    }
    if (splitSelectedVBtn) {
        splitSelectedVBtn.addEventListener('click', () => slicerEditor.splitSelected('vertical'));
    }

    // Watershed Splitting Event
    const triggerWatershedSplit = () => {
        if (!originalImg || !slicerEditor) return;
        const selected = slicerEditor.getSelectedSprites();
        if (selected.length === 0) return;

        const width = originalImg.naturalWidth || originalImg.width;
        const height = originalImg.naturalHeight || originalImg.height;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(originalImg, 0, 0, width, height);
        const imgData = ctx.getImageData(0, 0, width, height);

        const bgType = bgDetectTypeSelect ? bgDetectTypeSelect.value : 'auto';
        const alphaThreshold = alphaThresholdInput ? (isNaN(parseInt(alphaThresholdInput.value)) ? 15 : parseInt(alphaThresholdInput.value)) : 15;
        const bgTolerance = bgToleranceInput ? (isNaN(parseInt(bgToleranceInput.value)) ? 28 : parseInt(bgToleranceInput.value)) : 28;
        const hasAlpha = AlphaSegmenter.hasAlphaChannel(imgData.data, width, height);

        let mask;
        if (bgType === 'alpha' || (bgType === 'auto' && hasAlpha)) {
            mask = AlphaSegmenter.segment(imgData, alphaThreshold).mask;
        } else {
            mask = BackgroundSegmenter.segment(imgData, { bgType, bgTolerance }).mask;
        }

        const watershedDistance = watershedDistanceInput ? Math.max(4, isNaN(parseInt(watershedDistanceInput.value)) ? 14 : parseInt(watershedDistanceInput.value)) : 14;
        const minSize = minSizeInput ? Math.max(4, isNaN(parseInt(minSizeInput.value)) ? 16 : parseInt(minSizeInput.value)) : 16;

        const count = slicerEditor.watershedSplitSelected(mask, width, height, {
            minPeakDistance: watershedDistance,
            minPeakThreshold: 4.0,
            minSubSize: minSize
        });

        if (count > 0) {
            statusText.textContent = `成功使用分水嶺演算法將選中框體分離為 ${count} 個獨立 Sprite！`;
        } else {
            statusText.textContent = `分水嶺分析：該框體內部僅有單一核心或尺寸過小，未進行切分。`;
        }
    };

    if (watershedHeaderBtn) {
        watershedHeaderBtn.addEventListener('click', triggerWatershedSplit);
    }
    if (splitSelectedWatershedBtn) {
        splitSelectedWatershedBtn.addEventListener('click', triggerWatershedSplit);
    }

    // Toggle Overlay (All Boxes & Lines) Visibility
    let isOverlayHidden = false;

    function toggleOverlayVisibility(forceState) {
        if (!originalImg) return;
        isOverlayHidden = (typeof forceState === 'boolean') ? forceState : !isOverlayHidden;

        if (isOverlayHidden) {
            multiBoxContainer.classList.add('overlay-hidden');
            cropBox.classList.add('overlay-hidden');
            shadingOverlay.classList.add('overlay-hidden');

            if (toggleOverlayBtn) {
                toggleOverlayBtn.classList.add('btn-active-toggle');
                if (toggleOverlayIcon) toggleOverlayIcon.className = 'fa-solid fa-eye';
                if (toggleOverlayText) toggleOverlayText.textContent = '顯示框線';
                toggleOverlayBtn.title = '顯示所有圈選框與分割線 (快捷鍵 H)';
            }
            if (toggleGridOverlayBtn) {
                toggleGridOverlayBtn.classList.add('btn-active-toggle');
                if (toggleGridOverlayIcon) toggleGridOverlayIcon.className = 'fa-solid fa-eye';
                if (toggleGridOverlayText) toggleGridOverlayText.textContent = '顯示格線';
                toggleGridOverlayBtn.title = '顯示網格分割線 (快捷鍵 H)';
            }
            statusText.textContent = '已隱藏所有圈選框與分割線 (檢視純淨原圖中，按 H 鍵恢復顯示)';
        } else {
            multiBoxContainer.classList.remove('overlay-hidden');
            cropBox.classList.remove('overlay-hidden');
            shadingOverlay.classList.remove('overlay-hidden');

            if (toggleOverlayBtn) {
                toggleOverlayBtn.classList.remove('btn-active-toggle');
                if (toggleOverlayIcon) toggleOverlayIcon.className = 'fa-solid fa-eye-slash';
                if (toggleOverlayText) toggleOverlayText.textContent = '隱藏框線';
                toggleOverlayBtn.title = '開啟/隱藏所有圈選框與分割線 (快捷鍵 H)';
            }
            if (toggleGridOverlayBtn) {
                toggleGridOverlayBtn.classList.remove('btn-active-toggle');
                if (toggleGridOverlayIcon) toggleGridOverlayIcon.className = 'fa-solid fa-eye-slash';
                if (toggleGridOverlayText) toggleGridOverlayText.textContent = '隱藏格線';
                toggleGridOverlayBtn.title = '開啟/隱藏網格分割線 (快捷鍵 H)';
            }
            statusText.textContent = '已恢復顯示所有圈選框與分割線';
        }
    }

    if (toggleOverlayBtn) {
        toggleOverlayBtn.addEventListener('click', () => toggleOverlayVisibility());
    }
    if (toggleGridOverlayBtn) {
        toggleGridOverlayBtn.addEventListener('click', () => toggleOverlayVisibility());
    }

    // Clear all boxes
    clearBoxesBtn.addEventListener('click', () => {
        const sprites = slicerEditor.getSprites();
        if (sprites.length === 0) return;
        if (confirm(`確定要清除畫面上全部 ${sprites.length} 個框體嗎？`)) {
            slicerEditor.loadSprites([]);
            statusText.textContent = '已清空畫布所有框體';
        }
    });

    // Delete selected
    deleteSelectedBoxBtn.addEventListener('click', () => {
        slicerEditor.deleteSelected();
    });

    // Inspector Properties Manual Change
    [boxPropX, boxPropY, boxPropW, boxPropH].forEach(input => {
        input.addEventListener('input', () => {
            const selected = slicerEditor.getSelectedSprites();
            if (selected.length === 1) {
                const id = selected[0].id;
                slicerEditor.updateSprite(id, {
                    x: parseInt(boxPropX.value) || 0,
                    y: parseInt(boxPropY.value) || 0,
                    width: parseInt(boxPropW.value) || 4,
                    height: parseInt(boxPropH.value) || 4
                });
            }
        });
        input.addEventListener('change', () => {
            slicerEditor.commitManualChange('屬性面板數值調整');
        });
    });

    // Inspector UI Sync
    function updateInspectorUI(selectedSprites) {
        if (!selectedSprites || selectedSprites.length === 0) {
            selectedBoxCard.style.display = 'none';
            selectedBoxStat.textContent = '-';
            if (mergeBoxesBtn) mergeBoxesBtn.disabled = true;
            if (splitHBtn) splitHBtn.disabled = true;
            if (splitVBtn) splitVBtn.disabled = true;
            if (watershedHeaderBtn) watershedHeaderBtn.disabled = true;
            return;
        }

        selectedBoxCard.style.display = 'flex';

        if (selectedSprites.length === 1) {
            const s = selectedSprites[0];
            selectedBoxTitle.textContent = s.id;
            const conf = s.confidence || 0.9;
            const confPct = Math.round(conf * 100);
            if (selectedBoxConfidence) {
                selectedBoxConfidence.textContent = `${confPct}%`;
                selectedBoxConfidence.className = 'badge-confidence ' + (conf >= 0.8 ? 'confidence-high' : (conf >= 0.5 ? 'confidence-med' : 'confidence-low'));
            }

            boxPropX.value = s.x;
            boxPropY.value = s.y;
            boxPropW.value = s.width;
            boxPropH.value = s.height;

            selectedBoxStat.textContent = `${s.id} (${s.width}×${s.height})`;

            // 顯示信心評估因子明細
            if (s.confidenceBreakdown && confDetailRow) {
                confBorderText.textContent = `邊界: ${s.confidenceBreakdown.border}`;
                confGutterText.textContent = `隔離: ${s.confidenceBreakdown.gutter}`;
                confDensityText.textContent = `密度: ${Math.round(s.confidenceBreakdown.density * 100)}%`;
                confDetailRow.style.display = 'flex';
            } else if (confDetailRow) {
                confDetailRow.style.display = 'none';
            }

            // 顯示檢測依據 (Detection Reason)
            if (boxPropReasonRow && boxPropReasonText) {
                boxPropReasonText.textContent = s.reason || 'enclosed by strong gutters';
                boxPropReasonRow.style.display = 'block';
            }

            if (mergeBoxesBtn) mergeBoxesBtn.disabled = true;
            if (splitHBtn) splitHBtn.disabled = false;
            if (splitVBtn) splitVBtn.disabled = false;
            if (watershedHeaderBtn) watershedHeaderBtn.disabled = false;
        } else {
            selectedBoxTitle.textContent = `多選 (${selectedSprites.length} 個)`;
            if (selectedBoxConfidence) {
                selectedBoxConfidence.textContent = '多選中';
                selectedBoxConfidence.className = 'badge-confidence confidence-high';
            }
            if (confDetailRow) confDetailRow.style.display = 'none';
            if (boxPropReasonRow) boxPropReasonRow.style.display = 'none';

            boxPropX.value = '';
            boxPropY.value = '';
            boxPropW.value = '';
            boxPropH.value = '';

            selectedBoxStat.textContent = `已選中 ${selectedSprites.length} 個框`;
            if (mergeBoxesBtn) mergeBoxesBtn.disabled = false;
            if (splitHBtn) splitHBtn.disabled = false;
            if (splitVBtn) splitVBtn.disabled = false;
            if (watershedHeaderBtn) watershedHeaderBtn.disabled = false;
        }
    }

    // Keyboard Shortcuts: Arrows to nudge, Delete to remove, Ctrl+Z/Y for Undo/Redo
    window.addEventListener('keydown', (e) => {
        if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

        if (currentMode === 'auto' && slicerEditor) {
            const isCtrlOrCmd = e.ctrlKey || e.metaKey;

            if (isCtrlOrCmd && (e.key === 'z' || e.key === 'Z')) {
                e.preventDefault();
                if (e.shiftKey) {
                    slicerEditor.redo();
                } else {
                    slicerEditor.undo();
                }
                return;
            }

            // H: Toggle Overlay Visibility
            if (e.key === 'h' || e.key === 'H') {
                e.preventDefault();
                toggleOverlayVisibility();
                return;
            }

            if (isCtrlOrCmd && (e.key === 'y' || e.key === 'Y')) {
                e.preventDefault();
                slicerEditor.redo();
                return;
            }

            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                slicerEditor.deleteSelected();
                return;
            }

            if (e.key === 'Escape') {
                if (isDrawingMode) toggleDrawMode(false);
                slicerEditor.clearSelection();
                return;
            }

            const step = e.shiftKey ? 10 : 1;
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                slicerEditor.nudgeSelected(-step, 0);
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                slicerEditor.nudgeSelected(step, 0);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                slicerEditor.nudgeSelected(0, -step);
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                slicerEditor.nudgeSelected(0, step);
            }
        } else if (currentMode === 'grid') {
            // Delete key: Remove active grid divider line
            if (e.key === 'Delete' || e.key === 'Backspace') {
                const active = gridLinesState.activeLine || gridLinesState.hoveredLine;
                if (active) {
                    e.preventDefault();
                    if (active.type === 'col' && active.index < gridLinesState.colLines.length) {
                        gridLinesState.colLines.splice(active.index, 1);
                    } else if (active.type === 'row' && active.index < gridLinesState.rowLines.length) {
                        gridLinesState.rowLines.splice(active.index, 1);
                    }
                    gridLinesState.activeLine = null;
                    gridLinesState.hoveredLine = null;
                    gridLinesState.isCustomized = true;
                    updateGridBadge();
                    recalculateAndDrawGrid();
                    statusText.textContent = '已刪除選取的網格分割線';
                }
                return;
            }

            // Arrow keys: Nudge active divider line
            const active = gridLinesState.activeLine || gridLinesState.hoveredLine;
            if (active) {
                const step = (e.shiftKey ? 5 : 1) / scaleRatio;
                if (active.type === 'col' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                    e.preventDefault();
                    const dx = e.key === 'ArrowLeft' ? -step : step;
                    const idx = active.index;
                    const prevX = idx > 0 ? gridLinesState.colLines[idx - 1] : 0;
                    const nextX = idx < gridLinesState.colLines.length - 1 ? gridLinesState.colLines[idx + 1] : cropBoxState.w;
                    const minGap = Math.max(4, 6 / scaleRatio);
                    gridLinesState.colLines[idx] = Math.max(prevX + minGap, Math.min(nextX - minGap, gridLinesState.colLines[idx] + dx));
                    gridLinesState.isCustomized = true;
                    updateGridBadge();
                    recalculateAndDrawGrid();
                } else if (active.type === 'row' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                    e.preventDefault();
                    const dy = e.key === 'ArrowUp' ? -step : step;
                    const idx = active.index;
                    const prevY = idx > 0 ? gridLinesState.rowLines[idx - 1] : 0;
                    const nextY = idx < gridLinesState.rowLines.length - 1 ? gridLinesState.rowLines[idx + 1] : cropBoxState.h;
                    const minGap = Math.max(4, 6 / scaleRatio);
                    gridLinesState.rowLines[idx] = Math.max(prevY + minGap, Math.min(nextY - minGap, gridLinesState.rowLines[idx] + dy));
                    gridLinesState.isCustomized = true;
                    updateGridBadge();
                    recalculateAndDrawGrid();
                }
            }
        }
    });

    // 尋找/跳轉至待確認框 (Confidence < 0.8)
    let uncertainCursor = 0;
    if (findUncertainBtn) {
        findUncertainBtn.addEventListener('click', () => {
            if (!slicerEditor) return;
            const sprites = slicerEditor.getSprites();
            const uncertain = sprites
                .filter(s => (s.confidence || 1.0) < 0.8)
                .sort((a, b) => (a.confidence || 0) - (b.confidence || 0));

            if (uncertain.length === 0) {
                statusText.textContent = '太棒了！所有框體信心度皆高於 80%，目前無待確認框體。';
                findUncertainBtn.disabled = true;
                return;
            }

            uncertainCursor = (uncertainCursor) % uncertain.length;
            const target = uncertain[uncertainCursor];
            uncertainCursor++;

            slicerEditor.select(target.id);
            statusText.textContent = `跳轉至待確認框 ${target.id} (信心度: ${Math.round((target.confidence || 0) * 100)}%, 第 ${uncertainCursor}/${uncertain.length} 個)`;
        });
    }

    // ============================================================
    // STATS & DISTRIBUTION CALCULATION
    // ============================================================

    function updateAutoModeStats(sprites) {
        const list = sprites || slicerEditor.getSprites();
        boxesCountAuto.textContent = list.length;
        totalCountSpan.textContent = list.length;

        const sizeMap = {};
        for (const b of list) {
            const key = `${Math.round(b.width)}×${Math.round(b.height)}`;
            sizeMap[key] = (sizeMap[key] || 0) + 1;
        }

        const sizeEntries = Object.entries(sizeMap).sort((a, b) => b[1] - a[1]);
        sizeTypesCountAuto.textContent = `${sizeEntries.length} 種`;

        sizeDistContainer.innerHTML = '';
        sizeEntries.forEach(([dim, count]) => {
            const chip = document.createElement('span');
            chip.className = 'size-chip';
            chip.innerHTML = `${dim} <strong>×${count}</strong>`;
            sizeDistContainer.appendChild(chip);
        });

        updateDownloadButtonState(list.length);
    }

    function updateDownloadButtonState(count = null) {
        if (!originalImg) {
            downloadBtn.disabled = true;
            if (exportJsonBtn) exportJsonBtn.disabled = true;
            return;
        }
        if (currentMode === 'auto') {
            const total = typeof count === 'number' ? count : slicerEditor.getSprites().length;
            downloadBtn.disabled = total === 0;
            if (exportJsonBtn) exportJsonBtn.disabled = total === 0;
        } else {
            const cols = gridLinesState.colLines.length + 1;
            const rows = gridLinesState.rowLines.length + 1;
            const total = cols * rows;
            downloadBtn.disabled = total <= 0;
            if (exportJsonBtn) exportJsonBtn.disabled = total <= 0;
        }
    }

    // ============================================================
    // GRID MODE LOGIC (NON-UNIFORM DRAGGABLE GRID LINES)
    // ============================================================

    function syncUniformGridLines() {
        if (!cropBoxState.w || !cropBoxState.h) return;
        const targetTileW = Math.max(8, parseInt(tileWidthInput.value) || 128);
        const targetTileH = Math.max(8, parseInt(tileHeightInput.value) || 128);
        const stepX = (targetTileW / scaleRatio);
        const stepY = (targetTileH / scaleRatio);

        const cols = Math.ceil((cropBoxState.w * scaleRatio) / targetTileW);
        const rows = Math.ceil((cropBoxState.h * scaleRatio) / targetTileH);

        gridLinesState.colLines = [];
        for (let i = 1; i < cols; i++) {
            const x = i * stepX;
            if (x < cropBoxState.w - 4) {
                gridLinesState.colLines.push(x);
            }
        }

        gridLinesState.rowLines = [];
        for (let j = 1; j < rows; j++) {
            const y = j * stepY;
            if (y < cropBoxState.h - 4) {
                gridLinesState.rowLines.push(y);
            }
        }

        gridLinesState.isCustomized = false;
        gridLinesState.hoveredLine = null;
        gridLinesState.activeLine = null;
        updateGridBadge();
    }

    function updateGridBadge() {
        if (gridCustomBadge) {
            gridCustomBadge.style.display = gridLinesState.isCustomized ? 'inline-block' : 'none';
        }
    }

    function resetCropToFull() {
        if (!originalImg) return;
        const containerRect = sourceImage.getBoundingClientRect();
        const renderW = sourceImage.clientWidth || containerRect.width;
        const renderH = sourceImage.clientHeight || containerRect.height;
        if (renderW === 0) return;

        scaleRatio = originalImg.width / renderW;

        cropBoxState = { x: 0, y: 0, w: renderW, h: renderH };
        if (currentMode === 'grid') {
            updateCropBoxUI();
            syncUniformGridLines();
            recalculateAndDrawGrid();
        } else {
            cropBox.style.display = 'none';
            shadingOverlay.style.display = 'none';
            if (gridCtx && gridCanvas) {
                gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
            }
        }
    }

    resetCropBtn.addEventListener('click', resetCropToFull);

    if (resetUniformGridBtn) {
        resetUniformGridBtn.addEventListener('click', () => {
            syncUniformGridLines();
            recalculateAndDrawGrid();
            statusText.textContent = '已將網格重設為均勻等寬等高！';
        });
    }

    if (clearInnerGridLinesBtn) {
        clearInnerGridLinesBtn.addEventListener('click', () => {
            gridLinesState.colLines = [];
            gridLinesState.rowLines = [];
            gridLinesState.isCustomized = true;
            gridLinesState.hoveredLine = null;
            gridLinesState.activeLine = null;
            updateGridBadge();
            recalculateAndDrawGrid();
            statusText.textContent = '已清除所有內部格線，僅保留單一大裁切框。';
        });
    }

    // Helper: Find grid cell (col, row) from relative CSS position inside cropBox
    function getGridCellFromRelPos(relX, relY) {
        const colBounds = [0, ...gridLinesState.colLines, cropBoxState.w];
        const rowBounds = [0, ...gridLinesState.rowLines, cropBoxState.h];
        let c = -1;
        for (let i = 0; i < colBounds.length - 1; i++) {
            if (relX >= colBounds[i] && relX < colBounds[i + 1]) {
                c = i;
                break;
            }
        }
        let r = -1;
        for (let j = 0; j < rowBounds.length - 1; j++) {
            if (relY >= rowBounds[j] && relY < rowBounds[j + 1]) {
                r = j;
                break;
            }
        }
        return { col: c, row: r };
    }

    // Grid Hit Testing & Brush Continuous Painting
    cropBox.addEventListener('mousemove', (e) => {
        if (isGridDragging || currentMode !== 'grid') return;
        if (e.target.classList.contains('handle')) return;

        const rect = cropBox.getBoundingClientRect();
        const relX = (e.clientX - rect.left) / currentZoom;
        const relY = (e.clientY - rect.top) / currentZoom;

        // --- Brush Mode Handling (確定 / 取消 筆刷) ---
        if (tileBrushManager.getTool() !== 'pointer') {
            cropBox.classList.remove('col-resizing', 'row-resizing');
            cropBox.classList.add('brush-mode');

            const cell = getGridCellFromRelPos(relX, relY);
            if (cell.col !== brushHoverPos.col || cell.row !== brushHoverPos.row) {
                brushHoverPos = cell;
                if (isBrushPainting && cell.col >= 0 && cell.row >= 0) {
                    const cols = gridLinesState.colLines.length + 1;
                    const rows = gridLinesState.rowLines.length + 1;
                    tileBrushManager.paintGridArea(cell.col, cell.row, cols, rows);
                }
                recalculateAndDrawGrid();
            }
            return;
        }

        cropBox.classList.remove('brush-mode');
        const hitTol = 6;

        let foundCol = -1;
        for (let i = 0; i < gridLinesState.colLines.length; i++) {
            if (Math.abs(relX - gridLinesState.colLines[i]) <= hitTol) {
                foundCol = i;
                break;
            }
        }

        let foundRow = -1;
        for (let j = 0; j < gridLinesState.rowLines.length; j++) {
            if (Math.abs(relY - gridLinesState.rowLines[j]) <= hitTol) {
                foundRow = j;
                break;
            }
        }

        if (foundCol !== -1) {
            cropBox.classList.add('col-resizing');
            cropBox.classList.remove('row-resizing');
            gridLinesState.hoveredLine = { type: 'col', index: foundCol };
            recalculateAndDrawGrid();
        } else if (foundRow !== -1) {
            cropBox.classList.add('row-resizing');
            cropBox.classList.remove('col-resizing');
            gridLinesState.hoveredLine = { type: 'row', index: foundRow };
            recalculateAndDrawGrid();
        } else {
            cropBox.classList.remove('col-resizing', 'row-resizing');
            if (gridLinesState.hoveredLine) {
                gridLinesState.hoveredLine = null;
                recalculateAndDrawGrid();
            }
        }
    });

    cropBox.addEventListener('mouseleave', () => {
        cropBox.classList.remove('col-resizing', 'row-resizing', 'brush-mode');
        if (brushHoverPos.col !== -1 || brushHoverPos.row !== -1) {
            brushHoverPos = { col: -1, row: -1 };
            recalculateAndDrawGrid();
        }
        if (!isGridDragging && gridLinesState.hoveredLine) {
            gridLinesState.hoveredLine = null;
            recalculateAndDrawGrid();
        }
    });

    // Double-click to add a new cut divider line (pointer mode only)
    cropBox.addEventListener('dblclick', (e) => {
        if (currentMode !== 'grid' || isGridDragging || tileBrushManager.getTool() !== 'pointer') return;
        if (e.target.classList.contains('handle')) return;

        const rect = cropBox.getBoundingClientRect();
        const relX = (e.clientX - rect.left) / currentZoom;
        const relY = (e.clientY - rect.top) / currentZoom;

        // Determine orientation by distance to borders/lines
        const minDistCol = Math.min(...gridLinesState.colLines.map(x => Math.abs(relX - x)), relX, cropBoxState.w - relX);
        const minDistRow = Math.min(...gridLinesState.rowLines.map(y => Math.abs(relY - y)), relY, cropBoxState.h - relY);

        if (minDistCol > minDistRow) {
            gridLinesState.colLines.push(relX);
            gridLinesState.colLines.sort((a, b) => a - b);
            statusText.textContent = `已新增一條垂直網格線 (X: ${Math.round(relX * scaleRatio)}px)`;
        } else {
            gridLinesState.rowLines.push(relY);
            gridLinesState.rowLines.sort((a, b) => a - b);
            statusText.textContent = `已新增一條水平網格線 (Y: ${Math.round(relY * scaleRatio)}px)`;
        }

        gridLinesState.isCustomized = true;
        updateGridBadge();
        recalculateAndDrawGrid();
    });

    cropBox.addEventListener('mousedown', startGridDrag);
    cropBox.addEventListener('touchstart', startGridDrag, { passive: false });

    function startGridDrag(e) {
        if (e.button === 1 || e.button === 2) return;

        // Brush click / drag paint
        if (tileBrushManager.getTool() !== 'pointer') {
            if (e.button === 0) {
                e.preventDefault();
                e.stopPropagation();
                isBrushPainting = true;
                const rect = cropBox.getBoundingClientRect();
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                const relX = (clientX - rect.left) / currentZoom;
                const relY = (clientY - rect.top) / currentZoom;
                const cell = getGridCellFromRelPos(relX, relY);
                if (cell.col >= 0 && cell.row >= 0) {
                    const cols = gridLinesState.colLines.length + 1;
                    const rows = gridLinesState.rowLines.length + 1;
                    tileBrushManager.paintGridArea(cell.col, cell.row, cols, rows);
                    recalculateAndDrawGrid();
                }
                const onEndPaint = () => {
                    isBrushPainting = false;
                    window.removeEventListener('mouseup', onEndPaint);
                    window.removeEventListener('touchend', onEndPaint);
                };
                window.addEventListener('mouseup', onEndPaint);
                window.addEventListener('touchend', onEndPaint);
            }
            return;
        }

        if (e.target.classList.contains('handle')) {
            gridDragType = e.target.dataset.handle;
            gridLinesState.hoveredLine = null;
            gridLinesState.activeLine = null;
        } else if (gridLinesState.hoveredLine) {
            // Drag specific vertical or horizontal grid line!
            gridDragType = gridLinesState.hoveredLine.type + '-line';
            gridLinesState.activeLine = { ...gridLinesState.hoveredLine };
            gridLinesState.dragLineInitPos = (gridLinesState.hoveredLine.type === 'col')
                ? gridLinesState.colLines[gridLinesState.hoveredLine.index]
                : gridLinesState.rowLines[gridLinesState.hoveredLine.index];
        } else if (e.target === cropBox || e.target === gridCanvas) {
            gridDragType = 'move';
            gridLinesState.activeLine = null;
        } else {
            return;
        }

        e.preventDefault();
        isGridDragging = true;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        gridStartX = clientX;
        gridStartY = clientY;
        startCropState = { ...cropBoxState };
    }

    function handleGridDragMove(clientX, clientY, e) {
        e.preventDefault();
        const deltaX = (clientX - gridStartX) / currentZoom;
        const deltaY = (clientY - gridStartY) / currentZoom;
        const containerW = sourceImage.clientWidth;
        const containerH = sourceImage.clientHeight;
        const minBoxSize = 30;

        // 1. Drag specific vertical divider line
        if (gridDragType === 'col-line' && gridLinesState.activeLine) {
            const idx = gridLinesState.activeLine.index;
            const prevX = idx > 0 ? gridLinesState.colLines[idx - 1] : 0;
            const nextX = idx < gridLinesState.colLines.length - 1 ? gridLinesState.colLines[idx + 1] : cropBoxState.w;
            const minGap = Math.max(4, 6 / scaleRatio);

            let newX = gridLinesState.dragLineInitPos + deltaX;
            newX = Math.max(prevX + minGap, Math.min(nextX - minGap, newX));

            gridLinesState.colLines[idx] = newX;
            gridLinesState.isCustomized = true;
            updateGridBadge();
            recalculateAndDrawGrid();
            return;
        }

        // 2. Drag specific horizontal divider line
        if (gridDragType === 'row-line' && gridLinesState.activeLine) {
            const idx = gridLinesState.activeLine.index;
            const prevY = idx > 0 ? gridLinesState.rowLines[idx - 1] : 0;
            const nextY = idx < gridLinesState.rowLines.length - 1 ? gridLinesState.rowLines[idx + 1] : cropBoxState.h;
            const minGap = Math.max(4, 6 / scaleRatio);

            let newY = gridLinesState.dragLineInitPos + deltaY;
            newY = Math.max(prevY + minGap, Math.min(nextY - minGap, newY));

            gridLinesState.rowLines[idx] = newY;
            gridLinesState.isCustomized = true;
            updateGridBadge();
            recalculateAndDrawGrid();
            return;
        }

        // 3. Move whole Crop Box
        if (gridDragType === 'move') {
            let nx = startCropState.x + deltaX;
            let ny = startCropState.y + deltaY;

            nx = Math.max(0, Math.min(containerW - cropBoxState.w, nx));
            ny = Math.max(0, Math.min(containerH - cropBoxState.h, ny));

            cropBoxState.x = nx;
            cropBoxState.y = ny;
            updateCropBoxUI();
            recalculateAndDrawGrid();
            return;
        }

        // 4. Resize Crop Box by corner/edge handles
        let { x, y, w, h } = startCropState;

        if (gridDragType.includes('e')) {
            w = Math.max(minBoxSize, Math.min(containerW - x, startCropState.w + deltaX));
        }
        if (gridDragType.includes('s')) {
            h = Math.max(minBoxSize, Math.min(containerH - y, startCropState.h + deltaY));
        }
        if (gridDragType.includes('w')) {
            const maxDelta = startCropState.w - minBoxSize;
            const clampedDelta = Math.max(-startCropState.x, Math.min(maxDelta, deltaX));
            x = startCropState.x + clampedDelta;
            w = startCropState.w - clampedDelta;
        }
        if (gridDragType.includes('n')) {
            const maxDelta = startCropState.h - minBoxSize;
            const clampedDelta = Math.max(-startCropState.y, Math.min(maxDelta, deltaY));
            y = startCropState.y + clampedDelta;
            h = startCropState.h - clampedDelta;
        }

        cropBoxState = { x, y, w, h };
        updateCropBoxUI();
        if (!gridLinesState.isCustomized) {
            syncUniformGridLines();
        }
        recalculateAndDrawGrid();
    }

    function endGridDrag() {
        if (isGridDragging) {
            isGridDragging = false;
            gridDragType = null;
            gridLinesState.activeLine = null;
            recalculateAndDrawGrid();
        }
    }

    function updateCropBoxUI() {
        cropBox.style.left = `${cropBoxState.x}px`;
        cropBox.style.top = `${cropBoxState.y}px`;
        cropBox.style.width = `${cropBoxState.w}px`;
        cropBox.style.height = `${cropBoxState.h}px`;

        const dpr = window.devicePixelRatio || 1;
        const effectiveZoom = currentZoom || 1.0;
        const scaleFactor = effectiveZoom * dpr;

        gridCanvas.width = Math.max(1, Math.round(cropBoxState.w * scaleFactor));
        gridCanvas.height = Math.max(1, Math.round(cropBoxState.h * scaleFactor));
        gridCanvas.style.width = '100%';
        gridCanvas.style.height = '100%';
    }

    function recalculateAndDrawGrid() {
        if (!originalImg || currentMode !== 'grid') return;

        // If lines not yet initialized and not customized, sync uniform
        if (!gridLinesState.isCustomized && gridLinesState.colLines.length === 0 && gridLinesState.rowLines.length === 0) {
            syncUniformGridLines();
        }

        const origCropW = Math.round(cropBoxState.w * scaleRatio);
        const origCropH = Math.round(cropBoxState.h * scaleRatio);
        cropSizeSpan.textContent = `${origCropW} × ${origCropH} px`;

        const cols = gridLinesState.colLines.length + 1;
        const rows = gridLinesState.rowLines.length + 1;
        const total = cols * rows;

        colsCountSpan.textContent = cols;
        rowsCountSpan.textContent = rows;

        // Excluded & Effective Count Calculation
        const excludedCount = tileBrushManager.getExcludedGridCount(cols, rows);
        const effectiveCount = Math.max(0, total - excludedCount);
        totalCountSpan.textContent = effectiveCount;

        if (brushStatsBadge && excludedCountNum) {
            if (excludedCount > 0) {
                brushStatsBadge.style.display = 'inline-flex';
                excludedCountNum.textContent = `${excludedCount} 格`;
            } else {
                brushStatsBadge.style.display = 'none';
            }
        }

        updateDownloadButtonState();

        const dpr = window.devicePixelRatio || 1;
        const effectiveZoom = currentZoom || 1.0;
        const scaleFactor = effectiveZoom * dpr;

        // Maintain canvas buffer resolution for physical display
        gridCanvas.width = Math.max(1, Math.round(cropBoxState.w * scaleFactor));
        gridCanvas.height = Math.max(1, Math.round(cropBoxState.h * scaleFactor));
        gridCanvas.style.width = '100%';
        gridCanvas.style.height = '100%';

        gridCtx.resetTransform();
        gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
        if (cols <= 0 || rows <= 0) return;

        gridCtx.scale(scaleFactor, scaleFactor);

        const colBounds = [0, ...gridLinesState.colLines, cropBoxState.w];
        const rowBounds = [0, ...gridLinesState.rowLines, cropBoxState.h];

        // --- Layer 1: Cell Included / Excluded Colors ---
        for (let r = 0; r < rows; r++) {
            const y0 = rowBounds[r];
            const y1 = rowBounds[r + 1];
            const ch = y1 - y0;
            if (ch <= 0) continue;

            for (let c = 0; c < cols; c++) {
                const x0 = colBounds[c];
                const x1 = colBounds[c + 1];
                const cw = x1 - x0;
                if (cw <= 0) continue;

                const state = tileBrushManager.getCellState(c, r);
                if (state === 'included') {
                    // 確定產出：淺綠色
                    gridCtx.fillStyle = 'rgba(34, 197, 94, 0.32)';
                    gridCtx.fillRect(x0, y0, cw, ch);
                    gridCtx.strokeStyle = 'rgba(34, 197, 94, 0.8)';
                    gridCtx.lineWidth = 1 / effectiveZoom;
                    gridCtx.strokeRect(x0, y0, cw, ch);
                } else if (state === 'excluded') {
                    // 取消排除：淺紅色
                    gridCtx.fillStyle = 'rgba(239, 68, 68, 0.40)';
                    gridCtx.fillRect(x0, y0, cw, ch);
                    gridCtx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
                    gridCtx.lineWidth = 1 / effectiveZoom;
                    gridCtx.strokeRect(x0, y0, cw, ch);

                    // 繪製紅叉叉
                    const cx = x0 + cw / 2;
                    const cy = y0 + ch / 2;
                    const markR = Math.min(cw, ch) * 0.22;
                    if (markR >= 3) {
                        gridCtx.beginPath();
                        gridCtx.moveTo(cx - markR, cy - markR);
                        gridCtx.lineTo(cx + markR, cy + markR);
                        gridCtx.moveTo(cx + markR, cy - markR);
                        gridCtx.lineTo(cx - markR, cy + markR);
                        gridCtx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
                        gridCtx.lineWidth = Math.max(1, 1.5 / effectiveZoom);
                        gridCtx.stroke();
                    }
                }
            }
        }

        // --- Layer 2: Crisp 1px Grid Lines (無論放大縮小，均需保持在 1px 寬度) ---
        const stroke1px = 1 / effectiveZoom;
        const dash4px = 4 / effectiveZoom;

        // Pass 1: Semi-transparent dark drop shadow
        gridCtx.lineWidth = stroke1px;
        gridCtx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
        gridCtx.setLineDash([dash4px, dash4px]);

        for (let i = 0; i < gridLinesState.colLines.length; i++) {
            const x = gridLinesState.colLines[i];
            gridCtx.beginPath();
            gridCtx.moveTo(x, 0);
            gridCtx.lineTo(x, cropBoxState.h);
            gridCtx.stroke();
        }
        for (let j = 0; j < gridLinesState.rowLines.length; j++) {
            const y = gridLinesState.rowLines[j];
            gridCtx.beginPath();
            gridCtx.moveTo(0, y);
            gridCtx.lineTo(cropBoxState.w, y);
            gridCtx.stroke();
        }

        // Pass 2: Crisp dashed white lines
        gridCtx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        gridCtx.lineDashOffset = dash4px;

        for (let i = 0; i < gridLinesState.colLines.length; i++) {
            const x = gridLinesState.colLines[i];
            gridCtx.beginPath();
            gridCtx.moveTo(x, 0);
            gridCtx.lineTo(x, cropBoxState.h);
            gridCtx.stroke();
        }
        for (let j = 0; j < gridLinesState.rowLines.length; j++) {
            const y = gridLinesState.rowLines[j];
            gridCtx.beginPath();
            gridCtx.moveTo(0, y);
            gridCtx.lineTo(cropBoxState.w, y);
            gridCtx.stroke();
        }

        gridCtx.setLineDash([]); // Reset dash

        // --- Layer 3: Highlight Hovered or Dragged Line with size badges (only in pointer mode) ---
        const highlight = gridLinesState.activeLine || gridLinesState.hoveredLine;
        if (highlight && tileBrushManager.getTool() === 'pointer') {
            gridCtx.save();
            gridCtx.lineWidth = 2 / effectiveZoom;
            gridCtx.strokeStyle = '#38bdf8';
            gridCtx.shadowColor = '#38bdf8';
            gridCtx.shadowBlur = 6 / effectiveZoom;

            if (highlight.type === 'col' && highlight.index < gridLinesState.colLines.length) {
                const hx = gridLinesState.colLines[highlight.index];
                gridCtx.beginPath();
                gridCtx.moveTo(hx, 0);
                gridCtx.lineTo(hx, cropBoxState.h);
                gridCtx.stroke();

                const prevX = highlight.index > 0 ? gridLinesState.colLines[highlight.index - 1] : 0;
                const nextX = highlight.index < gridLinesState.colLines.length - 1 ? gridLinesState.colLines[highlight.index + 1] : cropBoxState.w;
                const leftW = Math.round((hx - prevX) * scaleRatio);
                const rightW = Math.round((nextX - hx) * scaleRatio);

                drawDimensionBadge(gridCtx, `${leftW}px`, Math.max(24, hx - 30), Math.min(cropBoxState.h - 18, 24), effectiveZoom);
                drawDimensionBadge(gridCtx, `${rightW}px`, Math.min(cropBoxState.w - 24, hx + 30), Math.min(cropBoxState.h - 18, 24), effectiveZoom);
            } else if (highlight.type === 'row' && highlight.index < gridLinesState.rowLines.length) {
                const hy = gridLinesState.rowLines[highlight.index];
                gridCtx.beginPath();
                gridCtx.moveTo(0, hy);
                gridCtx.lineTo(cropBoxState.w, hy);
                gridCtx.stroke();

                const prevY = highlight.index > 0 ? gridLinesState.rowLines[highlight.index - 1] : 0;
                const nextY = highlight.index < gridLinesState.rowLines.length - 1 ? gridLinesState.rowLines[highlight.index + 1] : cropBoxState.h;
                const topH = Math.round((hy - prevY) * scaleRatio);
                const btmH = Math.round((nextY - hy) * scaleRatio);

                drawDimensionBadge(gridCtx, `${topH}px`, Math.min(cropBoxState.w - 32, 40), Math.max(14, hy - 14), effectiveZoom);
                drawDimensionBadge(gridCtx, `${btmH}px`, Math.min(cropBoxState.w - 32, 40), Math.min(cropBoxState.h - 14, hy + 14), effectiveZoom);
            }
            gridCtx.restore();
        }

        // --- Layer 4: Brush Hover Range Preview (筆刷懸停預覽) ---
        if (tileBrushManager.getTool() !== 'pointer' && brushHoverPos.col >= 0 && brushHoverPos.row >= 0) {
            const cells = tileBrushManager.getBrushGridRange(brushHoverPos.col, brushHoverPos.row, cols, rows);
            if (cells.length > 0) {
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                for (const { col, row } of cells) {
                    minX = Math.min(minX, colBounds[col]);
                    maxX = Math.max(maxX, colBounds[col + 1]);
                    minY = Math.min(minY, rowBounds[row]);
                    maxY = Math.max(maxY, rowBounds[row + 1]);
                }
                const bw = maxX - minX;
                const bh = maxY - minY;

                gridCtx.save();
                const curTool = tileBrushManager.getTool();
                if (curTool === 'include') {
                    gridCtx.fillStyle = 'rgba(34, 197, 94, 0.22)';
                    gridCtx.strokeStyle = '#22c55e';
                } else if (curTool === 'exclude') {
                    gridCtx.fillStyle = 'rgba(239, 68, 68, 0.28)';
                    gridCtx.strokeStyle = '#ef4444';
                } else {
                    gridCtx.fillStyle = 'rgba(148, 163, 184, 0.25)';
                    gridCtx.strokeStyle = '#94a3b8';
                }
                gridCtx.lineWidth = 2 / effectiveZoom;
                gridCtx.setLineDash([4 / effectiveZoom, 3 / effectiveZoom]);
                gridCtx.fillRect(minX, minY, bw, bh);
                gridCtx.strokeRect(minX, minY, bw, bh);
                gridCtx.restore();
            }
        }
    }

    function drawDimensionBadge(ctx, text, cx, cy, effectiveZoom = 1.0) {
        ctx.save();
        const fontSize = 10 / effectiveZoom;
        ctx.font = `bold ${fontSize}px monospace`;
        const metrics = ctx.measureText(text);
        const padX = 5 / effectiveZoom, padY = 3 / effectiveZoom;
        const bw = metrics.width + padX * 2;
        const bh = fontSize + padY * 2;
        const bx = cx - bw / 2;
        const by = cy - bh / 2;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1 / effectiveZoom;
        ctx.shadowBlur = 0;
        ctx.beginPath();
        const r = 3 / effectiveZoom;
        if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, r); else ctx.rect(bx, by, bw, bh);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, cx, cy);
        ctx.restore();
    }

    // --- Brush Toolbar UI Controller ---
    function updateBrushToolbarUI() {
        const curTool = tileBrushManager.getTool();
        const curSize = tileBrushManager.getBrushSize();

        if (brushPointerBtn) brushPointerBtn.classList.toggle('active', curTool === 'pointer');
        if (brushIncludeBtn) brushIncludeBtn.classList.toggle('active', curTool === 'include');
        if (brushExcludeBtn) brushExcludeBtn.classList.toggle('active', curTool === 'exclude');
        if (brushEraserBtn) brushEraserBtn.classList.toggle('active', curTool === 'eraser');

        brushSizeBtns.forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.size, 10) === curSize);
        });

        if (cropBox) {
            if (curTool !== 'pointer') {
                cropBox.classList.add('brush-mode');
            } else {
                cropBox.classList.remove('brush-mode');
            }
        }
        recalculateAndDrawGrid();
    }

    if (brushPointerBtn) brushPointerBtn.addEventListener('click', () => { tileBrushManager.setTool('pointer'); updateBrushToolbarUI(); });
    if (brushIncludeBtn) brushIncludeBtn.addEventListener('click', () => { tileBrushManager.setTool('include'); updateBrushToolbarUI(); });
    if (brushExcludeBtn) brushExcludeBtn.addEventListener('click', () => { tileBrushManager.setTool('exclude'); updateBrushToolbarUI(); });
    if (brushEraserBtn) brushEraserBtn.addEventListener('click', () => { tileBrushManager.setTool('eraser'); updateBrushToolbarUI(); });

    brushSizeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const sz = parseInt(btn.dataset.size, 10);
            tileBrushManager.setBrushSize(sz);
            updateBrushToolbarUI();
        });
    });

    if (clearMarksBtn) {
        clearMarksBtn.addEventListener('click', () => {
            tileBrushManager.clearAll();
            recalculateAndDrawGrid();
            statusText.textContent = '已重設全圖所有確定與取消標記！';
        });
    }

    tileBrushManager.onChange(() => {
        recalculateAndDrawGrid();
    });

    // Global Brush Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

        if (e.code === 'KeyV') {
            tileBrushManager.setTool('pointer');
            updateBrushToolbarUI();
        } else if (e.code === 'KeyB') {
            tileBrushManager.setTool('include');
            updateBrushToolbarUI();
        } else if (e.code === 'KeyX') {
            tileBrushManager.setTool('exclude');
            updateBrushToolbarUI();
        } else if (e.code === 'KeyE') {
            tileBrushManager.setTool('eraser');
            updateBrushToolbarUI();
        } else if (e.code >= 'Digit1' && e.code <= 'Digit5') {
            const sz = parseInt(e.key, 10);
            tileBrushManager.setBrushSize(sz);
            updateBrushToolbarUI();
        }
    });

    tileWidthInput.addEventListener('input', () => {
        syncUniformGridLines();
        recalculateAndDrawGrid();
    });
    tileHeightInput.addEventListener('input', () => {
        syncUniformGridLines();
        recalculateAndDrawGrid();
    });

    window.addEventListener('mousemove', (e) => {
        if (isGridDragging) handleGridDragMove(e.clientX, e.clientY, e);
    });
    window.addEventListener('touchmove', (e) => {
        if (isGridDragging && e.touches.length > 0) {
            handleGridDragMove(e.touches[0].clientX, e.touches[0].clientY, e);
        }
    }, { passive: false });

    window.addEventListener('mouseup', endGridDrag);
    window.addEventListener('touchend', endGridDrag);

    // ============================================================
    // VIEWPORT PAN & ZOOM SYSTEM (中鍵滾輪縮放 + 中鍵/右鍵拖曳平移)
    // ============================================================
    let currentZoom = 1.0;
    let panX = 0;
    let panY = 0;
    let isPanning = false;
    let panStartX = 0;
    let panStartY = 0;
    let startPanX = 0;
    let startPanY = 0;

    function applyTransform() {
        if (!editorWrapper) return;
        editorWrapper.style.transform = `translate(${panX}px, ${panY}px) scale(${currentZoom})`;
        slicerEditor.setZoom(currentZoom);
        if (zoomLevelDisplay) {
            zoomLevelDisplay.textContent = `${Math.round(currentZoom * 100)}%`;
        }
        if (currentMode === 'grid') {
            recalculateAndDrawGrid();
        }
    }

    function resetView() {
        if (!originalImg || editorWrapper.style.display === 'none') return;
        currentZoom = 1.0;
        const ew = editorWrapper.offsetWidth || 500;
        const eh = editorWrapper.offsetHeight || 500;
        const cw = canvasContainer.clientWidth || 800;
        const ch = canvasContainer.clientHeight || 600;
        panX = Math.round((cw - ew * currentZoom) / 2);
        panY = Math.round((ch - eh * currentZoom) / 2);
        applyTransform();
    }

    function zoomTo(newZoom, centerX, centerY) {
        if (!originalImg || editorWrapper.style.display === 'none') return;
        const targetZoom = Math.min(Math.max(0.1, newZoom), 25.0);
        if (Math.abs(targetZoom - currentZoom) < 0.001) return;

        let mouseX = centerX;
        let mouseY = centerY;
        if (typeof mouseX !== 'number' || typeof mouseY !== 'number') {
            mouseX = canvasContainer.clientWidth / 2;
            mouseY = canvasContainer.clientHeight / 2;
        }

        const imgX = (mouseX - panX) / currentZoom;
        const imgY = (mouseY - panY) / currentZoom;

        panX = mouseX - imgX * targetZoom;
        panY = mouseY - imgY * targetZoom;
        currentZoom = targetZoom;

        applyTransform();
    }

    // 1. 中鍵滾輪放大縮小
    canvasContainer.addEventListener('wheel', (e) => {
        if (!originalImg || editorWrapper.style.display === 'none') return;
        e.preventDefault();

        const rect = canvasContainer.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const zoomFactor = e.deltaY < 0 ? 1.15 : (1 / 1.15);
        zoomTo(currentZoom * zoomFactor, mouseX, mouseY);
    }, { passive: false });

    // 2. 中鍵及右鍵按下拖曳圖片預覽區 (Capture Phase 確保優先權)
    canvasContainer.addEventListener('mousedown', (e) => {
        if (e.button === 1 || e.button === 2) {
            e.preventDefault();
            e.stopPropagation();
            isPanning = true;
            panStartX = e.clientX;
            panStartY = e.clientY;
            startPanX = panX;
            startPanY = panY;
            canvasContainer.classList.add('is-panning');
        }
    }, { capture: true });

    window.addEventListener('mousemove', (e) => {
        if (isPanning) {
            e.preventDefault();
            const dx = e.clientX - panStartX;
            const dy = e.clientY - panStartY;
            panX = startPanX + dx;
            panY = startPanY + dy;
            applyTransform();
        }
    });

    window.addEventListener('mouseup', (e) => {
        if (isPanning && (e.button === 1 || e.button === 2)) {
            isPanning = false;
            canvasContainer.classList.remove('is-panning');
        }
    });

    // 禁用 canvas 預設右鍵選單以支援右鍵拖曳
    canvasContainer.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    // 禁用中鍵預設自動滾動箭頭
    canvasContainer.addEventListener('auxclick', (e) => {
        if (e.button === 1) e.preventDefault();
    });

    // 浮動縮放工具列按鈕
    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', () => {
            zoomTo(currentZoom * 1.25);
        });
    }
    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', () => {
            zoomTo(currentZoom / 1.25);
        });
    }
    if (zoomLevelDisplay) {
        zoomLevelDisplay.addEventListener('click', () => {
            zoomTo(1.0);
        });
    }
    if (resetViewBtn) {
        resetViewBtn.addEventListener('click', resetView);
    }

    // ============================================================
    // EXPORT SYSTEM (Selected PNG, Atlas JSON, Full ZIP)
    // ============================================================

    // 1. Export Selected PNG
    if (exportSelectedBtn) {
        exportSelectedBtn.addEventListener('click', async () => {
            if (!originalImg || !slicerEditor) return;
            const selected = slicerEditor.getSelectedSprites();
            if (selected.length === 0) {
                alert('請先點選任一要單獨匯出的框體！');
                return;
            }
            try {
                await AtlasExporter.exportSelected(originalImg, selected[0], {
                    format: exportFormatSelect.value,
                    prefix: filePrefixInput.value.trim() || 'sprite_'
                });
                statusText.textContent = `已成功單張匯出 ${selected[0].id} (保留透明通道)！`;
            } catch (err) {
                console.error(err);
                alert('匯出單張小圖失敗：' + err.message);
            }
        });
    }

    // 2. Export atlas.json
    if (exportJsonBtn) {
        exportJsonBtn.addEventListener('click', () => {
            if (!originalImg) return;

            if (currentMode === 'grid') {
                const realColBounds = [0, ...gridLinesState.colLines, cropBoxState.w].map(x => Math.round(x * scaleRatio));
                const realRowBounds = [0, ...gridLinesState.rowLines, cropBoxState.h].map(y => Math.round(y * scaleRatio));
                const origCropX = Math.round(cropBoxState.x * scaleRatio);
                const origCropY = Math.round(cropBoxState.y * scaleRatio);

                const gridSprites = [];
                let idx = 1;
                for (let r = 0; r < realRowBounds.length - 1; r++) {
                    for (let c = 0; c < realColBounds.length - 1; c++) {
                        if (tileBrushManager.isCellExcluded(c, r)) continue;

                        const cellX = realColBounds[c];
                        const cellY = realRowBounds[r];
                        const cellW = Math.max(1, realColBounds[c + 1] - cellX);
                        const cellH = Math.max(1, realRowBounds[r + 1] - cellY);

                        gridSprites.push({
                            id: `tile_${String(idx++).padStart(3, '0')}`,
                            x: origCropX + cellX,
                            y: origCropY + cellY,
                            width: cellW,
                            height: cellH,
                            confidence: 1.0
                        });
                    }
                }
                AtlasExporter.exportJSON(
                    originalImg,
                    gridSprites,
                    'atlas.json',
                    currentImageFileName || 'atlas.png'
                );
                statusText.textContent = `已成功匯出網格 atlas.json 座標資料 (已排除取消圖塊，共 ${gridSprites.length} 個)！`;
                return;
            }

            if (!slicerEditor) return;
            const sprites = slicerEditor.getSprites().filter(s => !tileBrushManager.isSpriteExcluded(s.id));
            if (sprites.length === 0) {
                alert('目前畫面上沒有任何未排除的 Sprite 框體！');
                return;
            }
            AtlasExporter.exportJSON(
                originalImg,
                sprites,
                'atlas.json',
                currentImageFileName || 'atlas.png'
            );
            statusText.textContent = `已成功匯出標準 atlas.json 座標資料 (已排除取消框體，共 ${sprites.length} 個)！`;
        });
    }

    // 3. Export ZIP (Auto mode & Grid mode)
    downloadBtn.addEventListener('click', async () => {
        if (!originalImg) return;

        const format = exportFormatSelect.value;
        const prefix = filePrefixInput.value.trim() || 'tile_';

        loaderModal.classList.add('active');
        progressBar.style.width = '0%';

        try {
            if (currentMode === 'auto') {
                const sprites = slicerEditor.getSprites().filter(s => !tileBrushManager.isSpriteExcluded(s.id));
                if (sprites.length === 0) {
                    alert('目前沒有任何框選的小圖，請先執行自動識別或手動新增！');
                    loaderModal.classList.remove('active');
                    return;
                }

                progressText.textContent = `準備切圖，共 ${sprites.length} 張...`;

                await AtlasExporter.exportZIP(originalImg, sprites, {
                    format,
                    prefix,
                    includeJson: true,
                    imageName: currentImageFileName || 'atlas.png',
                    zipFilename: `${prefix}tiles.zip`
                }, (current, total, percent) => {
                    progressBar.style.width = `${percent}%`;
                    progressText.textContent = `切圖打包中: ${current} / ${total} 張 (${percent}%)`;
                });

                statusText.textContent = `切圖打包完成，已匯出全部 ${sprites.length} 張小圖及 atlas.json！`;
            } else {
                // Slicing in Grid Mode (Non-uniform custom grid lines support)
                const realColBounds = [0, ...gridLinesState.colLines, cropBoxState.w].map(x => Math.round(x * scaleRatio));
                const realRowBounds = [0, ...gridLinesState.rowLines, cropBoxState.h].map(y => Math.round(y * scaleRatio));
                const origCropX = Math.round(cropBoxState.x * scaleRatio);
                const origCropY = Math.round(cropBoxState.y * scaleRatio);

                const cols = realColBounds.length - 1;
                const rows = realRowBounds.length - 1;
                const total = cols * rows;
                const effectiveCount = tileBrushManager.getEffectiveGridCount(cols, rows);

                if (effectiveCount <= 0) {
                    alert('裁切區域內所有圖片均已被標記取消，無法切出任何圖片！');
                    loaderModal.classList.remove('active');
                    return;
                }

                progressText.textContent = `準備切圖，共 ${effectiveCount} 張...`;
                const zip = new JSZip();

                let ext = 'png';
                if (format === 'image/jpeg') ext = 'jpg';
                if (format === 'image/webp') ext = 'webp';

                const sliceCanvas = document.createElement('canvas');
                const sliceCtx = sliceCanvas.getContext('2d');

                let processed = 0;
                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        if (tileBrushManager.isCellExcluded(c, r)) continue;

                        const cellX = realColBounds[c];
                        const cellY = realRowBounds[r];
                        const cellW = Math.max(1, realColBounds[c + 1] - cellX);
                        const cellH = Math.max(1, realRowBounds[r + 1] - cellY);

                        const sx = origCropX + cellX;
                        const sy = origCropY + cellY;
                        const sw = Math.min(cellW, originalImg.width - sx);
                        const sh = Math.min(cellH, originalImg.height - sy);

                        sliceCanvas.width = sw;
                        sliceCanvas.height = sh;
                        sliceCtx.clearRect(0, 0, sw, sh);

                        sliceCtx.drawImage(
                            originalImg,
                            sx, sy, sw, sh,
                            0, 0, sw, sh
                        );

                        const blob = await new Promise(res => sliceCanvas.toBlob(res, format, 0.95));
                        const padR = String(r + 1).padStart(2, '0');
                        const padC = String(c + 1).padStart(2, '0');
                        const filename = `${prefix}r${padR}_c${padC}.${ext}`;
                        zip.file(filename, blob);

                        processed++;
                        const percent = Math.round((processed / effectiveCount) * 100);
                        progressBar.style.width = `${percent}%`;
                        progressText.textContent = `已切圖 ${processed} / ${effectiveCount} 張 (${percent}%)`;

                        if (processed % 6 === 0) await new Promise(r => setTimeout(r, 2));
                    }
                }

                progressText.textContent = '正在壓縮打包成 ZIP 檔...';
                const zipBlob = await zip.generateAsync({ type: 'blob' }, (meta) => {
                    progressBar.style.width = `${Math.round(meta.percent)}%`;
                    progressText.textContent = `壓縮打包中: ${Math.round(meta.percent)}%`;
                });

                const downloadUrl = URL.createObjectURL(zipBlob);
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = `${prefix}grid_tiles.zip`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(downloadUrl);

                statusText.textContent = '網格切圖打包完成，已觸發瀏覽器下載！';
            }
        } catch (err) {
            console.error('Export error:', err);
            alert('切圖打包過程中發生錯誤：' + err.message);
        } finally {
            loaderModal.classList.remove('active');
        }
    });

    // Initialize in auto mode
    setMode('auto');

    // --- AUTOMATED TEST HOOK (?image=... or ?test in URL) ---
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('image')) {
        const imgPath = urlParams.get('image');
        const customImg = new Image();
        customImg.onload = () => {
            originalImg = customImg;
            currentImageFileName = imgPath.split('/').pop().split('\\').pop();
            setupWorkspace();
        };
        customImg.src = imgPath;
    } else if (urlParams.has('test') && !urlParams.has('image')) {
        const testImg = new Image();
        testImg.onload = () => {
            originalImg = testImg;
            currentImageFileName = 'test_atlas.png';
            setupWorkspace();
        };
        testImg.src = 'test_atlas.png';
    }
});
