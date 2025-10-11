 # SVG Material Thickness Adjuster - Design & Implementation Plan

## Project Overview
A single-page web application for adjusting laser-cut SVG files to accommodate different material thicknesses by modifying interlocking tab/slot dimensions while maintaining closed shape geometry.

---

## Core Concepts

### Key Terminology
- **Adjustable Lines**: Line segments whose length should match material thickness (1x or 2x)
- **Tab Lines**: Lines that extend outward from core geometry; have adjustable sides and a connecting line that must translate
- **Slot Lines**: Lines that cut inward into core geometry; have adjustable sides and a fixed edge line
- **Closed Shape**: A continuous path where all lines connect end-to-end forming an enclosed area

### Geometric Rules
1. All shapes must remain closed after adjustment
2. Line angles never change, only lengths and positions
3. Each line connects to exactly 2 other lines (one at each endpoint)
4. Adjustable lines extend/contract perpendicular to themselves, away from or toward the enclosed area
5. Adjacent non-adjustable lines must translate to maintain connections
6. Slot edge lines (part of main shape perimeter) remain fixed
7. Tab connecting lines translate with adjustable line changes

---

## Application Architecture

### Technology Stack
- **Pure HTML/CSS/JavaScript** (no frameworks)
- **SVG manipulation**: SVG.js (v3.x) - loaded from CDN
- **State management**: In-memory JavaScript objects
- **Single dependency**: SVG.js for reliable path parsing and manipulation

### Data Structures

```javascript
// Core data model
{
  originalSVG: SVG.Doc,              // SVG.js document instance
  shapes: [                          // Array of closed shapes
    {
      id: String,
      lines: [                       // Array of line segments
        {
          id: String,
          svgPath: SVG.Path,         // SVG.js Path instance
          pathArray: Array,          // SVG.js path array [[cmd, ...coords], ...]
          segmentIndex: Number,      // Which segment in the path array
          startPoint: {x, y},
          endPoint: {x, y},
          angle: Number,             // Radians
          length: Number,
          isAdjustable: Boolean,
          multiplier: 1 or 2,        // Material thickness multiplier
          adjacentLines: {           // Connected lines
            start: lineId,
            end: lineId
          },
          type: 'fixed' | 'translatable' // Slot edge vs tab connector
        }
      ],
      windingOrder: 'cw' | 'ccw'
    }
  ],
  materialThickness: Number,         // In mm
  dpi: Number,                       // Default 72
  adjustedSVG: SVG.Doc              // Modified SVG.js document for display/download
}
```

### Key Algorithms

#### 1. SVG Path Parsing
- Load SVG using SVG.js: `SVG(svgString)`
- Extract all path elements: `svg.find('path')`
- Use SVG.js `path.array()` to get structured path data
- Detect compound paths: multiple 'M' commands in array
- Split compound paths using array slicing
- Convert path arrays to line segments with endpoints
- Handle curves: SVG.js can flatten curves with `path.flatten()`

#### 2. Shape Graph Construction
- Build connectivity graph: each line knows its two neighbors
- Identify closed shapes by following connections
- Store line angles and lengths for each segment

#### 3. Line Classification
- **User-marked**: Adjustable lines (1x or 2x multiplier)
- **Automatic detection**:
  - Fixed lines: Slot edges (share endpoints with adjustable lines but are part of main perimeter)
  - Translatable lines: Tab connectors (share endpoints with adjustable lines, not part of main perimeter)

#### 4. Adjustment Propagation
When user clicks "Apply":

```
For each adjustable line:
  1. Calculate target length: (materialThickness * multiplier * dpi) / 25.4
  2. Calculate delta: targetLength - currentLength
  3. Determine direction: perpendicular to line, away from/toward enclosed area
  4. Calculate new endpoints
  5. Propagate changes to connected lines:
     - If connected to another adjustable line: update shared endpoint
     - If connected to fixed line: update only the adjustable line's endpoint
     - If connected to translatable line: translate entire line to maintain connection
  6. Recursively adjust any lines affected by translations
  7. Update SVG path data
```

#### 5. Direction Determination
- Use shape winding order to determine "inside" vs "outside"
- Calculate perpendicular vector to line
- Choose direction that points away from (expansion) or toward (contraction) shape centroid

---

## User Interface Design

### Layout
```
┌─────────────────────────────────────────────────────────┐
│  SVG Material Thickness Adjuster                        │
├─────────────────────────────────────────────────────────┤
│  [Upload SVG]                                           │
├─────────────────────────────────────────────────────────┤
│  Settings Panel:                                         │
│    Material Thickness: [___] mm                         │
│    DPI: [72___]                                         │
│    [Apply Adjustments]  [Download Modified SVG]        │
├─────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────┐ │
│  │                                                   │ │
│  │           SVG Canvas Area                        │ │
│  │           (click lines to mark adjustable)       │ │
│  │                                                   │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  Legend:                                                │
│  ─── Normal  ─── 1x Adjustable  ─── 2x Adjustable     │
└─────────────────────────────────────────────────────────┘
```

