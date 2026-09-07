/* Ten real-time game worlds, fifty missions. Policy examples are transparent reactive controllers, not trained models. */
(function (root, factory) {
  const data = factory();
  if (typeof module === "object" && module.exports) module.exports = data;
  else root.ATRIKSHA_LIVE_GAMES = data;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const categories = [
    { id: "data-science", name: "Data science" },
    { id: "machine-learning", name: "Machine learning" },
    { id: "iot", name: "IoT & connected systems" },
    { id: "manufacturing", name: "Manufacturing" },
    { id: "math-optimization", name: "Math & optimization" },
  ];
  const families = [];
  const games = [];
  const key = (key, action) => ({ key, action });
  const seedFor = (id) =>
    [...id].reduce(
      (n, c) => Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0,
      2166136261,
    );
  const levelIds = ["foundation", "applied", "expert"];
  function world(spec, missions) {
    const { levelDescriptions, ...family } = spec;
    families.push(family);
    missions.forEach((m, variant) =>
      games.push({
        id: m.id,
        title: m.title,
        family: spec.id,
        variant,
        category: m.category,
        concept: m.concept,
        description: m.description,
        duration: m.duration || 90,
        tags: m.tags,
        objective: m.objective,
        twist: m.twist,
        levels: levelIds.map((id, i) => ({
          id,
          name: ["Foundation", "Applied", "Expert"][i],
          description: levelDescriptions[i],
        })),
        seed: seedFor(m.id),
      }),
    );
  }

  world(
    {
      id: "runner",
      name: "Signal Runner",
      genre: "Platform runner",
      description:
        "Tune a live sensor while jumping across platforms: preserve the signal without spending all its acquisition energy.",
      controls: [
        key("← / →", "Adjust running speed"),
        key("Space", "Jump; hold to buffer another jump on landing"),
        key("E", "Dash forward"),
      ],
      rules: [
        "Keep moving across platforms and jump before gaps.",
        "Collect cyan data; red noise is a hazard.",
        "Read the mission modifier: blinking pickups, belts, lasers or low gravity change your timing.",
        "Dash is an ability, not protection from every hazard.",
      ],
      scoring:
        "Only accurate captures advance the data target; collection points reflect sample quality. Distance adds points, and damage breaks the combo.",
      learning:
        "Sampling theory becomes an operating decision: choose bandwidth, inspect aliasing and pay the game’s processing-energy cost.",
      levelDescriptions: [
        "Collect 18 data pickups with slower running and fewer noise hazards.",
        "Collect 22 data pickups with faster running and more noise.",
        "Collect 26 data pickups at the fastest running pace and highest noise density.",
      ],
      ai: null,
    },
    [
      {
        id: "signal-sprint",
        title: "Signal Sprint",
        category: "data-science",
        concept:
          "Choose a sampling rate that preserves a changing signal without spending unnecessary energy.",
        description:
          "Choose a sampling rate as the signal changes, then collect accurate data across the platforms.",
        objective:
          "Collect accurate data while adapting sample rate to source frequency.",
        twist: "Useful and harmful pickups share the same movement space.",
        tags: ["platforming", "signal selection", "timing"],
      },
      {
        id: "pulse-window",
        title: "Pulse Window",
        category: "data-science",
        concept:
          "Separate a brief acquisition opportunity from the sampling rate needed inside it.",
        description:
          "Blinking data needs the right timing and sampling bandwidth. Keep the sensor powered between pulses.",
        objective:
          "Catch live pulses with adequate sampling bandwidth and sensor energy.",
        twist:
          "Pickups cycle between visible collection windows instead of staying available.",
        tags: ["platforming", "sampling windows", "timing"],
      },
      {
        id: "conveyor-works",
        title: "Conveyor Works",
        category: "data-science",
        concept:
          "Coordinate manufacturing-line motion with the quality of an acquired sensor stream.",
        description:
          "Conveyor motion changes the inspection signal. Adjust the sensor rate while lining up jumps.",
        objective:
          "Match sampling bandwidth to line motion and collect valid inspection data.",
        twist:
          "Your movement combines player control with each belt’s velocity.",
        tags: ["platforming", "conveyors", "relative motion"],
      },
      {
        id: "firewall-dash",
        title: "Firewall Dash",
        category: "data-science",
        concept:
          "Maintain measurement quality while a timed access constraint competes for attention.",
        description:
          "Laser timing and sensor power compete for attention. Dash safely while keeping acquisition accurate.",
        objective:
          "Cross the gates and collect accurately sampled data within the energy budget.",
        twist:
          "A timed dash protects against live gates, while the recharge limits repeated use.",
        tags: ["platforming", "gate timing", "dash"],
      },
      {
        id: "lunar-leaps",
        title: "Lunar Leaps",
        category: "data-science",
        concept:
          "Budget acquisition energy across a changed motion trajectory and signal bandwidth.",
        description:
          "Longer jumps extend the journey. Match the sample rate to the signal without wasting sensor energy.",
        objective:
          "Control long jumps while preserving accurate sensing and battery reserve.",
        twist: "Reduced gravity changes your airborne arc and landing timing.",
        tags: ["platforming", "gravity", "trajectory"],
        duration: 105,
      },
    ],
  );

  world(
    {
      id: "grapple",
      name: "Gravity Grappler",
      genre: "Swinging platformer",
      description:
        "Move a cable-driven rig between anchors while choosing tether strength, added mass and load margin.",
      controls: [
        key("← / →", "Pump your swing and adjust airborne movement"),
        key("↑ / ↓", "Reel in or extend the rope"),
        key("Space", "Attach to or release the nearest forward anchor"),
        key("E", "Use a forward burst"),
      ],
      rules: [
        "Attach when a reachable anchor is ahead.",
        "Build momentum before releasing toward the next anchor.",
        "Your tether, gravity and release timing jointly determine the flight path.",
        "Moving, elastic or temporary anchors change the plan in their respective missions.",
      ],
      scoring:
        "Relay deliveries earn points adjusted by load margin and cable mass. Overload can release the tether and damage the rig.",
      learning:
        "Compare estimated cable demand with available rating, then use the physical controls to reduce overload and complete the payload transfer.",
      levelDescriptions: [
        "Collect 12 relays with gentler gravity and closer anchors.",
        "Collect 15 relays with stronger gravity and wider anchor spacing.",
        "Collect 18 relays under the strongest gravity; fragile links expire fastest.",
      ],
      ai: null,
    },
    [
      {
        id: "orbital-courier",
        title: "Orbital Courier",
        category: "manufacturing",
        concept:
          "Select cable strength and moving mass for a repeated payload transfer.",
        description:
          "Choose a cable rating for the measured payload tension, then swing the rig to its next relay.",
        objective:
          "Deliver payloads with a cable rated for the measured dynamic demand.",
        twist:
          "Releasing the rope preserves motion; timing determines where you fly next.",
        tags: ["grappling", "momentum", "relay collection"],
        duration: 105,
      },
      {
        id: "moving-anchors",
        title: "Moving Anchors",
        category: "manufacturing",
        concept:
          "Allow for dynamic cable loads when an attachment point moves.",
        description:
          "A moving anchor changes cable demand. Select strength and mass for the complete transfer.",
        objective:
          "Maintain load margin while transferring between moving anchors.",
        twist:
          "Anchor positions change continuously, so yesterday’s aim is no longer enough.",
        tags: ["grappling", "moving targets", "prediction"],
        duration: 105,
      },
      {
        id: "elastic-links",
        title: "Elastic Links",
        category: "manufacturing",
        concept:
          "Balance elastic energy storage against cable load and overload exposure.",
        description:
          "An elastic link stores motion and changes load. Choose the tether and control its extension.",
        objective:
          "Use elastic motion while keeping estimated cable demand within capacity.",
        twist:
          "The tether adds spring motion, changing both speed and release timing.",
        tags: ["grappling", "springs", "energy"],
        duration: 105,
      },
      {
        id: "fragile-network",
        title: "Fragile Network",
        category: "manufacturing",
        concept:
          "Combine a strength constraint with a connection lifetime constraint.",
        description:
          "Temporary anchors lose capacity with attachment time. Size the cable and make the handoff promptly.",
        objective:
          "Complete handoffs before the temporary link loses its required load margin.",
        twist: "A connection has a limited lifetime, forcing timely handoffs.",
        tags: ["grappling", "connection lifetime", "handoff"],
        duration: 105,
      },
      {
        id: "storm-crossing",
        title: "Storm Crossing",
        category: "manufacturing",
        concept:
          "Maintain cable load margin under a changing external disturbance.",
        description:
          "Gusts change the estimated cable load. Balance reinforcement, moving mass and controlled release.",
        objective:
          "Transfer the payload while managing wind-driven demand and tether capacity.",
        twist:
          "Wind changes your swing while the tether is attached and after release.",
        tags: ["grappling", "wind", "feedback control"],
        duration: 120,
      },
    ],
  );

  world(
    {
      id: "racer",
      name: "Sensor Racer",
      genre: "Top-down racing",
      description:
        "Tune steering gain against actual grip and tracking error while racing through a changing route.",
      controls: [
        key("← / →", "Steer"),
        key("↑", "Accelerate"),
        key("↓", "Brake"),
        key("Space", "Traction assist; sensor pulse in Night Sensor"),
        key("E", "Use an energy-consuming boost"),
      ],
      rules: [
        "Steer around obstacles while keeping the car on the road.",
        "Speed improves progress but leaves less time to react.",
        "Road grip, battery, moving barriers or visibility depend on the mission.",
        "Use braking and the mission ability to recover control.",
      ],
      scoring:
        "Driving segments and pickups earn points. Segment credit reflects tracking quality and tire saturation; collisions and damage disrupt the run.",
      learning:
        "A gain changes commanded acceleration; tire saturation limits the response and consumes speed and energy.",
      levelDescriptions: [
        "Drive a 4,200-unit route with the lowest maximum speed and widest obstacle spacing.",
        "Drive a 5,100-unit route with higher speed and denser obstacles.",
        "Drive a 6,000-unit route at the highest speed and obstacle density.",
      ],
      ai: null,
    },
    [
      {
        id: "racing-line",
        title: "Racing Line",
        category: "math-optimization",
        concept:
          "Tune a tracking controller from its measured cross-track error.",
        description:
          "Tune steering gain from tracking error. A fast correction can ask for more grip than the road provides.",
        objective:
          "Finish the route with controlled tracking error and tire saturation.",
        twist:
          "The best immediate pickup is not always on the safest driving line.",
        tags: ["racing", "reactive control", "path choice"],
      },
      {
        id: "traction-lab",
        title: "Traction Lab",
        category: "math-optimization",
        concept:
          "Retune feedback when the same command acts through a different traction level.",
        description:
          "Road grip changes under the car. Retune the steering response before corrections start to slide.",
        objective:
          "Adapt gain to measured traction while completing the route.",
        twist: "Grip varies by road zone instead of remaining constant.",
        tags: ["racing", "traction", "control"],
      },
      {
        id: "energy-rally",
        title: "Energy Rally",
        category: "math-optimization",
        concept:
          "Balance tracking performance with the energy budget of a mobile system.",
        description:
          "Steering corrections and boost spend battery. Tune the response and plan useful charging stops.",
        objective:
          "Track the charging route with suitable gain and enough energy to finish.",
        twist: "Charging opportunities compete with the fastest racing line.",
        tags: ["racing", "battery", "resource planning"],
        duration: 105,
      },
      {
        id: "factory-slalom",
        title: "Factory Slalom",
        category: "math-optimization",
        concept:
          "Change tracking response while avoiding a moving obstacle in a shared aisle.",
        description:
          "Moving barriers narrow the control window. Tune lateral response and brake before the gap closes.",
        objective:
          "Pass moving barriers with a steering gain suited to the available grip.",
        twist:
          "Obstacle positions change while you approach, so a clear gap can close.",
        tags: ["racing", "moving obstacles", "anticipation"],
        duration: 105,
      },
      {
        id: "night-sensor",
        title: "Night Sensor",
        category: "math-optimization",
        concept: "Tune a tracking response under limited sensing range.",
        description:
          "Limited visibility delays decisions. Pulse the sensor and tune steering for the visible road.",
        objective:
          "Combine active sensing, speed control and gain tuning to finish the night route.",
        twist:
          "Limited visibility makes information gathering an active driving decision.",
        tags: ["racing", "limited visibility", "sensor pulse"],
        duration: 105,
      },
    ],
  );

  world(
    {
      id: "drone",
      name: "Precision Drone",
      genre: "Flight and landing",
      description:
        "Choose a velocity-sensor filter and make precision landings under noise, measurement lag and finite energy.",
      controls: [
        key("Arrow keys", "Apply directional thrust and adjust flight"),
        key("Space", "Send a scan pulse"),
        key("E", "Precision brake and landing assist"),
      ],
      rules: [
        "Guide the drone toward the lit landing pad or current survey target.",
        "A safe touchdown requires low relative speed, not just the right position.",
        "Counter wind and drift before committing to a landing.",
        "Scanning, energy use and moving pads add mission-specific demands.",
      ],
      scoring:
        "Landings earn quality-adjusted points only when motion and modeled uncertainty meet the pad limits. Survey beacons add scan points.",
      learning:
        "A sampled velocity estimate drives the precision brake. The game’s modeled noise-and-lag uncertainty can prevent a landing from being credited.",
      levelDescriptions: [
        "Complete 4 landings on wider pads with forgiving speed limits.",
        "Complete 5 landings on narrower pads with tighter speed limits and stronger gusts.",
        "Complete 6 landings on the narrowest pads with the strictest speed limits.",
      ],
      ai: null,
    },
    [
      {
        id: "cargo-landing",
        title: "Cargo Landing",
        category: "iot",
        concept:
          "Choose a sensor mode that supports a precise position-and-velocity landing.",
        description:
          "Choose a filter for velocity noise and lag. Land only when both motion and measurement uncertainty are controlled.",
        objective:
          "Select a sensor mode below the landing-uncertainty limit and touch down gently.",
        twist:
          "Reaching the pad at high speed is not a successful precision landing.",
        tags: ["flight", "landing", "velocity control"],
        duration: 105,
      },
      {
        id: "wind-farm",
        title: "Wind Farm",
        category: "iot",
        concept: "Distinguish real wind-driven motion from measurement noise.",
        description:
          "Wind changes real drift while the sensor adds noise. Choose filtering that still supports a timely correction.",
        objective:
          "Reject gusts and keep landing uncertainty within the pad limit.",
        twist:
          "Wind pushes the vehicle away from an otherwise correct flight path.",
        tags: ["flight", "wind", "disturbance rejection"],
        duration: 105,
      },
      {
        id: "sensor-survey",
        title: "Sensor Survey",
        category: "iot",
        concept:
          "Configure a measurement chain for observation and movement in the same mission.",
        description:
          "Scan the beacons, then land using a sensor mode that balances noise, delay and power.",
        objective:
          "Complete the survey and land with an acceptable uncertainty estimate.",
        twist:
          "The mission combines information collection with flight and touchdown control.",
        tags: ["flight", "survey", "active sensing"],
        duration: 120,
      },
      {
        id: "battery-courier",
        title: "Battery Courier",
        category: "iot",
        concept:
          "Trade sensing quality against the energy needed to finish a delivery route.",
        description:
          "Sensing and thrust share a finite battery. Choose a filter and charging approach that preserve both control and reserve.",
        objective:
          "Complete deliveries with enough sensor quality and battery reserve.",
        twist: "Energy management changes which destination is sensible next.",
        tags: ["flight", "battery", "charging"],
        duration: 120,
      },
      {
        id: "moving-platforms",
        title: "Moving Platforms",
        category: "iot",
        concept:
          "Manage measurement delay when the landing reference itself is moving.",
        description:
          "The pad moves beneath the drone. Filtering reduces noise but delays the velocity estimate used for landing.",
        objective:
          "Match the moving pad and choose a mode below the relative-motion uncertainty limit.",
        twist:
          "A landing target moves during the approach instead of staying fixed.",
        tags: ["flight", "interception", "relative velocity"],
        duration: 120,
      },
    ],
  );

  world(
    {
      id: "arena",
      name: "Pattern Arena",
      genre: "Reactive arena shooter",
      description:
        "Tune a rule-based threat threshold while moving, firing and managing classification mistakes.",
      controls: [
        key("Arrow keys", "Move"),
        key("Pointer + click", "Aim and fire"),
        key("Space", "Auto-aim and fire"),
        key(
          "E",
          "Shield; swap polarity in Shield Match; vent heat in Overload Waves",
        ),
      ],
      rules: [
        "Shoot hostile angular drones and avoid harming circular friendlies.",
        "Keep moving while choosing which threat to address.",
        "Match weapon polarity to shields in Shield Match.",
        "Protect the moving core in Escort Orbit and manage weapon heat in Overload Waves.",
      ],
      scoring:
        "Intercepted threats earn points. False-positive friendly hits and missed threats can cause damage; the detection-overlap readout summarizes TP/(TP+FP+FN).",
      learning:
        "A public signal score controls the fire interlock. Changing its threshold changes false positives, missed threats and the admitted targets.",
      levelDescriptions: [
        "Defeat 18 hostiles with lower health and gentler attack pressure.",
        "Defeat 24 tougher hostiles in faster, more crowded encounters.",
        "Defeat 30 of the toughest hostiles under the highest attack pressure.",
      ],
      ai: null,
    },
    [
      {
        id: "signal-defender",
        title: "Signal Defender",
        category: "machine-learning",
        concept:
          "Choose a classifier threshold from the observed costs of false positives and false negatives.",
        description:
          "A rule-based classifier controls the fire interlock. Tune its threshold as sensor bias changes.",
        objective:
          "Intercept threats while limiting false positives and missed detections.",
        twist:
          "Shooting every visible object performs worse than discriminating targets.",
        tags: ["arena", "target classification", "reaction"],
      },
      {
        id: "shield-match",
        title: "Shield Match",
        category: "machine-learning",
        concept:
          "Separate an uncertain classification decision from a required action-state match.",
        description:
          "Choose the classification threshold, then match shield polarity. Either decision can prevent a useful shot.",
        objective:
          "Admit appropriate targets and match their shield polarity before firing.",
        twist:
          "The E ability changes weapon state instead of deploying a shield.",
        tags: ["arena", "state matching", "weapon polarity"],
        duration: 105,
      },
      {
        id: "swarm-learning",
        title: "Swarm Learning",
        category: "machine-learning",
        concept:
          "Reassess a decision threshold while the environment responds to repeated behavior.",
        description:
          "Opponents respond to repeated firing positions. Monitor classification errors while changing your approach.",
        objective: "Adapt movement and decision threshold as the arena reacts.",
        twist: "The attack pattern reacts to your recent firing behavior.",
        tags: ["arena", "adaptive opponents", "feedback"],
        duration: 105,
      },
      {
        id: "escort-orbit",
        title: "Escort Orbit",
        category: "machine-learning",
        concept:
          "Choose an operating threshold when missed detections threaten a protected asset.",
        description:
          "Missed threats can reach the moving core. Choose the threshold with that consequence in mind.",
        objective:
          "Protect the core while balancing missed threats and false-positive risk.",
        twist:
          "Threat importance depends on where the escorted core is heading.",
        tags: ["arena", "escort", "priority control"],
        duration: 120,
      },
      {
        id: "overload-waves",
        title: "Overload Waves",
        category: "machine-learning",
        concept:
          "Coordinate a classification decision with a resource-limited actuator.",
        description:
          "Classification admits the target; weapon temperature limits the response. Regulate both while moving.",
        objective:
          "Choose useful targets and manage heat to keep the response available.",
        twist:
          "E vents heat instead of shielding; uninterrupted firing is not sustainable.",
        tags: ["arena", "thermal limits", "duty cycle"],
        duration: 120,
      },
    ],
  );

  world(
    {
      id: "factory",
      name: "Factory Flow",
      genre: "Factory floor simulation",
      description:
        "Set production feed, route the conveyors and maintain machines to produce accepted parts.",
      controls: [
        key("Arrow keys", "Move the technician"),
        key("Space", "Rotate a nearby conveyor"),
        key("Click a belt", "Rotate that conveyor directly"),
        key("E", "Repair or vent a nearby machine"),
      ],
      rules: [
        "Cargo moves continuously; steer it with conveyor directions.",
        "Keep the required route through processing machines connected.",
        "Repair jams and manage heat before they block the line.",
        "Destination, processing and cargo-handling requirements change by mission.",
      ],
      scoring:
        "Delivery points scale with remaining part integrity; shipments below 45% integrity are rejected. Heat, jams, queues and expiry can reduce accepted output.",
      learning:
        "Feed changes arrivals, belt motion and processing heat. Accepted integrity and thermal interlocks determine how much output is useful.",
      levelDescriptions: [
        "Establish a working line with gentler heat and production demands.",
        "Maintain throughput as heat, traffic and order targets rise.",
        "Keep the line productive under the highest machine pressure and order demands.",
      ],
      ai: null,
    },
    [
      {
        id: "throughput-shift",
        title: "Throughput Shift",
        category: "manufacturing",
        concept:
          "Set production feed from accepted throughput rather than arrival rate alone.",
        description:
          "Choose production feed from heat, queues and accepted yield. More incoming work can mean less usable output.",
        objective:
          "Set feed for accepted deliveries while keeping queues and heat under control.",
        twist:
          "Local conveyor choices affect downstream flow and delivery rate.",
        tags: ["factory", "throughput", "conveyors"],
        duration: 120,
      },
      {
        id: "quality-chain",
        title: "Quality Chain",
        category: "manufacturing",
        concept:
          "Choose feed for a process chain with mandatory ordered quality steps.",
        description:
          "Orders need two processing stages. Choose feed for the bottleneck and preserve the quality sequence.",
        objective:
          "Complete both required stages at a feed rate that preserves accepted quality.",
        twist:
          "Fast movement alone is insufficient when processing requirements are incomplete.",
        tags: ["factory", "process order", "quality"],
        duration: 120,
      },
      {
        id: "split-orders",
        title: "Split Orders",
        category: "manufacturing",
        concept:
          "Control admission rate when mixed orders share merge capacity.",
        description:
          "Mixed orders share merge bays. Adjust feed and junctions to keep the correct work flowing.",
        objective:
          "Route mixed orders correctly without overloading shared capacity.",
        twist: "A junction that serves one order can misroute the next.",
        tags: ["factory", "routing", "mixed orders"],
        duration: 120,
      },
      {
        id: "thermal-batch",
        title: "Thermal Batch",
        category: "manufacturing",
        concept:
          "Trade surge output against cooling time in a thermally limited batch.",
        description:
          "A batch rush raises machine heat. Slow feed or vent before the extra flow becomes rejected work.",
        objective:
          "Meet the batch target while controlling processing heat and yield loss.",
        twist:
          "Thermal limits constrain throughput and reward timely intervention.",
        tags: ["factory", "heat", "maintenance"],
        duration: 120,
      },
      {
        id: "fragile-freight",
        title: "Fragile Freight",
        category: "manufacturing",
        concept:
          "Set a manufacturing rate that protects fragile work in progress.",
        description:
          "Fragile orders lose integrity in heat and long queues. Use feed control and timely maintenance to protect them.",
        objective:
          "Deliver intact orders before expiry by managing feed, heat and waiting.",
        twist:
          "Cargo integrity, slower transport and shorter deadlines make recovery time critical.",
        tags: ["factory", "fragile cargo", "recovery"],
        duration: 120,
      },
    ],
  );

  world(
    {
      id: "network",
      name: "Packet Frontier",
      genre: "Network defense and logistics",
      description:
        "Choose service capacity and maintain a live relay network under traffic, delays and operating costs.",
      controls: [
        key("Arrow keys", "Move the maintenance drone"),
        key("Space", "Build or upgrade a nearby relay"),
        key("Click a node", "Build or upgrade that relay directly"),
        key("E", "Repair or purge a nearby relay"),
      ],
      rules: [
        "Connect the packet route with working relays.",
        "Building and upgrading consume the available credit budget.",
        "Watch queue length, heat, damage and offline status when choosing interventions.",
        "Keep packet service running while handling each mission’s traffic or threat pattern.",
      ],
      scoring:
        "Packet delivery points include an efficiency multiplier: 1.12× Eco, 1× Balanced and 0.78× Burst. Priority traffic and stopped attacks add their own mission rewards.",
      learning:
        "Compare arrival rate with the slowest route service rate, then balance latency against capacity and operating-credit demand.",
      levelDescriptions: [
        "Learn relay placement and repair under lighter traffic and threats.",
        "Balance queues and repairs as traffic and attack pressure increase.",
        "Maintain service under the highest congestion, outage and attack pressure.",
      ],
      ai: null,
    },
    [
      {
        id: "packet-delivery",
        title: "Packet Delivery",
        category: "iot",
        concept: "Select relay service capacity from measured packet demand.",
        description:
          "Packets arrive continuously. Select relay service capacity from demand, queue latency and operating credits.",
        objective:
          "Deliver packets with enough service capacity and affordable operating cost.",
        twist:
          "A disconnected or overloaded relay can hold up the entire route.",
        tags: ["network", "packet flow", "capacity"],
        duration: 120,
      },
      {
        id: "relay-defense",
        title: "Relay Defense",
        category: "iot",
        concept:
          "Preserve packet service while damage reduces available network capacity.",
        description:
          "Damaged relays reduce capacity. Repair the route and choose service effort for the traffic that remains.",
        objective: "Maintain packet delivery while repairing damaged capacity.",
        twist:
          "Maintenance decisions must respond to hostile activity as well as demand.",
        tags: ["network", "defense", "resilience"],
        duration: 120,
      },
      {
        id: "priority-lanes",
        title: "Priority Lanes",
        category: "iot",
        concept:
          "Allocate service effort to traffic with a shorter latency budget.",
        description:
          "Priority traffic expires sooner. Watch its age and choose service capacity before the deadline is lost.",
        objective:
          "Deliver priority packets within their tighter latency budget.",
        twist:
          "Traffic classes change which congested node deserves attention first.",
        tags: ["network", "priority traffic", "queues"],
        duration: 120,
      },
      {
        id: "outage-recovery",
        title: "Outage Recovery",
        category: "iot",
        concept:
          "Manage recovery from an outage without turning a backlog into the next failure.",
        description:
          "An outage leaves a growing backlog. Restore the route and select a service mode for controlled recovery.",
        objective:
          "Restore service and clear surviving queued traffic without exhausting credits.",
        twist: "A route that worked moments ago can become unavailable.",
        tags: ["network", "outages", "recovery"],
        duration: 120,
      },
      {
        id: "balanced-mesh",
        title: "Balanced Mesh",
        category: "iot",
        concept:
          "Match service rate and route capacity under sustained mesh traffic.",
        description:
          "Sustained mesh traffic reveals slow hops. Match service settings and upgrades to the actual bottleneck.",
        objective: "Keep end-to-end service ahead of sustained demand.",
        twist:
          "Improving one node can reveal congestion elsewhere in the network.",
        tags: ["network", "load balancing", "resource allocation"],
        duration: 120,
      },
    ],
  );

  world(
    {
      id: "swarm",
      name: "Swarm Shepherd",
      genre: "Collective-motion strategy",
      description:
        "Guide simulated robot formations and choose spacing for cohesion, clearance and shared passages.",
      controls: [
        key("Arrow keys", "Move the shepherd drone"),
        key("Pointer", "Set a steering destination"),
        key("Space", "Attract nearby flock members"),
        key("E", "Repel nearby flock members"),
      ],
      rules: [
        "The flock continues moving through its own local interactions.",
        "Place the shepherd where attraction or repulsion will guide nearby agents toward the goal.",
        "Capture depends on entering the correct goal region.",
        "Predators, moving goals, group assignments and storms change the guidance problem.",
      ],
      scoring:
        "Correctly routed robots earn points. Contact history can reduce routing credit by up to 30%, while contacts and other losses also damage the mission.",
      learning:
        "The selected separation radius changes local forces and formation cohesion; contacts and spread affect the group’s useful progress.",
      levelDescriptions: [
        "Practice gathering and guidance with gentler environmental pressure.",
        "Respond to stronger predation, disturbances and capture demands.",
        "Guide the flock under the most demanding hazards and goal requirements.",
      ],
      ai: null,
    },
    [
      {
        id: "flock-to-goal",
        title: "Flock to Goal",
        category: "math-optimization",
        concept:
          "Choose formation clearance from measured crowding and group progress.",
        description:
          "Guide a simulated robot group while choosing its spacing. Crowding and excessive spread both cost progress.",
        objective:
          "Choose formation clearance that supports safe, cohesive goal capture.",
        twist: "Only nearby agents feel your attraction or repulsion.",
        tags: ["swarm", "local control", "collective motion"],
        duration: 120,
      },
      {
        id: "predator-pass",
        title: "Predator Pass",
        category: "math-optimization",
        concept:
          "Balance formation cohesion and collision clearance under a moving disturbance.",
        description:
          "A moving disturbance scatters the robot group. Retune clearance and guide it back into useful motion.",
        objective:
          "Preserve group progress and clearance under moving disturbances.",
        twist: "The shortest-looking path may expose more agents to danger.",
        tags: ["swarm", "predators", "risk-aware control"],
        duration: 120,
      },
      {
        id: "moving-meadow",
        title: "Moving Meadow",
        category: "math-optimization",
        concept: "Retune group spacing while following a moving goal.",
        description:
          "The goal moves as the formation travels. Adjust spacing and the shepherd’s position to stay responsive.",
        objective:
          "Track the moving goal while controlling spread and close approaches.",
        twist: "A fixed direction becomes obsolete when the goal moves.",
        tags: ["swarm", "moving goal", "feedback"],
        duration: 120,
      },
      {
        id: "two-flock-crossing",
        title: "Two-Flock Crossing",
        category: "math-optimization",
        concept:
          "Coordinate separate agent groups with destination constraints and shared space.",
        description:
          "Two robot groups need different destinations. Set clearance for their shared working space.",
        objective:
          "Guide each group to its own goal while limiting contact losses.",
        twist:
          "Influencing the nearest agents is not enough when their destinations differ.",
        tags: ["swarm", "group identity", "multiple goals"],
        duration: 120,
      },
      {
        id: "storm-migration",
        title: "Storm Migration",
        category: "math-optimization",
        concept:
          "Choose clearance that works inside a constrained passage under disturbance.",
        description:
          "A narrow corridor and gusts constrain the formation. Choose clearance that fits the available geometry.",
        objective:
          "Pass the constrained route with a formation that maintains useful clearance.",
        twist:
          "External disturbance and limited space change where the shepherd should stand.",
        tags: ["swarm", "storm", "corridor navigation"],
        duration: 120,
      },
    ],
  );

  world(
    {
      id: "ecosystem",
      name: "Greenhouse Control",
      genre: "Ecosystem management",
      description:
        "Operate a sensor-controlled greenhouse model: choose irrigation, monitor moisture and sustain useful growth.",
      controls: [
        key("Arrow keys", "Move the rover"),
        key("Pointer", "Set a rover destination"),
        key("Space", "Plant or restore nearby ground"),
        key("E", "Harvest ripe growth or clear invasive growth"),
      ],
      rules: [
        "Plants and soil change continuously as the simulation runs.",
        "Use planting and restoration where the ground needs support.",
        "Harvest ripe growth, and clear invasive growth when the mission requires it.",
        "Balance immediate harvest against water, soil and habitat recovery.",
      ],
      scoring:
        "Planting, restoration and harvest earn points. Harvest credit is highest near 55% moisture and scales with the observed growing conditions.",
      learning:
        "Moisture feedback drives the pump. Setpoints change reservoir use, dryness, waterlogging and harvest quality.",
      levelDescriptions: [
        "Learn the growth and resource cycle under milder environmental stress.",
        "Balance restoration and harvest as drought and resource pressure rise.",
        "Maintain productive habitat under the strongest stress and objective demands.",
      ],
      ai: null,
    },
    [
      {
        id: "sustainable-harvest",
        title: "Sustainable Harvest",
        category: "iot",
        concept:
          "Choose an irrigation setpoint for sustained production rather than maximum water delivery.",
        description:
          "Run an IoT greenhouse model: choose a moisture target and watch growth, reservoir use and waterlogging.",
        objective:
          "Maintain useful harvest with a moisture target the water supply can sustain.",
        twist:
          "Repeated extraction can change the resources available for later growth.",
        tags: ["ecosystem", "sustainability", "feedback"],
        duration: 120,
      },
      {
        id: "arid-recovery",
        title: "Arid Recovery",
        category: "iot",
        concept:
          "Commission irrigation for poor soil without wasting the available water.",
        description:
          "Poor soil needs restoration as well as irrigation. Tune moisture while rebuilding the growing area.",
        objective:
          "Restore the growing area without wasting its shared water reserve.",
        twist:
          "Planting alone cannot substitute for recovering the conditions plants need.",
        tags: ["ecosystem", "soil", "restoration"],
        duration: 120,
      },
      {
        id: "pollinator-corridors",
        title: "Pollinator Corridors",
        category: "iot",
        concept:
          "Control a connected growing area whose outcome depends on spatial layout.",
        description:
          "Build a connected planted corridor and keep its moisture controlled for growth and pollinator visits.",
        objective:
          "Maintain an irrigated planted corridor that supports the mission targets.",
        twist:
          "Where restoration happens matters as well as how much you plant.",
        tags: ["ecosystem", "habitat", "spatial planning"],
        duration: 120,
      },
      {
        id: "invasive-containment",
        title: "Invasive Containment",
        category: "iot",
        concept:
          "Separate a control-setting problem from a disturbance that needs direct intervention.",
        description:
          "Irrigation cannot remove an invasive fault. Regulate healthy cells and clear the disturbance directly.",
        objective:
          "Control moisture and remove invasive growth before it degrades the process.",
        twist:
          "Containment competes with planting and harvesting for your attention.",
        tags: ["ecosystem", "invasive growth", "intervention"],
        duration: 120,
      },
      {
        id: "drought-resilience",
        title: "Drought Resilience",
        category: "iot",
        concept:
          "Adapt a greenhouse setpoint when supply and environmental demand change.",
        description:
          "Drought changes supply and demand. Adapt the irrigation target before the tank or plants are stressed.",
        objective:
          "Preserve productive growth by adapting irrigation to drought conditions.",
        twist:
          "A shrinking water margin forces priorities rather than uniform treatment.",
        tags: ["ecosystem", "drought", "resource allocation"],
        duration: 120,
      },
    ],
  );

  world(
    {
      id: "orbit",
      name: "Orbit Pilot",
      genre: "Orbital flight",
      description:
        "Choose an actuator envelope and control a craft through gravity, braking limits and finite drive reserve.",
      controls: [
        key("← / →", "Rotate the craft"),
        key("↑", "Thrust forward"),
        key("↓", "Apply reverse thrust"),
        key("Space", "Boost"),
        key("E", "Brake and docking assist"),
        key("Pointer", "Aim the heading and apply thrust"),
      ],
      rules: [
        "Thrust changes velocity; it does not instantly move the craft toward the cursor.",
        "Gravity continues accelerating the craft even while you are coasting.",
        "Control relative speed before passing a gate or docking with a moving target.",
        "Spend fuel carefully and account for debris or required trajectory changes.",
      ],
      scoring:
        "Gate and docking points reflect drive reserve used on the leg, with a minimum quality factor of 0.35. Stable-orbit rewards depend on the remaining reserve.",
      learning:
        "Thrust strength changes actual acceleration, boost impulse and fuel use. Closing speed sets an ideal braking-distance estimate, while gravity changes the real approach.",
      levelDescriptions: [
        "Learn turning, thrust and coasting with gentler orbital hazards.",
        "Manage denser hazards and increased objective pressure.",
        "Control precise approaches under the strongest debris and mission demands.",
      ],
      ai: null,
    },
    [
      {
        id: "gate-slalom",
        title: "Gate Slalom",
        category: "math-optimization",
        concept:
          "Select an actuator envelope from speed and the distance available for a correction.",
        description:
          "Choose a thrust envelope from speed and the available approach distance. Powerful corrections also cost reserve.",
        objective:
          "Clear navigation gates with controlled acceleration and arrival speed.",
        twist: "Pointing toward a gate does not cancel sideways velocity.",
        tags: ["orbital flight", "momentum", "gates"],
        duration: 105,
      },
      {
        id: "stable-orbit",
        title: "Stable Orbit",
        category: "math-optimization",
        concept:
          "Regulate a sustained trajectory without excessive corrective thrust.",
        description:
          "Hold the orbital band with measured corrections. Choose control authority that limits drift and wasted thrust.",
        objective:
          "Maintain the required orbital window with economical corrective thrust.",
        twist:
          "Continuous gravity makes coasting and corrective thrust part of the same plan.",
        tags: ["orbital flight", "gravity", "orbit tracking"],
        duration: 120,
      },
      {
        id: "rendezvous-dock",
        title: "Rendezvous Dock",
        category: "math-optimization",
        concept:
          "Choose control authority for a moving-target rendezvous with a relative-speed limit.",
        description:
          "The docking target moves. Compare closing speed and ideal braking distance before choosing thrust.",
        objective:
          "Dock with controlled relative speed and sufficient drive reserve.",
        twist:
          "A close pass can still miss the docking condition if relative velocity is too high.",
        tags: ["orbital flight", "rendezvous", "docking"],
        duration: 120,
      },
      {
        id: "debris-navigation",
        title: "Debris Navigation",
        category: "math-optimization",
        concept:
          "Balance collision-avoidance authority against recovery distance and energy.",
        description:
          "Avoid debris, then recover the route. Choose thrust for the correction and the distance needed afterward.",
        objective:
          "Clear the route using an actuator envelope that supports avoidance and recovery.",
        twist:
          "Avoidance maneuvers alter the velocity needed for the next approach.",
        tags: ["orbital flight", "debris", "collision avoidance"],
        duration: 120,
      },
      {
        id: "gravity-delivery",
        title: "Gravity Delivery",
        category: "math-optimization",
        concept:
          "Choose thrust while an external force helps one part of a route and complicates another.",
        description:
          "Gravity changes both travel and arrival speed. Select thrust for a controlled delivery, not just a fast transit.",
        objective:
          "Make gravity-shaped deliveries with controlled arrival speed and reserve.",
        twist:
          "The gravitational pull that helps one leg can complicate the final approach.",
        tags: ["orbital flight", "gravity assist", "delivery"],
        duration: 120,
      },
    ],
  );

  // Each example consumes the same public snapshot fields as the live controller.
  // The simulator calls this policy repeatedly; the example does not recreate physics.
  const pythonPrelude = `import json
import math

KEYS = ("left", "right", "up", "down", "action", "secondary")

def distance(a, b):
    return math.hypot(a["x"] - b["x"], a["y"] - b["y"])

def move(player, target, dead=8):
    if target is None:
        return {}
    return {"left": player["x"] > target["x"] + dead,
            "right": player["x"] < target["x"] - dead,
            "up": player["y"] > target["y"] + dead,
            "down": player["y"] < target["y"] - dead}

def controls(values):
    result = {key: bool(values.get(key, False)) for key in KEYS}
    for key in ("pointer", "pressed"):
        if key in values:
            result[key] = values[key]
    return result

def clamp(value, low, high):
    return max(low, min(high, value))
`;
  const policies = {};
  const policySources = {};
  function policy(id, name, summary, steps, body, example, limitations) {
    policySources[id] = { body, example };
    policies[id] = {
      name,
      summary,
      steps,
      code:
        pythonPrelude +
        "\n" +
        body.trim() +
        "\n\n# One public observation -> one action. Repeat this loop in a simulator.\nexample = json.loads(" +
        JSON.stringify(JSON.stringify(example)) +
        ")\nprint(json.dumps(agent(example), sort_keys=True))\n",
      limitations,
    };
  }

  policy(
    "factory",
    "Maintenance-first controller",
    "Prioritize a failing machine, then repair the conveyor route using cargo position and destination.",
    [
      "Read machine heat, jam state, cargo position and conveyor direction from the current observation.",
      "Repair jammed or hot machines first; otherwise prioritize incorrect belts carrying waiting cargo.",
      "For split orders, turn the junction toward the cargo’s destination row before restoring eastward flow.",
      "Move into interaction range and press the corresponding action; repeat after the factory advances.",
    ],
    `
def agent(o):
    player = o["player"]
    hot = [m for m in o["machines"] if m["jammed"] or m["heat"] > 64]
    if hot:
        target = max(hot, key=lambda m: 100 * bool(m["jammed"]) + m["heat"])
        return controls(dict(move(player, target), secondary=distance(player, target) < 65))
    fixes = []
    for belt in o["belts"]:
        cargo = next((a for a in o["cargo"] if a["c"] == belt["c"] and a["r"] == belt["r"]), None)
        desired = 0  # east; direction indices continue south, west, north
        if o["variant"] == 2 and belt["c"] == 6 and cargo and cargo["goal"] != belt["r"]:
            desired = 1 if cargo["goal"] > belt["r"] else 3
        if belt["dir"] != desired:
            priority = (200 + cargo["waiting"] * 10 if cargo else 0) - distance(player, belt) * 0.08
            fixes.append((priority, belt))
    if fixes:
        target = max(fixes, key=lambda item: item[0])[1]
        return controls(dict(move(player, target), action=distance(player, target) < 51))
    target = max(o["machines"], key=lambda m: m["heat"], default=None)
    return controls(dict(move(player, target), secondary=bool(target and distance(player, target) < 65 and target["heat"] > 25)))
`,
    {
      family: "factory",
      variant: 0,
      player: { x: 200, y: 100 },
      machines: [{ x: 220, y: 120, heat: 80, jammed: false }],
      belts: [{ x: 180, y: 200, c: 1, r: 1, dir: 2 }],
      cargo: [],
    },
    "A reactive scheduling heuristic, not a production optimizer. It can overlook future congestion; the simulator applies cooldowns and processing rules.",
  );

  policy(
    "network",
    "Repair, connect, upgrade",
    "Use relay health and queue observations to preserve a working route before spending on extra capacity.",
    [
      "Inspect relay health, heat, offline time, queue length and available credits.",
      "Repair urgent failures first, then build missing relays on the middle route.",
      "Rank upgrades by queue pressure, heat and existing tier while respecting credit costs.",
      "Move to the chosen relay and interact when close; reconsider after every new observation.",
    ],
    `
def agent(o):
    player, nodes, credits = o["player"], o["nodes"], o["credits"]
    urgent = [n for n in nodes if n["tier"] and (n["hp"] < 65 or n["offline"] > 0 or n["heat"] > 70)]
    if urgent:
        target = max(urgent, key=lambda n: 100 * bool(n["offline"]) + n["heat"] + 100 - n["hp"])
        return controls(dict(move(player, target), secondary=distance(player, target) < 68))
    missing = next((n for n in nodes if n["r"] == 1 and not n["tier"]), None)
    if missing and credits >= 20:
        return controls(dict(move(player, missing), action=distance(player, missing) < 58))
    upgrades = [n for n in nodes if 0 < n["tier"] < 3]
    target = max(upgrades, key=lambda n: n["queue"] * 20 + n["heat"] - n["tier"] * 12, default=None)
    if target and credits >= 20 + target["tier"] * 9:
        return controls(dict(move(player, target), action=distance(player, target) < 58))
    target = min((n for n in nodes if not n["tier"]), key=lambda n: abs(n["c"] - 1.5), default=None)
    if target and credits > 25:
        return controls(dict(move(player, target), action=distance(player, target) < 58))
    target = nodes[7] if len(nodes) > 7 else None
    return controls(dict(move(player, target), secondary=bool(target and target["heat"] > 35 and distance(player, target) < 68)))
`,
    {
      family: "network",
      variant: 0,
      player: { x: 100, y: 100 },
      credits: 30,
      nodes: [
        {
          id: "relay-1",
          x: 180,
          y: 160,
          c: 1,
          r: 1,
          tier: 0,
          hp: 100,
          heat: 0,
          offline: 0,
          queue: 0,
        },
      ],
    },
    "This local priority policy does not solve a global routing problem. It uses visible queue and condition data; packet routing remains the simulator’s responsibility.",
  );

  policy(
    "swarm",
    "Centroid shepherd",
    "Guide a flock indirectly by placing an attracting drone ahead of its center of mass.",
    [
      "Choose an unfinished flock group and its matching destination.",
      "Average the flock positions to estimate its center, then aim 85 world units toward its goal.",
      "Move the shepherd toward that point while attracting nearby agents.",
      "Repel a nearby predator when the pulse is available, then recompute as the flock moves.",
    ],
    `
def agent(o):
    goals = [g for g in o["goals"] if any(b["group"] == g["group"] for b in o["boids"])]
    if not goals:
        return controls({})
    goal = min(goals, key=lambda g: g["captured"])
    flock = [b for b in o["boids"] if b["group"] == goal["group"]]
    center = {axis: sum(b[axis] for b in flock) / len(flock) for axis in ("x", "y")}
    span = max(1, distance(center, goal))
    ahead = {axis: center[axis] + (goal[axis] - center[axis]) / span * 85 for axis in ("x", "y")}
    threat = min(o["predators"], key=lambda p: distance(o["player"], p), default=None)
    repel = bool(threat and distance(o["player"], threat) < 105 and o["pulse"] <= 0)
    return controls(dict(move(o["player"], ahead, 6), action=True, secondary=repel))
`,
    {
      family: "swarm",
      variant: 0,
      player: { x: 100, y: 250 },
      boids: [
        { x: 200, y: 240, vx: 12, vy: 0, group: 0 },
        { x: 220, y: 260, vx: 10, vy: 2, group: 0 },
      ],
      goals: [{ x: 800, y: 250, r: 60, group: 0, captured: 0 }],
      predators: [],
      pulse: 0,
    },
    "The centroid is a compact estimate, not a full plan for every agent. Split flocks, obstacles and competing groups can defeat this local policy.",
  );

  policy(
    "runner",
    "Look-ahead jump controller",
    "Read the nearby platform edge, useful pickups and hazards to decide when to jump or dash.",
    [
      "Read the player’s grounded state and the remaining distance to the platform edge.",
      "Estimate a jump’s landing position; chase high pickups or avoid noise only when that estimate reaches a platform.",
      "Jump near an edge when grounded; dash near a live gate or while falling across an actual gap.",
      "Apply forward motion and repeat this decision on the next simulation frame.",
    ],
    `
def agent(o):
    p = o["player"]
    high = any(not a["noise"] and a["active"] and 0 < a["x"] - p["x"] < 90 and a["y"] < p["y"] - 25 for a in o["orbs"])
    noise = any(a["noise"] and a["active"] and 0 < a["x"] - p["x"] < 90 and abs(a["y"] - p["y"]) < 40 for a in o["orbs"])
    edge_limit = 95 if o["variant"] == 4 else 65
    landing_x = p["x"] + p["vx"] * (1.32 if o["variant"] == 4 else 0.76)
    support, next_pad = o["support"], o["nextPlatform"]
    safe_jump = bool(support and landing_x < support["x"] + support["width"] - 15) or bool(next_pad and next_pad["x"] + 15 < landing_x < next_pad["x"] + next_pad["width"] - 15)
    jump = p["grounded"] and (o["edge"] < edge_limit or safe_jump and (high or noise))
    live_gate = any(g["active"] and g["x"] - p["x"] < 80 for g in o["gates"])
    next_pad = o["nextPlatform"]
    extend = o["overGap"] and not p["grounded"] and p["vy"] > 0 and next_pad is not None and next_pad["x"] - p["x"] > 65
    return controls({"right": True, "action": jump, "secondary": live_gate or extend})
`,
    {
      family: "runner",
      variant: 0,
      player: { x: 300, y: 400, grounded: true, vx: 240, vy: 0 },
      support: { x: 100, width: 285 },
      overGap: false,
      edge: 60,
      nextPlatform: { x: 470, y: 430, width: 300 },
      orbs: [],
      gates: [],
    },
    "The landing estimate uses approximate full-jump airtime and current horizontal speed. Height differences, dashes and pickup timing can invalidate that simple prediction.",
  );

  policy(
    "grapple",
    "Attach–swing–release controller",
    "Use the tether state and forward velocity to choose attachment and release events.",
    [
      "Find the currently attached anchor and the simulator’s reachable forward target.",
      "Attach when a target is reachable and no tether is active.",
      "Reel in a long tether, then release with forward and upward velocity or before a fragile link expires.",
      "Pay out cable and reduce pumping under high load; use a burst to recover an elastic stall or a low unattached flight.",
    ],
    `
def agent(o):
    p = o["player"]
    anchor = next((a for a in o["anchors"] if a["id"] == p["anchor"]), None)
    release = anchor is not None and ((p["x"] > anchor["x"] + 90 and p["vx"] > 90 and p["vy"] < -55) or (o["variant"] == 3 and p["attachedFor"] > 1))
    attach = anchor is None and o["target"] is not None
    event = attach or release
    stress = anchor is not None and o["engineering"]["predictedTensions"][2] > o["engineering"]["ratings"][2] / 1.15
    stalled = o["variant"] == 2 and anchor is not None and p["attachedFor"] > 2 and math.hypot(p["vx"], p["vy"]) < 90
    return controls({"right": p["vx"] < 290 and not stress, "left": p["vx"] > 355 or stress and p["vx"] > 60,
                     "up": anchor is not None and p["length"] > 225 and not stress, "down": stress,
                     "secondary": p["y"] > 390 and anchor is None or stalled,
                     "action": event, "pressed": {"action": event}})
`,
    {
      family: "grapple",
      variant: 0,
      player: {
        x: 200,
        y: 350,
        vx: 140,
        vy: 0,
        length: 0,
        anchor: null,
        attachedFor: 0,
      },
      anchors: [{ id: 1, x: 300, y: 140 }],
      target: { id: 1, x: 300, y: 140 },
      wind: 0,
    },
    "This event policy does not optimize pendulum energy or simulate future swings. Elastic links and gusts can require better release prediction.",
  );

  policy(
    "racer",
    "Predictive steering controller",
    "Choose a nearby driving target and compensate for sideways velocity before steering.",
    [
      "Find the nearest relevant barrier and the nearest useful pickup ahead.",
      "Prefer avoiding an imminent barrier; otherwise aim for the pickup or road center.",
      "Keep the target inside the road and compare it with the predicted lateral position x + 0.32 × velocity.",
      "Steer toward the error, brake for close danger, and use traction, sensing or boost; the simulator gives braking priority over throttle.",
    ],
    `
def agent(o):
    p = o["player"]
    dangers = [a for a in o["objects"] if a["type"] == "barrier" and p["y"] - 190 < a["y"] < p["y"] + 20]
    danger = max(dangers, key=lambda a: a["y"], default=None)
    pickups = [a for a in o["objects"] if a["type"] != "barrier" and p["y"] - 200 < a["y"] < p["y"]]
    pickup = max(pickups, key=lambda a: a["y"], default=None)
    target = o["roadCenter"]
    if danger and abs(danger["x"] - p["x"]) < 80:
        target = danger["x"] + (115 if p["x"] >= danger["x"] else -115)
    elif pickup:
        target = pickup["x"]
    target = clamp(target, o["roadCenter"] - o["roadHalf"] + 50, o["roadCenter"] + o["roadHalf"] - 50)
    delta = target - (p["x"] + p["vx"] * 0.32)
    brake = bool(danger and abs(danger["x"] - p["x"]) < 50 and danger["y"] > p["y"] - 85)
    return controls({"up": True, "down": brake, "left": delta < -14, "right": delta > 14,
                     "action": o["slick"] or o["variant"] == 4, "secondary": danger is None and p["energy"] > 45})
`,
    {
      family: "racer",
      variant: 0,
      player: { x: 480, y: 428, vx: 0, energy: 80 },
      roadCenter: 480,
      roadHalf: 210,
      slick: false,
      objects: [{ x: 475, y: 360, type: "barrier" }],
    },
    "A short-horizon rule does not forecast moving barriers or optimize energy globally. Limited sensing and ability cooldowns can leave too little time for recovery.",
  );

  policy(
    "drone",
    "Position-to-velocity controller",
    "Convert distance from the flight target into bounded desired velocity, then correct the velocity error.",
    [
      "Choose an unscanned beacon; otherwise cruise above the pad until aligned, then begin the descent.",
      "Convert position error into bounded desired velocity, adding the moving pad’s horizontal velocity.",
      "Compare desired velocity with the measured velocity to choose directional thrust.",
      "Use landing assist near the target and scan within range; repeat as the target and drone move.",
    ],
    `
def agent(o):
    p = o["player"]
    needs_scan = o["variant"] == 2 and not o["beacon"]["scanned"]
    dx = o["target"]["x"] - p["x"]
    cruise = abs(dx) > 110 or p["y"] + p["r"] > o["target"]["y"] + 4
    aim = o["beacon"] if needs_scan else {"x": o["target"]["x"], "y": o["target"]["y"] - p["r"] + (-75 if cruise else 8)}
    dy = aim["y"] - p["y"]
    desired_x = clamp(dx * 0.85 + o["target"].get("vx", 0), -150, 150)
    desired_y = clamp(dy * 0.95, -95, 55)
    return controls({"left": p["vx"] > desired_x + 10, "right": p["vx"] < desired_x - 10,
                     "up": p["vy"] > desired_y + 8, "down": p["vy"] < desired_y - 20,
                     "secondary": abs(dx) < 110 and abs(dy) < 120,
                     "action": needs_scan and distance(p, o["beacon"]) < 145})
`,
    {
      family: "drone",
      variant: 2,
      player: { x: 650, y: 260, vx: 40, vy: 10, r: 16 },
      target: { x: 765, y: 427, vx: 0 },
      beacon: { x: 765, y: 322, scanned: false },
      wind: 10,
      scanCooldown: 0,
    },
    "This feedback controller does not plan a battery-optimal route or estimate future pad motion. It reacts to measured errors; simulator physics determine the resulting flight.",
  );

  policy(
    "arena",
    "Observe, evade, aim",
    "Choose a rule-score threshold, move away from admitted tracks and aim ahead of the nearest one.",
    [
      "Admit tracks whose public rule score reaches the chosen threshold; the policy does not consult the target’s true class.",
      "Blend a gentle pull toward the center with enemy separation and nearby-bullet avoidance.",
      "Aim slightly ahead using the hostile’s observed velocity and keep moving while firing.",
      "Choose the E action from mission state: matching shield polarity, venting heat or defending against close danger.",
    ],
    `
def agent(o):
    p = o["player"]
    threshold = o["engineering"]["thresholds"][choose_setting(o)]
    enemy = min((e for e in o["enemies"] if e["confidence"] >= threshold), key=lambda e: distance(e, p), default=None)
    dx, dy = (480 - p["x"]) * 0.15, (270 - p["y"]) * 0.15
    if enemy and distance(enemy, p) < 190:
        dx += (p["x"] - enemy["x"]) * 2
        dy += (p["y"] - enemy["y"]) * 2
    if enemy:
        dx -= (enemy["y"] - p["y"]) * 0.22
        dy += (enemy["x"] - p["x"]) * 0.22
    bullet = next((b for b in o["bullets"] if distance(b, p) < 90), None)
    if bullet:
        dx += (p["x"] - bullet["x"]) * 3
        dy += (p["y"] - bullet["y"]) * 3
    if o["variant"] == 1:
        ability = bool(enemy and enemy["shield"] != p["polarity"])
    elif o["variant"] == 4:
        ability = p["heat"] > 0.68
    else:
        ability = bullet is not None or bool(enemy and distance(enemy, p) < 110)
    pointer = {"x": enemy["x"] + enemy["vx"] * 0.15, "y": enemy["y"] + enemy["vy"] * 0.15, "down": True} if enemy else {"x": p["x"], "y": p["y"], "down": False}
    return controls({"left": dx < -15, "right": dx > 15, "up": dy < -15, "down": dy > 15,
                     "action": enemy is not None, "secondary": ability, "pointer": pointer})
`,
    {
      family: "arena",
      variant: 1,
      player: { x: 480, y: 340, polarity: 0, heat: 0 },
      enemies: [
        {
          id: 1,
          x: 580,
          y: 250,
          vx: -15,
          vy: 10,
          shape: "triangle",
          shield: 1,
        },
        { id: 2, x: 460, y: 300, vx: 0, vy: 0, shape: "circle", shield: -1 },
      ],
      bullets: [],
    },
    "This transparent policy uses public rule scores, sensor bias and velocity, not trained probabilities or true target classes. False positives, missed threats and imperfect escort coverage remain possible.",
  );

  policy(
    "ecosystem",
    "Regeneration scheduler",
    "Rank restoration tasks by urgency, distance and the value of joining planted neighbors.",
    [
      "Read visible water, soil, growth and invasive status for each cell.",
      "Prioritize clearing invasive growth, harvesting mature growth and watering dry plants.",
      "When water permits, plant new cells; favor neighboring plants in the corridor mission.",
      "Subtract travel cost, move toward the best task and interact in range before reassessing.",
    ],
    `
def agent(o):
    ranked = []
    for cell in o["cells"]:
        score, secondary = -math.inf, False
        if cell["invasive"]:
            score, secondary = 950, True
        elif cell["planted"] and cell["growth"] >= 0.8:
            score, secondary = 850, True
        elif o["reservoir"] >= 7 and cell["planted"] and cell["water"] < 0.3:
            score = 500
        elif o["reservoir"] >= 11 and not cell["planted"]:
            neighbors = sum(n["planted"] and abs(n["c"] - cell["c"]) + abs(n["r"] - cell["r"]) == 1 for n in o["cells"])
            score = 280 + (neighbors * 70 if o["variant"] == 2 else 0)
        elif o["reservoir"] >= 7 and cell["planted"] and cell["soil"] < 0.55:
            score = 200
        ranked.append((score - distance(o["player"], cell) * 0.45, cell, secondary))
    best = max(ranked, key=lambda item: item[0], default=None)
    if best is None or not math.isfinite(best[0]):
        return controls({})
    _, target, secondary = best
    near = distance(o["player"], target) < 42
    return controls(dict(move(o["player"], target, 7), action=near and not secondary, secondary=near and secondary))
`,
    {
      family: "ecosystem",
      variant: 2,
      player: { x: 200, y: 220 },
      reservoir: 35,
      cells: [
        {
          x: 220,
          y: 220,
          c: 1,
          r: 1,
          soil: 0.6,
          water: 0.4,
          growth: 0.9,
          planted: true,
          invasive: false,
        },
        {
          x: 310,
          y: 220,
          c: 2,
          r: 1,
          soil: 0.4,
          water: 0.2,
          growth: 0,
          planted: false,
          invasive: false,
        },
      ],
    },
    "This policy manages a simplified game ecosystem, not a field ecology model. Fixed task values may miss long-term water shortages and the best habitat layout.",
  );

  policy(
    "orbit",
    "Gravity-aware flight controller",
    "Combine target tracking, velocity correction and local gravity compensation before choosing thrust.",
    [
      "Estimate gravity from the visible planet positions, radii and gravitational parameters.",
      "For orbit tracking, combine tangential velocity with radial correction; otherwise aim for the target or a planet-avoidance waypoint.",
      "Turn toward the desired acceleration: velocity error correction minus the estimated gravity.",
      "Thrust when aligned, boost on a long approach and brake near a docking target; repeat with the next snapshot.",
    ],
    `
def agent(o):
    p, goal = o["player"], dict(o["target"])
    gx = gy = 0
    for planet in o["planets"]:
        dx, dy = planet["x"] - p["x"], planet["y"] - p["y"]
        span = max(planet["r"] + 15, math.hypot(dx, dy))
        gx += dx / span * planet["mu"] / (span * span)
        gy += dy / span * planet["mu"] / (span * span)
    if o["variant"] == 1:
        planet = o["planets"][0]
        dx, dy = p["x"] - planet["x"], p["y"] - planet["y"]
        radius = max(1, math.hypot(dx, dy))
        speed, radial = math.sqrt(planet["mu"] / 190), (190 - radius) * 0.75
        desired_x = -dy / radius * speed + dx / radius * radial
        desired_y = dx / radius * speed + dy / radius * radial
    else:
        for planet in o["planets"]:
            vx, vy = goal["x"] - p["x"], goal["y"] - p["y"]
            length_squared = vx * vx + vy * vy
            u = clamp(((planet["x"] - p["x"]) * vx + (planet["y"] - p["y"]) * vy) / max(1, length_squared), 0, 1)
            close = {"x": p["x"] + u * vx, "y": p["y"] + u * vy}
            if 0.04 < u < 0.95 and distance(close, planet) < planet["r"] + 60:
                span = max(1, math.hypot(vx, vy))
                side = -1 if vx * (planet["y"] - p["y"]) - vy * (planet["x"] - p["x"]) > 0 else 1
                goal = {"x": planet["x"] - vy / span * (planet["r"] + 125) * side,
                        "y": planet["y"] + vx / span * (planet["r"] + 125) * side, "vx": 0, "vy": 0}
                break
        desired_x = (goal["x"] - p["x"]) * 0.8 + goal.get("vx", 0)
        desired_y = (goal["y"] - p["y"]) * 0.8 + goal.get("vy", 0)
        speed = math.hypot(desired_x, desired_y)
        limit = 100 if o["variant"] == 2 else 110
        if speed > limit:
            desired_x, desired_y = desired_x / speed * limit, desired_y / speed * limit
    ax, ay = (desired_x - p["vx"]) * 1.8 - gx, (desired_y - p["vy"]) * 1.8 - gy
    angle = math.atan2(ay, ax)
    error = math.atan2(math.sin(angle - p["angle"]), math.cos(angle - p["angle"]))
    remaining = distance(p, o["target"])
    boost = abs(error) < 0.12 and remaining > 170 and math.hypot(p["vx"], p["vy"]) < 90 and p["fuel"] > 45 and o["boost"] <= 0
    brake = o["variant"] == 2 and remaining < 75 and math.hypot(p["vx"] - o["target"]["vx"], p["vy"] - o["target"]["vy"]) > 28
    return controls({"left": error < -0.055, "right": error > 0.055,
                     "up": abs(error) < 0.28 and math.hypot(ax, ay) > 10,
                     "action": boost, "secondary": brake})
`,
    {
      family: "orbit",
      variant: 0,
      player: { x: 150, y: 300, vx: 20, vy: 0, angle: 0, fuel: 90 },
      planets: [{ x: 480, y: 270, r: 65, mu: 600000 }],
      target: { x: 750, y: 160, vx: 0, vy: 0 },
      boost: 0,
    },
    "This arcade flight policy uses simplified world units and a local avoidance waypoint. It is not a spacecraft mission planner and does not forecast moving debris.",
  );

  const settingPolicies = {
    runner: `def choose_setting(o):
    source = o["engineering"]
    return next((i for i, rate in enumerate(source["rates"]) if rate > 2 * source["frequency"]), 2)
`,
    grapple: `def choose_setting(o):
    source = o["engineering"]
    derating = max(0.65, 1 - o["player"]["attachedFor"] * 0.15) if o["variant"] == 3 else 1
    return next((i for i, rating in enumerate(source["ratings"]) if rating * derating >= source["predictedTensions"][i] * (1.7 if o["variant"] == 2 else 1.2)), 2)
`,
    racer: `def choose_setting(o):
    source = o["engineering"]
    if source["friction"] < 0.6:
        return 0
    return 2 if abs(source["crossTrack"]) > 85 and source["friction"] > 0.82 else 1
`,
    drone: `def choose_setting(o):
    modes = o["engineering"]["options"]
    return min(range(len(modes)), key=lambda i: modes[i]["uncertainty"] + modes[i]["power"] * 0.8)
`,
    arena: `def choose_setting(o):
    source = o["engineering"]
    return min(range(len(source["thresholds"])), key=lambda i: abs(source["thresholds"][i] - (0.55 + source["bias"])))
`,
    factory: `def choose_setting(o):
    peak = max((machine["heat"] for machine in o["machines"]), default=-math.inf)
    if peak > 70 or len(o["cargo"]) > 22:
        return 0
    return 2 if peak < 40 and len(o["cargo"]) < 14 else 1
`,
    network: `def choose_setting(o):
    if o["credits"] < 16:
        return 0
    queue = sum(node["queue"] for node in o["nodes"])
    urgent = any(packet["priority"] and packet["age"] > 6 for packet in o["packets"])
    return 2 if queue > 6 or urgent else 1
`,
    swarm: `def choose_setting(o):
    if o["minClearance"] < 16:
        return 2
    return 0 if o["spread"] > 135 and o["minClearance"] > 25 else 1
`,
    ecosystem: `def choose_setting(o):
    if o["reservoir"] < 20:
        return 0
    return 2 if o["soilMoisture"] < 0.34 and o["reservoir"] > 35 else 1
`,
    orbit: `def choose_setting(o):
    remaining = distance(o["player"], o["target"])
    if o["player"]["fuel"] < 22 or remaining < 130 or o["variant"] == 1:
        return 0
    return 2 if remaining > 300 and o["player"]["fuel"] > 55 else 1
`,
  };
  const settingExamples = {
    runner: { engineering: { rates: [8, 16, 32], frequency: 6, battery: 80 } },
    grapple: {
      engineering: {
        ratings: [950, 1650, 2800],
        predictedTensions: [1200, 1320, 1560],
      },
    },
    racer: { engineering: { friction: 0.4, crossTrack: 35 } },
    drone: {
      engineering: {
        options: [
          { uncertainty: 12, power: 1.5 },
          { uncertainty: 7, power: 0.8 },
          { uncertainty: 5, power: 0.35 },
        ],
      },
    },
    arena: { engineering: { thresholds: [0.35, 0.55, 0.75], bias: 0.2 } },
    factory: {},
    network: { packets: [] },
    swarm: { minClearance: 14, spread: 100 },
    ecosystem: { soilMoisture: 0.45 },
    orbit: {},
  };
  const settingSteps = {
    runner:
      "Choose the lowest sample rate above twice the measured source frequency; faster sampling spends more sensor energy.",
    grapple:
      "Choose the lightest cable with a 20% estimated load margin, or 70% for an elastic link; temporary anchors reduce available rating.",
    racer:
      "Reduce gain on low traction; use the largest gain only for a large tracking error with high traction.",
    drone:
      "Compare each mode’s predicted uncertainty plus a sensing-power penalty, then choose the smallest combined cost.",
    arena:
      "Adjust the classifier threshold for the measured sensor bias, and admit targets by rule score rather than hidden class labels.",
    factory:
      "Reduce feed when peak heat or queued work is high; increase it only when both have spare capacity.",
    network:
      "Conserve service credits when low; use burst service for large queues or aging priority traffic.",
    swarm:
      "Widen clearance when agents are too close; compact a spread-out group only when clearance is sufficient.",
    ecosystem:
      "Lower the irrigation target when water is scarce; increase it when the soil is dry and reserve is available.",
    orbit:
      "Select precision thrust near the target, for orbit tracking or with low fuel; use high thrust only on a long approach with reserve.",
  };
  for (const family of families) {
    const source = policySources[family.id];
    const example = { ...source.example, ...settingExamples[family.id] };
    if (family.id === "arena")
      example.enemies = example.enemies.map((enemy) => ({
        ...enemy,
        confidence: enemy.shape === "triangle" ? 0.83 : 0.24,
      }));
    policies[family.id].steps.unshift(settingSteps[family.id]);
    policies[family.id].code =
      pythonPrelude +
      "\n" +
      settingPolicies[family.id] +
      "\n" +
      source.body.trim().replace("def agent(o):", "def movement(o):") +
      '\n\ndef agent(o):\n    action = movement(o)\n    action["setting"] = choose_setting(o)\n    return action\n\n' +
      "# One public observation -> engineering setting plus movement. Repeat in the simulator.\n" +
      "example = json.loads(" +
      JSON.stringify(JSON.stringify(example)) +
      ")\n" +
      "print(json.dumps(agent(example), sort_keys=True))\n";
  }

  const shortControls = {
    runner: ["Jump", "Dash"],
    grapple: ["Link / release", "Burst"],
    racer: ["Assist / scan", "Boost"],
    drone: ["Scan", "Landing assist"],
    arena: ["Fire", "Mission ability"],
    factory: ["Rotate belt", "Repair / vent"],
    network: ["Build / upgrade", "Repair / purge"],
    swarm: ["Attract", "Repel"],
    ecosystem: ["Plant / water", "Harvest / clear"],
    orbit: ["Boost", "Brake"],
  };
  for (const family of families) {
    family.rules.push(
      {
        runner:
          "Choose the sampling rate from the live source frequency; undersampled captures do not advance the accurate-data target.",
        grapple:
          "Compare estimated demand with the cable rating; choose a design and reduce sustained overload before it releases the tether.",
        racer:
          "Choose steering gain from grip and tracking error; tire saturation limits the actual correction.",
        drone:
          "Choose a sensor mode whose modeled uncertainty is below the displayed landing limit.",
        arena:
          "The selected threshold gates firing by public rule score; watch false positives and missed threats as sensor bias changes.",
        factory:
          "Select feed for accepted quality; excessive processing heat reduces part integrity and can latch an interlock.",
        network:
          "Match relay service to demand; burst service consumes operating credits and loses capacity when that budget is empty.",
        swarm:
          "Choose formation clearance; contact below 9 world units causes losses while wider spacing weakens cohesion.",
        ecosystem:
          "Choose the irrigation setpoint; dry roots and waterlogging reduce growth while the pump draws from the shared tank.",
        orbit:
          "Choose thrust for the approach; the ideal braking estimate ignores gravity and counterthrust consumes reserve.",
      }[family.id],
    );
    family.controls.push(
      key("Z / X", "Select the previous or next engineering preset"),
    );
    family.ai = policies[family.id];
    const primary = family.controls.find((control) => control.key === "Space");
    const secondary = family.controls.find((control) => control.key === "E");
    primary.short = shortControls[family.id][0];
    secondary.short = shortControls[family.id][1];
  }
  return { categories, families, games };
});
