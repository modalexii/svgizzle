// Geometric adjustment engine for modifying line lengths based on material thickness

import { state } from './state.js';
import { pointsEqual } from './geometry.js';

/**
 * Task 4.1: Convert millimeters + DPI to SVG units
 * Formula: (mm * dpi) / 25.4
 * @param {number} mm - Measurement in millimeters
 * @param {number} dpi - Dots per inch (default from state)
 * @returns {number} - SVG units
 */
export function mmToSVGUnits(mm, dpi = null) {
    const dotsPerInch = dpi || state.dpi;
    if (dotsPerInch <= 0) {
        throw new Error('DPI must be greater than 0');
    }
    if (mm < 0) {
        throw new Error('Millimeters must be non-negative');
    }

    return (mm * dotsPerInch) / 25.4;
}

/**
 * Task 4.2: Calculate shape centroid for direction determination
 * @param {Object} shape - Shape object with lines array
 * @returns {Object} - {x, y} centroid point
 */
export function calculateShapeCentroid(shape) {
    if (!shape.lines || shape.lines.length === 0) {
        throw new Error('Shape has no lines');
    }

    let sumX = 0;
    let sumY = 0;
    let pointCount = 0;

    // Use all line segment start points
    shape.lines.forEach(line => {
        sumX += line.startPoint.x;
        sumY += line.startPoint.y;
        pointCount++;
    });

    return {
        x: sumX / pointCount,
        y: sumY / pointCount
    };
}

/**
 * Task 4.2: Calculate perpendicular direction vector for a line
 * Uses winding order to determine which perpendicular (there are two: +90° and -90°)
 * @param {Object} line - Line segment object
 * @param {Object} shape - Parent shape object
 * @param {boolean} expandAway - True to expand away from centroid, false to contract toward it
 * @returns {Object} - {x, y} unit vector perpendicular to line
 */
export function calculatePerpendicularDirection(line, shape, expandAway = true) {
    // Get line direction vector
    const dx = line.endPoint.x - line.startPoint.x;
    const dy = line.endPoint.y - line.startPoint.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length === 0) {
        throw new Error('Cannot calculate perpendicular for zero-length line');
    }

    // Normalize direction vector
    const normalizedDx = dx / length;
    const normalizedDy = dy / length;

    // Calculate both perpendicular vectors (rotate by +90° and -90°)
    // Right perpendicular (rotate +90° clockwise in SVG coordinates where Y increases downward)
    const perpRight = {
        x: normalizedDy,
        y: -normalizedDx
    };

    // Left perpendicular (rotate -90° counter-clockwise)
    const perpLeft = {
        x: -normalizedDy,
        y: normalizedDx
    };

    // Calculate shape centroid
    const centroid = calculateShapeCentroid(shape);

    // Calculate line midpoint
    const midpoint = {
        x: (line.startPoint.x + line.endPoint.x) / 2,
        y: (line.startPoint.y + line.endPoint.y) / 2
    };

    // Vector from centroid to line midpoint
    const toCentroid = {
        x: midpoint.x - centroid.x,
        y: midpoint.y - centroid.y
    };

    // Dot product to determine which perpendicular points away from centroid
    const dotRight = perpRight.x * toCentroid.x + perpRight.y * toCentroid.y;
    const dotLeft = perpLeft.x * toCentroid.x + perpLeft.y * toCentroid.y;

    // Choose perpendicular based on expand/contract and which points away from centroid
    let chosenPerp;
    if (expandAway) {
        // Choose the perpendicular that points away from centroid (positive dot product)
        chosenPerp = dotRight > dotLeft ? perpRight : perpLeft;
    } else {
        // Choose the perpendicular that points toward centroid (negative dot product)
        chosenPerp = dotRight < dotLeft ? perpRight : perpLeft;
    }

    console.log('Line', line.id, 'perpendicular direction:', chosenPerp,
                '(expand away:', expandAway, ', winding:', shape.windingOrder + ')');

    return chosenPerp;
}

