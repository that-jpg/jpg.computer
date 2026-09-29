const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');

test('cat clicker plays only on demand, reuses audio, respects volume and recovers from failure', async () => {
  const html = readFileSync(`${__dirname}/../src/cat/index.html`, 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const elements = Object.fromEntries(['clicker', 'volume', 'volume-value', 'status'].map(id => [id, {
    value: '25',
    addEventListener(event, handler) { this[event] = handler; }
  }]));
  const contexts = [];
  const sounds = [];
  const gains = [];
  const parameter = () => ({
    values: [],
    setValueAtTime(value, time) { this.values.push([value, time]); },
    linearRampToValueAtTime(value, time) { this.values.push([value, time]); },
    exponentialRampToValueAtTime(value, time) { this.values.push([value, time]); }
  });
  class AudioContext {
    state = 'suspended';
    currentTime = 10;
    destination = {};
    constructor() { contexts.push(this); }
    async resume() { this.state = 'running'; }
    createOscillator() {
      const sound = {
        frequency: parameter(),
        connect(target) { this.target = target; },
        disconnect() { this.target = null; },
        start(time) { this.startTime = time; },
        stop(time) { this.stopTime = time; }
      };
      sounds.push(sound);
      return sound;
    }
    createGain() {
      const gain = {
        gain: parameter(),
        connect(target) { this.target = target; },
        disconnect() { this.target = null; }
      };
      gains.push(gain);
      return gain;
    }
  }
  const window = { AudioContext };
  runInNewContext(script, { window, document: { getElementById: id => elements[id] } });
  assert.equal(contexts.length, 0);
  await Promise.all([elements.clicker.click(), elements.clicker.click()]);
  assert.equal(sounds.length, 1);
  assert.equal(contexts.length, 1);
  assert.equal(sounds[0].target.target, contexts[0].destination);
  assert.ok(sounds[0].stopTime > sounds[0].startTime);
  assert.ok(sounds[0].stopTime - sounds[0].startTime < 0.1);
  assert.ok(gains[0].gain.values.some(([value]) => value > 0));
  assert.equal(gains[0].gain.values.at(-1)[0], 0);
  elements.volume.value = '50';
  elements.volume.input();
  await elements.clicker.click();
  assert.equal(contexts.length, 1);
  assert.equal(sounds.length, 2);
  assert.deepEqual(sounds[1].frequency.values, sounds[0].frequency.values);
  assert.equal(elements['volume-value'].textContent, '50%');
  assert.equal(gains[1].gain.values[1][0], gains[0].gain.values[1][0] * 2);
  sounds[0].onended();
  assert.equal(sounds[0].target, null);
  assert.equal(gains[0].target, null);
  contexts[0].state = 'suspended';
  contexts[0].resume = async () => { throw new Error('Audio blocked'); };
  await elements.clicker.click();
  assert.equal(sounds.length, 2);
  assert.match(elements.status.textContent, /Couldn’t play/);
  contexts[0].state = 'closed';
  await elements.clicker.click();
  assert.equal(contexts.length, 2);
  assert.equal(sounds.length, 3);
  assert.match(elements.status.textContent, /give a treat/);
  delete window.AudioContext;
  await elements.clicker.click();
  assert.match(elements.status.textContent, /Couldn’t play/);
});
