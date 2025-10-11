# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SVGizzle is a single-page web application for adjusting laser-cut SVG files to accommodate different material thicknesses. The app modifies interlocking tab/slot dimensions while maintaining closed shape geometry, enabling users to adapt SVG designs for various material thicknesses without manual recalculation.

## Technology Stack

- **Pure HTML/CSS/JavaScript** - No build process, no frameworks
- **SVG.js v3.x** - Single dependency loaded from CDN for SVG manipulation
- **Runtime**: Entirely browser-based, no backend required

## Running the Application

Simply open `app/svgizzle.html` in any modern web browser. No build step or local server required.

## Architecture & Core Concepts

### Data Flow

1. User uploads SVG → File parsed by SVG.js
2. Compound paths automatically split into individual paths
3. Curves flattened to line segments for geometric processing
4. Line segments connected to build shape graph (closed shapes)
5. User marks lines as adjustable (1x or 2x material thickness)
6. User sets material thickness (mm) and DPI, then applies adjustments
7. Geometric engine adjusts marked lines and propagates changes to maintain closed shapes
8. Modified SVG displayed and available for download

### Key Data Structures

**Global State Object** (`state` in app/svgizzle.html:301-309):
- `originalSVG`: SVG.js element reference
- `svgDraw`: SVG.js drawing instance
- `shapes`: Array of closed shape objects (see below)
- `materialThickness`: User-specified thickness in mm
- `dpi`: Dots per inch for unit conversion
- `adjustedSVG`: Modified SVG after adjustments
- `fileName`: Original file name for download naming

**Shape Object**:
```javascript
{
  id: String,                    // 'shape_0', 'shape_1', etc.
  lines: [LineSegment],          // Array of connected line segments
  windingOrder: 'cw' | 'ccw'     // Clockwise or counter-clockwise
}
```

**Line Segment Object** (app/svgizzle.html:679-697):
```javascript
{
  id: String,                    // Unique identifier
  pathId: String,                // Parent path ID
  segmentIndex: Number,          // Index within parent path
  svgPath: SVG.Path,            // SVG.js path reference
  cmdIndex: Number,              // Command index in path array
  startPoint: {x, y},
  endPoint: {x, y},
  length: Number,                // Calculated length
  angle: Number,                 // In radians
  isAdjustable: Boolean,         // User-marked for adjustment
  multiplier: 1 | 2,            // Material thickness multiplier
  adjacentLines: {
    start: lineId | null,        // Line connected at start point
    end: lineId | null          // Line connected at end point
  },
  type: 'normal' | 'fixed' | 'translatable'
}
```

### Critical Geometric Constraints

**Closed Shape Preservation**:
- All lines must remain connected at their endpoints after adjustments
- Line angles never change, only lengths and positions
- Each line connects to exactly 2 other lines (one at each endpoint)

**Adjustment Rules**:
- **Adjustable lines**: Length changes to match material thickness × multiplier
- **Fixed lines**: Slot edges that remain stationary (part of main perimeter)
- **Translatable lines**: Tab connectors that move to maintain shape closure

**Direction Determination**:
- Uses shape winding order to determine "inside" vs "outside"
- Adjustable lines extend/contract perpendicular to themselves
- Direction points away from (expansion) or toward (contraction) shape centroid

## Implementation Status

The application is currently in **Phase 2 Complete** status. See `PROGRESS.md` for detailed implementation progress, completed tasks, and next steps.

## Key Algorithms & Functions

### SVG.js Usage Patterns

**Path Array Format**:
```javascript
[
  ['M', x, y],    // Move to
  ['L', x, y],    // Line to
  ['C', x1, y1, x2, y2, x3, y3],  // Cubic Bezier
  ['Q', x1, y1, x2, y2],          // Quadratic Bezier
  ['Z']           // Close path
]
```

**Common SVG.js Operations**:
- `path.array()` - Get/set path data as array
- `path.bbox()` - Get bounding box
- `path.attr(name, value)` - Set attributes
- `path.stroke(color)` - Change stroke color
- `path.on(event, handler)` - Event handling
- `draw.svg(string)` - Load SVG content
- `draw.viewbox(x, y, w, h)` - Set viewbox
- `draw.find('path')` - Query all paths

### Unit Conversion Formula

```javascript
svgUnits = (millimeters * dpi) / 25.4
```

### Point Equality Check

Uses epsilon tolerance (0.001) for floating-point comparison:
```javascript
function pointsEqual(p1, p2, epsilon = 0.001) {
    return Math.abs(p1.x - p2.x) < epsilon &&
           Math.abs(p1.y - p2.y) < epsilon;
}
```

## Development Guidelines

### When Continuing Development

1. **Read design.md first** - Contains detailed phase-by-phase implementation plan
2. **Check current phase status** - Look at function implementations to determine exact progress
3. **Follow phase sequence** - Phases build on each other; don't skip ahead
4. **Test incrementally** - Use sample.svg for testing after each phase
5. **Maintain pure JavaScript** - No transpilation, no build tools
6. **Use SVG.js for SVG manipulation** - Don't parse SVG strings manually

### Testing Strategy

**Test SVGs**:
- `sample.svg` - Complex laser-cut design with multiple tabs/slots
- Simple rectangle with single slot (create as needed)
- Corner tabs/slots (edge cases)

**Testing Approach**:
1. Load SVG and verify parsing (check console logs)
2. Verify shape graph construction (number of shapes, line counts)
3. Mark lines as adjustable and verify state changes
4. Apply adjustments and verify closure preservation
5. Download and verify output renders correctly in external viewers

### Console Logging

The application uses extensive console logging for debugging:
- SVG parsing: Number of paths found, split operations
- Shape graph: Number of shapes, lines per shape, winding order
- Adjustments: Target lengths, deltas, propagation chains

Monitor browser console when developing/testing.

### Important Implementation Notes

**Curve Handling**: All curves (C, Q) are flattened to 10 line segments per curve in `flattenPathArray()`. This is a critical pre-processing step that simplifies all geometric calculations.

**Tab vs Slot Detection**: Not yet implemented (Phase 6). The heuristic will be:
- **Slots**: Have a fixed edge line (part of main perimeter) - should not translate
- **Tabs**: Have a connecting line between two adjustable lines - must translate

**Corner Cases**: Tabs/slots at shape corners require special handling as one "adjustable" line is actually part of the adjacent side and should expand/contract BY material thickness, not TO material thickness.

**Epsilon Precision**: Always use 0.001 tolerance for point comparisons to handle floating-point errors.

## Git Workflow

- Commit completed phases with descriptive messages
- Use format: "Phase X complete: [brief description]"
- Commit working code frequently, even mid-phase
- Don't commit broken/non-functional code

## Troubleshooting

**SVG not loading**: Check browser console for SVG.js errors, verify SVG is valid XML

**Lines not connecting**: Check epsilon tolerance in point matching, verify closed paths

**Adjustments breaking shapes**: Verify adjacency graph is correct, check winding order calculation

**Scale issues**: SVG units vs mm/DPI conversion - verify formula: `(mm * dpi) / 25.4`
