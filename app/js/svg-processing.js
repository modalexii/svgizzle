// SVG parsing and path processing functions

import { pointsEqual, isCurveStraight, createLineSegment } from './geometry.js';

// Split compound paths (paths with multiple M commands)
export function splitCompoundPaths(paths) {
    const result = [];

    paths.forEach(path => {
        const pathArray = path.array();
        const subpaths = [];
        let currentSubpath = [];

        pathArray.forEach((cmd, index) => {
            if (cmd[0] === 'M' && currentSubpath.length > 0) {
                // Start of new subpath, save previous
                subpaths.push(currentSubpath);
                currentSubpath = [cmd];
            } else {
                currentSubpath.push(cmd);
            }
        });

        // Add last subpath
        if (currentSubpath.length > 0) {
            subpaths.push(currentSubpath);
        }

        // If only one subpath, keep original path
        if (subpaths.length === 1) {
            result.push(path);
        } else {
            // Multiple subpaths - split into separate paths
            console.log('Splitting compound path into', subpaths.length, 'paths');

            const parent = path.parent();
            const attrs = {
                fill: path.attr('fill'),
                stroke: path.attr('stroke'),
                'stroke-width': path.attr('stroke-width')
            };

            subpaths.forEach(subpathArray => {
                const newPath = parent.path(subpathArray);
                // Copy attributes
                Object.keys(attrs).forEach(key => {
                    if (attrs[key]) newPath.attr(key, attrs[key]);
                });
                result.push(newPath);
            });

            // Remove original compound path
            path.remove();
        }
    });

    return result;
}

