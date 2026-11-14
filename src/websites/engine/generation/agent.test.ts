import { describe, it, expect } from 'vitest';
import { runAgent } from './agent.js';
import { isWritable } from './template.js';
import type { Builder, ContentBlock, ModelClient, ModelMessage } from './types.js';

const toolUse = (id: string, name: string, input: Record<string, unknown>): ContentBlock => ({
  type: 'tool_use',
  id,
  name,
  input,
});

function scriptedModel(steps: ModelMessage[]): ModelClient {
  let i = 0;
  return { createMessage: async () => steps[i++] };
}

const okBuilder: Builder = { build: async () => ({ ok: true, log: '', jar: Buffer.from('jar') }) };

describe('runAgent', () => {
  it('scaffolds, builds and returns the jar', async () => {
    const client = scriptedModel([
      {
        stop_reason: 'tool_use',
        content: [toolUse('1', 'init_plugin', { plugin_id: 'jump_boots', name: 'Jump Boots' })],
      },
      { stop_reason: 'tool_use', content: [toolUse('2', 'build', {})] },
      { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Wear the boots!' }] },
    ]);
    const out = await runAgent({ client, builder: okBuilder, description: 'boots' });
    expect(out.meta.pluginId).toBe('jump_boots');
    expect(out.jar.toString()).toBe('jar');
    expect(out.summary).toBe('Wear the boots!');
    expect(Object.keys(out.files)).toContain('pom.xml');
  });

  it('rejects writes outside the allowed paths', async () => {
    const client = scriptedModel([
      {
        stop_reason: 'tool_use',
        content: [
          toolUse('1', 'init_plugin', { plugin_id: 'abc', name: 'Abc' }),
          toolUse('2', 'write_file', { path: 'pom.xml', content: 'x' }),
        ],
      },
      { stop_reason: 'end_turn', content: [] },
    ]);
    await expect(
      runAgent({ client, builder: okBuilder, description: 'x', maxTurns: 2 })
    ).rejects.toThrow('turn limit');
  });

  it('fails when the model refuses', async () => {
    const client = scriptedModel([{ stop_reason: 'refusal', content: [] }]);
    await expect(runAgent({ client, builder: okBuilder, description: 'x' })).rejects.toThrow(
      'declined'
    );
  });
});

describe('isWritable', () => {
  it('only allows source and resource files', () => {
    expect(isWritable('src/main/java/com/x/Foo.java')).toBe(true);
    expect(isWritable('pom.xml')).toBe(false);
    expect(isWritable('src/main/java/../../../etc/passwd')).toBe(false);
    expect(isWritable('/etc/passwd')).toBe(false);
  });
});

describe('runAgent with an existing project', () => {
  it('starts from the previous files and does not need init_plugin', async () => {
    const seen: string[] = [];
    const client: ModelClient = {
      createMessage: async ({ messages }) => {
        seen.push(JSON.stringify(messages[0].content));
        return seen.length === 1
          ? { stop_reason: 'tool_use', content: [toolUse('1', 'build', {})] }
          : { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Faster boots!' }] };
      },
    };
    const base = {
      meta: { pluginId: 'jump_boots', name: 'Jump Boots' },
      files: { 'src/main/java/com/engine/jumpboots/Plugin.java': 'class Plugin {}' },
    };
    const out = await runAgent({
      client,
      builder: okBuilder,
      description: 'make them faster',
      base,
    });
    expect(seen[0]).toContain('already exists');
    expect(seen[0]).toContain('make them faster');
    expect(Object.keys(out.files)).toEqual(['src/main/java/com/engine/jumpboots/Plugin.java']);
    expect(out.summary).toBe('Faster boots!');
  });
});
