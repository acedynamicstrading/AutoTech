/**
 * Build Dependency & Fitment Engine
 * -----------------------------------
 * Pure functions, no UI/DOM dependency. Operates on a catalog (array of Part
 * objects) and a build (array/Set of selected part ids).
 *
 * Part shape:
 * {
 *   id, cat, sub, name,
 *   cost: [min, max],
 *   powerGain: [min, max],
 *   requires: [id, ...],   // must also be present in the build
 *   conflicts: [id, ...],  // cannot coexist in the build
 *   trackOnly: bool,
 *   confidence: 'high' | 'med' | 'low',
 *   note: string
 * }
 */

const CONFIDENCE_WEIGHT = { high: 3, med: 2, low: 1 };

// ---------- CATALOG VALIDATION ----------

/**
 * Validates catalog integrity before it's ever used against a build:
 * - every requires/conflicts id must exist in the catalog
 * - no part may require or conflict with itself
 * - no circular requires chains (A requires B requires A)
 * Returns { valid: bool, errors: [string] }
 */
function validateCatalog(catalog) {
  const errors = [];
  const idSet = new Set(catalog.map(p => p.id));
  const dupeCheck = new Set();

  for (const part of catalog) {
    if (dupeCheck.has(part.id)) errors.push(`Duplicate part id: ${part.id}`);
    dupeCheck.add(part.id);

    for (const reqId of part.requires) {
      if (reqId === part.id) errors.push(`${part.id} requires itself`);
      if (!idSet.has(reqId)) errors.push(`${part.id} requires unknown part: ${reqId}`);
    }
    for (const conId of part.conflicts) {
      if (conId === part.id) errors.push(`${part.id} conflicts with itself`);
      if (!idSet.has(conId)) errors.push(`${part.id} conflicts with unknown part: ${conId}`);
      // conflict should be symmetric — flag if the other side doesn't declare it back
      const other = catalog.find(p => p.id === conId);
      if (other && !other.conflicts.includes(part.id)) {
        errors.push(`Asymmetric conflict: ${part.id} -> ${conId} not mirrored on ${conId}`);
      }
    }
  }

  // circular requires detection via DFS
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const state = {};
  catalog.forEach(p => (state[p.id] = WHITE));

  function dfs(id, path) {
    state[id] = GRAY;
    const part = catalog.find(p => p.id === id);
    for (const reqId of part.requires) {
      if (state[reqId] === GRAY) {
        errors.push(`Circular dependency: ${[...path, id, reqId].join(' -> ')}`);
      } else if (state[reqId] === WHITE) {
        dfs(reqId, [...path, id]);
      }
    }
    state[id] = BLACK;
  }
  catalog.forEach(p => {
    if (state[p.id] === WHITE) dfs(p.id, []);
  });

  return { valid: errors.length === 0, errors };
}

// ---------- DEPENDENCY RESOLUTION ----------

/** Returns the full transitive set of required part ids for a given part id. */
function getDependencyClosure(partId, catalog) {
  const closure = new Set();
  const visit = (id) => {
    const part = catalog.find(p => p.id === id);
    if (!part) return;
    part.requires.forEach(reqId => {
      if (!closure.has(reqId)) {
        closure.add(reqId);
        visit(reqId);
      }
    });
  };
  visit(partId);
  return closure;
}

/**
 * Analyzes a build (Set or array of part ids) against the catalog.
 * Returns missing requirements, conflicts, and per-part detail.
 */
function analyzeBuild(buildIds, catalog) {
  const build = new Set(buildIds);
  const missing = []; // { forId, forName, needsId, needsName }
  const conflicts = []; // { aId, aName, bId, bName }
  const seenMissing = new Set();
  const seenConflictPairs = new Set();

  build.forEach(id => {
    const part = catalog.find(p => p.id === id);
    if (!part) return;

    part.requires.forEach(reqId => {
      if (!build.has(reqId) && !seenMissing.has(`${part.id}:${reqId}`)) {
        seenMissing.add(`${part.id}:${reqId}`);
        const reqPart = catalog.find(p => p.id === reqId);
        missing.push({ forId: part.id, forName: part.name, needsId: reqId, needsName: reqPart ? reqPart.name : reqId });
      }
    });

    part.conflicts.forEach(conId => {
      if (build.has(conId)) {
        const pairKey = [part.id, conId].sort().join(':');
        if (!seenConflictPairs.has(pairKey)) {
          seenConflictPairs.add(pairKey);
          const conPart = catalog.find(p => p.id === conId);
          conflicts.push({ aId: part.id, aName: part.name, bId: conId, bName: conPart ? conPart.name : conId });
        }
      }
    });
  });

  return { missing, conflicts, isValid: missing.length === 0 && conflicts.length === 0 };
}

/**
 * Returns a new build (array of ids) with all transitive requirements
 * auto-added. Does NOT resolve conflicts — those need a human decision.
 */
function autoCompleteBuild(buildIds, catalog) {
  const build = new Set(buildIds);
  let changed = true;
  while (changed) {
    changed = false;
    build.forEach(id => {
      const part = catalog.find(p => p.id === id);
      if (!part) return;
      part.requires.forEach(reqId => {
        if (!build.has(reqId)) {
          build.add(reqId);
          changed = true;
        }
      });
    });
  }
  return Array.from(build);
}

// ---------- ESTIMATION ----------

/** Aggregates cost, power gain, and confidence across a build. */
function estimateBuild(buildIds, catalog, basePowerWhp = 0) {
  const build = new Set(buildIds);
  let costMin = 0, costMax = 0, powerMin = 0, powerMax = 0;
  let confSum = 0, confCount = 0;
  let trackOnlyCount = 0;

  build.forEach(id => {
    const part = catalog.find(p => p.id === id);
    if (!part) return;
    costMin += part.cost[0];
    costMax += part.cost[1];
    powerMin += part.powerGain[0];
    powerMax += part.powerGain[1];
    confSum += CONFIDENCE_WEIGHT[part.confidence] ?? 1;
    confCount++;
    if (part.trackOnly) trackOnlyCount++;
  });

  const avgConf = confCount ? confSum / confCount : 0;
  const confidenceLabel = confCount === 0 ? 'n/a' : avgConf >= 2.5 ? 'high' : avgConf >= 1.5 ? 'med' : 'low';

  return {
    partCount: build.size,
    cost: { min: costMin, max: costMax },
    powerGain: { min: powerMin, max: powerMax },
    totalPower: { min: basePowerWhp + powerMin, max: basePowerWhp + powerMax },
    confidence: { average: Number(avgConf.toFixed(2)), label: confidenceLabel },
    trackOnlyPartCount: trackOnlyCount,
  };
}

/** Full pipeline: validate build, report issues, and estimate — the single entry point a UI/API layer should call. */
function evaluateBuild(buildIds, catalog, basePowerWhp = 0) {
  const analysis = analyzeBuild(buildIds, catalog);
  const estimate = estimateBuild(buildIds, catalog, basePowerWhp);
  return { ...analysis, estimate };
}

module.exports = {
  validateCatalog,
  getDependencyClosure,
  analyzeBuild,
  autoCompleteBuild,
  estimateBuild,
  evaluateBuild,
};