/**
 * Task 4.3: Adjust a single line to target length
 *
 * CORRECTED ALGORITHM - Maintains closed shapes:
 * 1. Adjustable lines move perpendicular to achieve target length
 * 2. Endpoints MUST stay connected - update shared connection points
 * 3. Slot edges don't translate but endpoints can shift along the line
 * 4. Tab connectors translate as whole lines
 *
 * @param {Object} line - Line segment to adjust
 * @param {Object} shape - Parent shape object
 * @returns {Object} - New line geometry {startPoint, endPoint, length}
 */
export function adjustSingleLine(line, shape) {
    if (!line.isAdjustable) {
        console.log('Line', line.id, 'is not adjustable, skipping');
        return null;
    }

    // Calculate target length in SVG units
    const targetLengthMM = state.materialThickness * line.multiplier;
    const targetLengthSVG = mmToSVGUnits(targetLengthMM);

    console.log('Adjusting line', line.id);
    console.log('  Current length:', line.length.toFixed(2), 'SVG units');
    console.log('  Target:', targetLengthMM, 'mm =', targetLengthSVG.toFixed(2), 'SVG units');
    console.log('  Multiplier:', line.multiplier + 'x');

    // Calculate delta
    const delta = targetLengthSVG - line.length;
    console.log('  Delta:', delta.toFixed(2), 'SVG units');

    if (Math.abs(delta) < 0.001) {
        console.log('  Line is already at target length');
        return null;
    }

    // Get line direction (will be preserved - angle doesn't change!)
    const lineDir = {
        x: line.endPoint.x - line.startPoint.x,
        y: line.endPoint.y - line.startPoint.y
    };
    const currentLength = Math.sqrt(lineDir.x * lineDir.x + lineDir.y * lineDir.y);
    lineDir.x /= currentLength;
    lineDir.y /= currentLength;

    // Get adjacent lines to classify them
    const startAdjacent = line.adjacentLines.start ? findLineById(line.adjacentLines.start) : null;
    const endAdjacent = line.adjacentLines.end ? findLineById(line.adjacentLines.end) : null;

    const startType = startAdjacent ? (startAdjacent.isAdjustable ? 'adjustable' : classifyLineType(startAdjacent)) : 'none';
    const endType = endAdjacent ? (endAdjacent.isAdjustable ? 'adjustable' : classifyLineType(endAdjacent)) : 'none';

    console.log('  Start adjacent:', startAdjacent?.id, '- type:', startType);
    console.log('  End adjacent:', endAdjacent?.id, '- type:', endType);

    let newStartPoint, newEndPoint;

    // STRATEGY: Keep angle fixed, adjust length by moving endpoints along the line direction
    // The key: determine which endpoint(s) should move based on what they connect to

    // Case 1: Both ends connect to slot edges (rare - probably an error in marking)
    if ((startType === 'slot-edge' || startType === 'perimeter') &&
        (endType === 'slot-edge' || endType === 'perimeter')) {
        console.log('  WARNING: Both ends on slot edges - extending from midpoint');
        const midpoint = {
            x: (line.startPoint.x + line.endPoint.x) / 2,
            y: (line.startPoint.y + line.endPoint.y) / 2
        };
        const halfTarget = targetLengthSVG / 2;
        newStartPoint = {
            x: midpoint.x - lineDir.x * halfTarget,
            y: midpoint.y - lineDir.y * halfTarget
        };
        newEndPoint = {
            x: midpoint.x + lineDir.x * halfTarget,
            y: midpoint.y + lineDir.y * halfTarget
        };
    }
    // Case 2: Start on slot edge - keep start fixed, extend/contract end
    else if (startType === 'slot-edge' || startType === 'perimeter') {
        console.log('  Start on slot edge - keeping start fixed');
        newStartPoint = { ...line.startPoint };
        newEndPoint = {
            x: newStartPoint.x + lineDir.x * targetLengthSVG,
            y: newStartPoint.y + lineDir.y * targetLengthSVG
        };
    }
    // Case 3: End on slot edge - keep end fixed, extend/contract start
    else if (endType === 'slot-edge' || endType === 'perimeter') {
        console.log('  End on slot edge - keeping end fixed');
        newEndPoint = { ...line.endPoint };
        newStartPoint = {
            x: newEndPoint.x - lineDir.x * targetLengthSVG,
            y: newEndPoint.y - lineDir.y * targetLengthSVG
        };
    }
    // Case 4: Neither end on slot edge - both can move
    else {
        console.log('  Both ends free - extending from midpoint');
        const midpoint = {
            x: (line.startPoint.x + line.endPoint.x) / 2,
            y: (line.startPoint.y + line.endPoint.y) / 2
        };
        const halfTarget = targetLengthSVG / 2;
        newStartPoint = {
            x: midpoint.x - lineDir.x * halfTarget,
            y: midpoint.y - lineDir.y * halfTarget
        };
        newEndPoint = {
            x: midpoint.x + lineDir.x * halfTarget,
            y: midpoint.y + lineDir.y * halfTarget
        };
    }

    // Calculate new length to verify
    const newDx = newEndPoint.x - newStartPoint.x;
    const newDy = newEndPoint.y - newStartPoint.y;
    const newLength = Math.sqrt(newDx * newDx + newDy * newDy);

    console.log('  New length:', newLength.toFixed(2), 'SVG units');
    console.log('  New start:', newStartPoint);
    console.log('  New end:', newEndPoint);

    return {
        startPoint: newStartPoint,
        endPoint: newEndPoint,
        length: newLength
    };
}

