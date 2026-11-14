export type Files = Record<string, string | Buffer>;
export interface BuildResult {
  ok: boolean;
  log: string;
  jar?: Buffer;
}
export interface Builder {
  build(files: Files): Promise<BuildResult>;
}
export interface PluginMeta {
  pluginId: string;
  name: string;
}
export type Log = (msg: string) => void;

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}
export interface TextBlock {
  type: 'text';
  text: string;
}
export interface OtherBlock {
  type: string;
}
export type ContentBlock = ToolUseBlock | TextBlock | OtherBlock;
export interface ModelMessage {
  content: ContentBlock[];
  stop_reason: string | null;
}
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[] | ToolResultBlock[];
}
export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}
export interface ModelClient {
  createMessage(params: {
    model: string;
    system: string;
    tools: ToolDefinition[];
    messages: ConversationMessage[];
  }): Promise<ModelMessage>;
}
export interface ToolDefinition {
  name: string;
  description: string;
  strict: boolean;
  input_schema: Record<string, unknown>;
}
