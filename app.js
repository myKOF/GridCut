// GridCut - Core Application Logic (Decoupled CV Pipeline + Modern Atlas Editor)

import { AtlasAnalyzer } from './src/analyzer/AtlasAnalyzer.js?v=2.3.0';
import { MetadataDetector } from './src/analyzer/MetadataDetector.js?v=2.3.0';
import { AlphaSegmenter } from './src/analyzer/AlphaSegmenter.js?v=2.3.0';
import { BackgroundSegmenter } from './src/analyzer/BackgroundSegmenter.js?v=2.3.0';
import { AtlasSlicerEditor } from './src/editor/AtlasSlicerEditor.js?v=2.3.0';
import { AtlasExporter } from './src/editor/AtlasExporter.js?v=2.3.0';

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

    // Grid Mode Inputs
    const tileWidthInput = document.getElementById('tileWidth');
    const tileHeightInput = document.getElementById('tileHeight');
    const resetCropBtn = document.getElementById('resetCropBtn');

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

    // Grid Mode Crop Box State (Rendered CSS space)
    let cropBoxState = { x: 0, y: 0, w: 0, h: 0 };
    let isGridDragging = false;
    let gridDragType = null;
    let gridStartX = 0, gridStartY = 0;
    let startCropState = { x: 0, y: 0, w: 0, h: 0 };

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
        const enableWatershed = enableWatershedInput ? enableWatershedInput.checked : true;
        const watershedDistance = watershedDistanceInput ? Math.max(4, isNaN(parseInt(watershedDistanceInput.value)) ? 14 : parseInt(watershedDistanceInput.value)) : 14;

        // Async execution to avoid freezing browser render
        setTimeout(async () => {
            try {
                const result = await AtlasAnalyzer.analyze(originalImg, {
                    bgType,
                    alphaThreshold,
                    bgTolerance,
                    minSize,
                    mergeGap,
                    padding: boxPadding,
                    morphCloseRadius,
                    groupDistance,
                    enableWatershed,
                    watershedDistance
                }, cachedMetadata);

                slicerEditor.loadSprites(result.sprites);
                const count = result.sprites.length;
                const wsInfo = result.stats.watershedSplitCount ? `, 分水嶺切出 +${result.stats.watershedSplitCount} 個` : '';
                statusText.textContent = `成功識別 ${count} 個 Sprite (耗時 ${result.stats.durationMs}ms, 聚合前: ${result.stats.rawComponentCount} 個${wsInfo})`;
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
            const targetTileW = parseInt(tileWidthInput.value) || 128;
            const targetTileH = parseInt(tileHeightInput.value) || 128;
            const origCropW = Math.round(cropBoxState.w * scaleRatio);
            const origCropH = Math.round(cropBoxState.h * scaleRatio);
            const total = Math.ceil(origCropW / targetTileW) * Math.ceil(origCropH / targetTileH);
            downloadBtn.disabled = total <= 0;
            if (exportJsonBtn) exportJsonBtn.disabled = true;
        }
    }

    // ============================================================
    // GRID MODE LOGIC (PRESERVED & FULLY COMPATIBLE)
    // ============================================================

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

    cropBox.addEventListener('mousedown', startGridDrag);
    cropBox.addEventListener('touchstart', startGridDrag, { passive: false });

    function startGridDrag(e) {
        if (e.button === 1 || e.button === 2) return;
        if (e.target.classList.contains('handle')) {
            gridDragType = e.target.dataset.handle;
        } else if (e.target === cropBox || e.target === gridCanvas) {
            gridDragType = 'move';
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

        if (gridDragType === 'move') {
            let newX = Math.max(0, Math.min(containerW - startCropState.w, startCropState.x + deltaX));
            let newY = Math.max(0, Math.min(containerH - startCropState.h, startCropState.y + deltaY));
            cropBoxState.x = newX;
            cropBoxState.y = newY;
        } else {
            let nx = startCropState.x;
            let ny = startCropState.y;
            let nw = startCropState.w;
            let nh = startCropState.h;

            if (gridDragType.includes('w')) {
                const px = startCropState.x + deltaX;
                const pw = startCropState.w - deltaX;
                if (px >= 0 && pw >= minBoxSize) { nx = px; nw = pw; }
            } else if (gridDragType.includes('e')) {
                const pw = startCropState.w + deltaX;
                if (nx + pw <= containerW && pw >= minBoxSize) nw = pw;
            }

            if (gridDragType.includes('n')) {
                const py = startCropState.y + deltaY;
                const ph = startCropState.h - deltaY;
                if (py >= 0 && ph >= minBoxSize) { ny = py; nh = ph; }
            } else if (gridDragType.includes('s')) {
                const ph = startCropState.h + deltaY;
                if (ny + ph <= containerH && ph >= minBoxSize) nh = ph;
            }

            cropBoxState.x = nx;
            cropBoxState.y = ny;
            cropBoxState.w = nw;
            cropBoxState.h = nh;
        }

        updateCropBoxUI();
        recalculateAndDrawGrid();
    }

    function endGridDrag() {
        isGridDragging = false;
        gridDragType = null;
    }

    function updateCropBoxUI() {
        cropBox.style.left = `${cropBoxState.x}px`;
        cropBox.style.top = `${cropBoxState.y}px`;
        cropBox.style.width = `${cropBoxState.w}px`;
        cropBox.style.height = `${cropBoxState.h}px`;

        gridCanvas.width = cropBoxState.w;
        gridCanvas.height = cropBoxState.h;
    }

    function recalculateAndDrawGrid() {
        if (!originalImg || currentMode !== 'grid') return;

        const targetTileW = Math.max(8, parseInt(tileWidthInput.value) || 128);
        const targetTileH = Math.max(8, parseInt(tileHeightInput.value) || 128);

        const origCropW = Math.round(cropBoxState.w * scaleRatio);
        const origCropH = Math.round(cropBoxState.h * scaleRatio);

        cropSizeSpan.textContent = `${origCropW} × ${origCropH} px`;

        const cols = Math.ceil(origCropW / targetTileW);
        const rows = Math.ceil(origCropH / targetTileH);
        const total = cols * rows;

        colsCountSpan.textContent = cols;
        rowsCountSpan.textContent = rows;
        totalCountSpan.textContent = total;

        gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
        if (cols <= 0 || rows <= 0) return;

        const stepX = (targetTileW / scaleRatio);
        const stepY = (targetTileH / scaleRatio);

        gridCtx.lineWidth = 1;
        gridCtx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        gridCtx.setLineDash([4, 4]);
        drawGridLines(cols, rows, stepX, stepY);

        gridCtx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        gridCtx.lineDashOffset = 4;
        drawGridLines(cols, rows, stepX, stepY);
    }

    function drawGridLines(cols, rows, stepX, stepY) {
        for (let i = 1; i <= cols; i++) {
            const x = Math.min(gridCanvas.width - 1, i * stepX);
            gridCtx.beginPath();
            gridCtx.moveTo(x, 0);
            gridCtx.lineTo(x, gridCanvas.height);
            gridCtx.stroke();
        }
        for (let j = 1; j <= rows; j++) {
            const y = Math.min(gridCanvas.height - 1, j * stepY);
            gridCtx.beginPath();
            gridCtx.moveTo(0, y);
            gridCtx.lineTo(gridCanvas.width, y);
            gridCtx.stroke();
        }
    }

    tileWidthInput.addEventListener('input', recalculateAndDrawGrid);
    tileHeightInput.addEventListener('input', recalculateAndDrawGrid);

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
            if (!originalImg || !slicerEditor) return;
            const sprites = slicerEditor.getSprites();
            if (sprites.length === 0) {
                alert('目前畫面上沒有任何 Sprite 框體！');
                return;
            }
            AtlasExporter.exportJSON(
                originalImg,
                sprites,
                'atlas.json',
                currentImageFileName || 'atlas.png'
            );
            statusText.textContent = `已成功匯出標準 atlas.json 座標資料！`;
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
                const sprites = slicerEditor.getSprites();
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
                // Slicing in Grid Mode
                const targetTileW = Math.max(8, parseInt(tileWidthInput.value) || 128);
                const targetTileH = Math.max(8, parseInt(tileHeightInput.value) || 128);

                const origCropX = Math.round(cropBoxState.x * scaleRatio);
                const origCropY = Math.round(cropBoxState.y * scaleRatio);
                const origCropW = Math.round(cropBoxState.w * scaleRatio);
                const origCropH = Math.round(cropBoxState.h * scaleRatio);

                const cols = Math.ceil(origCropW / targetTileW);
                const rows = Math.ceil(origCropH / targetTileH);
                const total = cols * rows;

                if (total <= 0) {
                    alert('裁切區域內無法切出任何圖片！');
                    loaderModal.classList.remove('active');
                    return;
                }

                progressText.textContent = `準備切圖，共 ${total} 張...`;
                const zip = new JSZip();

                let ext = 'png';
                if (format === 'image/jpeg') ext = 'jpg';
                if (format === 'image/webp') ext = 'webp';

                const sliceCanvas = document.createElement('canvas');
                sliceCanvas.width = targetTileW;
                sliceCanvas.height = targetTileH;
                const sliceCtx = sliceCanvas.getContext('2d');

                let processed = 0;
                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        const sx = origCropX + (c * targetTileW);
                        const sy = origCropY + (r * targetTileH);
                        const sw = Math.min(targetTileW, originalImg.width - sx);
                        const sh = Math.min(targetTileH, originalImg.height - sy);

                        sliceCanvas.width = sw;
                        sliceCanvas.height = sh;
                        sliceCtx.clearRect(0, 0, sw, sh);

                        sliceCtx.drawImage(
                            originalImg,
                            sx, sy, sw, sh,
                            0, 0, sw, sh
                        );

                        const blob = await new Promise(res => sliceCanvas.toBlob(res, format, 0.95));
                        const paddedRow = String(r).padStart(2, '0');
                        const paddedCol = String(c).padStart(2, '0');
                        const filename = `${prefix}${paddedRow}_${paddedCol}.${ext}`;
                        zip.file(filename, blob);

                        processed++;
                        const percent = Math.round((processed / total) * 100);
                        progressBar.style.width = `${percent}%`;
                        progressText.textContent = `已切圖 ${processed} / ${total} 張 (${percent}%)`;

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
