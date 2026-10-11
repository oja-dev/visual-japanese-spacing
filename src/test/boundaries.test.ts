import * as assert from 'assert/strict';
import { describe, it } from 'mocha';
import { findSpacingRanges } from '../boundaries';
const ends = (text: string, numbers = true) => findSpacingRanges(text, numbers).map((x) => x.end);

describe('spacing boundaries', () => {
  it('both directions and adjacent boundaries', () => {
    assert.deepEqual(ends('日本語ABC123文字'), [3, 9]);
    assert.deepEqual(ends('A日B'), [1, 2]);
    assert.deepEqual(ends('日本語VSCodeで文章を書く'), [3, 9]);
  });
  it('numbers can be disabled without excluding letters', () => {
    assert.deepEqual(ends('第1章とA版2'), [1, 2, 4, 5, 6]);
    assert.deepEqual(ends('第1章とA版2', false), [4, 5]);
  });
  it('existing whitespace and punctuation remain untouched', () => {
    for (const value of [
      '',
      'hello-world 123',
      '日本語だけ',
      '日本 A',
      'A 日本',
      '日\tA',
      '日\nA',
      '日\u00a0A',
      '日本、A',
      'A。日本',
      '日Ａ',
      '日１',
      '日é',
    ]) {
      assert.deepEqual(ends(value), [], value);
    }
    assert.deepEqual(ends('日本foo-bar日本'), [2, 9]);
  });
  it('surrogate pairs use UTF-16 coordinates and nonempty ranges', () => {
    assert.deepEqual(findSpacingRanges('𠮷A𠮷B'), [
      { start: 0, end: 2 },
      { start: 2, end: 3 },
      { start: 3, end: 5 },
    ]);
    assert.deepEqual(findSpacingRanges('😀𠮷A'), [{ start: 2, end: 4 }]);
  });
  it('iteration, prolongation and voicing marks', () => {
    for (const value of ['カーA', 'ｶﾞA', 'か\u3099A', '日々A', 'くゝA', 'クヽA', '〆A', '〇A']) {
      assert.deepEqual(ends(value), [value.length - 1], value);
    }
  });
  it('combining marks and variation selectors stay with their base', () => {
    assert.deepEqual(findSpacingRanges('葛\uFE00A'), [{ start: 0, end: 2 }]);
    assert.deepEqual(findSpacingRanges('𠮷\u{E0100}A'), [{ start: 0, end: 4 }]);
    assert.deepEqual(ends('A\u3099'), []);
    assert.deepEqual(findSpacingRanges('か\u3099A'), [{ start: 0, end: 2 }]);
  });
});
