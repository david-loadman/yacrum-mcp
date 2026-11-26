import { describe, expect, it } from 'vitest';
import { retiredNotice } from '../src/retired.js';

describe('retiredNotice (#535)', () => {
  it('names the hosted connector at the configured address, without a doubled slash', () => {
    const text = retiredNotice('https://crm.example.com/');
    expect(text).toContain('retired');
    expect(text).toContain('https://crm.example.com/api/mcp');
    expect(text).toContain('claude mcp add --transport http yacrum https://crm.example.com/api/mcp');
    expect(text).not.toContain('//api/mcp');
  });

  it('never mentions a key value', () => {
    expect(retiredNotice('https://x.example')).not.toMatch(/yk_/);
  });
});
