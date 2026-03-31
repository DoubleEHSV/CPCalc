const API_BASE = "https://pogoapi.net/api/v1";
const DEFAULT_FORM = "Normal";
const LEVELS = Array.from({ length: 99 }, (_, index) => 1 + index * 0.5);

const elements = {
  entryPanel: document.querySelector("#entry-panel"),
  calculatorPanel: document.querySelector("#calculator-panel"),
  hero: document.querySelector("#hero"),
  form: document.querySelector("#predictor-form"),
  predictButton: document.querySelector("#predict-button"),
  modeButtons: document.querySelectorAll("[data-mode]"),
  tabButtons: document.querySelectorAll("[data-tab]"),
  backButton: document.querySelector("#back-button"),
  formTitle: document.querySelector("#form-title"),
  calculatorHint: document.querySelector("#calculator-hint"),
  speciesSearch: document.querySelector("#species-search"),
  speciesList: document.querySelector("#species-list"),
  currentCp: document.querySelector("#current-cp"),
  ivToggleWrapper: document.querySelector("#iv-toggle-wrapper"),
  useIvs: document.querySelector("#use-ivs"),
  ivGrid: document.querySelector("#iv-grid"),
  trainerLevelWrapper: document.querySelector("#trainer-level-wrapper"),
  trainerLevel: document.querySelector("#trainer-level"),
  attackIv: document.querySelector("#attack-iv"),
  defenseIv: document.querySelector("#defense-iv"),
  staminaIv: document.querySelector("#stamina-iv"),
  fillDemo: document.querySelector("#fill-demo"),
  dataStatus: document.querySelector("#data-status"),
  resultsTitle: document.querySelector("#results-title"),
  levelBadge: document.querySelector("#level-badge"),
  messages: document.querySelector("#messages"),
  evolutionCard: document.querySelector("#evolution-card"),
  evolutionResults: document.querySelector("#evolution-results"),
  levelCard: document.querySelector("#level-card"),
  levelResults: document.querySelector("#level-results"),
  purifyCard: document.querySelector("#purify-card"),
  purifyResults: document.querySelector("#purify-results"),
  root: document.documentElement,
};

const state = {
  statsByKey: new Map(),
  speciesOptions: [],
  evolutionMap: new Map(),
  multipliers: new Map(),
  dataLoaded: false,
  mode: null,
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}

async function bootstrap() {
  if (!elements.form || !elements.predictButton) {
    return;
  }

  attachEvents();

  try {
    const [stats, evolutions, multipliers] = await loadData();

    hydrateStats(stats);
    hydrateEvolutions(evolutions);
    hydrateMultipliers(multipliers);
    populateSpeciesList();
    state.dataLoaded = true;

    if (elements.dataStatus) {
      elements.dataStatus.textContent = `${state.speciesOptions.length} species ready`;
    }
    setMessage("Live Pokemon GO data loaded. You can start predicting now.");
  } catch (error) {
    console.error(error);
    state.dataLoaded = false;
    if (elements.dataStatus) {
      elements.dataStatus.textContent = "Data failed to load";
    }
    setMessage(
      "The app could not load Pokemon GO data from PoGoAPI. Check your connection and refresh."
    );
  }
}

async function loadData() {
  const localStats = window.POKEMON_STATS;
  const localEvolutions = window.POKEMON_EVOLUTIONS;
  const localMultipliers = window.CP_MULTIPLIERS;

  if (Array.isArray(localStats) && Array.isArray(localEvolutions) && Array.isArray(localMultipliers)) {
    return [localStats, localEvolutions, localMultipliers];
  }

  return Promise.all([
    fetchJson(`${API_BASE}/pokemon_stats.json`),
    fetchJson(`${API_BASE}/pokemon_evolutions.json`),
    fetchJson(`${API_BASE}/cp_multiplier.json`),
  ]);
}