/**
 * Project a point onto a line (find closest point on line to given point)
 * @param {Object} point - {x, y} point to project
 * @param {Object} line - Line segment to project onto
 * @returns {Object} - {x, y} projected point on the line
 */
function projectPointOntoLine(point, line) {
    // Line direction vector
    const dx = line.endPoint.x - line.startPoint.x;
    const dy = line.endPoint.y - line.startPoint.y;

    // Vector from line start to point
    const px = point.x - line.startPoint.x;
    const py = point.y - line.startPoint.y;

    // Project onto line direction
    const lineLengthSquared = dx * dx + dy * dy;
    const t = (px * dx + py * dy) / lineLengthSquared;

    // Clamp t to [0, 1] to stay on line segment
    const tClamped = Math.max(0, Math.min(1, t));

    return {
        x: line.startPoint.x + tClamped * dx,
        y: line.startPoint.y + tClamped * dy
    };
}

/**
 * Phase 4 test function: Apply adjustments to all adjustable lines
 * Does NOT propagate changes or maintain closure - that's Phase 5
 * @returns {number} - Number of lines adjusted
 */
export function applyAdjustmentsPhase4() {
    console.log('=== Phase 4: Applying Geometric Adjustments ===');
    console.log('Material thickness:', state.materialThickness, 'mm');
    console.log('DPI:', state.dpi);

    let adjustedCount = 0;

    state.shapes.forEach((shape, shapeIndex) => {
        console.log('\nProcessing shape', shapeIndex, '(', shape.lines.length, 'lines,',
                    'winding:', shape.windingOrder + ')');

        shape.lines.forEach(line => {
            if (line.isAdjustable) {
                const newGeometry = adjustSingleLine(line, shape);

                if (newGeometry) {
                    // Update line data (but don't update SVG yet - just testing)
                    line.startPoint = newGeometry.startPoint;
                    line.endPoint = newGeometry.endPoint;
                    line.length = newGeometry.length;

                    adjustedCount++;
                }
            }
        });
    });

    console.log('\n=== Phase 4 Complete ===');
    console.log('Adjusted', adjustedCount, 'lines');

    return adjustedCount;
}

/**
 * Phase 5: Find a line by its ID across all shapes
 * @param {string} lineId - Line ID to find
 * @returns {Object|null} - Line object or null
 */
function findLineById(lineId) {
    for (const shape of state.shapes) {
        const line = shape.lines.find(l => l.id === lineId);
        if (line) return line;
    }
    return null;
}

/**
 * Phase 5: Find which shape contains a given line
 * @param {Object} line - Line to find parent shape for
 * @returns {Object|null} - Shape object or null
 */
function findShapeForLine(line) {
    return state.shapes.find(shape => shape.lines.includes(line)) || null;
}

