const fs = require('fs');
const path = require('path');
const engine = require('./engine');

const catalogData = JSON.parse(fs.readFileSync(path.join(__dirname, 'catalog.json'), 'utf8'));
const { parts: catalog, vehicle } = catalogData;

function section(title) {
  console.log('\n=== ' + title + ' ===');
}

// 1. Catalog integrity
section('1. Catalog Validation');
const validation = engine.validateCatalog(catalog);
console.log('Valid:', validation.valid);
validation.errors.forEach(e => console.log('  ERROR:', e));

// 2. Real build from the spec: "Aggressive Weekend Toy" minus supporting mods (the common user mistake)
section('2. Build with missing requirements (turbo kit, nothing else)');
let result = engine.evaluateBuild(['turbo_kit'], catalog, vehicle.basePowerWhp);
console.log('Missing:', result.missing.map(m => `${m.forName} needs ${m.needsName}`));
console.log('Conflicts:', result.conflicts);
console.log('Estimate:', result.estimate);

// 3. Auto-complete that build
section('3. Auto-completed build (transitive requirements added)');
const completed = engine.autoCompleteBuild(['turbo_kit'], catalog);
console.log('Parts:', completed);
result = engine.evaluateBuild(completed, catalog, vehicle.basePowerWhp);
console.log('isValid:', result.isValid);
console.log('Estimate:', result.estimate);

// 4. Conflict case: GT wing + duckbill
section('4. Conflict detection (GT wing + duckbill together)');
result = engine.evaluateBuild(['gt_wing', 'duckbill'], catalog, vehicle.basePowerWhp);
console.log('Conflicts:', result.conflicts);

// 5. Full "Aggressive Weekend Toy" build, fully resolved
section('5. Full sample build from the spec, auto-completed');
const fullBuildWanted = [
  'widebody', 'front_splitter', 'rear_diffuser', 'gt_wing', 'wheels_18', 'wrap',
  'underglow', 'bucket_seats', 'cai', 'catback', 'turbo_kit', 'coilovers', 'sway_bars', 'bbk'
];
const fullBuild = engine.autoCompleteBuild(fullBuildWanted, catalog);
result = engine.evaluateBuild(fullBuild, catalog, vehicle.basePowerWhp);
console.log('Total parts (incl. auto-added requirements):', fullBuild.length);
console.log('Auto-added (not in original wishlist):', fullBuild.filter(id => !fullBuildWanted.includes(id)));
console.log('isValid:', result.isValid);
console.log('Estimate:', result.estimate);

// 6. Adversarial: inject a circular dependency and confirm it's caught
section('6. Circular dependency detection (adversarial injected catalog)');
const brokenCatalog = JSON.parse(JSON.stringify(catalog));
const a = brokenCatalog.find(p => p.id === 'fuel_system');
const b = brokenCatalog.find(p => p.id === 'ecu_tune');
a.requires.push('ecu_tune');
b.requires.push('fuel_system');
const brokenValidation = engine.validateCatalog(brokenCatalog);
console.log('Valid:', brokenValidation.valid);
brokenValidation.errors.forEach(e => console.log('  ERROR:', e));

// 7. Adversarial: asymmetric conflict
section('7. Asymmetric conflict detection (adversarial injected catalog)');
const asymCatalog = JSON.parse(JSON.stringify(catalog));
const c = asymCatalog.find(p => p.id === 'nitrous');
c.conflicts.push('coilovers'); // one-directional, coilovers doesn't declare it back
const asymValidation = engine.validateCatalog(asymCatalog);
console.log('Valid:', asymValidation.valid);
asymValidation.errors.forEach(e => console.log('  ERROR:', e));