### Interaction Flow
1. User uploads SVG → App parses and displays
2. User clicks line segments → Toggle between: normal / 1x / 2x / normal
3. Visual feedback: Color coding for line states
4. User enters material thickness and DPI
5. User clicks Apply → Geometric adjustments calculated and applied
6. Modified SVG displayed in canvas
7. User can download adjusted SVG

### Visual Feedback
- **Normal lines**: Black (#000000)
- **1x Adjustable lines**: Blue (#2196F3)
- **2x Adjustable lines**: Purple (#9C27B0)
- **Hover state**: Line highlights with increased stroke width
- **Selected state**: Glowing effect

---

## Implementation Task List

### Phase 1: Project Setup & SVG Upload (Session 1)
- [ ] **Task 1.1**: Create HTML structure
  - File upload input
  - Settings panel (material thickness, DPI inputs)
  - Canvas area for SVG display
  - Apply and Download buttons
  - Legend
  
- [ ] **Task 1.2**: Create CSS styling
  - Responsive layout
  - Visual hierarchy
  - Button and input styling
  - Canvas container styling

- [ ] **Task 1.3**: Implement SVG upload handler
  - File input event listener
  - Read SVG file as text
  - Load SVG using SVG.js: `SVG().svg(svgText)`
  - Append to canvas container
  - Store SVG.js document instance

- [ ] **Task 1.4**: Load SVG.js library
  - Add CDN link to HTML: `<script src="https://cdn.jsdelivr.net/npm/@svgdotjs/svg.js@3.x/dist/svg.min.js"></script>`
  - Verify library loads correctly
  - Test basic SVG.js operations

**Session 1 Deliverable**: Basic UI with SVG upload and display functionality

---

### Phase 2: SVG Path Processing (Session 2)
- [ ] **Task 2.1**: Implement compound path splitter
  - Use `path.array()` to get path command array
  - Identify compound paths: count 'M' commands in array
  - Split array at each 'M' command after the first
  - Create new SVG.js path for each subpath: `draw.path(subArray)`
  - Remove original compound path
  - Maintain stroke/fill styles on new paths

- [ ] **Task 2.2**: Implement path-to-line converter
  - Flatten curves to line segments: `path.flatten(tolerance)`
  - Get flattened path array: `path.array()`
  - Extract line segments from array (L, H, V commands)
  - Calculate start/end points from coordinates
  - Calculate line length: `Math.hypot(dx, dy)`
  - Calculate line angle: `Math.atan2(dy, dx)`
  - Handle closed paths (Z command)

- [ ] **Task 2.3**: Build shape graph
  - Create line segment data structure with SVG.js references
  - Identify connected lines using endpoint matching (epsilon = 0.001)
  - Detect closed shapes by following connections
  - Calculate shape area to determine winding order
  - Use SVG.js `path.bbox()` for bounding box if needed

**Session 2 Context**:
- Input: SVG.js document from Phase 1
- Output: `shapes` array with `lines` containing geometric data and SVG.js references
- Key SVG.js methods: 
  - `path.array()` - get/set path data as array
  - `path.flatten(tolerance)` - convert curves to lines
  - `path.plot(array)` - update path data
  - `path.length()` - get total path length
- Testing: Use simple rectangle and tab/slot test SVGs
- Curve flattening tolerance: Start with 0.1 units

---

### Phase 3: Interactive Line Selection (Session 3)
- [ ] **Task 3.1**: Implement line click detection
  - Add click event listeners directly to SVG path elements
  - Use SVG.js `path.on('click', handler)`
  - Calculate click position relative to SVG coordinate system
  - Use geometric distance calculation to find nearest line segment
  - Distance formula: perpendicular distance from point to line segment
  - Apply tolerance (e.g., 10 pixels) for click detection
  - Track clicked line in data model
  - **DO NOT** create overlay elements - modify original paths in place

- [ ] **Task 3.2**: Implement line state toggling
  - Cycle through: normal → 1x → 2x → normal
  - Update line data structure
  - Visual feedback by changing path stroke color directly
  - Use `path.attr('stroke', color)` to update colors
  - Color scheme: normal=#000000, 1x=#2196F3, 2x=#9C27B0
  - If multiple segments in one path, use dominant state for path color

- [ ] **Task 3.3**: Implement hover effects
  - Add mouse event listeners: `path.on('mouseenter/mouseleave')`
  - Stroke width increase on hover
  - Cursor change using `path.style('cursor', 'pointer')`

**Session 3 Context**:
- Input: Shape graph with SVG.js path instances from Phase 2
- Output: Interactive SVG with selectable lines marked in place
- Key SVG.js methods:
  - `path.on(event, handler)` - event handling
  - `path.attr(name, value)` - set attributes like stroke color and width
- Implementation approach:
  - Attach handlers to existing paths, not overlays
  - Use click coordinates to determine which line segment was clicked
  - Calculate distance from click point to each line segment
  - Update original path stroke color based on line segment states
- State tracking: Each line's `isAdjustable` and `multiplier` properties
- Testing: Click multiple lines, verify state persistence and visual feedback

---

### Phase 4: Geometric Adjustment Engine - Part 1 (Session 4)
- [ ] **Task 4.1**: Implement unit conversion
  - MM + DPI → SVG units formula: (mm * dpi) / 25.4
  - Create conversion utility function
  - Validate inputs

- [ ] **Task 4.2**: Implement direction calculation
  - Calculate shape centroid
  - Determine perpendicular vector to line
  - Use winding order to choose correct perpendicular direction
  - Decide expansion vs contraction based on target vs current length

- [ ] **Task 4.3**: Implement single line adjustment
  - Calculate new line length
  - Compute new endpoint positions
  - Update line segment data
  - Do NOT propagate changes yet (isolated test)

**Session 4 Context**:
- Input: Adjustable line data, material thickness, DPI
- Output: Functions that calculate new line geometry
- Key algorithm: Perpendicular direction = rotate line vector 90° based on winding
- Testing: Single adjustable line, verify endpoints move correctly

---

### Phase 5: Geometric Adjustment Engine - Part 2 (Session 5)
- [ ] **Task 5.1**: Implement change propagation to adjacent lines
  - Identify connected lines at each adjusted endpoint
  - Classify connected lines: adjustable, fixed, or translatable
  - Update shared endpoints for adjustable-to-adjustable connections

- [ ] **Task 5.2**: Implement line translation
  - Translate entire line to maintain connection
  - Update both endpoints
  - Preserve line angle and length

- [ ] **Task 5.3**: Implement recursive propagation
  - Handle chains of translatable lines
  - Track visited lines to avoid infinite loops
  - Ensure all connections remain intact

**Session 5 Context**:
- Input: Adjusted line from Phase 4
- Output: All affected lines updated to maintain closed shapes
- Key challenge: Distinguishing fixed vs translatable lines
- Algorithm: Breadth-first propagation from adjusted lines
- Testing: Multiple connected adjustable lines, verify closure maintained

---

### Phase 6: Line Type Classification (Session 6)
- [ ] **Task 6.1**: Implement slot edge detection
  - Identify lines that are part of main shape perimeter
  - Mark as 'fixed' type
  - These lines should not translate when adjacent adjustable lines change

- [ ] **Task 6.2**: Implement tab connector detection
  - Identify lines connecting two adjustable lines
  - Mark as 'translatable' type
  - These lines must move to maintain tab geometry

- [ ] **Task 6.3**: Handle ambiguous cases
  - Corner tabs/slots with 4 lines
  - User feedback if automatic detection uncertain
  - Validation that shapes remain closed

**Session 6 Context**:
- Input: Shape graph with user-marked adjustable lines
- Output: All lines classified as adjustable/fixed/translatable
- Heuristic: Fixed lines are likely longer and part of perimeter
- Testing: Tab/slot patterns, corner cases

---

### Phase 7: Apply & Update SVG (Session 7)
- [ ] **Task 7.1**: Implement Apply button handler
  - Trigger adjustment calculation for all marked lines
  - Update internal shape data
  - Update SVG.js path instances with new geometry

- [ ] **Task 7.2**: SVG path regeneration
  - Convert adjusted line segments back to path arrays
  - Use SVG.js `path.plot(newArray)` to update each path
  - Maintain original path structure where possible
  - Preserve stroke/fill attributes

- [ ] **Task 7.3**: Canvas update
  - SVG automatically updates via SVG.js reactive system
  - Maintain color coding for adjustable lines
  - Re-enable interaction for further adjustments
  - Update any visual indicators

**Session 7 Context**:
- Input: Adjusted shape data from Phase 5
- Output: Modified SVG displayed in canvas
- Key SVG.js methods:
  - `path.plot(array)` - update path data
  - `path.array()` - get current path array
  - Format: `[['M', x, y], ['L', x, y], ['L', x, y], ['Z']]`
- Path array structure: Each command is `[command, ...coords]`
- Testing: Verify visual output matches expected adjustments
- Verify paths remain valid and closed

---

### Phase 8: Download & Polish (Session 8)
- [ ] **Task 8.1**: Implement SVG download
  - Get SVG as string: `draw.svg()`
  - Create blob with proper MIME type: `image/svg+xml`
  - Trigger download with original filename + "_adjusted"
  - Ensure all styling is preserved in export

- [ ] **Task 8.2**: Input validation
  - Material thickness > 0
  - DPI > 0
  - At least one adjustable line marked before Apply
  - User-friendly error messages

- [ ] **Task 8.3**: Edge case handling
  - Empty or invalid SVG files
  - SVGs with no paths
  - Extremely small or large adjustments
  - Shapes that would overlap after adjustment (warn user)
  - Handle SVG.js parsing errors gracefully

- [ ] **Task 8.4**: UI polish
  - Loading indicators
  - Success/error feedback
  - Tooltips and help text
  - Keyboard shortcuts (optional)

**Session 8 Context**:
- Key SVG.js methods:
  - `draw.svg()` - serialize entire SVG to string
  - `draw.clear()` - clear canvas if needed
- Ensure exported SVG is standalone and viewable in other software
- Test download in multiple browsers
- Verify exported SVG maintains all adjustments

**Session 8 Deliverable**: Complete, polished application

---

## Testing Strategy

### Unit Tests (Per Phase)
- Geometric calculations (angles, perpendiculars, distances)
- Unit conversions
- Path parsing
- Line classification

### Integration Tests
- Upload → Parse → Display pipeline
- Selection → Marking → State update
- Adjust → Propagate → Update SVG

### User Acceptance Tests
1. Simple rectangle with one slot
2. Rectangle with multiple tabs and slots
3. Corner tabs/slots
4. Multiple separate shapes in one SVG
5. Complex nested geometry

---

## Known Challenges & Solutions

### Challenge 1: Curve Handling
**Problem**: SVG paths may contain curves (C, S, Q, T, A commands)  
**Solution**: Use SVG.js `path.flatten(tolerance)` to convert curves to line segments automatically. This handles all curve types reliably. Start with tolerance of 0.1 SVG units and adjust if needed for visual quality.

### Challenge 2: Floating Point Precision
**Problem**: Endpoint matching may fail due to floating point errors  
**Solution**: Use epsilon tolerance (e.g., 0.001) for point equality checks. SVG.js provides high precision but we still need fuzzy matching for connection detection.

### Challenge 3: Fixed vs Translatable Line Detection
**Problem**: Automatically distinguishing slot edges from tab connectors  
**Solution**: Analyze line length relative to material thickness and position relative to shape perimeter. Lines much longer than material thickness are likely perimeter edges.

### Challenge 4: Corner Tab/Slot Geometry
**Problem**: 4-line corners with varying angles  
**Solution**: Special case detection - if adjustable line connects to 3+ other lines, apply corner handling logic. May require user verification in ambiguous cases.

### Challenge 5: Multiple Adjustment Passes
**Problem**: User may apply adjustments multiple times with different thicknesses  
**Solution**: Always work from current state, not original - store current line lengths. SVG.js path arrays can be queried at any time for current geometry.

### Challenge 6: SVG.js Path Array Format
**Problem**: Need to understand SVG.js array format for manipulation  
**Solution**: SVG.js uses format: `[['M', x, y], ['L', x, y], ['Z']]`. Each element is an array where first item is command string, rest are numeric parameters. Much cleaner than raw path strings.

---

## Session Handoff Protocol

Each session should end with:

1. **Completed Tasks**: List of finished task IDs
2. **Current State**: 
   - What's working
   - What data structures exist
   - What functions are implemented
3. **Next Session Start**: 
   - Exact task ID to begin
   - Any blockers or decisions needed
   - Testing recommendations
4. **Code Context**:
   - Key variable names
   - Important function signatures
   - Data structure current state

---

## Progress Tracking Template

```
SESSION X COMPLETION REPORT
Date: [Date]
Tasks Completed: [Task IDs]
Code State:
  - Functions implemented: [list]
  - Data structures: [list]
  - Known issues: [list]
Next Session:
  - Start with Task: [ID]
  - Prerequisites: [any setup needed]
  - Testing focus: [what to verify]
```

---

## Success Criteria

✓ User can upload any valid SVG  
✓ Compound paths automatically split  
✓ Lines can be marked as 1x or 2x adjustable  
✓ Material thickness and DPI inputs work correctly  
✓ Apply button correctly adjusts all marked lines  
✓ All shapes remain closed after adjustment  
✓ Line angles preserved  
✓ Slot edges remain fixed  
✓ Tab connectors translate appropriately  
✓ Modified SVG can be downloaded  
✓ App works entirely in browser with no backend

---

*End of Design Document*