/**
 * Phase 6: Classify line type based on adjacency to adjustable lines
 * @param {Object} line - Line to classify
 * @returns {string} - 'tab-connector' | 'slot-edge' | 'perimeter'
 */
function classifyLineType(line) {
    if (line.isAdjustable) {
        return 'adjustable'; // Should not be called on adjustable lines
    }

    // Count how many adjacent lines are adjustable
    let adjustableNeighborCount = 0;
    const adjacentIds = [line.adjacentLines.start, line.adjacentLines.end].filter(id => id);

    for (const adjId of adjacentIds) {
        const adjacentLine = findLineById(adjId);
        if (adjacentLine && adjacentLine.isAdjustable) {
            adjustableNeighborCount++;
        }
    }

    console.log('    Line', line.id, 'has', adjustableNeighborCount, 'adjustable neighbors');

    // Classification logic:
    // - 2 adjustable neighbors = tab connector (between two tab sides) → TRANSLATE
    // - 1 adjustable neighbor = slot edge (perimeter at slot opening) → DO NOT translate
    // - 0 adjustable neighbors = regular perimeter → DO NOT translate

    if (adjustableNeighborCount === 2) {
        return 'tab-connector';
    } else if (adjustableNeighborCount === 1) {
        return 'slot-edge';
    } else {
        return 'perimeter';
    }
}

/**
 * Phase 5 Task 5.2: Translate an entire line to maintain connection
 * @param {Object} line - Line to translate
 * @param {Object} deltaVector - {x, y} translation vector
 */
function translateLine(line, deltaVector) {
    console.log('  Translating line', line.id, 'by delta:', deltaVector);

    line.startPoint.x += deltaVector.x;
    line.startPoint.y += deltaVector.y;
    line.endPoint.x += deltaVector.x;
    line.endPoint.y += deltaVector.y;

    // Length and angle remain unchanged
}

/**
 * Phase 5 Task 5.1 & 5.3: Propagate adjustment changes to adjacent lines
 * Recursively updates connected lines to maintain closed shapes
 * @param {Object} adjustedLine - The line that was just adjusted
 * @param {Object} oldStartPoint - Original start point before adjustment
 * @param {Object} oldEndPoint - Original end point before adjustment
 * @param {Set} visited - Set of line IDs already processed (prevents infinite loops)
 */
