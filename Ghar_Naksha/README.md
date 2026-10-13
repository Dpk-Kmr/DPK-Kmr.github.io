> The fresh default is now the measured family house: a 4 ft x 4 ft x 3 ft temple with wardrobe above, 4 ft-wide kitchen with a single 2 ft-deep counter open to living, scaled appliances, 3D entry and walkthrough (including the exact return stair). See [dimension ledger and offline generator](design/README.md). The project menu offers **Restore default house**; edited saved projects are retained. Validate startup with `node tests/default-browser.mjs` against the dev server.

# Ghar Naksha · Design Studio

A home-design web app that opens in an editable **2D floor plan**, with a connected multi-storey 3D model and an adjustable-height, game-style walkthrough. Explore the furnished sample home or start with an overall floor outline, then add rooms, furniture, stairs, openings, and utility connections.

The compact left rail opens **New**, **Rooms**, **Elements**, and **Systems**, and provides selection and transform tools. A single panel on the right shows either the chosen palette or the current selection’s properties. Adding an element closes the palette and opens its inspector. On smaller screens, use **Open properties** to show the inspector and close it to return to the drawing.

## Run locally

Use Node.js 22.12 or newer and npm.

```sh
npm install
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`. The 3D view and walkthrough require WebGL; the SVG floor plan works independently. The development server listens on all network interfaces for access from another device on the same network. No account, API server, database, or environment variables are required.

```sh
npm test          # Geometry, placement, stairs, connections, and project tests
npm run build    # TypeScript checks and production build in dist/
npm run preview  # Serve the production build locally
```

## Atriksha website deployment

This entire project now lives inside `DPK-Kmr.github.io/Ghar_Naksha/`, moved from its former sibling directory. The public app is **https://atriksha.com/ghar-naksha/**, linked from Products and Learn & play. Its production header returns to Atriksha; the brand returns to this app. Browser saves and snapshot links work under this subpath without a backend.

After editing the source, run `npm test`, then build the website copy from the parent repository directory:

```sh
cd ..
node scripts/sync-ghar-naksha.mjs
```

The helper runs the TypeScript/Vite production build with `--base=/ghar-naksha/` and publishes the output to the separate `../ghar-naksha/` directory. Commit both the source changes and updated production directory on the website's `main` branch. Keep `node_modules/`, `dist/`, test results and local environment files ignored; `npm ci` recreates dependencies from the committed lockfile. Do not launch the source directory on GitHub Pages.

## Browser checks

With the development server running and Google Chrome installed, run the browser checks below. Each uses a fresh browser profile and writes artifacts under `test-results/`. Set `SMOKE_BASE_URL` to test another local development-server URL. The 3D gesture and walkthrough suites use Vite's development modules to inspect rendered objects.

```sh
node tests/browser-smoke.mjs              # Core editing, persistence, exports/imports
node tests/numeric-browser-smoke.mjs      # Native form validity, decimal units, all numeric editors
node tests/floor-browser-smoke.mjs        # Floor creation, resizing, outline validation
node tests/floor-direct-browser.mjs       # Floor mouse/touch handles, units persistence, responsive panels
node tests/interaction-browser-smoke.mjs  # 2D element/room transforms, touch and pinch
node tests/scene-gestures.mjs             # 3D mouse/touch gizmos, cancellation and undo
node tests/scene-level-gestures.mjs       # Upper-floor 3D selection and transform elevation
node tests/utility-browser-smoke.mjs      # Editable electrical and water routes
node tests/group-browser-smoke.mjs        # Group transforms, copy/paste between floors, mouse/touch
node tests/share-browser-smoke.mjs        # Fixed snapshots in fresh browsers, independent edits
node tests/multifloor-browser-smoke.mjs   # Storeys, fitted stair links, cross-floor systems, full-building save
node tests/walkthrough-browser.mjs        # Avatar cameras, height, stair ascent/descent, sitting and touch
node tests/mobile-building-browser.mjs   # Phone storeys, sharing, person controls and layout
```

## Start with the total floor

