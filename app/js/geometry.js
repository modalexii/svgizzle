// Geometry utilities and mathematical functions

// Helper function to check if two points are equal
export function pointsEqual(p1, p2, epsilon = 0.001) {
    return Math.abs(p1.x - p2.x) < epsilon &&
           Math.abs(p1.y - p2.y) < epsilon;
}

// Check if a curve is effectively straight by testing if control points are collinear
export function isCurveStraight(startPoint, controlPoints, endPoint, tolerance = 0.5) {
    // Calculate the direct line from start to end
    const lineLength = Math.sqrt(
        Math.pow(endPoint.x - startPoint.x, 2) +
        Math.pow(endPoint.y - startPoint.y, 2)
    );

    // If line is too short, consider it straight
    if (lineLength < 0.1) return true;

    // For each control point, calculate perpendicular distance to the line
    for (const cp of controlPoints) {
        // Using formula: distance = |ax + by + c| / sqrt(a² + b²)
        // Line equation: (y2-y1)x - (x2-x1)y + x2*y1 - y2*x1 = 0
        const a = endPoint.y - startPoint.y;
        const b = -(endPoint.x - startPoint.x);
        const c = endPoint.x * startPoint.y - endPoint.y * startPoint.x;

        const distance = Math.abs(a * cp.x + b * cp.y + c) / Math.sqrt(a * a + b * b);

        // If any control point is too far from the line, it's a real curve
        if (distance > tolerance) {
            return false;
        }
    }

    return true; // All control points are close to the line
}

// Cubic bezier calculation
export function cubicBezier(t, p0, p1, p2, p3) {
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;

    return {
        x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
        y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y
    };
}

// Quadratic bezier calculation
export function quadraticBezier(t, p0, p1, p2) {
    const u = 1 - t;
    const uu = u * u;
    const tt = t * t;

    return {
        x: uu * p0.x + 2 * u * t * p1.x + tt * p2.x,
        y: uu * p0.y + 2 * u * t * p1.y + tt * p2.y
    };
}

// Create a line segment data structure
export function createLineSegment(pathId, segmentIndex, startPoint, endPoint, svgPath, cmdIndex) {
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    return {
        id: pathId + '_seg_' + segmentIndex,
        pathId: pathId,
        segmentIndex: segmentIndex,
        svgPath: svgPath,
        cmdIndex: cmdIndex,
        startPoint: { ...startPoint },
        endPoint: { ...endPoint },
        length: length,
        angle: angle,
        isAdjustable: false,
        multiplier: 1,
        adjacentLines: {
            start: null,
            end: null
        },
        type: 'normal'
    };
}

// Calculate winding order (clockwise or counter-clockwise)
export function calculateWindingOrder(lines) {
    // Use shoelace formula to calculate signed area
    let area = 0;
    lines.forEach(line => {
        area += (line.endPoint.x - line.startPoint.x) *
                (line.endPoint.y + line.startPoint.y);
    });

    return area > 0 ? 'cw' : 'ccw';
}

// Flatten path array: convert curves to line segments
export function flattenPathArray(pathArray) {
    const result = [];
    let currentPoint = { x: 0, y: 0 };
    const CURVE_SEGMENTS = 10; // Number of segments to approximate curves

    pathArray.forEach(cmd => {
        const command = cmd[0];

        if (command === 'M' || command === 'm') {
            // Move command
            const x = command === 'M' ? cmd[1] : currentPoint.x + cmd[1];
            const y = command === 'M' ? cmd[2] : currentPoint.y + cmd[2];
            result.push(['M', x, y]);
            currentPoint = { x, y };
        } else if (command === 'L' || command === 'l') {
            // Line command
            const x = command === 'L' ? cmd[1] : currentPoint.x + cmd[1];
            const y = command === 'L' ? cmd[2] : currentPoint.y + cmd[2];
            result.push(['L', x, y]);
            currentPoint = { x, y };
        } else if (command === 'H' || command === 'h') {
            // Horizontal line
            const x = command === 'H' ? cmd[1] : currentPoint.x + cmd[1];
            result.push(['L', x, currentPoint.y]);
            currentPoint.x = x;
        } else if (command === 'V' || command === 'v') {
            // Vertical line
            const y = command === 'V' ? cmd[1] : currentPoint.y + cmd[1];
            result.push(['L', currentPoint.x, y]);
            currentPoint.y = y;
        } else if (command === 'C' || command === 'c') {
            // Cubic bezier curve - approximate with line segments
            const p0 = { ...currentPoint };
            const p1 = command === 'C' ?
                { x: cmd[1], y: cmd[2] } :
                { x: currentPoint.x + cmd[1], y: currentPoint.y + cmd[2] };
            const p2 = command === 'C' ?
                { x: cmd[3], y: cmd[4] } :
                { x: currentPoint.x + cmd[3], y: currentPoint.y + cmd[4] };
            const p3 = command === 'C' ?
                { x: cmd[5], y: cmd[6] } :
                { x: currentPoint.x + cmd[5], y: currentPoint.y + cmd[6] };

            for (let i = 1; i <= CURVE_SEGMENTS; i++) {
                const t = i / CURVE_SEGMENTS;
                const point = cubicBezier(t, p0, p1, p2, p3);
                result.push(['L', point.x, point.y]);
            }
            currentPoint = p3;
        } else if (command === 'Q' || command === 'q') {
            // Quadratic bezier curve
            const p0 = { ...currentPoint };
            const p1 = command === 'Q' ?
                { x: cmd[1], y: cmd[2] } :
                { x: currentPoint.x + cmd[1], y: currentPoint.y + cmd[2] };
            const p2 = command === 'Q' ?
                { x: cmd[3], y: cmd[4] } :
                { x: currentPoint.x + cmd[3], y: currentPoint.y + cmd[4] };

            for (let i = 1; i <= CURVE_SEGMENTS; i++) {
                const t = i / CURVE_SEGMENTS;
                const point = quadraticBezier(t, p0, p1, p2);
                result.push(['L', point.x, point.y]);
            }
            currentPoint = p2;
        } else if (command === 'Z' || command === 'z') {
            result.push(['Z']);
        }
        // For now, skip other commands (A, S, T) - can add later if needed
    });

    return result;
}
