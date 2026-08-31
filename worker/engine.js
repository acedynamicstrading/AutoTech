/**
 * Build Dependency & Fitment Engine (Worker/ESM version)
 * Logic is byte-for-byte identical to the Node version — only the module
 * syntax changed (export const/function instead of module.exports) since
 * Cloudflare Workers require ES modules.
 */

const CONFIDENCE_WEIGHT = { high: 3, med: 2, low: 1 };

export function validateCatalog(catalog) {
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
      const other = catalog.find(p => p.id === conId);
      if (other && !other.conflicts.includes(part.id)) {
        errors.push(`Asymmetric conflict: ${part.id} -> ${conId} not mirrored on ${conId}`);
      }
    }
  }

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

export function getDependencyClosure(partId, catalog) {
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

export function analyzeBuild(buildIds, catalog) {
  const build = new Set(buildIds);
  const missing = [];
  const conflicts = [];
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

export function autoCompleteBuild(buildIds, catalog) {
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

export function estimateBuild(buildIds, catalog, basePowerWhp = 0) {
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

export function evaluateBuild(buildIds, catalog, basePowerWhp = 0) {
  const analysis = analyzeBuild(buildIds, catalog);
  const estimate = estimateBuild(buildIds, catalog, basePowerWhp);
  return { ...analysis, estimate };
}
