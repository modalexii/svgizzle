// UI interactions and event handlers

import { state } from './state.js';
import { splitCompoundPaths, convertPathsToLines } from './svg-processing.js';
import { buildShapeGraph } from './shape-graph.js';

// Get color for line based on its state
export function getLineColor(line) {
    if (!line.isAdjustable) {
        return '#000000'; // Normal - black
    } else if (line.multiplier === 1) {
        return '#FF6B00'; // 1x adjustable - bright orange
    } else if (line.multiplier === 2) {
        return '#9C27B0'; // 2x adjustable - purple
    }
    return '#000000';
}

// Handle line click - toggle state
export function handleLineClick(line) {
    // Cycle through states: normal → 1x → 2x → normal
    if (!line.isAdjustable) {
        // normal → 1x
        line.isAdjustable = true;
        line.multiplier = 1;
    } else if (line.multiplier === 1) {
        // 1x → 2x
        line.multiplier = 2;
    } else if (line.multiplier === 2) {
        // 2x → normal
        line.isAdjustable = false;
        line.multiplier = 1;
    }

    // Update visual appearance
    updateLineVisual(line);

    // Log state change
    console.log('Line', line.id, 'state:', line.isAdjustable ? line.multiplier + 'x adjustable' : 'normal');
}

// Update single line visual appearance
export function updateLineVisual(line) {
    // Skip curves - they don't have individual path elements
    if (line.isCurve) {
        return;
    }
    const color = getLineColor(line);
    line.svgPath.attr('stroke', color);
}

// Update all line visuals
export function updateAllLineVisuals() {
    state.shapes.forEach(shape => {
        shape.lines.forEach(line => {
            updateLineVisual(line);
        });
    });
}

// Make line segments interactive (only straight lines, curves are non-interactive)
export function makeLineSegmentsInteractive(draw) {
    console.log('=== Making Line Segments Interactive ===');

    let interactiveCount = 0;

    // Only make straight lines interactive (skip curves)
    state.shapes.forEach(shape => {
        shape.lines.forEach(line => {
            // Skip curves - they're not selectable
            if (line.isCurve) {
                return;
            }

            const path = line.svgPath;

            // Make path interactive
            path.style('cursor', 'pointer');

            // Add click handler
            path.on('click', function(event) {
                event.stopPropagation();
                handleLineClick(line);
            });

            // Add hover handlers
            path.on('mouseenter', function() {
                path.attr('stroke-width', 5);
            });

            path.on('mouseleave', function() {
                path.attr('stroke-width', 3);
            });

            interactiveCount++;
        });
    });

    // Apply initial colors based on line state
    updateAllLineVisuals();

    console.log('Made', interactiveCount, 'straight line segments interactive');
    console.log('Skipped', state.shapes.reduce((sum, s) => sum + s.lines.filter(l => l.isCurve).length, 0), 'curve segments');
}

// Process SVG: split compound paths, build shape graph
export function processSVG(draw) {
    console.log('=== Starting SVG Processing ===');

    // Find all path elements
    const allPaths = draw.find('path');
    console.log('Found', allPaths.length, 'total paths');

    // Split compound paths
    const splitPaths = splitCompoundPaths(allPaths);
    console.log('After splitting:', splitPaths.length, 'paths');

    // Convert paths to line segments and create interactive line paths
    const lineSegments = convertPathsToLines(splitPaths, draw);
    console.log('Extracted', lineSegments.length, 'line segments');
    console.log('Straight lines:', lineSegments.filter(l => !l.isCurve).length);
    console.log('Curves:', lineSegments.filter(l => l.isCurve).length);

    // Build shape graph
    state.shapes = buildShapeGraph(lineSegments);
    console.log('Built', state.shapes.length, 'closed shapes');

    console.log('=== SVG Processing Complete ===');
}

// Load SVG using SVG.js
export function loadSVG(svgText, svgCanvas) {
    // Clear previous SVG
    svgCanvas.innerHTML = '';
    svgCanvas.classList.add('has-content');

    // Create SVG.js drawing
    const draw = SVG().addTo('#svg-canvas').size('100%', '100%');

    // Load the SVG content
    draw.svg(svgText);

    // Get the actual SVG content (first child group or element)
    const svgContent = draw.children()[0];

    if (!svgContent) {
        throw new Error('No content found in SVG');
    }

    // Get the bounding box and center the content
    const bbox = svgContent.bbox();
    const canvasWidth = svgCanvas.clientWidth;
    const canvasHeight = svgCanvas.clientHeight;

    // Calculate scale to fit content with padding
    const padding = 40;
    const scaleX = (canvasWidth - padding * 2) / bbox.width;
    const scaleY = (canvasHeight - padding * 2) / bbox.height;
    const scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down

    // Center the content
    const viewBox = {
        x: bbox.x - padding / scale,
        y: bbox.y - padding / scale,
        width: bbox.width + (padding * 2) / scale,
        height: bbox.height + (padding * 2) / scale
    };

    draw.viewbox(viewBox.x, viewBox.y, viewBox.width, viewBox.height);

    // Store in state
    state.svgDraw = draw;
    state.originalSVG = svgContent;

    console.log('SVG loaded successfully');
    console.log('SVG dimensions:', bbox);
    console.log('Found', draw.find('path').length, 'paths');

    // Process SVG: split compound paths and build shape graph
    processSVG(draw);

    // Make line segments interactive
    makeLineSegmentsInteractive(draw);

    return draw;
}

// Handle file upload
export function handleFileUpload(event, fileNameDisplay, svgCanvas, applyBtn, downloadBtn, showStatus) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.includes('svg')) {
        showStatus('Please upload a valid SVG file', 'error');
        return;
    }

    state.fileName = file.name;
    fileNameDisplay.textContent = file.name;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            loadSVG(e.target.result, svgCanvas);
            showStatus('SVG loaded successfully! Click lines to mark them as adjustable.', 'success');

            // Enable buttons
            applyBtn.disabled = false;
            downloadBtn.disabled = false;
        } catch (error) {
            showStatus('Error loading SVG: ' + error.message, 'error');
            console.error('SVG load error:', error);
        }
    };
    reader.readAsText(file);
}

// Update material thickness
export function updateMaterialThickness(event) {
    const value = parseFloat(event.target.value);
    if (value > 0) {
        state.materialThickness = value;
    }
}

// Update DPI
export function updateDPI(event) {
    const value = parseInt(event.target.value);
    if (value > 0) {
        state.dpi = value;
    }
}

// Apply adjustments (placeholder for now)
export function applyAdjustments(showStatus) {
    if (!state.svgDraw) {
        showStatus('Please upload an SVG first', 'error');
        return;
    }

    showStatus('Apply function will be implemented in Phase 4-7', 'error');
    console.log('Apply adjustments clicked');
    console.log('Material thickness:', state.materialThickness, 'mm');
    console.log('DPI:', state.dpi);
}

// Download SVG
export function downloadSVG(showStatus) {
    if (!state.svgDraw) {
        showStatus('No SVG to download', 'error');
        return;
    }

    try {
        const svgString = state.svgDraw.svg();
        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = state.fileName.replace('.svg', '_adjusted.svg');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showStatus('SVG downloaded successfully!', 'success');
    } catch (error) {
        showStatus('Error downloading SVG: ' + error.message, 'error');
        console.error('Download error:', error);
    }
}

// Show status message
export function showStatus(message, type, statusMessage) {
    statusMessage.textContent = message;
    statusMessage.className = 'status-message ' + type;

    if (type === 'success') {
        setTimeout(() => {
            statusMessage.style.display = 'none';
        }, 5000);
    }
}