function attachEvents() {
  for (const button of elements.modeButtons) {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  }

  for (const button of elements.tabButtons) {
    button.addEventListener("click", () => {
      const tab = button.dataset.tab;
      if (tab === "main") {
        returnToEntry();
        return;
      }

      setMode(tab);
    });
  }

  elements.backButton.addEventListener("click", returnToEntry);
  elements.form.addEventListener("submit", handleSubmit);
  elements.predictButton.addEventListener("click", handleSubmit);
  elements.useIvs.addEventListener("change", syncLevelModeInputs);
  elements.form.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      handleSubmit(event);
    }
  });
  elements.fillDemo.addEventListener("click", () => {
    if (state.mode === "purification") {
      elements.speciesSearch.value = "Machop";
      elements.currentCp.value = "744";
      elements.trainerLevel.value = "34";
      elements.attackIv.value = "13";
      elements.defenseIv.value = "12";
      elements.staminaIv.value = "15";
      setMessage("Loaded a Shadow Machop example for the purification calculator.");
      return;
    }

    if (state.mode === "level") {
      elements.speciesSearch.value = "Dratini";
      elements.currentCp.value = "512";
      elements.trainerLevel.value = "";
      elements.useIvs.checked = false;
      syncLevelModeInputs();
      elements.attackIv.value = "12";
      elements.defenseIv.value = "14";
      elements.staminaIv.value = "13";
      setMessage("Loaded a Dratini example for the level checker.");
      return;
    }

    elements.speciesSearch.value = "Dratini";
    elements.currentCp.value = "512";
    elements.trainerLevel.value = "";
    elements.attackIv.value = "12";
    elements.defenseIv.value = "14";
    elements.staminaIv.value = "13";
    setMessage("Loaded a Dratini example for the evolution calculator.");
  });
}

function setMode(mode) {
  state.mode = mode;
  elements.hero.classList.add("hidden");
  elements.entryPanel.classList.add("hidden");
  elements.calculatorPanel.classList.remove("hidden");
  syncTabs();

  const isEvolution = mode === "evolution";
  const isPurification = mode === "purification";
  const isLevel = mode === "level";
  elements.formTitle.textContent = isEvolution
    ? "Evolution CP Predictor"
    : isPurification
      ? "Purified CP Predictor"
      : "Pokemon Level Checker";
  elements.predictButton.textContent = isEvolution
    ? "Predict Evolution CP"
    : isPurification
      ? "Predict Purified CP"
      : "Estimate Level";
  elements.trainerLevelWrapper.classList.toggle("hidden", !isPurification);
  elements.ivToggleWrapper.classList.toggle("hidden", !isLevel);
  elements.levelCard.classList.toggle("hidden", !isLevel);
  elements.evolutionCard.classList.toggle("hidden", !isEvolution);
  elements.purifyCard.classList.toggle("hidden", !isPurification);
  elements.calculatorHint.textContent = isEvolution
    ? "Tip: if multiple half-levels can produce the same CP, the app shows the closest match and tells you when the result is ambiguous."
    : isPurification
      ? "Tip: purification adds 2 to each IV up to 15 and raises the Pokemon to at least level 25."
      : "Tip: exact level estimates need IVs. Without IVs, the tool shows the possible level range for that CP.";
  syncLevelModeInputs();

  renderEmptyStates();
  setMessage(
    isEvolution
      ? "Enter a Pokemon to estimate its immediate evolution CP."
      : isPurification
        ? "Enter a Shadow Pokemon to estimate its purified CP."
        : "Enter a Pokemon and CP to estimate its level."
  );
}

