// Shape graph building and connectivity functions

import { pointsEqual, calculateWindingOrder } from './geometry.js';

// Build shape graph by connecting line segments
export function buildShapeGraph(lineSegments) {
    const EPSILON = 0.001; // Tolerance for point matching
    const shapes = [];

    // Build connectivity: find which lines share endpoints
    lineSegments.forEach(line => {
        lineSegments.forEach(otherLine => {
            if (line.id === otherLine.id) return;

            // Check if line's end connects to otherLine's start
            if (pointsEqual(line.endPoint, otherLine.startPoint, EPSILON)) {
                line.adjacentLines.end = otherLine.id;
            }

            // Check if line's start connects to otherLine's end
            if (pointsEqual(line.startPoint, otherLine.endPoint, EPSILON)) {
                line.adjacentLines.start = otherLine.id;
            }
        });
    });

    // Find closed shapes by following connections
    const visited = new Set();

    lineSegments.forEach(startLine => {
        if (visited.has(startLine.id)) return;

        const shape = {
            id: 'shape_' + shapes.length,
            lines: [],
            windingOrder: 'cw'
        };

        let currentLine = startLine;
        let iterations = 0;
        const maxIterations = lineSegments.length * 2;

        // Follow the chain of connections
        while (currentLine && iterations < maxIterations) {
            if (visited.has(currentLine.id)) {
                // We've completed a loop
                break;
            }

            visited.add(currentLine.id);
            shape.lines.push(currentLine);

            // Find next line
            const nextLineId = currentLine.adjacentLines.end;
            if (!nextLineId) break;

            currentLine = lineSegments.find(l => l.id === nextLineId);
            iterations++;
        }

        // Only add if we have a closed shape (more than 2 lines)
        if (shape.lines.length > 2) {
            // Calculate winding order
            shape.windingOrder = calculateWindingOrder(shape.lines);
            shapes.push(shape);
            console.log('Found shape with', shape.lines.length, 'lines, winding:', shape.windingOrder);
        }
    });

    return shapes;
}
