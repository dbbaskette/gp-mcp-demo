import { describe, it, expect } from 'vitest';
import { sanitize } from '../rendering/sanitize';

describe('sanitize', () => {
  it('allows <card>, <statgrid>, <stat>, <datatable> with their attributes', () => {
    const html = '<card title="Top"><statgrid><stat label="A" value="1" /></statgrid></card>';
    expect(sanitize(html)).toContain('<card title="Top">');
    expect(sanitize(html)).toContain('<stat');
  });

  it('strips <script> tags', () => {
    expect(sanitize('hello <script>alert(1)</script> world')).not.toContain('<script');
  });

  it('strips on* attributes', () => {
    expect(sanitize('<img src=x onerror="alert(1)" />')).not.toContain('onerror');
  });

  it('strips javascript: URLs', () => {
    expect(sanitize('<a href="javascript:alert(1)">x</a>')).not.toContain('javascript:');
  });
});