1. Choose **New** on the left rail, name the design, select metres or feet, and define its total outline. Start with **Rectangle**, **L-shaped**, or **Custom**. Every side has an editable length; the preview and both viewers show the perimeter measurements.
2. Drag the preview’s corner or side handles with a mouse or touch, or type each side length. Rectangles keep opposite sides equal. In Custom mode, changing a side moves its end corner, updating adjoining lengths while keeping the outline closed. Use **Edit corner coordinates** to enter exact X/Z positions, split sides, or remove corners. Escape cancels an active drag without closing the form.
3. Set the wall height and thickness, choose whether to create perimeter walls, and click **Create floor plan**. The new design has a persistent floor and zero rooms. Its total area comes from the polygon, independently of room areas.
4. Use **Add your first room** or **Add room** to place a rectangular room inside the boundary. Enter dimensions and choose automatic placement or manual X/Z coordinates. **Find available space** can suggest a position and, when necessary, a smaller room size. All measurements remain editable afterward.

Select **Total floor plan**, **Floor outline**, or a perimeter measurement to inspect the outline. Drag its blue corner/edge handles directly on the 2D canvas to reshape it. The same pointer controls are available in the outline editor’s preview. **Apply floor changes** can keep existing sizes and positions or scale the layout to the new outline. The optional perimeter-wall update rebuilds the generated shell. Changes that would cut through an existing room are rejected; move or resize that room first. Removing the last room leaves the overall floor intact.

Floor outlines support 3–32 vertices, coordinates within ±100 metres, sides at least 0.1 m long, and area greater than 1 m². Crossings, overlapping edges, and holes are rejected. Wall height accepts 0.5–10 m and wall thickness 0.05–1 m.

## Multiple storeys

The **Active floor** selector above the drawing switches storeys. **Manage floors** adds an empty floor with an outline and perimeter walls, copies the current floor with its rooms/elements/internal routes, renames floors, changes their elevation, or removes a floor. These edits are undoable. Each floor has its own editable outline and rooms; changing one outline leaves the other storeys intact. Elevations are measured from ground level, so a basement uses a negative value. Projects support up to 32 floors.

In **3D view**, toggle **Entire building** to see the storeys together. Walkthrough always includes the whole building. Select a staircase and choose its **Destination floor** to fit its rise and open the destination slab over the stair footprint. Keep its top landing within the destination outline and leave access clear at both ends. Changing floor elevations adjusts linked stair heights. Editing a linked stair’s rise manually unlinks it; choose its destination again to refit it. Moving its base vertically preserves the destination by adjusting the rise. A copied floor clears its original outgoing stair links so its new vertical access can be chosen deliberately.

## Explore and edit

| Control                    | Action                                                                                                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Floor plan**             | Default view. Drag an unlocked element to move it; drag empty space to pan. Scroll toward the pointer or use a two-finger pinch to zoom.                                                          |
| **3D view**                | Drag empty space to orbit, right-drag to pan, and scroll/pinch to zoom. Select an unlocked element to show its transform gizmo.                                                                   |
| **Walkthrough**            | W/A/S/D or arrow keys move; drag to look. Shift moves faster and Escape exits. Touch devices have direction buttons.                                                                              |
| **Rooms**                  | Open the room palette and select a room to focus it. **Total floor plan** or **Fit entire home** restores the overall view.                                                                       |
| **Select / V**             | Select and directly drag elements in 2D. Selected elements show resize and rotation handles. Hidden elements remain selectable through the scene-object list.                                     |
| **Move / G**               | Move an element in 2D or use its translation gizmo in 3D.                                                                                                                                         |
| **Resize / R**             | Drag an element’s edge/corner handles in 2D or its local width/height/depth gizmo axes in 3D.                                                                                                     |
| **Rotate / E**             | Drag the selected element’s rotation handle or the 3D vertical-axis ring. Numeric rotation and the 90° button remain available.                                                                   |
| **Room details**           | Drag a room’s centre handle to move it with its contents, or resize its edges/corners in 2D. Resizing adjusts its shell while furniture keeps its dimensions. Rooms must remain inside the floor. |
| **Floor outline**          | Drag floor corners or edges in 2D or in the outline preview. Enter exact side lengths and coordinates in the inspector.                                                                           |
| **Measure / M**            | Select an element to display its width, depth, and height. Overall floor side lengths remain visible in editing views.                                                                            |
| **Properties / Materials** | Edit dimensions, X/Y/Z position, rotation, material, and colour. Stair selections also open a dedicated **Stair design** tab.                                                                     |
| **Placement & fitting**    | Change the assigned room/floor, centre an element, or fit it to available space, then fine-tune manually.                                                                                         |
| **Elements**               | Add furniture, kitchen/bath fixtures, structural elements, utility ports, and five stair designs. Items can belong to a room or directly to the floor.                                            |
| **Layers**                 | Toggle furniture, walls/openings/stairs, room labels, dimensions, electricity, and plumbing.                                                                                                      |

