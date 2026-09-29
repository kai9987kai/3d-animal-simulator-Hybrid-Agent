(function (root) {
  'use strict';
  function seedHash(value) {
    let h = 2166136261;
    for (const c of String(value)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return h >>> 0;
  }
  function createRng(seed) {
    let state = seedHash(seed);
    return {
      next() {
        state = (state + 0x6D2B79F5) >>> 0;
        let t = Math.imul(state ^ state >>> 15, state | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      },
      getState: () => state,
      setState(value) {
        if (!Number.isInteger(value) || value < 0 || value > 4294967295) throw new Error('Invalid random state');
        state = value;
      }
    };
  }
  const traits = ['size','speed','sense','immunity','thermal','efficiency','plasticity','defense','boldness','memory'];
  function crossGenes(a, b, mutation, random) {
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const out = {};
    for (const key of traits) {
      const v = b ? (a[key] + b[key]) / 2 : a[key];
      const noise = (random() * 2 - 1) * mutation;
      out[key] = key === 'defense' ? clamp(v + noise, 0, 1.2) : key === 'boldness' ? clamp(v + noise, 0, 1) : clamp(v * (1 + noise), .35, 2.1);
    }
    out.policy = a.policy.map((v, i) => clamp((b ? (v + b.policy[i]) / 2 : v) + (random() * 2 - 1) * mutation * 2, .2, 2.4));
    return out;
  }
  function summarize(values) {
    if (!values.length) return { n: 0, mean: 0, sd: 0, se: 0, min: 0, max: 0 };
    const mean = values.reduce((a,b) => a+b, 0) / values.length;
    const sd = values.length > 1 ? Math.sqrt(values.reduce((s,v) => s + (v-mean)**2, 0) / (values.length-1)) : 0;
    return { n: values.length, mean, sd, se: sd / Math.sqrt(values.length), min: Math.min(...values), max: Math.max(...values) };
  }
  class PointIndex {
    constructor(cell = 8) { this.cell = cell; this.map = new Map(); this.locations = new Map(); }
    clear() { this.map.clear(); this.locations.clear(); }
    insert(value, x, z) {
      const key = Math.floor(x/this.cell)+','+Math.floor(z/this.cell);
      const previous = this.locations.get(value);
      if (previous !== undefined) {
        const bucket = this.map.get(previous).filter(p => p.value !== value);
        if (bucket.length) this.map.set(previous,bucket); else this.map.delete(previous);
      }
      if (!this.map.has(key)) this.map.set(key, []);
      this.map.get(key).push({value,x,z});
      this.locations.set(value,key);
    }
    query(x,z,r) {
      const out = [], cx = Math.floor(x/this.cell), cz = Math.floor(z/this.cell), span = Math.ceil(r/this.cell);
      for (let a=-span;a<=span;a++) for (let b=-span;b<=span;b++) {
        for (const p of this.map.get((cx+a)+','+(cz+b)) || []) if ((x-p.x)**2+(z-p.z)**2 <= r*r) out.push(p.value);
      }
      return out.sort((a,b) => a-b);
    }
  }
  const api = {seedHash, createRng, crossGenes, summarize, PointIndex, traits};
  root.EvoLab = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
