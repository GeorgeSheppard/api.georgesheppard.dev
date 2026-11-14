import * as C from './config.js';
import { pngFromGrid } from './png.js';
import { scaffold, isWritable, packageFor } from './template.js';
import { SYSTEM } from './prompt.js';
import type {
  Builder,
  ContentBlock,
  ConversationMessage,
  Files,
  Log,
  ModelClient,
  PluginMeta,
  TextBlock,
  ToolDefinition,
  ToolResultBlock,
  ToolUseBlock,
} from './types.js';

const tools: ToolDefinition[] = [
  {
    name: 'init_plugin',
    description: 'Create the project scaffold. Call exactly once, first.',
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['plugin_id', 'name'],
      properties: {
        plugin_id: { type: 'string', description: 'snake_case, 3-30 chars, starts with a letter' },
        name: { type: 'string' },
      },
    },
  },
  {
    name: 'write_file',
    description: 'Create or overwrite a text file under src/main/java or src/main/resources.',
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['path', 'content'],
      properties: { path: { type: 'string' }, content: { type: 'string' } },
    },
  },
  {
    name: 'write_texture',
    description:
      'Write a PNG from a grid. rows: one string per pixel row, cells separated by spaces; each cell is #rrggbb, #rrggbbaa, or . for transparent. Usually 16 rows of 16 cells. Path must end in .png.',
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['path', 'rows'],
      properties: { path: { type: 'string' }, rows: { type: 'array', items: { type: 'string' } } },
    },
  },
  {
    name: 'read_file',
    description: 'Read a file you wrote earlier.',
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['path'],
      properties: { path: { type: 'string' } },
    },
  },
  {
    name: 'build',
    description: 'Compile the plugin into a jar. Returns success or the compiler log.',
    strict: true,
    input_schema: { type: 'object', additionalProperties: false, properties: {} },
  },
];

export interface AgentOptions {
  client: ModelClient;
  builder: Builder;
  description: string;
  log?: Log;
  model?: string;
  maxTurns?: number;
}
export interface AgentOutput {
  meta: PluginMeta;
  jar: Buffer;
  summary: string;
  files: Files;
}

const isToolUse = (b: ContentBlock): b is ToolUseBlock => b.type === 'tool_use';
const isText = (b: ContentBlock): b is TextBlock => b.type === 'text';
const str = (v: unknown) => (typeof v === 'string' ? v : '');

export async function runAgent(o: AgentOptions): Promise<AgentOutput> {
  const log = o.log ?? (() => {});
  const files: Files = {};
  let meta: PluginMeta | undefined;
  let jar: Buffer | undefined;
  let dirty = true;
  const messages: ConversationMessage[] = [
    { role: 'user', content: `Make this plugin: ${o.description}` },
  ];

  const exec = async (name: string, input: Record<string, unknown>): Promise<string> => {
    const filePath = str(input.path);
    switch (name) {
      case 'init_plugin': {
        if (meta) return 'error: already initialised';
        const id = str(input.plugin_id);
        if (!/^[a-z][a-z0-9_]{2,30}$/.test(id)) return 'error: bad plugin_id';
        meta = { pluginId: id, name: str(input.name).slice(0, 60) };
        Object.assign(files, scaffold(meta.pluginId, meta.name));
        log(`Planning "${meta.name}"…`);
        return `ok. Java package: ${packageFor(meta.pluginId)} (path src/main/java/${packageFor(meta.pluginId).replace(/\./g, '/')}/Plugin.java). Resource namespace: ${meta.pluginId}`;
      }
      case 'write_file':
        if (!meta) return 'error: call init_plugin first';
        if (!isWritable(filePath)) return 'error: path not allowed';
        files[filePath] = str(input.content);
        dirty = true;
        log(`Writing ${filePath}`);
        return 'ok';
      case 'write_texture':
        if (!meta) return 'error: call init_plugin first';
        if (!isWritable(filePath) || !filePath.endsWith('.png')) return 'error: path not allowed';
        try {
          files[filePath] = pngFromGrid(Array.isArray(input.rows) ? input.rows.map(String) : []);
        } catch (e) {
          return `error: ${e instanceof Error ? e.message : 'bad texture'}`;
        }
        dirty = true;
        log(`Drawing ${filePath}`);
        return 'ok';
      case 'read_file': {
        const f = files[filePath];
        return f === undefined ? 'error: no such file' : f.toString();
      }
      case 'build': {
        if (!meta) return 'error: call init_plugin first';
        if (!Object.keys(files).some((p) => p.endsWith('/Plugin.java')))
          return 'error: Plugin.java not found. Use read_file to check the template, then write_file to modify it.';
        log('Building…');
        const r = await o.builder.build(files);
        if (r.ok && r.jar) {
          jar = r.jar;
          dirty = false;
          log('Build succeeded');
          return 'BUILD SUCCESS';
        }
        jar = undefined;
        log('Build failed, fixing…');
        return 'BUILD FAILED\n' + r.log.slice(-6000);
      }
    }
    return 'error: unknown tool';
  };

  const maxTurns = o.maxTurns ?? 30;
  for (let turn = 0; turn < maxTurns; turn++) {
    const res = await o.client.createMessage({
      model: o.model ?? C.DEFAULT_MODEL,
      system: SYSTEM,
      tools,
      messages,
    });
    messages.push({ role: 'assistant', content: res.content });
    if (res.stop_reason === 'refusal') throw new Error('The request was declined by the model.');
    if (res.stop_reason === 'max_tokens') {
      messages.push({ role: 'user', content: 'Output was cut off. Continue with smaller files.' });
      continue;
    }
    const uses = res.content.filter(isToolUse);
    if (uses.length) {
      const results: ToolResultBlock[] = [];
      for (const u of uses) {
        const content = await exec(u.name, u.input).catch(
          (e: unknown) => `error: ${e instanceof Error ? e.message : 'failed'}`
        );
        results.push({ type: 'tool_result', tool_use_id: u.id, content });
      }
      messages.push({ role: 'user', content: results });
      continue;
    }
    const summary = res.content
      .filter(isText)
      .map((b) => b.text)
      .join('\n')
      .trim();
    if (meta && jar && !dirty) {
      log('Plugin complete!');
      return { meta, jar, summary, files };
    }
    messages.push({
      role: 'user',
      content:
        'There is no successful build of the latest files yet. Call build and fix any errors.',
    });
  }
  throw new Error('Could not produce a working plugin within the turn limit.');
}