Element, room, and floor handles support mouse and touch. Room/floor handles are available in 2D; group rotation and proportional resizing are available in 2D. A canvas gesture previews locally and commits on release as **one undo entry**. Escape or pointer cancellation restores the starting geometry. Starting a two-finger pinch in 2D cancels a pending object drag and changes only the viewport.

The grid button switches between free movement and 0.1 m snapping; rotation snaps to 15° when snapping is enabled. Holding Shift temporarily enables snapping for 2D gestures. Numeric entry remains independent of the grid.

**Multi-select** enables additive selection with a finger or mouse. On a keyboard, use Shift-click to add/remove elements or Shift-drag an area. Move the group frame, resize proportionally from its corners, and rotate from its round handle. The frame respects locked elements. Select an element name in the group inspector to edit its individual measurement fields.

**Copy**, **Cut**, **Paste**, and **Duplicate** operate on the entire selection as one undo step. Ctrl/⌘ C, X, V and D provide the same actions; Ctrl/⌘ A selects the visible elements on the active floor. Text inputs keep their normal keyboard shortcuts. Copy or cut a group, switch floors, then paste. Internal wall attachments and routes between selected ports are copied with new IDs; references to unselected objects are detached. Repeated pastes stagger their placement. This element clipboard lasts for the current browser session.

The inspector supports duplication, visibility, locking, and deletion. Locked elements have no transform handles; sample walls start locked. Use **Ctrl/⌘ Z** to undo, **Ctrl/⌘ Shift Z** or **Ctrl/⌘ Y** to redo, **Ctrl/⌘ D** to duplicate, and Delete/Backspace to remove an unlocked selection. History is session-only and retains up to 50 changes.

### Exact numbers and units

Decimal fields accept ordinary values such as `29.00 ft`, `29.017 ft`, or `0.175 m` without requiring a fixed increment. **Enter** or leaving a field commits the edit; Enter does not prematurely submit the surrounding form. Clicking **Create floor plan**, **Add room**, or **Apply floor changes** also commits the last focused field. **Escape** restores that field’s accepted value.

Empty, non-finite, out-of-range, or fractional step-count values receive an explicit error rather than silently clamping. If a geometric constraint rejects an edit, the field returns to the accepted model value and explains that the change was not applied. Focusing and leaving an unchanged field does not rewrite its stored measurement.

Choose metres/feet in the footer or the new-project form. The unit preference persists across reloads in this browser; project geometry stays stored in metres. Unit conversion changes the display without changing geometry. Ordinary element dimensions, including stair footprint width/depth and floor-to-floor rise, accept **0.01–100 m**; stair component settings and floor-outline constraints have their own ranges below.

### Doors and windows

New doors and windows attach to the nearest wall when one is available. **Attach to wall** projects an existing opening onto a wall, aligns its orientation, and fits its width. Attached openings cut actual holes in the 3D wall and have matching 2D gap symbols. Door apertures allow walkthrough passage; window sills remain solid.