function returnToEntry() {
  state.mode = null;
  elements.hero.classList.remove("hidden");
  elements.entryPanel.classList.remove("hidden");
  elements.calculatorPanel.classList.add("hidden");
  elements.form.reset();
  elements.useIvs.checked = true;
  syncTabs();
  renderEmptyStates();
  setMessage("Choose evolution or purification to start a new prediction.");
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}`);
  }

  return response.json();
}

function hydrateStats(entries) {
  for (const entry of entries) {
    const key = makeSpeciesKey(entry.pokemon_name, entry.form);
    state.statsByKey.set(key, {
      id: entry.pokemon_id,
      name: entry.pokemon_name,
      form: entry.form || DEFAULT_FORM,
      stats: {
        base_attack: Number(entry.base_attack),
        base_defense: Number(entry.base_defense),
        base_stamina: Number(entry.base_stamina),
      },
    });
  }

  state.speciesOptions = [...state.statsByKey.values()]
    .filter((entry) => entry.form === DEFAULT_FORM)
    .sort((left, right) => left.name.localeCompare(right.name));
}

function hydrateEvolutions(entries) {
  for (const entry of entries) {
    const key = makeSpeciesKey(entry.pokemon_name, entry.form);
    state.evolutionMap.set(key, entry.evolutions || []);
  }
}

function hydrateMultipliers(entries) {
  for (const entry of entries) {
    state.multipliers.set(Number(entry.level), Number(entry.multiplier));
  }
}

function populateSpeciesList() {
  elements.speciesList.innerHTML = state.speciesOptions
    .map((entry) => `<option value="${escapeHtml(entry.name)}"></option>`)
    .join("");
}

function handleSubmit(event) {
  if (event && typeof event.preventDefault === "function") {
    event.preventDefault();
  }

  const formData = new FormData(elements.form);
  const speciesName = String(formData.get("species") || "").trim();
  const currentCp = Number(formData.get("currentCp"));
  const trainerLevelRaw = String(formData.get("trainerLevel") || "").trim();
  const trainerLevel = trainerLevelRaw ? Number(trainerLevelRaw) : 50;
  const attackIvRaw = String(formData.get("attackIv") || "").trim();
  const defenseIvRaw = String(formData.get("defenseIv") || "").trim();
  const staminaIvRaw = String(formData.get("staminaIv") || "").trim();
  const ivs = {
    attack: attackIvRaw === "" ? null : Number(attackIvRaw),
    defense: defenseIvRaw === "" ? null : Number(defenseIvRaw),
    stamina: staminaIvRaw === "" ? null : Number(staminaIvRaw),
  };
  const hasAllIvs = Object.values(ivs).every((value) => value !== null);
  const useIvs = state.mode === "level" ? elements.useIvs.checked && hasAllIvs : true;

  if (!state.mode) {
    elements.resultsTitle.textContent = "Choose a calculator first";
    setMessage("Choose evolution or purification on the entry page first.");
    return;
  }

  if (!state.dataLoaded) {
    elements.resultsTitle.textContent = "Pokemon data unavailable";
    elements.levelBadge.textContent = "Data not loaded";
    setMessage(
      "The Pokemon dataset did not load, so predictions cannot run yet. If you opened the file directly, try refreshing or running the site from a local web server."
    );
    clearResults(
      "Pokemon data is unavailable right now.",
      "Pokemon data is unavailable right now."
    );
    return;
  }

  const species = state.statsByKey.get(makeSpeciesKey(speciesName, DEFAULT_FORM));
  if (!species) {
    elements.resultsTitle.textContent = "Pokemon not found";
    setMessage("That species is not in the loaded Pokemon GO dataset. Pick a name from the list.");
    clearResults(
      "Pick a Pokemon name from the loaded list.",
      "Pick a Pokemon name from the loaded list."
    );
    return;
  }

  if (!Number.isFinite(currentCp) || currentCp < 10) {
    elements.resultsTitle.textContent = "Enter a valid CP";
    setMessage("Enter a valid current CP before predicting.");
    clearResults("Enter a valid CP to calculate evolution.", "Enter a valid CP to calculate purification.");
    return;
  }

  if (!Number.isFinite(trainerLevel) || trainerLevel < 1 || trainerLevel > 50) {
    elements.resultsTitle.textContent = "Enter a valid trainer level";
    setMessage("Trainer level must be between 1 and 50 if you enter it.");
    clearResults("Trainer level is only used for purification.", "Enter a trainer level from 1 to 50.");
    return;
  }

  if (hasAllIvs && Object.values(ivs).some((value) => !Number.isFinite(value) || value < 0 || value > 15)) {
    elements.resultsTitle.textContent = "Enter valid IVs";
    setMessage("Each IV must be a whole number from 0 to 15.");
    clearResults("Enter valid IVs from 0 to 15.", "Enter valid IVs from 0 to 15.");
    return;
  }

  const hasNoIvs = Object.values(ivs).every((value) => value === null);

  if (state.mode === "purification" && !hasAllIvs) {
    elements.resultsTitle.textContent = "Enter all IVs";
    setMessage("Purification predictions need Attack, Defense, and HP IVs.");
    clearResults("Enter all three IVs to calculate evolution.", "Enter all three IVs to calculate purification.");
    return;
  }

  if (state.mode === "evolution" && !hasAllIvs && !hasNoIvs) {
    elements.resultsTitle.textContent = "Enter all IVs or leave them blank";
    setMessage("For evolution predictions, either enter all three IVs or leave all three blank for a range estimate.");
    clearResults("Enter all three IVs or leave them blank.", "Enter all three IVs to calculate purification.");
    return;
  }

  const levelGuess = state.mode === "level" && !useIvs
    ? inferLevelRange(species, currentCp)
    : state.mode === "evolution" && hasNoIvs
      ? inferLevelRange(species, currentCp)
      : inferLevel(species, ivs, currentCp);

  renderResults({
    species,
    currentCp,
    trainerLevel,
    ivs,
    levelGuess,
    useIvs,
    hasNoIvs,
  });
}

function inferLevel(species, ivs, targetCp) {
  const candidates = LEVELS.map((level) => {
    const cp = calculateCp(species.stats, ivs, level);
    return {
      level,
      cp,
      diff: Math.abs(cp - targetCp),
    };
  }).sort((left, right) => {
    if (left.diff !== right.diff) {
      return left.diff - right.diff;
    }

    return left.level - right.level;
  });

  const best = candidates[0];
  const exactMatches = candidates.filter((candidate) => candidate.diff === 0);

  return {
    best,
    candidates: exactMatches.length ? exactMatches : [best],
    ambiguous: exactMatches.length > 1,
    exact: best.diff === 0,
  };
}

function calculateCp(baseStats, ivs, level) {
  const multiplier = state.multipliers.get(level);
  if (
    !multiplier ||
    !baseStats ||
    !Number.isFinite(baseStats.base_attack) ||
    !Number.isFinite(baseStats.base_defense) ||
    !Number.isFinite(baseStats.base_stamina)
  ) {
    return 10;
  }

  const attack = baseStats.base_attack + ivs.attack;
  const defense = baseStats.base_defense + ivs.defense;
  const stamina = baseStats.base_stamina + ivs.stamina;
  const cp = Math.floor((attack * Math.sqrt(defense) * Math.sqrt(stamina) * multiplier * multiplier) / 10);
  return Math.max(10, cp);
}

function renderResults({ species, currentCp, trainerLevel, ivs, levelGuess, useIvs, hasNoIvs }) {
  if (state.mode === "level") {
    renderLevelResult(species, currentCp, levelGuess, useIvs);
    return;
  }

  if (state.mode === "evolution" && hasNoIvs) {
    renderEvolutionRangeResult(species, currentCp, levelGuess);
    return;
  }

  const { best, candidates, ambiguous, exact } = levelGuess;
  elements.resultsTitle.textContent = `${species.name} at CP ${currentCp}`;
  elements.levelBadge.textContent = ambiguous
    ? `Likely level ${formatLevel(best.level)}`
    : `Level ${formatLevel(best.level)}`;

  const levelMessage = ambiguous
    ? `Multiple half-levels match this CP with those IVs (${candidates
        .map((candidate) => formatLevel(candidate.level))
        .join(", ")}). Using the highest match for projections.`
    : !exact
      ? `Closest estimated level: ${formatLevel(best.level)}. This CP/IV spread is off by ${best.diff} CP from the nearest exact match, so treat the projection as an estimate.`
    : `Estimated level: ${formatLevel(best.level)}.`;

  setMessage(levelMessage);

  if (state.mode === "evolution") {
    renderEvolutionCards(species, ivs, best.level);
    return;
  }

  renderPurifyCard(species, ivs, best.level, trainerLevel);
}

function renderEvolutionRangeResult(species, currentCp, levelRange) {
  elements.resultsTitle.textContent = `${species.name} at CP ${currentCp}`;
  elements.levelBadge.textContent = "IV range mode";
  setMessage(
    `IVs were left blank, so evolution CP is shown as a range based on all valid IV and level combinations that can produce ${currentCp} CP for ${species.name}.`
  );
  renderEvolutionRangeCards(species, currentCp);
}

function renderLevelResult(species, currentCp, levelGuess, useIvs) {
  elements.resultsTitle.textContent = `${species.name} at CP ${currentCp}`;

  if (useIvs) {
    const { best, candidates, ambiguous, exact } = levelGuess;
    elements.levelBadge.textContent = ambiguous
      ? `Likely level ${formatLevel(best.level)}`
      : `Level ${formatLevel(best.level)}`;
    setMessage(
      ambiguous
        ? `Multiple half-levels match this CP with those IVs (${candidates
            .map((candidate) => formatLevel(candidate.level))
            .join(", ")}).`
        : exact
          ? `Estimated level: ${formatLevel(best.level)} with the IVs you entered.`
          : `Closest estimated level: ${formatLevel(best.level)}. Exact level may vary if the IVs are off.`
    );
    elements.levelResults.innerHTML = `
      <div class="prediction-list">
        <div class="prediction-item">
          <strong>Estimated Level</strong>
          <span class="cp">Lv ${formatLevel(best.level)}</span>
          <div class="meta">
            This estimate uses the IVs you entered for ${escapeHtml(species.name)}.
          </div>
        </div>
      </div>
    `;
    return;
  }

  elements.levelBadge.textContent = `Range ${formatLevel(levelGuess.minLevel)}-${formatLevel(levelGuess.maxLevel)}`;
  setMessage(
    `IVs are not required, but they do matter. Without IVs, ${species.name} can plausibly be between level ${formatLevel(levelGuess.minLevel)} and ${formatLevel(levelGuess.maxLevel)} at ${currentCp} CP.`
  );
  elements.levelResults.innerHTML = `
    <div class="prediction-list">
      <div class="prediction-item">
        <strong>Possible Level Range</strong>
        <span class="cp">Lv ${formatLevel(levelGuess.minLevel)}-${formatLevel(levelGuess.maxLevel)}</span>
        <div class="meta">
          This range is based on all IV combinations that can produce ${currentCp} CP for ${escapeHtml(species.name)}.
          <br />Turn on IVs above if you want a tighter estimate.
        </div>
      </div>
    </div>
  `;
}

function inferLevelRange(species, targetCp) {
  let minLevel = null;
  let maxLevel = null;

  for (let attack = 0; attack <= 15; attack += 1) {
    for (let defense = 0; defense <= 15; defense += 1) {
      for (let stamina = 0; stamina <= 15; stamina += 1) {
        for (const level of LEVELS) {
          const cp = calculateCp(species.stats, { attack, defense, stamina }, level);
          if (cp !== targetCp) {
            continue;
          }

          if (minLevel === null || level < minLevel) {
            minLevel = level;
          }

          if (maxLevel === null || level > maxLevel) {
            maxLevel = level;
          }
        }
      }
    }
  }

  if (minLevel === null || maxLevel === null) {
    const fallback = inferLevel(species, { attack: 10, defense: 10, stamina: 10 }, targetCp);
    return {
      minLevel: fallback.best.level,
      maxLevel: fallback.best.level,
      exact: false,
    };
  }

  return {
    minLevel,
    maxLevel,
    exact: true,
  };
}

function renderEvolutionCards(species, ivs, currentLevel) {
  const predictions = collectEvolutionPredictions(species, ivs, currentLevel);
  if (!predictions.length) {
    elements.evolutionResults.innerHTML = `<div class="empty-state">${escapeHtml(
      `${species.name} does not have any further evolutions in the loaded dataset.`
    )}</div>`;
    return;
  }

  const cards = predictions
    .map((prediction) => {
      const stageLabel = prediction.stage === 1 ? "Next evolution" : `Stage ${prediction.stage} evolution`;
      const trailLabel = prediction.path.length > 1 ? `Path: ${prediction.path.join(" -> ")}` : "";

      return `
        <div class="prediction-item">
          <strong>${escapeHtml(prediction.name)}</strong>
          <span class="cp">${prediction.cp} CP</span>
          <div class="meta">
            ${escapeHtml(stageLabel)} at the same level and IVs.
            <br />${escapeHtml(prediction.details.join(" • "))}
            ${trailLabel ? `<br />${escapeHtml(trailLabel)}` : ""}
          </div>
        </div>
      `;
    })
    .filter(Boolean)
    .join("");

  elements.evolutionResults.innerHTML = `<div class="prediction-list">${cards}</div>`;
}

function renderEvolutionRangeCards(species, currentCp) {
  const predictions = collectEvolutionRangePredictions(species, currentCp);
  if (!predictions.length) {
    elements.evolutionResults.innerHTML = `<div class="empty-state">${escapeHtml(
      `${species.name} does not have any further evolutions in the loaded dataset.`
    )}</div>`;
    return;
  }

  const cards = predictions
    .map((prediction) => {
      const stageLabel = prediction.stage === 1 ? "Next evolution range" : `Stage ${prediction.stage} range`;
      const trailLabel = prediction.path.length > 1 ? `Path: ${prediction.path.join(" -> ")}` : "";
      return `
        <div class="prediction-item">
          <strong>${escapeHtml(prediction.name)}</strong>
          <span class="cp">${prediction.minCp}-${prediction.maxCp} CP</span>
          <div class="meta">
            ${escapeHtml(stageLabel)} based on all valid IV and level matches for the current CP.
            ${trailLabel ? `<br />${escapeHtml(trailLabel)}` : ""}
          </div>
        </div>
      `;
    })
    .join("");

  elements.evolutionResults.innerHTML = `<div class="prediction-list">${cards}</div>`;
}

function collectEvolutionPredictions(species, ivs, currentLevel, stage = 1, path = [], visited = new Set()) {
  const currentKey = makeSpeciesKey(species.name, species.form);
  const traversalVisited = new Set(visited);
  traversalVisited.add(currentKey);
  const evolutions = state.evolutionMap.get(makeSpeciesKey(species.name, species.form)) || [];
  const predictions = [];

  for (const evolution of evolutions) {
    const evolved = state.statsByKey.get(makeSpeciesKey(evolution.pokemon_name, evolution.form));
    if (!evolved) {
      continue;
    }

    const visitedKey = makeSpeciesKey(evolved.name, evolved.form);
    if (traversalVisited.has(visitedKey)) {
      continue;
    }

    const nextVisited = new Set(traversalVisited);
    nextVisited.add(visitedKey);

    const detailParts = [];
    if (Number.isFinite(evolution.candy_required)) {
      detailParts.push(`${evolution.candy_required} candy`);
    }
    if (evolution.item_required) {
      detailParts.push(`Item: ${evolution.item_required}`);
    }
    if (evolution.lure_required) {
      detailParts.push(`Lure: ${evolution.lure_required}`);
    }
    if (evolution.gender_required) {
      detailParts.push(`${evolution.gender_required} only`);
    }
    if (evolution.must_be_buddy_to_evolve) {
      detailParts.push("Buddy requirement");
    }
    if (evolution.only_evolves_in_daytime) {
      detailParts.push("Daytime only");
    }
    if (evolution.only_evolves_in_nighttime) {
      detailParts.push("Nighttime only");
    }
    if (!detailParts.length) {
      detailParts.push("No special requirement listed");
    }

    const currentPath = [...path, evolved.name];
    predictions.push({
      stage,
      name: evolved.name,
      cp: calculateCp(evolved.stats, ivs, currentLevel),
      details: detailParts,
      path: currentPath,
    });

    predictions.push(
      ...collectEvolutionPredictions(evolved, ivs, currentLevel, stage + 1, currentPath, nextVisited)
    );
  }

  return predictions;
}

function collectEvolutionRangePredictions(species, targetCp, stage = 1, path = [], visited = new Set()) {
  return collectEvolutionRangePredictionsFromStates(
    species,
    enumerateMatchingStates(species, targetCp),
    stage,
    path,
    visited
  );
}

function collectEvolutionRangePredictionsFromStates(species, states, stage = 1, path = [], visited = new Set()) {
  const currentKey = makeSpeciesKey(species.name, species.form);
  const traversalVisited = new Set(visited);
  traversalVisited.add(currentKey);
  const evolutions = state.evolutionMap.get(currentKey) || [];
  const aggregates = new Map();

  for (const state of states) {
    for (const evolution of evolutions) {
      const evolved = state.statsByKey.get(makeSpeciesKey(evolution.pokemon_name, evolution.form));
      if (!evolved) {
        continue;
      }

      const visitedKey = makeSpeciesKey(evolved.name, evolved.form);
      if (traversalVisited.has(visitedKey)) {
        continue;
      }

      const key = `${visitedKey}::${stage}`;
      const evolvedCp = calculateCp(evolved.stats, state.ivs, state.level);
      const currentPath = [...path, evolved.name];
      const existing = aggregates.get(key);

      if (!existing) {
        aggregates.set(key, {
          stage,
          name: evolved.name,
          minCp: evolvedCp,
          maxCp: evolvedCp,
          path: currentPath,
          form: evolved.form,
          states: [{ ivs: state.ivs, level: state.level }],
        });
      } else {
        existing.minCp = Math.min(existing.minCp, evolvedCp);
        existing.maxCp = Math.max(existing.maxCp, evolvedCp);
        existing.states.push({ ivs: state.ivs, level: state.level });
      }
    }
  }

  const predictions = [...aggregates.values()];
  for (const prediction of predictions) {
    const evolved = state.statsByKey.get(makeSpeciesKey(prediction.name, prediction.form));
    if (!evolved) {
      continue;
    }
    const nextVisited = new Set(traversalVisited);
    nextVisited.add(makeSpeciesKey(prediction.name, prediction.form));
    predictions.push(
      ...collectEvolutionRangePredictionsFromStates(
        evolved,
        prediction.states,
        stage + 1,
        prediction.path,
        nextVisited
      )
    );
    delete prediction.states;
  }

  return predictions;
}

function enumerateMatchingStates(species, targetCp) {
  const matches = [];
  for (let attack = 0; attack <= 15; attack += 1) {
    for (let defense = 0; defense <= 15; defense += 1) {
      for (let stamina = 0; stamina <= 15; stamina += 1) {
        const ivs = { attack, defense, stamina };
        for (const level of LEVELS) {
          if (calculateCp(species.stats, ivs, level) === targetCp) {
            matches.push({ ivs, level });
          }
        }
      }
    }
  }
  return matches.length ? matches : [{ ivs: { attack: 10, defense: 10, stamina: 10 }, level: inferLevel(species, { attack: 10, defense: 10, stamina: 10 }, targetCp).best.level }];
}

function renderPurifyCard(species, ivs, currentLevel, trainerLevel) {
  const purifiedLevel = Math.max(currentLevel, Math.min(trainerLevel, 25));
  const purifiedIvs = {
    attack: Math.min(15, ivs.attack + 2),
    defense: Math.min(15, ivs.defense + 2),
    stamina: Math.min(15, ivs.stamina + 2),
  };
  const purifiedCp = calculateCp(species.stats, purifiedIvs, purifiedLevel);
  const evolutionPredictions = collectEvolutionPredictions(species, purifiedIvs, purifiedLevel);

  const evolutionMarkup = evolutionPredictions.length
    ? evolutionPredictions
        .map((prediction) => {
          const stageLabel =
            prediction.stage === 1 ? "After purification: next evolution" : `After purification: stage ${prediction.stage}`;
          const trailLabel = prediction.path.length > 1 ? `Path: ${prediction.path.join(" -> ")}` : "";

          return `
            <div class="prediction-item">
              <strong>${escapeHtml(prediction.name)}</strong>
              <span class="cp">${prediction.cp} CP</span>
              <div class="meta">
                ${escapeHtml(stageLabel)}.
                <br />${escapeHtml(prediction.details.join(" • "))}
                ${trailLabel ? `<br />${escapeHtml(trailLabel)}` : ""}
              </div>
            </div>
          `;
        })
        .join("")
    : `
      <div class="prediction-item">
        <strong>No further purified evolutions</strong>
        <div class="meta">
          ${escapeHtml(species.name)} does not have any further evolutions in the loaded dataset.
        </div>
      </div>
    `;

  elements.purifyResults.innerHTML = `
    <div class="prediction-list">
      <div class="prediction-item">
        <strong>Purified ${escapeHtml(species.name)}</strong>
        <span class="cp">${purifiedCp} CP</span>
        <div class="meta">
          Purification projects to level ${formatLevel(purifiedLevel)} with IVs
          ${purifiedIvs.attack}/${purifiedIvs.defense}/${purifiedIvs.stamina}.<br />
          If the Pokemon is already above level 25, its level stays the same.
        </div>
      </div>
      ${evolutionMarkup}
    </div>
  `;
}

function renderEmptyStates() {
  elements.resultsTitle.textContent = state.mode === "purification"
    ? "Waiting for a Shadow Pokemon..."
    : state.mode === "level"
      ? "Waiting for a Pokemon..."
      : "Waiting for a Pokemon...";
  elements.levelBadge.textContent = "Level unknown";
  clearResults(
    "Enter a Pokemon to see its immediate evolutions.",
    "Shadow Pokemon projections will appear here.",
    "Level estimates will appear here."
  );
}

function clearResults(evolutionMessage, purifyMessage, levelMessage) {
  elements.evolutionResults.innerHTML =
    `<div class="empty-state">${escapeHtml(evolutionMessage)}</div>`;
  elements.purifyResults.innerHTML =
    `<div class="empty-state">${escapeHtml(purifyMessage)}</div>`;
  elements.levelResults.innerHTML =
    `<div class="empty-state">${escapeHtml(levelMessage || "Level estimates will appear here.")}</div>`;
}

function syncLevelModeInputs() {
  const usingLevelMode = state.mode === "level";
  const showIvs = !usingLevelMode || elements.useIvs.checked;
  elements.ivGrid.classList.toggle("hidden", !showIvs);
}

function syncTabs() {
  for (const button of elements.tabButtons) {
    const tab = button.dataset.tab;
    const isActive = state.mode === null ? tab === "main" : tab === state.mode;
    button.classList.toggle("active", isActive);
  }
}

function setMessage(message) {
  elements.messages.textContent = message;
}

function makeSpeciesKey(name, form = DEFAULT_FORM) {
  return `${String(name).trim().toLowerCase()}::${String(form || DEFAULT_FORM).trim().toLowerCase()}`;
}

function formatLevel(level) {
  return Number.isInteger(level) ? String(level) : level.toFixed(1);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