// Convert paths to line segments
// Create individual path elements ONLY for straight lines (curves stay in original path)
export function convertPathsToLines(paths, draw) {
    const allLineSegments = [];
    let straightCurvesConverted = 0;

    paths.forEach((path, pathIndex) => {
        const pathArray = path.array();
        const pathId = 'path_' + pathIndex;
        const parent = path.parent();

        let currentPoint = null;
        let firstPoint = null;
        let segmentIndex = 0;

        pathArray.forEach((cmd, cmdIndex) => {
            const command = cmd[0];

            if (command === 'M' || command === 'm') {
                // Move command - convert to absolute
                const x = command === 'M' ? cmd[1] : currentPoint ? currentPoint.x + cmd[1] : cmd[1];
                const y = command === 'M' ? cmd[2] : currentPoint ? currentPoint.y + cmd[2] : cmd[2];
                currentPoint = { x, y };
                firstPoint = { x, y };
            } else if (command === 'L' || command === 'l') {
                // Line command - create individual path element
                if (currentPoint) {
                    const x = command === 'L' ? cmd[1] : currentPoint.x + cmd[1];
                    const y = command === 'L' ? cmd[2] : currentPoint.y + cmd[2];
                    const endPoint = { x, y };

                    // Create individual path element for this line
                    const linePath = parent.path([
                        ['M', currentPoint.x, currentPoint.y],
                        ['L', endPoint.x, endPoint.y]
                    ]);
                    linePath.attr({
                        fill: 'none',
                        stroke: '#000000',
                        'stroke-width': 3,
                        'stroke-linecap': 'round',
                        'stroke-linejoin': 'round'
                    });

                    const line = createLineSegment(
                        pathId,
                        segmentIndex,
                        currentPoint,
                        endPoint,
                        linePath,
                        cmdIndex
                    );
                    allLineSegments.push(line);
                    segmentIndex++;
                    currentPoint = endPoint;
                }
            } else if (command === 'H' || command === 'h') {
                // Horizontal line - create individual path element
                if (currentPoint) {
                    const x = command === 'H' ? cmd[1] : currentPoint.x + cmd[1];
                    const endPoint = { x, y: currentPoint.y };

                    // Create individual path element for this line
                    const linePath = parent.path([
                        ['M', currentPoint.x, currentPoint.y],
                        ['L', endPoint.x, endPoint.y]
                    ]);
                    linePath.attr({
                        fill: 'none',
                        stroke: '#000000',
                        'stroke-width': 3,
                        'stroke-linecap': 'round',
                        'stroke-linejoin': 'round'
                    });

                    const line = createLineSegment(
                        pathId,
                        segmentIndex,
                        currentPoint,
                        endPoint,
                        linePath,
                        cmdIndex
                    );
                    allLineSegments.push(line);
                    segmentIndex++;
                    currentPoint = endPoint;
                }
            } else if (command === 'V' || command === 'v') {
                // Vertical line - create individual path element
                if (currentPoint) {
                    const y = command === 'V' ? cmd[1] : currentPoint.y + cmd[1];
                    const endPoint = { x: currentPoint.x, y };

                    // Create individual path element for this line
                    const linePath = parent.path([
                        ['M', currentPoint.x, currentPoint.y],
                        ['L', endPoint.x, endPoint.y]
                    ]);
                    linePath.attr({
                        fill: 'none',
                        stroke: '#000000',
                        'stroke-width': 3,
                        'stroke-linecap': 'round',
                        'stroke-linejoin': 'round'
                    });

                    const line = createLineSegment(
                        pathId,
                        segmentIndex,
                        currentPoint,
                        endPoint,
                        linePath,
                        cmdIndex
                    );
                    allLineSegments.push(line);
                    segmentIndex++;
                    currentPoint = endPoint;
                }
            } else if (command === 'C' || command === 'c' || command === 'S' || command === 's' ||
                       command === 'Q' || command === 'q' || command === 'T' || command === 't' ||
                       command === 'A' || command === 'a') {
                // Curve commands - check if effectively straight, if so convert to line
                if (currentPoint) {
                    let endPoint;
                    let controlPoints = [];

                    // Extract endpoint and control points based on curve type
                    if (command === 'C') {
                        // Cubic bezier absolute: C x1 y1, x2 y2, x y
                        endPoint = { x: cmd[5], y: cmd[6] };
                        controlPoints = [
                            { x: cmd[1], y: cmd[2] },
                            { x: cmd[3], y: cmd[4] }
                        ];
                    } else if (command === 'c') {
                        // Cubic bezier relative
                        endPoint = { x: currentPoint.x + cmd[5], y: currentPoint.y + cmd[6] };
                        controlPoints = [
                            { x: currentPoint.x + cmd[1], y: currentPoint.y + cmd[2] },
                            { x: currentPoint.x + cmd[3], y: currentPoint.y + cmd[4] }
                        ];
                    } else if (command === 'S') {
                        // Smooth cubic bezier absolute: S x2 y2, x y
                        endPoint = { x: cmd[3], y: cmd[4] };
                        controlPoints = [{ x: cmd[1], y: cmd[2] }];
                    } else if (command === 's') {
                        // Smooth cubic bezier relative
                        endPoint = { x: currentPoint.x + cmd[3], y: currentPoint.y + cmd[4] };
                        controlPoints = [{ x: currentPoint.x + cmd[1], y: currentPoint.y + cmd[2] }];
                    } else if (command === 'Q') {
                        // Quadratic bezier absolute: Q x1 y1, x y
                        endPoint = { x: cmd[3], y: cmd[4] };
                        controlPoints = [{ x: cmd[1], y: cmd[2] }];
                    } else if (command === 'q') {
                        // Quadratic bezier relative
                        endPoint = { x: currentPoint.x + cmd[3], y: currentPoint.y + cmd[4] };
                        controlPoints = [{ x: currentPoint.x + cmd[1], y: currentPoint.y + cmd[2] }];
                    } else if (command === 'T') {
                        // Smooth quadratic bezier absolute: T x y
                        endPoint = { x: cmd[1], y: cmd[2] };
                        // No explicit control point (reflected from previous)
                        controlPoints = [];
                    } else if (command === 't') {
                        // Smooth quadratic bezier relative
                        endPoint = { x: currentPoint.x + cmd[1], y: currentPoint.y + cmd[2] };
                        controlPoints = [];
                    } else if (command === 'A') {
                        // Arc absolute: A rx ry x-axis-rotation large-arc-flag sweep-flag x y
                        endPoint = { x: cmd[5], y: cmd[6] };
                        // Arcs are more complex, we'll check them conservatively
                        controlPoints = [];
                    } else if (command === 'a') {
                        // Arc relative
                        endPoint = { x: currentPoint.x + cmd[5], y: currentPoint.y + cmd[6] };
                        controlPoints = [];
                    }

                    if (endPoint) {
                        // Check if this curve is effectively straight
                        const isEffectivelyStraight = isCurveStraight(currentPoint, controlPoints, endPoint);

                        if (isEffectivelyStraight) {
                            // Convert to actual line segment with individual path element
                            console.log('Converting straight curve:', command, 'from', currentPoint, 'to', endPoint);
                            straightCurvesConverted++;

                            const linePath = parent.path([
                                ['M', currentPoint.x, currentPoint.y],
                                ['L', endPoint.x, endPoint.y]
                            ]);
                            linePath.attr({
                                fill: 'none',
                                stroke: '#000000',
                                'stroke-width': 3,
                                'stroke-linecap': 'round',
                                'stroke-linejoin': 'round'
                            });

                            const line = createLineSegment(
                                pathId,
                                segmentIndex,
                                currentPoint,
                                endPoint,
                                linePath,
                                cmdIndex
                            );
                            allLineSegments.push(line);
                            segmentIndex++;
                        } else {
                            // Keep as curve - reference original path
                            const line = createLineSegment(
                                pathId,
                                segmentIndex,
                                currentPoint,
                                endPoint,
                                path, // Keep reference to original path
                                cmdIndex
                            );
                            // Mark this as a curve - will not be interactive
                            line.isCurve = true;
                            line.curveCommand = command;
                            allLineSegments.push(line);
                            segmentIndex++;
                        }

                        currentPoint = endPoint;
                    }
                }
            } else if (command === 'Z' || command === 'z') {
                // Close path - connect back to first point if not already there
                if (currentPoint && firstPoint && !pointsEqual(currentPoint, firstPoint, 0.001)) {
                    // Create individual path element for closing line
                    const linePath = parent.path([
                        ['M', currentPoint.x, currentPoint.y],
                        ['L', firstPoint.x, firstPoint.y]
                    ]);
                    linePath.attr({
                        fill: 'none',
                        stroke: '#000000',
                        'stroke-width': 3,
                        'stroke-linecap': 'round',
                        'stroke-linejoin': 'round'
                    });

                    const line = createLineSegment(
                        pathId,
                        segmentIndex,
                        currentPoint,
                        firstPoint,
                        linePath,
                        cmdIndex
                    );
                    allLineSegments.push(line);
                    segmentIndex++;
                }
                currentPoint = firstPoint;
            }
        });

        // Keep the original path - it contains the curves
        // Make it non-interactive and style curves as medium gray
        path.attr({
            fill: 'none',
            stroke: '#888888',  // Medium gray for non-interactive curves
            'stroke-width': 3,
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round'
        });
        path.style('pointer-events', 'none'); // Make it non-interactive so clicks go through to line segments
    });

    console.log('Converted', straightCurvesConverted, 'curve commands to straight lines');
    return allLineSegments;
}