Attachments follow wall movement, rotation, and resizing. Manually moving an opening detaches it so it can be positioned freely or attached again. Deleting its supporting wall detaches the opening. For adjacent or overlapping walls, align their openings manually; attaching to one wall does not cut every neighboring wall.

### Electrical and water routes

Open **Systems** or **Edit routes & connection points**. Create and delete electrical or water routes, choose compatible source/destination elements, edit names and drawing labels, enable/disable routes, and set their conduit/pipe size. Select the endpoint element to change the port's position or properties.

An automatic route uses orthogonal bends between live endpoints. Add/edit X/Y/Z bend coordinates for a manual route, or reset its automatic routing. Moving an endpoint updates the line while preserving manual intermediate bends. The editor displays world-space route length and labels endpoint floors. Routes can connect ports on different storeys; filter the list by all routes, this floor, or cross-floor links. Manual bend Y values are relative to the source floor, including negative values for downward routes. The 2D canvas shows internal routes on the active floor; **Entire building** in 3D shows cross-floor routes. Each system layer controls visibility in both viewers. Projects support up to 2,000 routes, 30 bends per route, and a size value of 1–300 mm. Sizes and lengths describe the drawing, without electrical or hydraulic calculations.

### Stair designs

Open **Elements → Stairs** and choose **Straight flight**, **Quarter turn · L**, **Half turn · U**, **Spiral stair**, or **Floating treads**. The **Stair design** inspector tab opens automatically and edits the footprint, floor-to-floor rise, steps, flight width, landings, turn direction, treads, risers, supports, and handrails. Switch to **Properties** to edit placement or to **Materials** to change its finish. Height means the rise to the upper floor level; railings extend above it. The same configuration drives the 3D staircase and its 2D UP symbol.

| Stair control               | Accepted range/options                                 |
| --------------------------- | ------------------------------------------------------ |
| Step count                  | 3–64 whole steps                                       |
| Overall width/depth/rise    | 0.01–100 m per dimension                               |
| Flight width; landing depth | 0.4–4 m; 0.4–6 m                                       |
| Tread thickness; nosing     | 0.02–0.25 m; 0–0.1 m                                   |
| Railing                     | None, left, right, or both; height 0.3–1.5 m           |
| Risers; support             | Open or closed; side stringers, central spine, or none |
| Spiral                      | 0.5–3 turns; inner radius 0.06–2 m                     |
| Design helpers              | Target riser 0.1–0.3 m; target going 0.15–0.5 m        |

**Suggest step count** estimates a count from the chosen rise and target riser. **Fit footprint** adjusts width/depth to the stair settings and target going, retaining the rise. Statistics show riser height, going, pitch, and actual flight width. Fit messages explain when the requested settings are constrained by the footprint. These are geometry estimates, not structural, headroom, or building-code checks.

### Walk, climb and sit

Set **Person height** to 0.6–2.5 m (or the equivalent in feet). Choose **Behind person**, **In front of person**, or **First person**. The visible avatar follows the chosen body height, animates while moving, and uses a seated pose on furniture. W/A/S/D or arrow keys move relative to the viewing direction; drag to look, hold Shift to move faster, and use the direction pad on touchscreens.

Walk into the low end of a connected staircase to climb its actual treads and continue onto the next storey; return along the same path to descend. The floor indicator updates as you arrive. Approaching a sofa or chair enables **Sit**; press it or E to sit, and use **Stand up** or E to leave. The current floor, standing/seated state and eye height appear in the view. Entering walkthrough restores the walls and furniture layers, while honoring each element’s individual visibility. Body clearance uses the chosen height against walls, doorway lintels and overhead floors; furniture blocks walking. Stair dimensions, clear landing access and doorway height affect where a person can go.

## Save, share and export

Changes save automatically in this browser's local storage. Projects are specific to the browser and origin; clearing site data removes that local copy.

