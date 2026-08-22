import { test } from 'node:test';
import assert from 'node:assert/strict';
import MiniSearch from 'minisearch';

/**
 * The build (scripts/build-index.js) and the client (assets/js/search.js) agree
 * on one serialized shape: `{ index }`, with title/url/preview carried per
 * document in the index's own storedFields. These tests pin that contract —
 * the client reads result.url directly, so a build that stopped storing it
 * would silently produce results that navigate nowhere.
 */

const DOCS = [
  {
    id: 1,
    title: '1.1 Review of Functions',
    content: 'A function relates each element of a set with exactly one element of another set.',
    url: '/calculus-bundle/calculus-volume-1/1-1-review-of-functions/',
    preview: 'A function relates each element…',
  },
  {
    id: 2,
    title: 'Preface',
    content: 'Welcome to Calculus Volume 1, an OpenStax resource.',
    url: '/calculus-bundle/calculus-volume-1/preface/',
    preview: 'Welcome to Calculus Volume 1…',
  },
];

/** Serialize exactly the way scripts/build-index.js does. */
function buildIndex() {
  const miniSearch = new MiniSearch({
    fields: ['title', 'content'],
    storeFields: ['title', 'url', 'preview'],
    searchOptions: { boost: { title: 2 }, fuzzy: 0.2, prefix: true },
  });
  miniSearch.addAll(DOCS);
  return JSON.parse(JSON.stringify({ index: miniSearch.toJSON() }));
}

/** Deserialize exactly the way assets/js/search.js does. */
function loadIndex(data) {
  return MiniSearch.loadJS(data.index, {
    fields: ['title', 'content'],
    storeFields: ['title', 'url', 'preview'],
  });
}

test('the serialized payload carries no separate documents table', () => {
  const data = buildIndex();
  assert.deepEqual(Object.keys(data), ['index']);
});

test('every document is recoverable from storedFields alone', () => {
  const stored = Object.values(buildIndex().index.storedFields);
  assert.equal(stored.length, DOCS.length);
  for (const doc of stored) {
    assert.ok(doc.url, 'stored document is missing url');
    assert.ok(doc.title, 'stored document is missing title');
    assert.ok(doc.preview, 'stored document is missing preview');
  }
});

test('results round-trip through loadJS with title/url/preview attached', () => {
  const miniSearch = loadIndex(buildIndex());
  const results = miniSearch.search('functions', { boost: { title: 2 }, fuzzy: 0.2, prefix: true });

  assert.ok(results.length > 0, 'expected at least one hit');
  const [top] = results;
  assert.equal(top.title, '1.1 Review of Functions');
  assert.equal(top.url, '/calculus-bundle/calculus-volume-1/1-1-review-of-functions/');
  assert.match(top.preview, /A function relates each element/);
});

test('index URLs use the directory form the ToC links to', () => {
  for (const doc of Object.values(buildIndex().index.storedFields)) {
    assert.doesNotMatch(doc.url, /index\.html$/);
    assert.match(doc.url, /\/$/);
  }
});
