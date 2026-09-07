/* Every mission connects a measured engineering state to a control decision and a visible consequence. */
(function (root, factory) {
  const catalog =
    typeof module === "object" && module.exports
      ? require("./live-games.js")
      : root.ATRIKSHA_LIVE_GAMES;
  const data = factory(catalog);
  if (typeof module === "object" && module.exports) module.exports = data;
  else root.ATRIKSHA_LIVE_LEARNING = data;
})(typeof globalThis !== "undefined" ? globalThis : this, function (catalog) {
  "use strict";
  const games = {};
  const option = (label, description, value) => ({
    label,
    description,
    ...(value === undefined ? {} : { value }),
  });
  function family(id, base, missions) {
    const entries = catalog.games.filter((game) => game.family === id);
    if (entries.length !== 5 || missions.length !== 5)
      throw Error("Learning missions do not match " + id);
    entries.forEach((game, index) => {
      games[game.id] = {
        ...base,
        ...missions[index],
        control: {
          ...base.control,
          initial: 1,
          options: base.control.options.map((item) => ({ ...item })),
        },
      };
    });
  }

  family(
    "runner",
    {
      domain: "AI, ML & data science",
      references: [
        {
          label: "NI: sampling and aliasing",
          url: "https://www.ni.com/en/shop/data-acquisition/measurement-fundamentals/analog-fundamentals/acquiring-an-analog-signal--bandwidth--nyquist-sampling-theorem-.html",
        },
      ],
      control: {
        label: "Sampling rate",
        options: [
          option(
            "8 Hz",
            "Fewer measurements conserve sampling energy but miss faster changes.",
            8,
          ),
          option(
            "16 Hz",
            "A middle rate balances signal detail and sampling cost.",
            16,
          ),
          option(
            "32 Hz",
            "Resolve faster changes at a higher sampling energy cost.",
            32,
          ),
        ],
      },
      formula:
        "Apparent frequency = |f − round(f/fₛ) × fₛ|. Accurate capture requires fₛ > 2f and sensor energy; the game’s processing-energy drain grows with fₛ².",
      application:
        "IoT sensor acquisition: select a sampling rate before using the measurements for monitoring or model training.",
    },
    [
      {
        concept:
          "Choose a sampling rate that preserves a changing signal without spending unnecessary energy.",
        observe:
          "Read the current signal frequency, apparent frequency and sampling energy while approaching data pickups.",
        act: "Raise the rate when the signal becomes too fast for the current setting; lower it when a slower signal leaves spare sampling margin.",
        consequence:
          "The setting changes which collected data earns valid capture credit and how quickly sampling energy is spent.",
        transfer:
          "A sensor stream is useful only if acquisition preserves the behavior a later analysis needs.",
      },
      {
        concept:
          "Separate a brief acquisition opportunity from the sampling rate needed inside it.",
        observe:
          "Watch both the blinking pickup window and the signal frequency; an available pickup can still represent poorly sampled data.",
        act: "Time the jump for an active pulse, then choose enough sampling bandwidth for that pulse’s signal.",
        consequence:
          "Collection timing and sampling quality jointly determine useful capture; a higher rate cannot recover a missed window.",
        transfer:
          "For event-triggered measurements, acquisition timing and measurement bandwidth are separate design choices.",
      },
      {
        concept:
          "Coordinate manufacturing-line motion with the quality of an acquired sensor stream.",
        observe:
          "Read signal frequency and apparent frequency while the conveyor adds horizontal motion.",
        act: "Compensate for the belt during jumps and adjust the sampling setting as the source frequency changes.",
        consequence:
          "Movement determines whether the pickup is reached; the sampling decision determines its technical quality and energy cost.",
        transfer:
          "On a moving production line, reliable inspection needs both correct sensor configuration and reliable part presentation.",
      },
      {
        concept:
          "Maintain measurement quality while a timed access constraint competes for attention.",
        observe:
          "Track live gate cycles alongside the sampling rate, signal frequency and apparent frequency.",
        act: "Use gate timing or dash to cross safely, and change the rate before collecting a signal that exceeds the current bandwidth.",
        consequence:
          "Gate damage and sampling losses are different failure modes; solving one does not eliminate the other.",
        transfer:
          "A robust automation sequence must handle physical interlocks while keeping data acquisition correctly configured.",
      },
      {
        concept:
          "Budget acquisition energy across a changed motion trajectory and signal bandwidth.",
        observe:
          "Read sampling energy and signal frequency during the longer low-gravity flight.",
        act: "Keep enough sampling margin for the current signal and avoid spending at the highest rate throughout every long jump.",
        consequence:
          "Low gravity changes travel timing, while the selected acquisition rate changes energy use and data quality.",
        transfer:
          "Longer mission duration can change the best sensor operating policy even when the required information is unchanged.",
      },
    ],
  );

  family(
    "grapple",
    {
      domain: "CAD design & manufacturing",
      control: {
        label: "Tether design",
        options: [
          option(
            "Light · 950 N",
            "No added cable mass; the lowest load rating.",
            950,
          ),
          option(
            "Balanced · 1,650 N",
            "Adds 9 kg of simulated cable mass for more capacity.",
            1650,
          ),
          option(
            "Reinforced · 2,800 N",
            "Adds 27 kg of simulated cable mass; stronger but slower to pump and reel.",
            2800,
          ),
        ],
      },
      formula:
        "Estimated cable demand T = m(g_model cos θ + v²/L + disturbance acceleration), with 40 pixels per model metre; safety factor = available cable rating / T. More than 0.4 s below a factor of 1 releases the tether.",
      application:
        "Cable-driven robot and lifting-system design: compare moving mass, strength and duty cycle before committing a CAD assembly.",
    },
    [
      {
        concept:
          "Select cable strength and moving mass for a repeated payload transfer.",
        observe:
          "Read tether tension, strength margin and overload exposure while the payload swings.",
        act: "Select a cable design for the measured load, then use rope length and release timing to keep the transfer controlled.",
        consequence:
          "A stronger cable changes moving mass as well as load capacity; an overloaded link can interrupt the transfer.",
        transfer:
          "A light component is useful only if its load capacity and overload margin meet the actual duty cycle.",
      },
      {
        concept:
          "Allow for dynamic cable loads when an attachment point moves.",
        observe:
          "Watch tension as the moving anchor changes the direction and speed of the suspended payload.",
        act: "Compare peak loading with cable capacity and select a design that preserves a margin during the anchor’s motion.",
        consequence:
          "Moving geometry produces changing tension; a design that was comfortable at one position may approach its limit later.",
        transfer:
          "A robot mechanism should be checked across its working motion, not only in one static CAD pose.",
      },
      {
        concept:
          "Balance elastic energy storage against cable load and overload exposure.",
        observe:
          "Watch extension, measured tension and overload exposure as the elastic tether stretches and recoils.",
        act: "Choose the tether design and adjust rope length to use recoil without repeatedly overloading the link.",
        consequence:
          "The spring-like tether changes the swing, while strength and overload exposure limit how aggressively that motion can be used.",
        transfer:
          "Compliant mechanisms need checks for both useful deflection and the resulting repeated load.",
      },
      {
        concept:
          "Combine a strength constraint with a connection lifetime constraint.",
        observe:
          "Read cable load and overload exposure while tracking how long the temporary anchor has been attached.",
        act: "Choose adequate cable capacity and complete the handoff before the temporary anchor expires.",
        consequence:
          "Reinforcement can improve cable load capacity but does not extend a temporary anchor’s lifetime.",
        transfer:
          "Improving one component does not remove a different bottleneck in the assembly or operating sequence.",
      },
      {
        concept:
          "Maintain cable load margin under a changing external disturbance.",
        observe:
          "Read the gust, resulting tension and accumulated overload exposure during successive swings.",
        act: "Change the tether design when the disturbance raises loads, and use controlled releases to avoid repeated high-load excursions.",
        consequence:
          "Wind changes the actual motion and tension; strength, mass and overload exposure affect whether the next transfer remains controlled.",
        transfer:
          "Cable-supported equipment should be evaluated against disturbance loads as well as its nominal payload.",
      },
    ],
  );

  family(
    "racer",
    {
      domain: "Robotics, control & optimization",
      control: {
        label: "Steering gain",
        options: [
          option(
            "0.8 · gentle",
            "A smaller steering response can reduce corrections but recover more slowly.",
            0.8,
          ),
          option(
            "1.5 · balanced",
            "A middle response for ordinary tracking corrections.",
            1.5,
          ),
          option(
            "2.6 · responsive",
            "A stronger response can recover faster but can amplify overcorrection.",
            2.6,
          ),
        ],
      },
      formula:
        "Lateral command a = 3.3K(v_target − v_x), limited to ±900 × effective grip. Cross-track error is vehicle x − road-center x; saturation costs speed and battery.",
      application:
        "Mobile-robot tracking: tune steering response against speed, surface grip and tracking error.",
    },
    [
      {
        concept:
          "Tune a tracking controller from its measured cross-track error.",
        observe:
          "Read road-center error and lateral motion while approaching obstacles and pickups.",
        act: "Choose a steering gain that corrects the error without repeated side-to-side overcorrection.",
        consequence:
          "The selected gain changes the car’s actual lateral response and therefore the path, collisions and tracking quality.",
        transfer:
          "A useful controller is judged by the resulting error and stability, not by how large its control commands are.",
      },
      {
        concept:
          "Retune feedback when the same command acts through a different traction level.",
        observe:
          "Compare measured traction and cross-track error when entering and leaving low-grip road zones.",
        act: "Change gain and use braking or grip assist to bring the car back under control.",
        consequence:
          "Changing grip alters the effective steering response; a setting that tracked well on one surface can overshoot or respond slowly on another.",
        transfer:
          "Control tuning should account for changes in the physical process between command and measured motion.",
      },
      {
        concept:
          "Balance tracking performance with the energy budget of a mobile system.",
        observe:
          "Read battery reserve, road-center error and upcoming charging pickups.",
        act: "Choose enough steering response to reach a useful charging path while managing speed and boost energy.",
        consequence:
          "The gain changes tracking behavior, while the route and boost decisions change the remaining energy available to complete the run.",
        transfer:
          "A controller can track accurately yet still fail a mission if the path and energy budget are ignored.",
      },
      {
        concept:
          "Change tracking response while avoiding a moving obstacle in a shared aisle.",
        observe:
          "Watch barrier motion alongside cross-track error and the selected gain.",
        act: "Choose a response strong enough for the available gap and brake when steering alone cannot recover safely.",
        consequence:
          "Gain affects the trajectory toward a moving opening; excessive or insufficient response can both lead to a collision.",
        transfer:
          "Robot navigation in a working area requires control response and collision timing to be considered together.",
      },
      {
        concept: "Tune a tracking response under limited sensing range.",
        observe:
          "Read visible obstacles, sensor-pulse availability, speed and tracking error.",
        act: "Use a sensor pulse before visibility becomes critical and choose a gain appropriate to the remaining reaction distance.",
        consequence:
          "Steering gain can change the response after detection, but cannot recover information that has not yet been sensed.",
        transfer:
          "Sensing range, latency and controller response jointly limit how fast a robot can operate safely.",
      },
    ],
  );

  family(
    "drone",
    {
      domain: "IoT & automation",
      control: {
        label: "Sensor processing",
        options: [
          option(
            "Fast · 30 Hz",
            "α = 1: no smoothing lag, more noise and the highest sensing power.",
            30,
          ),
          option(
            "Balanced · 15 Hz",
            "α = 0.5: a middle noise, lag and power tradeoff.",
            15,
          ),
          option(
            "Filtered · 6 Hz",
            "α = 0.25: stronger smoothing and lower sensing power, with more lag.",
            6,
          ),
        ],
      },
      formula:
        "Velocity estimate ← α × measurement + (1−α) × estimate. Lag = (1−α)/(αfₛ); modeled uncertainty ≈ √[(n√(α/(2−α)) × 1 s)² + (relative velocity × lag)²], where n is the simulated velocity-noise amplitude. Landing requires uncertainty < pad width/5.",
      application:
        "Robotic sensing and automation: select signal processing that matches the speed of the controlled motion.",
    },
    [
      {
        concept:
          "Choose a sensor mode that supports a precise position-and-velocity landing.",
        observe:
          "Compare velocity-measurement noise and latency with the drone’s drift and distance from the pad.",
        act: "Choose the sensor mode, then stabilize and slow the drone using the resulting measurements.",
        consequence:
          "The selected measurement stream affects flight stabilization and the quality of the landing approach.",
        transfer:
          "A smooth measurement is not automatically the best input for a controller if it arrives too late.",
      },
      {
        concept: "Distinguish real wind-driven motion from measurement noise.",
        observe:
          "Read wind, sensed drift, noise and latency while gusts change the vehicle’s motion.",
        act: "Select enough filtering to make the signal usable without delaying the correction needed for the current gust.",
        consequence:
          "The sensor choice changes stabilization behavior while the wind continues to disturb the drone.",
        transfer:
          "Disturbance rejection depends on both the quality and timeliness of the measured response.",
      },
      {
        concept:
          "Configure a measurement chain for observation and movement in the same mission.",
        observe:
          "Watch sensor quality, scan range and beacon status while navigating toward a survey target.",
        act: "Choose a suitable sensor mode, enter scan range, acquire the beacon and then stabilize for landing.",
        consequence:
          "Scanning collects the required observation; sensor processing affects the motion needed to obtain it and return safely.",
        transfer:
          "An automated survey needs reliable information acquisition and control of the platform carrying the sensor.",
      },
      {
        concept:
          "Trade sensing quality against the energy needed to finish a delivery route.",
        observe:
          "Track sensor mode, battery reserve and distance to the next charging pad.",
        act: "Select a measurement mode that supports a controlled approach without unnecessary sensing cost, then use the pad to recover energy.",
        consequence:
          "Sensor processing and flight control consume the same finite mission budget; a poor choice can compromise the next landing.",
        transfer:
          "Power budgets for connected devices should include acquisition and processing as well as actuators.",
      },
      {
        concept:
          "Manage measurement delay when the landing reference itself is moving.",
        observe:
          "Read pad motion, measurement latency and relative horizontal speed near contact.",
        act: "Use a sensor mode responsive enough to track the moving pad and match its motion before touchdown.",
        consequence:
          "Delayed velocity feedback can misjudge the pad-relative motion; the landing test uses speed relative to the pad.",
        transfer:
          "Tracking a moving workpiece requires fresh reference measurements and relative-motion control.",
      },
    ],
  );

  family(
    "arena",
    {
      domain: "AI, ML & data science",
      references: [
        {
          label: "Google: classification thresholds, precision and recall",
          url: "https://developers.google.com/machine-learning/crash-course/classification/accuracy-precision-recall",
        },
      ],
      control: {
        label: "Classifier threshold",
        options: [
          option(
            "0.35 · permissive",
            "Admit lower-scoring targets, increasing opportunities and false-positive exposure.",
            0.35,
          ),
          option("0.55 · balanced", "A middle rule-score threshold.", 0.55),
          option(
            "0.75 · selective",
            "Reject more uncertain targets, at the risk of missing real threats.",
            0.75,
          ),
        ],
      },
      formula:
        "Rule score = clamp(0.7 × emission signature + 0.3 × normalized closing speed + sensor bias, 0, 1). Fire is admitted when score ≥ threshold; this score is not a trained probability.",
      application:
        "Machine-vision decision systems: select an operating threshold according to the consequences of false alarms and missed detections.",
    },
    [
      {
        concept:
          "Choose a classifier threshold from the observed costs of false positives and false negatives.",
        observe:
          "Read threat rule score and the live classification outcomes while hostiles and friendlies share the arena.",
        act: "Change the threshold to admit or reject uncertain targets, then aim and fire through the classifier’s interlock.",
        consequence:
          "The threshold changes which firing opportunities are allowed; false positives can harm friendlies and false negatives leave threats active.",
        transfer:
          "Classification accuracy alone does not capture whether the system makes the costly kind of mistake.",
      },
      {
        concept:
          "Separate an uncertain classification decision from a required action-state match.",
        observe:
          "Read target rule score, selected threshold and shield polarity.",
        act: "First admit an appropriate target through the threshold, then match the weapon polarity to the target’s shield.",
        consequence:
          "Passing the classification interlock does not bypass the shield rule; both decisions affect whether the shot is useful.",
        transfer:
          "A vision decision often feeds a stateful automation sequence with additional conditions before actuation.",
      },
      {
        concept:
          "Reassess a decision threshold while the environment responds to repeated behavior.",
        observe:
          "Track rule score, errors and the movement pattern that develops around repeated firing positions.",
        act: "Adjust threshold from the observed errors and change position as the swarm reacts.",
        consequence:
          "Classifier decisions affect allowed shots while the adaptive opponent changes the physical situation in which those decisions are used.",
        transfer:
          "Model decisions should be monitored after deployment because inputs and operating conditions can change.",
      },
      {
        concept:
          "Choose an operating threshold when missed detections threaten a protected asset.",
        observe:
          "Read threat rule score and classification outcomes while watching attacks near the moving core.",
        act: "Balance false-alarm risk against the urgency of missed threats, and position the defender to protect the core.",
        consequence:
          "A selective threshold can leave low-scoring threats active; a permissive threshold can expose friendlies to unnecessary fire.",
        transfer:
          "The right threshold depends on the application’s error costs and the asset the automation is intended to protect.",
      },
      {
        concept:
          "Coordinate a classification decision with a resource-limited actuator.",
        observe:
          "Read rule score, threshold, classification errors and weapon heat.",
        act: "Admit useful targets while using bursts and venting to keep the firing process available.",
        consequence:
          "The classifier interlock decides whether a target is admitted, while thermal limits decide whether the actuator can respond.",
        transfer:
          "A correct model prediction is only one part of a complete sensing-to-actuation system.",
      },
    ],
  );

  family(
    "factory",
    {
      domain: "CAD design & manufacturing",
      control: {
        label: "Production feed",
        options: [
          option(
            "Conservative feed",
            "Feed ×0.68; belt speed ×0.85; processing heat ×0.68.",
            0.68,
          ),
          option(
            "Balanced feed",
            "Feed, belt speed and processing heat at their base rates.",
            1,
          ),
          option(
            "Surge feed",
            "Feed ×1.48; belt speed ×1.18; processing heat ×1.8.",
            1.48,
          ),
        ],
      },
      formula:
        "Heat change = processing heat × preset gain − cooling. At a completed stage, integrity loss = max(0, heat−62)/65; integrity below 45% rejects a shipment. Yield = accepted/(accepted+rejected).",
      application:
        "Manufacturing process planning: choose a feed policy for accepted output, machine load and work-in-progress limits.",
    },
    [
      {
        concept:
          "Set production feed from accepted throughput rather than arrival rate alone.",
        observe:
          "Read incoming flow, machine heat, queues and accepted output while watching the production route.",
        act: "Raise feed when the line has spare capacity; reduce it when queues or heat threaten useful output.",
        consequence:
          "Feed changes arrival rate, conveyor motion and heat generation, so a faster input stream can reduce accepted yield if the line is overloaded.",
        transfer:
          "More work entering a factory is not the same as more finished work leaving it.",
      },
      {
        concept:
          "Choose feed for a process chain with mandatory ordered quality steps.",
        observe:
          "Watch both required processing stages, their heat and downstream waiting cargo.",
        act: "Keep the two-stage route connected and choose a feed rate the slower stage can sustain.",
        consequence:
          "Cargo must complete both stages; bypassing a step or overheating the chain prevents useful accepted output.",
        transfer:
          "A multi-step manufacturing process is constrained by its dependent operations and acceptance requirements.",
      },
      {
        concept:
          "Control admission rate when mixed orders share merge capacity.",
        observe:
          "Track destination-specific cargo, congestion near the merge bays and processing heat.",
        act: "Set feed to avoid overfilling the shared route and turn junctions toward the current order’s destination.",
        consequence:
          "Feed changes how much work competes for the shared route; wrong routing and congestion consume the time available for valid delivery.",
        transfer:
          "A mixed-product line needs both correct routing and an admission policy compatible with shared capacity.",
      },
      {
        concept:
          "Trade surge output against cooling time in a thermally limited batch.",
        observe:
          "Read machine heat, incoming flow and accepted output during the batch rush.",
        act: "Use a higher feed only while thermal margin remains; slow the line and vent before heat causes quality or availability losses.",
        consequence:
          "The feed setting directly changes processing heat and flow, while venting and repair restore operating margin.",
        transfer:
          "A sustainable production rate must include thermal recovery rather than assuming continuous peak operation.",
      },
      {
        concept:
          "Set a manufacturing rate that protects fragile work in progress.",
        observe:
          "Watch cargo integrity, long queues, hot machines and the expiry window.",
        act: "Reduce feed when handling conditions threaten integrity, then repair or clear the bottleneck before returning to a higher rate.",
        consequence:
          "Fragile cargo loses integrity at hot machines and during prolonged waiting; a surge can increase gross flow while losing more usable work.",
        transfer:
          "Process optimization should include product quality and work-in-progress damage, not only cycle time.",
      },
    ],
  );

  family(
    "network",
    {
      domain: "IoT & automation",
      control: {
        label: "Relay service mode",
        options: [
          option(
            "Eco service",
            "Service ×0.65; no continuous service-credit charge.",
            0.65,
          ),
          option(
            "Balanced service",
            "Service ×1; costs 0.12 credits per built relay per second.",
            1,
          ),
          option(
            "Burst service",
            "Service ×1.6; costs 1.4 credits per built relay per second.",
            1.6,
          ),
        ],
      },
      formula:
        "Relay service μ = 1.4 × tier × preset packets/s; path capacity uses the slowest active hop. Load ratio ρ = measured arrival rate / path capacity; queue latency grows when service cannot keep up.",
      application:
        "Connected-device infrastructure: match communication service capacity to traffic, delay limits and operating cost.",
    },
    [
      {
        concept: "Select relay service capacity from measured packet demand.",
        observe:
          "Read arrival rate, service rate, queue length and packet latency.",
        act: "Build a working route and select enough service capacity for current traffic without paying for unused burst capacity.",
        consequence:
          "Service mode changes how quickly relays release packets and its credit or heat cost; insufficient capacity increases waiting and expiry.",
        transfer:
          "A connected system needs an operating policy for traffic demand as well as a valid network diagram.",
      },
      {
        concept:
          "Preserve packet service while damage reduces available network capacity.",
        observe:
          "Read relay health, outages, queues and the load ratio while attackers damage the route.",
        act: "Repair urgent faults and choose a service setting that helps the remaining active route carry its traffic.",
        consequence:
          "Higher service effort cannot make an offline node available; capacity settings and maintenance must work together.",
        transfer:
          "Resilience combines fault recovery with the capacity available while components are degraded.",
      },
      {
        concept:
          "Allocate service effort to traffic with a shorter latency budget.",
        observe:
          "Watch priority packet latency, queue pressure and available service capacity.",
        act: "Increase service when urgent traffic is at risk and maintain a route that prevents short-deadline packets from waiting too long.",
        consequence:
          "Priority packets have a tighter expiry window; the same queue delay can be acceptable for ordinary traffic and a failure for urgent traffic.",
        transfer:
          "Real-time telemetry and ordinary background data can require different service objectives on the same infrastructure.",
      },
      {
        concept:
          "Manage recovery from an outage without turning a backlog into the next failure.",
        observe:
          "Read offline time, queued traffic, relay heat and measured service capacity.",
        act: "Restore the missing relay, then use a service mode that clears the backlog without exhausting operating resources.",
        consequence:
          "Packets continue aging during an outage; recovery capacity determines how quickly surviving traffic can leave the queue.",
        transfer:
          "Restoring a component is only the first step; a system also needs a plan for the accumulated backlog.",
      },
      {
        concept:
          "Match service rate and route capacity under sustained mesh traffic.",
        observe:
          "Compare queue pressure, service rate and relay heat across the active mesh.",
        act: "Upgrade or repair the busy part of the route and select a service mode suitable for the sustained load.",
        consequence:
          "Service changes interact with route congestion and thermal load, so one fast relay cannot eliminate a downstream bottleneck.",
        transfer:
          "Capacity planning should follow end-to-end flow through the connected system, not isolated peak specifications.",
      },
    ],
  );

  family(
    "swarm",
    {
      domain: "Robotics, control & optimization",
      control: {
        label: "Formation clearance",
        options: [
          option("Compact · 17 units", "Separation gain 85; cohesion 0.6.", 17),
          option(
            "Balanced · 29 units",
            "Separation gain 165; cohesion 0.36.",
            29,
          ),
          option("Wide · 43 units", "Separation gain 230; cohesion 0.2.", 43),
        ],
      },
      formula:
        "Pair clearance d = √(Δx²+Δy²); separation force = preset gain × max(0, 1−d/preset clearance). Contact below 9 world units causes losses.",
      application:
        "Multi-robot planning: test formation spacing, shared passage width and local collision avoidance in a simplified agent simulation.",
    },
    [
      {
        concept:
          "Choose formation clearance from measured crowding and group progress.",
        observe:
          "Read nearest-agent separation, close-approach losses and goal capture while the group moves.",
        act: "Select a clearance setting and position the attracting shepherd ahead of the group.",
        consequence:
          "The setting changes actual inter-agent forces and spacing; a compact group and a low collision rate are competing objectives.",
        transfer:
          "Multi-robot throughput depends on interaction between vehicles, not only the path of each vehicle in isolation.",
      },
      {
        concept:
          "Balance formation cohesion and collision clearance under a moving disturbance.",
        observe:
          "Watch the approaching predator disturbance, agent spacing and close-approach events.",
        act: "Change formation clearance and use the shepherd’s attraction or repulsion to keep the group moving without dangerous crowding.",
        consequence:
          "Agents react to the disturbance and one another; excessive crowding causes losses, while dispersion can delay goal capture.",
        transfer:
          "A useful coordination policy should preserve clearance even when an external event disrupts its nominal formation.",
      },
      {
        concept: "Retune group spacing while following a moving goal.",
        observe:
          "Read the destination’s movement, group spread and local clearance.",
        act: "Select spacing that keeps the group responsive, and lead it toward the updated destination.",
        consequence:
          "The moving target changes the desired direction while the clearance rule changes how quickly a dispersed or crowded group can reorganize.",
        transfer:
          "A moving work target can change coordination requirements even if the individual vehicle controller is unchanged.",
      },
      {
        concept:
          "Coordinate separate agent groups with destination constraints and shared space.",
        observe:
          "Read group labels, matching destination markers and crowding where the groups approach one another.",
        act: "Choose a clearance setting and guide each group toward its own destination without compressing the shared traffic.",
        consequence:
          "Group assignment determines valid capture; spacing determines local interaction and collision losses during the transfer.",
        transfer:
          "Fleet coordination must preserve both route assignment and safe clearance when several jobs share a workspace.",
      },
      {
        concept:
          "Choose clearance that works inside a constrained passage under disturbance.",
        observe:
          "Watch corridor geometry, gust-driven motion, group spread and close approaches.",
        act: "Change the separation setting and shepherd position to fit the passage while maintaining a useful clearance margin.",
        consequence:
          "The same spacing that works in open space can interact poorly with a narrow corridor or a gust.",
        transfer:
          "Formation parameters should be checked against the available geometry and disturbance envelope of the working area.",
      },
    ],
  );

  family(
    "ecosystem",
    {
      domain: "IoT & automation",
      control: {
        label: "Irrigation controller",
        options: [
          option(
            "Water-saving · 32%",
            "Moisture target 32%; pump limit 0.6 L/s.",
            0.32,
          ),
          option(
            "Sensor regulated · 52%",
            "Moisture target 52%; pump limit 1.4 L/s.",
            0.52,
          ),
          option(
            "High irrigation · 84%",
            "Moisture target 84%; pump limit 2.8 L/s.",
            0.84,
          ),
        ],
      },
      formula:
        "Δreservoir = (refill rate − pump flow) × Δt − manual dose. Irrigation gain per root zone = delivered water/(8 L × active zones); moisture above 78% reduces growth to one quarter.",
      application:
        "IoT greenhouse automation: select a moisture setpoint while monitoring reservoir use, plant response and soil conditions.",
    },
    [
      {
        concept:
          "Choose an irrigation setpoint for sustained production rather than maximum water delivery.",
        observe:
          "Read measured moisture, controller target, reservoir level and growth ready for harvest.",
        act: "Set irrigation for useful growth, restore needy cells and harvest mature plants without emptying the shared water reserve.",
        consequence:
          "The controller changes water delivery; dry or waterlogged growing conditions reduce useful growth.",
        transfer:
          "A feedback setpoint should be selected from the process outcome, not from the largest available actuator output.",
      },
      {
        concept:
          "Commission irrigation for poor soil without wasting the available water.",
        observe:
          "Compare low soil quality, moisture readings, reservoir demand and habitat recovery.",
        act: "Choose an irrigation setting and restore or plant cells while monitoring whether soil and plant response improve.",
        consequence:
          "Adding more water cannot by itself repair poor soil; the setting interacts with restoration and finite reservoir supply.",
        transfer:
          "Commissioning an automated process includes the condition of the physical system, not only its controller settings.",
      },
      {
        concept:
          "Control a connected growing area whose outcome depends on spatial layout.",
        observe:
          "Watch moisture and water use alongside connected planted corridors and pollinator visits.",
        act: "Select an irrigation mode and extend adjacent planted cells into a viable corridor.",
        consequence:
          "Irrigation changes whether the planted network can grow, while spatial connection determines corridor and pollination outcomes.",
        transfer:
          "A sensor-controlled facility may need both suitable local process conditions and a layout that supports the overall task.",
      },
      {
        concept:
          "Separate a control-setting problem from a disturbance that needs direct intervention.",
        observe:
          "Read moisture and growth while monitoring invasive cells that consume resources and spread.",
        act: "Set irrigation for the healthy process and clear invasive growth rather than trying to solve every loss by increasing water.",
        consequence:
          "The irrigation setting changes moisture, but invasive growth still needs removal and can degrade nearby productive cells.",
        transfer:
          "Automation should distinguish a process variable that can be regulated from a fault requiring maintenance.",
      },
      {
        concept:
          "Adapt a greenhouse setpoint when supply and environmental demand change.",
        observe:
          "Track the drought phase, reservoir recovery, soil moisture and plant stress.",
        act: "Choose a lower or higher moisture target according to the available water and observed growing conditions.",
        consequence:
          "During drought, the same irrigation policy can drain the reserve faster; under-watering and waterlogging remain competing failure modes.",
        transfer:
          "A fixed setpoint can become unsuitable when resource availability or environmental demand changes.",
      },
    ],
  );

  family(
    "orbit",
    {
      domain: "Robotics, control & optimization",
      control: {
        label: "Thrust envelope",
        options: [
          option(
            "Precision · 72",
            "Acceleration 72 units/s²; drive use 4.2/s; boost adds 38 units/s.",
            72,
          ),
          option(
            "Cruise · 112",
            "Acceleration 112 units/s²; drive use 7/s; boost adds 62 units/s.",
            112,
          ),
          option(
            "High · 170",
            "Acceleration 170 units/s²; drive use 13/s; boost adds 95 units/s.",
            170,
          ),
        ],
      },
      formula:
        "Ideal approach braking distance = max(0, closing speed)²/(2 × 0.9 × preset thrust). This ignores gravity; actual velocity also changes under gravity, thrust and target motion.",
      application:
        "Motion-system sizing and control: compare acceleration, braking distance, overshoot and energy using an abstract flight simulation.",
    },
    [
      {
        concept:
          "Select an actuator envelope from speed and the distance available for a correction.",
        observe:
          "Read speed, selected acceleration, stopping-distance estimate and the next gate.",
        act: "Choose thrust strength early enough to shape the approach, then coast or brake before overshooting.",
        consequence:
          "The setting changes real acceleration, boost impulse and fuel use; late high-thrust corrections can send the craft past the gate.",
        transfer:
          "An actuator must be sized for controlled stopping and approach behavior as well as forward acceleration.",
      },
      {
        concept:
          "Regulate a sustained trajectory without excessive corrective thrust.",
        observe:
          "Watch radial error, orbital motion, thrust setting and fuel use.",
        act: "Choose a thrust envelope that corrects drift without repeatedly pushing the craft across the required orbital band.",
        consequence:
          "Gravity and tangential velocity sustain the path; the setting changes the strength and cost of each correction.",
        transfer:
          "Holding a trajectory can require a different actuator operating envelope from a rapid point-to-point move.",
      },
      {
        concept:
          "Choose control authority for a moving-target rendezvous with a relative-speed limit.",
        observe:
          "Read closing speed, stopping-distance estimate and the remaining distance to the moving docking target.",
        act: "Choose the thrust envelope, align with the required correction and brake before entering the docking zone too fast.",
        consequence:
          "Docking requires both proximity and controlled relative speed; higher thrust can shorten a correction but consume fuel or cause overshoot.",
        transfer:
          "A robot approaching a moving workpiece must control relative motion, not merely arrive at the right location.",
      },
      {
        concept:
          "Balance collision-avoidance authority against recovery distance and energy.",
        observe:
          "Track debris motion, current velocity, remaining fuel and stopping distance.",
        act: "Select enough thrust for an avoidance maneuver while preserving room and fuel to recover toward the next target.",
        consequence:
          "Avoidance changes velocity; the selected actuator envelope determines the resulting acceleration, fuel cost and ease of recovery.",
        transfer:
          "The control effort needed to avoid an obstacle can create a new tracking problem immediately afterward.",
      },
      {
        concept:
          "Choose thrust while an external force helps one part of a route and complicates another.",
        observe:
          "Read gravity-shaped motion, speed, stopping-distance estimate and fuel reserve near each target.",
        act: "Select a thrust envelope that works with the gravity field during transit and supports a controlled final approach.",
        consequence:
          "The same gravitational pull can accelerate transit and increase arrival speed; thrust strength changes the cost and authority of the correction.",
        transfer:
          "Motion planning should include external loads and the approach conditions at the destination, not only travel time.",
      },
    ],
  );

  return { games };
});
