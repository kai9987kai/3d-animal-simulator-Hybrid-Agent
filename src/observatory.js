(function (root) {
  'use strict';
  const TYPES = ['prey', 'pred'];
  const CAUSES = ['predation', 'starvation', 'disease', 'age', 'injury'];
  const pair = () => ({prey: 0, pred: 0});
  const count = value => Number.isFinite(value) ? value : 0;

  function createCensus() {
    return {births: pair(), introductions: pair(), deaths: pair(),
      causes: Object.fromEntries(CAUSES.map(cause => [cause, 0])),
      kills: 0, failedHunts: 0, grazes: 0, regrown: 0};
  }

  // Each call records one completed event. Attempts and kills never imply deaths:
  // the simulation records a death when it removes the animal from the population.
  function record(census, event) {
    const grouped = {birth: 'births', introduction: 'introductions', death: 'deaths'};
    const single = {kill: 'kills', failedHunt: 'failedHunts', graze: 'grazes', regrow: 'regrown'};
    if (!event || !Object.hasOwn(grouped, event.kind) && !Object.hasOwn(single, event.kind)) {
      throw new Error('Unknown census event');
    }
    if (Object.hasOwn(grouped, event.kind)) {
      if (!TYPES.includes(event.type)) throw new Error('Unknown animal type');
      if (event.kind === 'death' && !CAUSES.includes(event.cause)) throw new Error('Unknown death cause');
      census[grouped[event.kind]][event.type]++;
      if (event.kind === 'death') census.causes[event.cause]++;
    } else census[single[event.kind]]++;
    return census;
  }

  function summarize(agents, census) {
    const totals = census || createCensus();
    const result = {population: pair(), energy: pair(), resting: pair(), handling: pair(),
      lineages: pair(), generation: pair(), balance: pair(), births: {...totals.births},
      introductions: {...totals.introductions}, deaths: {...totals.deaths}, causes: {...totals.causes},
      kills: totals.kills, failedHunts: totals.failedHunts, grazes: totals.grazes, regrown: totals.regrown};
    const founders = {prey: new Set(), pred: new Set()};
    for (const agent of agents) {
      if (agent.dead || !TYPES.includes(agent.type)) continue;
      const type = agent.type;
      result.population[type]++;
      result.energy[type] += count(agent.energy);
      result.generation[type] = Math.max(result.generation[type], count(agent.generation));
      if (agent.state === 'REST') result.resting[type]++;
      if (agent.state === 'HANDLE' || agent.handlingTimer > 0) result.handling[type]++;
      const founder = agent.founderId ?? agent.id;
      if (Number.isInteger(founder)) founders[type].add(founder);
    }
    for (const type of TYPES) {
      result.energy[type] /= result.population[type] || 1;
      result.lineages[type] = founders[type].size;
      result.balance[type] = totals.introductions[type] + totals.births[type] - totals.deaths[type] - result.population[type];
    }
    for (const key of ['population', 'resting', 'handling', 'lineages']) {
      result[key].total = result[key].prey + result[key].pred;
    }
    result.generation.max = Math.max(result.generation.prey, result.generation.pred);
    const attempts = totals.kills + totals.failedHunts;
    result.huntSuccess = attempts ? totals.kills / attempts : 0;
    return result;
  }

  function niceMaximum(value) {
    if (!(value > 0)) return 1;
    const power = 10 ** Math.floor(Math.log10(value));
    return [1, 2, 2.5, 5, 10].find(step => step * power >= value) * power;
  }

  function historyView(history, metric = 'population') {
    const modes = {
      population: {unit: 'animals', series: [['Prey', 'prey', '#b1df87', 1], ['Predators', 'pred', '#f29d89', 1]]},
      resources: {unit: 'plants', series: [['Vegetation', 'food', '#e9c379', 20]]},
      energy: {unit: 'energy units', series: [['Prey mean', 'preyEnergy', '#b1df87', 1], ['Predator mean', 'predEnergy', '#f29d89', 1]]}
    };
    const mode = modes[metric] || modes.population;
    const series = mode.series.map(([label, key, color, factor]) => ({label, color,
      values: history.map(point => Number.isFinite(point[key]) ? Math.max(0, point[key] * factor) : null)}));
    let maximum = 0;
    for (const line of series) for (const value of line.values) if (value !== null) maximum = Math.max(maximum, value);
    return {unit: mode.unit, series, maximum: niceMaximum(maximum),
      startDay: count(history[0]?.day), endDay: count(history.at(-1)?.day), samples: history.length};
  }

  const api = {createCensus, record, summarize, historyView};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.EvoObservatory = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

// Browser functions are deliberately inert until boot.js invokes them. The pure
// census helpers above can also be required by Node without DOM or WebGL globals.
function setupObservatoryUI() {
  const button = document.getElementById('btnObservatory');
  const panel = document.getElementById('observatoryPanel');
  button.onclick = () => {
    const open = panel.style.display !== 'block';
    panel.style.display = open ? 'block' : 'none';
    button.setAttribute('aria-expanded', String(open));
    button.classList.toggle('active', open);
    if (open) {
      updateObservatory();
      document.getElementById('controlsToggle').checked = false;
    }
  };
  // Also tracks the common analysis-panel close button added during boot.
  const observer = new MutationObserver(() => {
    const open = panel.style.display === 'block';
    button.setAttribute('aria-expanded', String(open));
    button.classList.toggle('active', open);
  });
  observer.observe(panel, {attributes: true, attributeFilter: ['style']});
  document.getElementById('historyMetric').onchange = drawPopulationHistory;
}

function updateObservatory() {
  const panel = document.getElementById('observatoryPanel');
  if (!panel || panel.style.display !== 'block') return;
  const summary = EvoObservatory.summarize(agents, census);
  const text = (id, value) => {document.getElementById(id).textContent = value;};
  const paired = value => value.prey.toLocaleString() + ' / ' + value.pred.toLocaleString();
  text('obsBirths', paired(summary.births));
  text('obsIntroductions', paired(summary.introductions));
  text('obsDeaths', paired(summary.deaths));
  text('obsLineages', paired(summary.lineages));
  text('obsGeneration', paired(summary.generation));
  text('obsEnergy', summary.energy.prey.toFixed(1) + ' / ' + summary.energy.pred.toFixed(1));
  text('obsResting', paired(summary.resting));
  text('obsHandling', paired(summary.handling));
  text('obsKills', summary.kills.toLocaleString());
  text('obsFailedHunts', summary.failedHunts.toLocaleString());
  text('obsSuccess', summary.kills + summary.failedHunts ? (summary.huntSuccess * 100).toFixed(1) + '%' : 'No attempts');
  text('obsGrazing', summary.grazes.toLocaleString() + ' / ' + summary.regrown.toLocaleString());
  const balanced = summary.balance.prey === 0 && summary.balance.pred === 0;
  text('obsBalance', balanced ? 'Population accounted for' : 'Census mismatch: ' + paired(summary.balance));
  document.getElementById('obsBalance').classList.toggle('c-pred', !balanced);
  for (const cause of ['predation', 'starvation', 'disease', 'age', 'injury']) {
    text('obsCause-' + cause, summary.causes[cause].toLocaleString());
  }
  const ledger = document.getElementById('censusLedger');
  const signature = censusEvents.map(event => [event.tick, event.kind, event.id, event.type, event.cause].join(':')).join('|');
  if (ledger.dataset.signature !== signature) {
    ledger.dataset.signature = signature;
    ledger.replaceChildren();
    for (const event of censusEvents) {
      const row = document.createElement('li');
      const stamp = document.createElement('span');
      stamp.className = 'ledgerTick';
      stamp.textContent = 'T' + event.tick.toLocaleString();
      const description = document.createElement('span');
      const animal = (event.type === 'pred' ? 'Predator' : 'Prey') + ' #' + event.id;
      description.textContent = animal + (event.kind === 'birth' ? ' born · founder #' + event.founderId : event.kind === 'introduction' ? ' introduced' : ' died · ' + event.cause);
      row.append(stamp, description);
      ledger.append(row);
    }
  }
  document.getElementById('censusEmpty').hidden = censusEvents.length > 0;
}

function drawPopulationHistory() {
  const canvas = document.getElementById('graph');
  if (!canvas) return;
  const metric = document.getElementById('historyMetric').value;
  const view = EvoObservatory.historyView(stats.history, metric);
  const ctx = canvas.getContext('2d');
  const width = canvas.width, height = canvas.height;
  const left = 36, right = width - 8, top = 15, bottom = height - 22;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#07181288';ctx.fillRect(0, 0, width, height);
  ctx.font = '9px ui-monospace, monospace';ctx.textBaseline = 'middle';
  const axisLabel = value => value >= 10000 ? (value / 1000).toFixed(value % 1000 ? 1 : 0) + 'k' : String(Number(value.toFixed(1)));
  for (const fraction of [0, .5, 1]) {
    const y = bottom - fraction * (bottom - top);
    ctx.strokeStyle = '#8aa49230';ctx.lineWidth = 1;ctx.setLineDash([]);
    ctx.beginPath();ctx.moveTo(left, y);ctx.lineTo(right, y);ctx.stroke();
    ctx.fillStyle = '#a5b7aa';ctx.textAlign = 'right';ctx.fillText(axisLabel(view.maximum * fraction), left - 5, y);
  }
  view.series.forEach((line, seriesIndex) => {
    ctx.strokeStyle = line.color;ctx.lineWidth = 1.6;ctx.setLineDash(seriesIndex ? [4, 2] : []);
    ctx.beginPath();let started = false;
    line.values.forEach((value, index) => {
      if (value === null) {started = false;return;}
      const x = left + index / Math.max(1, line.values.length - 1) * (right - left);
      const y = bottom - value / view.maximum * (bottom - top);
      if (started) ctx.lineTo(x, y);else ctx.moveTo(x, y);
      started = true;
      if (line.values.length === 1) {ctx.fillStyle = line.color;ctx.fillRect(x - 1.5, y - 1.5, 3, 3);}
    });
    ctx.stroke();
  });
  ctx.setLineDash([]);ctx.fillStyle = '#a5b7aa';ctx.textAlign = 'left';
  ctx.fillText('Day ' + view.startDay.toFixed(2), left, height - 9);
  if (view.samples > 1) {ctx.textAlign = 'right';ctx.fillText(view.endDay.toFixed(2), right, height - 9);}
  const legend = document.getElementById('historyLegend');
  if (legend.dataset.metric !== metric) {
    legend.dataset.metric = metric;legend.replaceChildren();
    view.series.forEach((line, index) => {
      const item = document.createElement('span');
      item.style.color = line.color;item.textContent = (index ? '┄ ' : '━ ') + line.label;
      legend.append(item);
    });
  }
  const latest = view.series.map(line => line.label + ': ' + (line.values.at(-1) == null ? 'no data' : Number(line.values.at(-1).toFixed(1)))).join(' · ');
  document.getElementById('historySummary').textContent = 'Scale 0–' + axisLabel(view.maximum) + ' ' + view.unit + ' · sampled each second';
  canvas.setAttribute('aria-label', metric + ' history. ' + latest + '. Scale zero to ' + view.maximum + ' ' + view.unit + '. ' + view.samples + ' samples.');
}
