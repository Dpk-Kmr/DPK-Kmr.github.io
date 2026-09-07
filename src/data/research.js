// Publication catalog. Editing and verification instructions: docs/research-sources.md
// Public research summaries are original paraphrases; visual stories are concept illustrations.
window.ATRIKSHA_RESEARCH = {
  collection: {
    title: "Applied research",
    verifiedDate: "2026-09-07",
  },
  papers: [
    {
      id: "co2-solvents",
      year: 2026,
      date: "2026-03-25",
      onlineDate: "2026-03-12",
      title:
        "Thermophysical Property Prediction and Optimization of CO₂–Binding Organic Liquids Using Kolmogorov–Arnold Networks and Optimized Quantum Descriptors",
      headline: "Choosing better carbon-capture liquids",
      topic: "Molecular design",
      color: "cyan",
      authors: [
        "Deepak Kumar",
        "Safique Anwer",
        "Ahmed Alhajaj",
        "Manojkumar Ramteke",
        "Hariprasad Kodamana",
      ],
      journal: "Industrial & Engineering Chemistry Research",
      citation: "65 (11), 6375–6392",
      type: "Journal article",
      doi: "10.1021/acs.iecr.5c03327",
      publisherUrl: "https://pubs.acs.org/doi/abs/10.1021/acs.iecr.5c03327",
      takeaway:
        "Interpretable models help compare how carbon-capture liquids flow and evaporate.",
      question:
        "How can researchers screen carbon-capture solvents when experimental measurements are scarce?",
      approach:
        "The team combined optimized molecular descriptors, prediction ensembles, and Kolmogorov–Arnold networks to connect molecular structure with liquid properties.",
      finding:
        "Testing on held-out compounds supported predictions of density, viscosity, and vapor pressure. Optimization identified different blends for lower solvent loss or easier circulation.",
      why: "Makes solvent trade-offs easier to inspect before selecting candidates for experiments.",
      limitation:
        "Property prediction and optimization study; it does not establish full-scale carbon-capture performance.",
      visualDescription:
        "Molecular structure feeds a property model, then branches into two solvent choices: lower evaporation and easier flow.",
      sourceNote:
        "Publisher abstract and metadata; author order also checked against the publisher-deposited Crossref record.",
      status: "Published",
      doiUrl: "https://doi.org/10.1021/acs.iecr.5c03327",
      verifiedDate: "2026-09-07",
    },
    {
      id: "symbolic-physics",
      year: 2025,
      date: "2025-06-11",
      onlineDate: "2025-05-27",
      title:
        "Learning System Physics Using Symbolic Neural Integration (SyNISM) with Applications to Chemical Processes",
      headline: "Turning data into readable equations",
      topic: "Process systems",
      color: "lime",
      authors: [
        "Deepak Kumar",
        "Vinayak Dixit",
        "Manojkumar Ramteke",
        "Hariprasad Kodamana",
      ],
      journal: "Industrial & Engineering Chemistry Research",
      citation: "64 (23), 11441–11458",
      type: "Journal article",
      doi: "10.1021/acs.iecr.5c00107",
      publisherUrl: "https://pubs.acs.org/doi/abs/10.1021/acs.iecr.5c00107",
      takeaway:
        "SyNISM learns equations that help explain the physics behind process data.",
      question:
        "Can a learning model describe a physical process with equations people can inspect?",
      approach:
        "SyNISM combines neural networks with symbolic regression. A parameter-generating network helps select compact expressions for the system being modeled.",
      finding:
        "Case studies covering reactors, heat transfer, and material properties recovered symbolic relationships consistent with analytical solutions.",
      why: "Readable equations can help engineers examine learned relationships and predictions.",
      limitation:
        "Demonstrated on the reported case studies; performance beyond them is not established.",
      visualDescription:
        "Observed data passes through symbolic learning blocks and emerges as an inspectable equation sheet.",
      sourceNote:
        "Publisher abstract, author list, and publication dates; Crossref author-order verification.",
      status: "Published",
      doiUrl: "https://doi.org/10.1021/acs.iecr.5c00107",
      verifiedDate: "2026-09-07",
    },
    {
      id: "model-maintenance",
      year: 2024,
      date: "2024-10",
      title:
        "A framework for model maintenance using kernel-based forward propagating neural networks",
      headline: "Keeping models in step with change",
      topic: "Process systems",
      color: "purple",
      authors: ["Deepak Kumar", "Manojkumar Ramteke", "Hariprasad Kodamana"],
      journal: "Chemical Engineering Research and Design",
      citation: "210, 352–364",
      type: "Journal article",
      doi: "10.1016/j.cherd.2024.09.002",
      publisherUrl:
        "https://www.sciencedirect.com/science/article/abs/pii/S0263876224005318",
      takeaway:
        "Layer-by-layer updates help process models adapt as fresh measurements arrive.",
      question:
        "How can a process model stay useful when operating conditions change?",
      approach:
        "A kernel-based forward-propagating network updates individual layers as new data arrives, avoiding backpropagation through the entire network.",
      finding:
        "In a stirred-tank reactor control case study, the adaptive model updated faster and performed better than the backpropagation-based comparison.",
      why: "Faster adaptation can support timely control decisions as processes drift.",
      limitation:
        "Reported results are specific to the reactor case study and its comparison setup.",
      visualDescription:
        "A process changes direction; sequential model layers update; the model reconnects with incoming measurements.",
      sourceNote:
        "Publisher abstract and section snippets; Crossref verifies author order and October 2024 issue.",
      status: "Published",
      doiUrl: "https://doi.org/10.1016/j.cherd.2024.09.002",
      verifiedDate: "2026-09-07",
    },
    {
      id: "koopman-dynamics",
      year: 2024,
      date: "2024",
      title:
        "Learning Interpretable Representation of Koopman Operator for Non-linear Dynamics",
      headline: "Making complex motion easier to read",
      topic: "Process systems",
      color: "cyan",
      authors: [
        "Deepak Kumar",
        "Vinayak Dixit",
        "Manojkumar Ramteke",
        "Hariprasad Kodamana",
      ],
      journal: "Computer Aided Chemical Engineering",
      citation: "53, 2773–2778",
      type: "Conference chapter",
      doi: "10.1016/B978-0-443-28824-1.50463-4",
      publisherUrl:
        "https://www.sciencedirect.com/science/article/abs/pii/B9780443288241504634",
      takeaway:
        "An equation-learning model makes nonlinear reactor behavior easier to analyze.",
      question:
        "Can complicated reactor dynamics be represented in a simpler space without hiding how the transformation works?",
      approach:
        "Equation Learner networks create explicit mappings into and out of a lifted space, where a Koopman model describes the dynamics linearly.",
      finding:
        "A stirred-tank reactor example demonstrated this interpretable transformation and prediction of reaction concentrations.",
      why: "Transparent transformations help engineers understand what a learned model is doing.",
      limitation:
        "The authors identify testing different initial conditions and disturbances as future work.",
      visualDescription:
        "Curved system behavior transforms through a mapping into straight, simpler trajectories in a lifted space.",
      sourceNote:
        "Publisher abstract, author list, conclusion, and chapter metadata; Crossref verification.",
      status: "Published",
      doiUrl: "https://doi.org/10.1016/B978-0-443-28824-1.50463-4",
      verifiedDate: "2026-09-07",
    },
    {
      id: "heart-health",
      year: 2024,
      date: "2024-05",
      onlineDate: "2024-03-05",
      title:
        "An improved machine learning-based prediction framework for early detection of events in heart failure patients using mHealth",
      headline: "Finding useful signals for heart care",
      topic: "Health",
      color: "amber",
      authors: [
        "Deepak Kumar",
        "Keerthiveena Balraj",
        "Sandeep Seth",
        "Shivani Vashista",
        "Manojkumar Ramteke",
        "Anurag S. Rathore",
      ],
      authorNote: "Deepak Kumar and Keerthiveena Balraj contributed equally.",
      journal: "Health and Technology",
      citation: "14 (3), 495–512",
      type: "Journal article",
      doi: "10.1007/s12553-024-00832-z",
      publisherUrl:
        "https://link.springer.com/article/10.1007/s12553-024-00832-z",
      takeaway:
        "Comparing learning models helped identify useful features for heart-failure event prediction.",
      question:
        "Which patient measurements can help a model forecast events in people already living with heart failure?",
      approach:
        "The study compared ten classifiers, ranked input features, and developed a web-based mHealth application using AIIMS Delhi study data.",
      finding:
        "Feature selection highlighted five inputs. Gaussian Naive Bayes led average performance, while K-nearest neighbors led the reported precision, recall, and F1 comparison.",
      why: "Studies like this explore how a smaller set of inputs may support decision tools.",
      limitation:
        "Research illustration only, not a diagnostic tool. The study dataset is not publicly available.",
      visualDescription:
        "Patient measurements feed a comparison of models and then a research-only mobile-health interface; no patient risk score is calculated.",
      sourceNote:
        "Publisher abstract, data availability, full author order, and equal-contribution note.",
      status: "Published",
      doiUrl: "https://doi.org/10.1007/s12553-024-00832-z",
      verifiedDate: "2026-09-07",
    },
    {
      id: "forward-faults",
      year: 2023,
      date: "2023-10",
      title:
        "Variance-capturing forward-forward autoencoder (VFFAE): A forward learning neural network for fault detection and isolation of process data",
      headline: "Spotting faults as new data arrives",
      topic: "Process systems",
      color: "amber",
      authors: [
        "Deepak Kumar",
        "Umang Goswami",
        "Hariprasad Kodamana",
        "Manojkumar Ramteke",
        "Prakash Kumar Tamboli",
      ],
      journal: "Process Safety and Environmental Protection",
      citation: "178, 176–194",
      type: "Journal article",
      doi: "10.1016/j.psep.2023.07.083",
      publisherUrl:
        "https://www.sciencedirect.com/science/article/abs/pii/S0957582023006857",
      takeaway:
        "A forward-learning network updates fault detection as process measurements stream in.",
      question:
        "How can fault-detection models learn from fast-arriving data without costly retraining?",
      approach:
        "The VFFAE autoencoder learns with forward-forward updates and adapts an existing model to incoming measurements.",
      finding:
        "Tests on Tennessee Eastman, nuclear power flux, and wastewater datasets showed faster model updating while maintaining detection accuracy in the reported comparisons.",
      why: "Efficient updates could help monitoring systems keep up with changing process data.",
      limitation:
        "Dataset results do not establish deployment performance or guarantee plant safety.",
      visualDescription:
        "Streaming sensor traces enter a narrowing autoencoder and branch into normal and fault pathways.",
      sourceNote:
        "Publisher abstract and author list; Crossref confirms author order and issue date.",
      status: "Published",
      doiUrl: "https://doi.org/10.1016/j.psep.2023.07.083",
      verifiedDate: "2026-09-07",
    },
    {
      id: "antibody-production",
      year: 2022,
      date: "2022-10",
      title:
        "Multi-objective optimization of monoclonal antibody production in bioreactor",
      headline: "Balancing antibody output and resources",
      topic: "Process systems",
      color: "lime",
      authors: [
        "Deepak Kumar",
        "Neelesh Gangwar",
        "Anurag S Rathore",
        "Manojkumar Ramteke",
      ],
      journal: "Chemical Engineering and Processing – Process Intensification",
      citation: "180, 108720",
      type: "Journal article",
      doi: "10.1016/j.cep.2021.108720",
      publisherUrl:
        "https://www.sciencedirect.com/science/article/abs/pii/S0255270121004049",
      takeaway:
        "A bioreactor model explores trade-offs between antibody output, time, and nutrient use.",
      question:
        "How can a bioreactor produce more antibodies while balancing operating time and resource use?",
      approach:
        "An experimentally calibrated model links temperature and feed conditions to cell growth and antibody production. Multi-objective optimization compares operating strategies.",
      finding:
        "The model identified improved combined-mode operating conditions and compared continuous-production strategies across competing objectives.",
      why: "Trade-off analysis helps select operating strategies that fit different production priorities.",
      limitation:
        "Production improvements are model estimates, not newly demonstrated manufacturing outcomes.",
      visualDescription:
        "A fed bioreactor connects to a choice of operating strategies, balancing product output against time and resources.",
      sourceNote:
        "Publisher abstract and highlights; publisher-deposited Crossref author order. Use 2022 journal issue year, matching Scholar, despite 2021 in DOI.",
      status: "Published",
      doiUrl: "https://doi.org/10.1016/j.cep.2021.108720",
      verifiedDate: "2026-09-07",
    },
  ],
};
