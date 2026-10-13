# Default measured family house

This is Ghar Naksha's fresh-workspace and **Restore default house** design. It opens in 3D; Floor plan and Walkthrough are available immediately. An untouched old Courtyard starter is migrated. Existing edited projects remain saved. Use the project menu's Restore default house to load this model into an existing workspace.

Python geometry uses inches. The existing browser editor uses metres via an exact 0.0254 m/in adapter; its initial display units are feet. All walls are editable cuboids, and openings are real gaps. Sketch house offers finish themes and editable proposed variations.

## Dimension ledger

| Label | Dimensions and interpretation |
| --- | --- |
| from sketch | User-confirmed site 25 ft x 54 ft; 9 in walls; clear bands 5 ft, 12 ft, 15 ft, 14 ft; Room 3 12 ft x 14 ft; general walls 9 ft high; WC ceiling 6 ft 6 in. |
| from sketch | Latest user dimensions supersede the prior kitchen/temple values: kitchen and rear return are 4 ft wide; temple return is 2 ft deep and 3 ft high; wardrobe directly above. |
| from sketch | Three-wall 2 ft-deep counter, full side-wall run and 4 ft returns at Room 1 and Room 3. Sink closest to temple. Stair starts from living on right exterior-wall flight, returns on left; no separating wall/header. WC loft accessed from utility lobby. |
| calculated | Inside width 282 in; Room 1 / 2 widths (282 - 9)/2 = 136.5 in = 11 ft 4.5 in each. Living width 282 - 48 = 234 in = 19 ft 6 in. |
| calculated | Band depths 552 in + five 9 in wall allowances on the Room 3/left axis = 597 in house depth (49 ft 9 in). Site remainder 51 in (4 ft 3 in), placed at front as proposed court. The stair side has an open floor connection instead of that cross wall. |
| calculated | Rear and front slab returns occupy 24 in each of the 180 in band; side run between them is 132 in (11 ft). Kitchen has 24 in clear beside its counter within its 4 ft width. Living remains open beside it: the checked clear strip is 60 in wide across both zones; no closed 3 ft aisle is claimed within the kitchen alone. |
| proposed | Wardrobe 48 x 24 in footprint, base 36 in, height 60 in, top 96 in; doors face Room 1 through upper crosswall recess A01. Shrine opens toward living and kitchen; separator/frame panels proposed 1 in. |
| proposed | Side counter 24 x 132 x 36 in; returns 48 x 24 in; sink 22 x 22 in; hob 22 x 20 in. Refrigerator 27 x 27 x 72 in, faces living; microwave 20 x 16 x 12 in on counter; chimney, purifier, TV, geyser, bedroom AC units, fans, lights, washing machine and service points are scaled cuboid-based appliances. All appliance positions/dimensions are editable at the source top or in the editor. |
| proposed | WC storage: 48 x 60 x 27 in; shelf 3 in at z=78-81 in; storage base 81 in, top 108 in; lobby-facing hatch S01 is 30 x 24 in. Walls above WC enclose the loft; no extra footprint. |
| proposed | Stair floor-to-floor 120 in; 20 risers x 6 in, 9 independent 10 in goings per flight; 36 in flights and landing, 6 in well. Footprint x=213-291, y=420-546 in. First flight right, landing front, return left. Upper arrival x=213-249, y=384-420, z=120 in. Full open shaft to assumed roof underside 228 in gives minimum 108 in headroom. |
| proposed | Doors, window offsets and sizes remain scheduled assumptions. Furniture and utility placements are proposed. No north direction supplied. |

## Regenerate offline

Activate a local Python environment containing Pillow and ReportLab. No network or AI-generated images are required. Arial is used on macOS; edit FONT for another local TrueType font.

```sh
python3 design/generate_house.py --output public/measured-house
python3 design/generate_house.py --parameters house-parameters.json --output public/measured-house
# Downloaded ZIP: python3 generate_house.py --output ./generated
# From repository root, update the static application:
node scripts/sync-ghar-naksha.mjs
```

Proposed dimensions, opening offsets and appliance/furniture cuboids are grouped at the source top. Outputs: one 2400 x 3500 plan PNG; ten 2800 x 2500 finish-view PNGs; 13-page PDF; geometry-inches.json; project.json; source, README and ZIP. Downloads describe the default; export panel parameters and regenerate for revisions.

## Checks

The generator rejects dimensional closure errors, non-9 in walls, overlapping/out-of-bounds apertures, invalid stair geometry/headroom, blocked door swings and obstructed kitchen/stair routes. Appliances on the counter or wall are intentionally mounted at their stated base heights. Exact stepped stair surfaces are used by walkthrough, including both flights and arrival; appliances participate in collision checks. Ten themes keep identical geometry and vary finishes, patterns, lighting and facade surface treatments.

This is a dimensional layout study; structural support, guarding, services and local construction approval require further design. The upper floor beyond the arrival deck is not invented.

Latest confirmed revision: kitchen/living clear depth 180 in. House depth 597 in; front court 51 in. Slab has a continuous 24 in-deep left run and 48 in-long returns against Room 1 and Room 3. Rear return is 48 × 24 in; temple outer niche is 24 × 24 × 36 in beneath its living-side half; its proposed 2 in slab occupies the top 2 in. Wardrobe above spans the full 48 × 24 in return and faces Room 1. Room 3, stair and front openings move together by 54 in.

Proposed stair waist: 12 in vertical thickness beneath the slope through riser bases. Stepped upper faces and a continuous straight sloping underside replace solid blocks to ground. Ground below high portions is open; lower portions and the 5 ft landing do not offer standing headroom. Walkthrough collision retains the actual overhead flight volume.

User-confirmed arrangement: 24 in beside the left wall beneath the rear return is kitchen storage; 24 in toward living is the temple, separated by a 1 in cabinet panel within the temple outer envelope. Temple opens at its front (kitchen aisle) and right (living). The nominal 24 in temple width includes the proposed 1 in separator, giving 23 in clear niche width. Fridge is beside the end of the Room 3 return at x=57, y=384 in, facing living.