- **Share** produces a compressed, self-contained snapshot link containing the complete building. Anyone opening it receives an editable independent copy without an account. Owner edits made later do not update existing links. Create another link to share a newer snapshot.
- **Editable project** exports JSON containing every floor outline and elevation, rooms, elements, attachments, stair settings and destination links, and utility routes. Import it to continue editing or transfer a design.
- **Floor plan drawing** exports a standalone SVG of the current plan viewport, including its annotations.
- **Current 3D view** exports a PNG of the rendered camera view. HTML measurement labels and interface panels sit outside the WebGL canvas and are not included in this PNG.
- The project menu renames a design or restores the sample home. Restoring the sample can be undone in the same session.

To share outside your local network, deploy `dist/` to a public static host and use its website address in the Share dialog. A localhost address is only accessible on the same computer. Snapshot data lives in the URL fragment and does not need a backend database; the hosted website must remain available. Very large designs can produce links longer than some messaging services support, in which case use a JSON export. A snapshot opened in the app saves locally, and the fragment is cleared so reloading retains subsequent recipient edits.

Version 1 JSON imports accept files up to 5 MB, 32 floors, 2,000 elements, and 100 rooms. Validation checks each floor, dimensions, colors, IDs, attachments, stair configuration, linked stair rise/base consistency, and compatible connection endpoints. Older version 1 designs migrate into a ground-floor storey at elevation zero, retaining their outline (or deriving one from room bounds) and editable routes. Invalid imports preserve the current design. A damaged or inaccessible local cache falls back to the sample; keep JSON exports as separate backups.

## Scope and limits

This studio uses React, TypeScript, Three.js, React Three Fiber, and SVG. Custom outlines support pointer/touch and numeric side/corner editing; there is no freehand drawing tool. Multi-storey walkthrough has geometric collision and tread support, rather than a general-purpose physics engine. Doors display open apertures without hinged-door interaction. A staircase must have accessible treads, a usable rise per step, and clear landing space to be traversable; the app does not certify its safety or compliance.

Rooms have rectangular definitions; editing individual walls does not recalculate room dimensions or areas. Adjoining rooms, duplicate shared walls, and openings through multiple walls require manual alignment. Assisted placement does not resolve every overlap or produce a complete architectural layout automatically.

Utility routes record connections and drawing sizes, but do not calculate loads, flow, drainage, or engineering compliance. The app does not produce BIM/CAD models, permit drawings, construction documents, or verified architectural plans. It has no cloud sync, multi-user collaboration, authentication, AI generation, or imported 3D asset pipeline.

## Validation checklist

1. Start in 2D. Drag, resize and rotate an element with the mouse and touch; repeat element transforms in 3D. Confirm one undo restores each completed gesture and Escape discards previews.
2. Move/resize a room and reshape floor corners/edges. Confirm the room shell and its contents follow the documented rules, and invalid floor/room geometry is rejected.
3. Create a project in feet with a `29.017` side and submit directly from the last field. Edit decimal room, furniture, stair and route measurements in both unit systems; confirm native form validity, Escape restoration and no measurement drift on unchanged blur.
4. Compare grid snapping with free movement. Pinch on the 2D plan and verify that zoom does not move or resize the selection.
5. Attach a door and window to a wall. Move/resize the wall and inspect the openings in both views. Walk through the door, check the window sill collision, and exit with Escape.
6. Add each stair design and compare 3D geometry with its 2D symbol. Exercise stair controls, step-count/footprint suggestions, cross-tab dimension edits, and undo.
7. Create electrical and water routes, change endpoints, add manual bends, move a port, and disable/delete a route. Confirm both views agree.
8. Add and copy storeys, change elevations and independent outlines, then copy/paste a multi-element group between floors. Verify stair links and internal utility connections, plus undo and reload.
9. Adjust person height and all three cameras. Climb and descend a linked staircase; sit/stand near a sofa and confirm doorway clearance changes with person height.
10. Open a shared link in a fresh browser, edit the recipient copy, then open the original link again. Confirm the snapshot and owner design stay independent.
11. Reload after **All changes saved** and check the unit preference. Export/import JSON; malformed files must leave the design unchanged. Open SVG and PNG exports independently.
12. At phone and tablet widths, open/close palettes and properties without obscuring the drawing tools. Exercise touch handles and walkthrough buttons.
