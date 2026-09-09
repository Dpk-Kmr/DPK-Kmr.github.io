# Atriksha

A static website for Atriksha Engineering Solutions, with service navigation, separate CAD design and manufacturing estimates, visual research stories, individual research mentoring, and a learning arcade.

## Run locally

From this directory:

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Open http://127.0.0.1:4173. Serving the checked-in files needs no build step or application server. Scripts, fonts, and original vector illustrations are bundled locally. `CNAME` retains the existing GitHub Pages domain.

## Pages

- `index.html`: three service choices, quotation and research shortcuts, and the interactive mechanical assembly.
- `pages/services.html`: four service categories, search, and expandable descriptions of all 35 capabilities, including research mentoring.
- `pages/quotation.html`: separate estimates for CAD design services and manufacturing a part.
- `pages/research.html`: seven verified publications, original concept illustrations, short stories, publication citations, and individual research support.
- `pages/learn.html`: the Little Sprout children's app plus ten real-time game worlds, fifty missions, three difficulties, physics and evolving environments, live AI agents, saved scores, and combined filters.
- `little-sprout/`: the complete production web copy of Little Sprout, with 100 age-based activities, six cartoon teachers, and six spoken languages.
- `pages/playground.html`: optional robotic-arm, AI fault-detection, and learning-path demos.
- `pages/company.html`, `products.html`, `career.html`, and `contact.html`: about, product development, roles, and inquiries.
- `pages/home.html`: legacy redirect to the homepage, preserving query strings and fragment links.

## Quotations and pricing

The calculator uses editable **indicative assumptions**, not an approved or binding rate card. Design and manufacturing totals are kept separate. The formulas and rates are available on the quotation page under expandable details. Defaults are centralized in `src/scripts/quotation-model.js`.

CAD design effort is estimated from the project scope: distinct parts, complexity, technical drawings, revision rounds, and review time. It is not inferred from a file's triangle count. Cost equals the estimated hours for each work item multiplied by the configured hourly rate.

Manufacturing costs are itemized as material or raw stock, one-time setup, machine time, optional finishing, and inspection. Part-dependent costs are multiplied by quantity; setup is charged once. Tax is a separate configurable percentage, defaulting to zero. A zero rate means tax has not been included, not that the work is tax-exempt. Each line is rounded to paise before the subtotal and total are computed.

The FDM estimate approximates material use from solid volume, surface area, shell thickness, infill, and support/waste allowances. The CNC estimate uses the bounding stock envelope, stock allowance, removal volume, and an explicit surface-detail time allowance. These formulas estimate planning costs; they do not perform toolpath generation, slicing, tolerance inspection, or manufacturability assessment. Shipping, specialist tooling, and other unmodeled requirements need a reviewed quotation.

Binary and ASCII STL files are measured locally. File and triangle limits apply. Geometry checks reject unreliable enclosed volumes, including open edges, inconsistent orientation, and multiple separate shells. Units are chosen explicitly because STL does not encode them. STEP/IGES files are treated as references requiring manually entered geometry; they are not silently approximated as parsed CAD solids. Manual envelope estimates are labeled separately. Files stay in the browser.

Both estimate modes support downloadable details and an email draft for team review. No file or message is transmitted automatically.

## Publishing research

Publication content lives in `src/data/research.js`; illustration and story behavior live in `src/scripts/research.js`. To publish another study, follow the record structure and the verification guidance in [docs/research-sources.md](docs/research-sources.md).

The collection is presented as a company research resource, without personal profile links. All authors and equal-contribution notes remain in collapsed publication citations. The site does not relabel collaborative publications as work performed exclusively at Atriksha. Each visual is an original concept illustration, not a reproduced journal figure or a simulated experimental result. Research mentoring supports individual research skills, portfolios, and CVs; contact links use `?interest=research`.

## Little Sprout

The Learn & play page includes a dedicated Little Sprout card and launch button for children aged 3 and up. The app is served at `/little-sprout/` on the same website. Its small navigation bar returns to Learn & play and links to public artwork, font, software, and voice credits. The existing engineering arcade remains available on the same Learn & play page.