function propagateChanges(adjustedLine, oldStartPoint, oldEndPoint, visited = new Set()) {
    if (visited.has(adjustedLine.id)) {
        return; // Already processed this line
    }

    visited.add(adjustedLine.id);

    console.log('  Propagating changes from line', adjustedLine.id);

    // Calculate how much the endpoints moved
    const startDelta = {
        x: adjustedLine.startPoint.x - oldStartPoint.x,
        y: adjustedLine.startPoint.y - oldStartPoint.y
    };

    const endDelta = {
        x: adjustedLine.endPoint.x - oldEndPoint.x,
        y: adjustedLine.endPoint.y - oldEndPoint.y
    };

    console.log('    Start moved by:', startDelta);
    console.log('    End moved by:', endDelta);

    // Process adjacent lines at start point
    if (adjustedLine.adjacentLines.start) {
        const adjacentLine = findLineById(adjustedLine.adjacentLines.start);
        if (adjacentLine && !visited.has(adjacentLine.id)) {
            console.log('    Adjacent at start:', adjacentLine.id);

            // Determine which endpoint of the adjacent line connects to our start
            const connectsAtStart = pointsEqual(adjacentLine.startPoint, oldStartPoint);
            const connectsAtEnd = pointsEqual(adjacentLine.endPoint, oldStartPoint);

            if (adjacentLine.isAdjustable) {
                // Adjacent is adjustable - update the shared endpoint to maintain connection
                console.log('      Adjacent is adjustable - updating shared endpoint');

                if (connectsAtStart) {
                    adjacentLine.startPoint = { ...adjustedLine.startPoint };
                } else if (connectsAtEnd) {
                    adjacentLine.endPoint = { ...adjustedLine.startPoint };
                }

                // Recalculate length
                const dx = adjacentLine.endPoint.x - adjacentLine.startPoint.x;
                const dy = adjacentLine.endPoint.y - adjacentLine.startPoint.y;
                adjacentLine.length = Math.sqrt(dx * dx + dy * dy);

            } else {
                // Adjacent line is not adjustable - classify it
                const lineType = classifyLineType(adjacentLine);
                console.log('      Line type:', lineType);

                if (lineType === 'tab-connector') {
                    // This is a tab connector (between two adjustable lines) - TRANSLATE it
                    console.log('      Tab connector - translating entire line');
                    const oldAdjacentStart = { ...adjacentLine.startPoint };
                    const oldAdjacentEnd = { ...adjacentLine.endPoint };

                    translateLine(adjacentLine, startDelta);

                    // Recursively propagate to lines connected to this one
                    propagateChanges(adjacentLine, oldAdjacentStart, oldAdjacentEnd, visited);
                } else {
                    // This is a slot edge or perimeter
                    // The adjustable line's endpoint was projected onto this line, so connection is maintained
                    console.log('      Slot edge/perimeter - connection maintained via projection');

                    // Update the slot edge endpoint to match the adjusted line's endpoint
                    if (connectsAtStart) {
                        adjacentLine.startPoint = { ...adjustedLine.startPoint };
                    } else if (connectsAtEnd) {
                        adjacentLine.endPoint = { ...adjustedLine.startPoint };
                    }

                    // Recalculate length
                    const dx = adjacentLine.endPoint.x - adjacentLine.startPoint.x;
                    const dy = adjacentLine.endPoint.y - adjacentLine.startPoint.y;
                    adjacentLine.length = Math.sqrt(dx * dx + dy * dy);
                }
            }
        }
    }

    // Process adjacent lines at end point
    if (adjustedLine.adjacentLines.end) {
        const adjacentLine = findLineById(adjustedLine.adjacentLines.end);
        if (adjacentLine && !visited.has(adjacentLine.id)) {
            console.log('    Adjacent at end:', adjacentLine.id);

            // Determine which endpoint of the adjacent line connects to our end
            const connectsAtStart = pointsEqual(adjacentLine.startPoint, oldEndPoint);
            const connectsAtEnd = pointsEqual(adjacentLine.endPoint, oldEndPoint);

            if (adjacentLine.isAdjustable) {
                // Adjacent is adjustable - update the shared endpoint to maintain connection
                console.log('      Adjacent is adjustable - updating shared endpoint');

                if (connectsAtStart) {
                    adjacentLine.startPoint = { ...adjustedLine.endPoint };
                } else if (connectsAtEnd) {
                    adjacentLine.endPoint = { ...adjustedLine.endPoint };
                }

                // Recalculate length
                const dx = adjacentLine.endPoint.x - adjacentLine.startPoint.x;
                const dy = adjacentLine.endPoint.y - adjacentLine.startPoint.y;
                adjacentLine.length = Math.sqrt(dx * dx + dy * dy);

            } else {
                // Adjacent line is not adjustable - classify it
                const lineType = classifyLineType(adjacentLine);
                console.log('      Line type:', lineType);

                if (lineType === 'tab-connector') {
                    // This is a tab connector (between two adjustable lines) - TRANSLATE it
                    console.log('      Tab connector - translating entire line');
                    const oldAdjacentStart = { ...adjacentLine.startPoint };
                    const oldAdjacentEnd = { ...adjacentLine.endPoint };

                    translateLine(adjacentLine, endDelta);

                    // Recursively propagate to lines connected to this one
                    propagateChanges(adjacentLine, oldAdjacentStart, oldAdjacentEnd, visited);
                } else {
                    // This is a slot edge or perimeter
                    // The adjustable line's endpoint was projected onto this line, so connection is maintained
                    console.log('      Slot edge/perimeter - connection maintained via projection');

                    // Update the slot edge endpoint to match the adjusted line's endpoint
                    if (connectsAtStart) {
                        adjacentLine.startPoint = { ...adjustedLine.endPoint };
                    } else if (connectsAtEnd) {
                        adjacentLine.endPoint = { ...adjustedLine.endPoint };
                    }

                    // Recalculate length
                    const dx = adjacentLine.endPoint.x - adjacentLine.startPoint.x;
                    const dy = adjacentLine.endPoint.y - adjacentLine.startPoint.y;
                    adjacentLine.length = Math.sqrt(dx * dx + dy * dy);
                }
            }
        }
    }
}

