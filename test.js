const fs = require('fs');
const path = require('path');
const assert = require('assert');

const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const html = read('index.html');
const js = read('app.js');
const css = read('styles.css');

assert(html.includes('id="map"'), 'Map container should be present');
assert(html.includes('id="search-form"'), 'Search form should be present');
assert(html.includes('id="results-body"'), 'Results table body should be present');

assert(js.includes('MAX_RESULTS'), 'Search cap constant should be defined');
assert(js.includes('buildSearchUrl'), 'Search URL builder should exist');
assert(js.includes('setDefaultDates'), 'Default date helper should be present');

assert(css.includes('#map'), 'Map styling should exist');
assert(css.includes('.card'), 'Card styling should exist');

console.log('Basic structure checks passed.');