`little-sprout/` contains a production Expo SDK 57 web export, including all 5,224 music/effect/narration files and local fonts. The copy is about 68 MB; audio loads as needed after entering the app. The Learn & play card does not embed or preload the app. The 100 activities use 20 mechanics across five age bands, with teacher narration in English, Hindi, Arabic, Spanish, Mandarin Chinese, and Japanese. Preferences, favorites, and history stay in this browser under the app's separate storage key. Website play requires the site and requested assets to load; this web copy is not an offline PWA.

The original Expo project remains at the sibling `../little-sprout/` directory. To update the website copy after changing that project, use Node 22.13+ and install the original app's dependencies with `npm ci`, then run from this website directory:

```sh
node scripts/sync-little-sprout.mjs
```

You can pass another source-project path as the first argument. The script builds in a temporary directory, configures Expo's `/little-sprout` asset base path there, verifies every audio hash and unchanged original source files, and replaces only the managed website copy. It copies public license notices and removes temporary build files. No source code, node_modules, Android/iOS binaries, signing files, or development maps are copied into the published app directory. `little-sprout/web-build.json` records the version and asset inventory. The source project is never moved or deleted.

Keep the root **`.nojekyll`** file when syncing this repository: Expo emits an `_expo/` directory, and its files must be served by GitHub Pages. These settings follow [Expo's GitHub Pages guidance](https://docs.expo.dev/guides/publishing-websites/) and [GitHub's static-site instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site). No change to the site's custom domain or hosting configuration is needed.

To check the integration, start the static server above, then run:

```sh
SITE_TEST_URL=http://127.0.0.1:4173 node tests/little-sprout-browser.mjs
cd ../little-sprout
GAMEPLAY_URL=http://127.0.0.1:4173/little-sprout/ npm run test:gameplay
```

The integration test uses Playwright from the original app's installed dependencies. It checks navigation, mobile layouts, all four website themes, 100 catalogue entries, real playback in all six languages, local persistence, and missing/remote asset requests. The gameplay suite checks the static web copy's board types, scoring, retries, and completed history. Reports and screenshots are written to `../little-sprout/artifacts/website-sync/`, outside the published repository.

## Live learning arcade

`src/data/live-games.js` defines ten distinct game worlds and fifty missions, with five environmental variants per world and three difficulty settings. The worlds are a platformer, rope-swing traversal, racing, drone flight, an arena shooter, factory operations, network defense, swarm herding, ecosystem survival, and orbital flight. These are continuous simulations with movement, collisions, changing conditions, resources, and real-time consequences. There is no answer-submission flow.

`live-worlds-motion.js` and `live-worlds-systems.js` implement the ten worlds. Each exposes `update(dt, input)`, `draw(ctx)`, `observe()`, and `act(observation)`. `live-runtime.js` owns the fixed 60 Hz simulation, animation, keyboard/pointer/touch input, pause, hidden-tab handling, particles, optional synthesized sound, health, score combos, and the run clock. Each world awards points for its own actions; combos reach 3× and break on damage. Mission objectives may finish a run early. The time limit ends a run without automatically claiming its objective was achieved.

The AI companion drives the same controls through a reactive policy based on the visible observation. Players can watch it play, inspect observation/action snapshots, take control, and download an executable Python policy example. These are inspectable heuristic agents, not trained neural networks or guarantees of optimal play. Python files demonstrate the controller and sample observation; they do not include the browser's renderer or physics engine.

`live-arcade.js` provides the game library, live attract-mode preview, mission briefings, difficulty selection, player, and companion. Filters combine game world, learning topics, search, duration, progress, favorites, and difficulty. Six sorts and deep links are supported. Game cards show snapshots from their actual simulations. All foregrounds and game palettes follow the site's background theme.