/**
 * Phase 7 Task 7.2: Update SVG path with new line geometry
 * Converts line segment back to path commands and updates the SVG
 * @param {Object} line - Line segment with updated geometry
 */
function updateSVGPath(line) {
    // Skip curves - they're handled differently
    if (line.isCurve) {
        return;
    }

    try {
        // Get the current path array
        const pathArray = line.svgPath.array();

        // For individual line paths, we simply update the coordinates
        // These are paths created by convertPathsToLines that have format: [['M', x, y], ['L', x, y]]
        if (pathArray.length >= 2) {
            // Update move command with new start point
            pathArray[0] = ['M', line.startPoint.x, line.startPoint.y];
            // Update line command with new end point
            pathArray[1] = ['L', line.endPoint.x, line.endPoint.y];

            // Apply the updated path array
            line.svgPath.plot(pathArray);
        }
    } catch (error) {
        console.error('Error updating SVG path for line', line.id, ':', error);
    }
}

/**
 * Phase 7 Task 7.3: Update all SVG paths with new geometry
 */
function updateAllSVGPaths() {
    console.log('=== Updating SVG Paths ===');

    let updatedCount = 0;

    state.shapes.forEach(shape => {
        shape.lines.forEach(line => {
            updateSVGPath(line);
            updatedCount++;
        });
    });

    console.log('Updated', updatedCount, 'SVG paths');
}

/**
 * Phase 5: Apply adjustments with propagation to maintain closed shapes
 * CRITICAL FIX: Adjust ALL adjustable lines FIRST, then propagate to non-adjustable lines
 * This prevents adjustable lines from interfering with each other during propagation
 * @returns {number} - Number of lines adjusted
 */
export function applyAdjustmentsPhase5() {
    console.log('=== Phase 5: Applying Adjustments with Propagation ===');
    console.log('Material thickness:', state.materialThickness, 'mm');
    console.log('DPI:', state.dpi);

    // STEP 1: Collect all adjustable lines and their old positions
    const adjustmentsToMake = [];

    state.shapes.forEach((shape, shapeIndex) => {
        console.log('\nScanning shape', shapeIndex, 'for adjustable lines');

        shape.lines.forEach(line => {
            if (line.isAdjustable) {
                adjustmentsToMake.push({
                    line: line,
                    shape: shape,
                    oldStartPoint: { ...line.startPoint },
                    oldEndPoint: { ...line.endPoint }
                });
            }
        });
    });

    console.log('\nFound', adjustmentsToMake.length, 'adjustable lines to process');

    // STEP 2: Adjust ALL adjustable lines (without propagation yet)
    console.log('\n=== STEP 1: Adjusting all adjustable lines ===');
    let adjustedCount = 0;

    adjustmentsToMake.forEach(adj => {
        const newGeometry = adjustSingleLine(adj.line, adj.shape);

        if (newGeometry) {
            // Update line data
            adj.line.startPoint = newGeometry.startPoint;
            adj.line.endPoint = newGeometry.endPoint;
            adj.line.length = newGeometry.length;
            adjustedCount++;
        }
    });

    // STEP 3: Now propagate changes to NON-adjustable lines only
    console.log('\n=== STEP 2: Propagating to connector lines ===');
    const visited = new Set();

    adjustmentsToMake.forEach(adj => {
        propagateChanges(adj.line, adj.oldStartPoint, adj.oldEndPoint, visited);
    });

    // Phase 7: Update SVG paths with new geometry
    updateAllSVGPaths();

    console.log('\n=== Phase 5 Complete ===');
    console.log('Adjusted', adjustedCount, 'lines (plus propagated changes)');
    console.log('SVG paths updated with new geometry');

    return adjustedCount;
}