`src/data/live-learning.js` connects each of the fifty missions to an Atriksha education domain through a measured condition, a player decision, a real simulation consequence, an explicit model, and a workplace application. The ten technical controls cover sensor sampling, cable load, feedback gain, sensor estimation, classifier thresholds, manufacturing feed, relay service capacity, robot clearance, irrigation control, and actuator profiles. Setting choices change the running world's dynamics, resources, accepted work, or scoring; they are not quiz answers. Players use the three preset buttons or Z/X while moving and using the original abilities.

The live engineering console shows measurements and operating status. The same readings also appear in the canvas. AI control chooses engineering presets from public observations through the same input path. The runtime preserves a bounded one-second instrument history, control changes, and outcome events. After a completed run, a review explains observed decisions and consequences and offers a JSON download for further analysis. These records describe simulation outcomes; they do not certify that the player has mastered a topic. Model descriptions distinguish simplified estimates and simulation units from physical measurements. Selected model panels link to primary explanations of sampling and classification theory.

`live-progress.js` stores independent and practice personal bests per mission and difficulty under `atriksha-live-v1`. Using AI control marks the entire run as practice; taking control again does not undo that mark. Arcade XP sums independent bests, weighted 1×, 2×, or 3× by difficulty. Replays only improve XP when the independent best improves. An unfinished run is not saved. Corrupt or denied storage is handled without preventing play. Scores from the earlier exercises remain untouched in their separate storage keys; the old exercise files remain in the repository but are not loaded by the live arcade.

## Shared navigation and styles

Shared styling is in `src/styles/design-system.css`. Homepage and playground styles are in `main.css` and `clarity.css`; each new tool has a dedicated stylesheet. Interactive motion respects reduced-motion preferences and the footer pause control. The assembly pauses when offscreen or in a hidden browser tab.

The labeled Theme control switches complete backgrounds: Midnight (dark), Paper (light), Mist (cool light), and Sand (warm light). `appearance.js` applies the saved `atriksha-theme` choice before rendering; `themes.css` defines coordinated foreground, surface, border, chart, and button colors. Old theme preferences are migrated. Canvas visuals update on the `atriksha:theme` event. Themes persist across pages, with graceful handling when browser storage is blocked.

Headers and footers are static HTML for immediate navigation. To update the shared routes after adding a page:

```sh
python3 scripts/sync-navigation.py
```

The script maintains page-specific current navigation indicators and correct relative paths. Self-hosted font license files remain in `src/assets/fonts/`.

## Contact and applications

Contact and career forms validate required fields and prepare an email draft. Visitors review and send it using their email app. Copy buttons provide a selectable fallback when clipboard access is unavailable. There is no server-side submission storage or automatic delivery.

Contact preselection links use `?interest=precision`, `intelligence`, `academy`, `research`, or `partnership`.

## Verification

Run the quotation, game mechanics, catalog, and progress tests with Node.js:

```sh
node --test tests/*.test.cjs
```

Browser verification covers desktop and mobile navigation, service search and deep links, all research stories, quotation modes and pricing changes, upload errors, lab interactions, form validation, local links, horizontal overflow, reduced motion, and automated WCAG A/AA accessibility checks. Live arcade checks cover deterministic simulation, actual movement and reactions, identical-input comparisons of engineering settings, adaptive versus unsuitable fixed settings, bounded instrument/evidence histories, independent and AI practice scores, pause/resume, mission variants, policy examples, replay, keyboard/touch controls, and unavailable or corrupt browser storage. The previous exercise tests remain as regression coverage for their retained files. Theme checks cover every palette, navigation across screen sizes, persistence, and paused canvas updates.

## Publishing the static site

The local preview and public GitHub Pages site are separate deployments. Publish the complete site, including new files in `src/data`, `src/scripts`, and `src/styles`; updating only existing tracked HTML leaves missing scripts. The public site returned 404 for `src/scripts/appearance.js` during the 7 September 2026 check. No deployment is performed by the local preview server. After publication, verify the theme and curriculum script URLs return JavaScript rather than a 404 page.
