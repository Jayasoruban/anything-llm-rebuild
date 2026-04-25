// ============================================================================
//  AgentEngine — the "brain" of agent mode.
//
//  Supports two LLM providers (picked from LLM_PROVIDER env / DB setting):
//    • openai  — uses OpenAI chat completions with tool_calls
//    • gemini  — uses Google GenAI with functionCalls
//
//  How the loop works:
//  1. User sends a message in agent mode.
//  2. We give the LLM the message AND a list of tools it can call.
//  3. LLM replies with either:
//     a) Tool calls → we run them, feed results back, repeat (up to MAX_ITERATIONS)
//     b) Final text answer → we yield it and stop
//
//  Tools come from two sources:
//    Built-in: web_search, search_documents (defined in this repo)
//    MCP:      any external MCP server (e.g. GitHub) connected via McpClient
// ============================================================================

const { SystemSettings, SETTINGS } = require("../../models/systemSettings");
const { mcpManager } = require("../McpClient");
const searchDocuments = require("./tools/searchDocuments");
const webSearch = require("./tools/webSearch");
const logger = require("../logger");

const MAX_ITERATIONS = 5;

const BUILTIN_TOOLS = [searchDocuments, webSearch];

// ── Config ────────────────────────────────────────────────────────────────────

// Reads which LLM provider + model + api key to use.
// Checks DB first, then falls back to .env values.
async function resolveConfig() {
  const [provider, openaiKey, openaiModel, geminiKey, geminiModel] = await Promise.all([
    SystemSettings.get(SETTINGS.LLM_PROVIDER),
    SystemSettings.getSecret(SETTINGS.OPENAI_API_KEY),
    SystemSettings.get(SETTINGS.OPENAI_MODEL),
    SystemSettings.getSecret(SETTINGS.GEMINI_API_KEY),
    SystemSettings.get(SETTINGS.GEMINI_MODEL),
  ]);

  const resolvedProvider = provider ?? process.env.LLM_PROVIDER ?? "openai";

  if (resolvedProvider === "openai") {
    return {
      provider: "openai",
      apiKey: openaiKey ?? process.env.OPENAI_API_KEY,
      model: openaiModel ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    };
  }

  // Gemini — gemini-2.5-flash-lite lacks function calling, fall back to 2.0-flash
  const rawModel = geminiModel ?? process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  const model = rawModel.includes("2.5-flash-lite") ? "gemini-2.0-flash" : rawModel;
  return {
    provider: "gemini",
    apiKey: geminiKey ?? process.env.GEMINI_API_KEY,
    model,
  };
}

// ── Tool definitions ──────────────────────────────────────────────────────────

// All tools in a neutral format: { name, description, parameters (JSON Schema) }
function getAllToolDefs() {
  const defs = BUILTIN_TOOLS.map((t) => t.DEFINITION);

  // Add MCP tools, prefixed with server name so we can route them back.
  // e.g. GitHub's "search_repositories" → "github__search_repositories"
  for (const { serverName, tool } of mcpManager.getAllTools()) {
    defs.push({
      name: `${serverName}__${tool.name}`,
      description: `[${serverName}] ${tool.description ?? tool.name}`,
      parameters: tool.inputSchema ?? { type: "object", properties: {} },
    });
  }

  return defs;
}

// Convert our neutral tool defs to the format OpenAI expects.
function toOpenAITools(defs) {
  return defs.map((d) => ({
    type: "function",
    function: {
      name: d.name,
      description: d.description,
      parameters: d.parameters,
    },
  }));
}

// Convert our neutral tool defs to the format Gemini expects.
function toGeminiTools(defs) {
  return [{ functionDeclarations: defs.map((d) => ({
    name: d.name,
    description: d.description,
    parameters: d.parameters,
  })) }];
}

// ── Tool executor ─────────────────────────────────────────────────────────────

// Run a single tool call (built-in or MCP) and return the result as a string.
async function executeTool(name, args, { workspaceSlug, workspaceId }) {
  if (name.includes("__")) {
    // MCP tool: "serverName__toolName"
    const sep = name.indexOf("__");
    const serverName = name.slice(0, sep);
    const toolName = name.slice(sep + 2);
    return mcpManager.callTool(serverName, toolName, args);
  }

  // Built-in tool
  const tool = BUILTIN_TOOLS.find((t) => t.DEFINITION.name === name);
  if (!tool) return `Unknown tool: ${name}`;

  try {
    return await tool.run(args, { workspaceSlug, workspaceId });
  } catch (err) {
    return `Tool error: ${err.message}`;
  }
}

// ── OpenAI agent loop ─────────────────────────────────────────────────────────

async function* runOpenAI({ apiKey, model }, messages, toolDefs, ctx) {
  // Lazy-require so Gemini-only setups don't need the openai package.
  const OpenAI = require("openai");
  const client = new OpenAI({ apiKey });
  const tools = toOpenAITools(toolDefs);

  // OpenAI uses a flat messages array (role + content/tool_calls).
  // System messages stay in place, no special conversion needed.
  const history = messages.map((m) => ({ role: m.role, content: m.content }));

  logger.info(`[agent/openai] starting — model: ${model}, tools: ${toolDefs.length}`);

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    logger.info(`[agent/openai] iteration ${i + 1}`);

    const response = await client.chat.completions.create({
      model,
      messages: history,
      tools,
      temperature: 0.5,
    });

    const choice = response.choices[0];
    const msg = choice.message;
    const toolCalls = msg.tool_calls ?? [];
    const text = msg.content ?? "";

    logger.info(`[agent/openai] toolCalls: ${toolCalls.length}, textLen: ${text.length}`);

    if (toolCalls.length === 0) {
      // Final answer — no more tools
      if (text) yield { type: "chunk", text };
      yield { type: "done", response: text };
      return;
    }

    // Add the assistant's tool-call turn to history
    history.push(msg);

    // Execute each tool and collect results
    for (const tc of toolCalls) {
      const name = tc.function.name;
      let args = {};
      try {
        args = JSON.parse(tc.function.arguments ?? "{}");
      } catch (_) {}

      yield { type: "tool_call", tool: name, args };

      const result = await executeTool(name, args, ctx);
      logger.info(`[agent/openai] ${name} → ${String(result).slice(0, 120)}`);

      yield { type: "tool_result", tool: name, result };

      // OpenAI expects tool results as role: "tool" messages
      history.push({
        role: "tool",
        tool_call_id: tc.id,
        content: String(result),
      });
    }
  }

  // Max iterations — force a final answer with no tools
  logger.warn("[agent/openai] max iterations reached — forcing final answer");
  const final = await client.chat.completions.create({
    model,
    messages: history,
    temperature: 0.5,
  });
  const finalText = final.choices[0].message.content ?? "I was unable to complete the task.";
  yield { type: "chunk", text: finalText };
  yield { type: "done", response: finalText };
}

// ── Gemini agent loop ─────────────────────────────────────────────────────────

// Convert OpenAI-style messages to Gemini's content format.
// System messages are handled separately via systemInstruction config.
function toGeminiContents(messages) {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
}

async function* runGemini({ apiKey, model }, messages, toolDefs, ctx) {
  const { GoogleGenAI } = require("@google/genai");
  const client = new GoogleGenAI({ apiKey });
  const geminiTools = toGeminiTools(toolDefs);

  const systemInstruction =
    messages.find((m) => m.role === "system")?.content ??
    "You are a helpful AI agent. Use the available tools when needed to answer accurately.";

  let contents = toGeminiContents(messages);

  logger.info(`[agent/gemini] starting — model: ${model}, tools: ${toolDefs.length}`);

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    logger.info(`[agent/gemini] iteration ${i + 1}`);

    const response = await client.models.generateContent({
      model,
      contents,
      tools: geminiTools,
      config: { systemInstruction, temperature: 0.5 },
    });

    const functionCalls = response.functionCalls ?? [];
    const responseText = response.text ?? "";

    logger.info(`[agent/gemini] functionCalls: ${functionCalls.length}, textLen: ${responseText.length}`);

    if (functionCalls.length === 0) {
      if (responseText) yield { type: "chunk", text: responseText };
      yield { type: "done", response: responseText };
      return;
    }

    // Add the model's tool-call turn to conversation history
    const modelParts = functionCalls.map((fc) => ({ functionCall: fc }));
    if (responseText) modelParts.unshift({ text: responseText });
    contents.push({ role: "model", parts: modelParts });

    const resultParts = [];

    for (const fc of functionCalls) {
      const { name, args } = fc;
      yield { type: "tool_call", tool: name, args };

      const result = await executeTool(name, args, ctx);
      logger.info(`[agent/gemini] ${name} → ${String(result).slice(0, 120)}`);

      yield { type: "tool_result", tool: name, result };
      resultParts.push({ functionResponse: { name, response: { result } } });
    }

    // Tool results go back as a user turn (Gemini's protocol requirement)
    contents.push({ role: "user", parts: resultParts });
  }

  // Max iterations — force final answer
  logger.warn("[agent/gemini] max iterations reached — forcing final answer");
  const finalResponse = await client.models.generateContent({
    model,
    contents,
    config: { systemInstruction, temperature: 0.5 },
  });
  const finalText = finalResponse.text ?? "I was unable to complete the task.";
  yield { type: "chunk", text: finalText };
  yield { type: "done", response: finalText };
}

// ── AgentEngine ───────────────────────────────────────────────────────────────

class AgentEngine {
  constructor({ workspaceSlug, workspaceId }) {
    this.workspaceSlug = workspaceSlug;
    this.workspaceId = workspaceId;
  }

  async *run(messages) {
    yield { type: "agent_start" };

    try {
      const config = await resolveConfig();
      const toolDefs = getAllToolDefs();
      const ctx = { workspaceSlug: this.workspaceSlug, workspaceId: this.workspaceId };

      logger.info(`[agent] provider: ${config.provider}, model: ${config.model}`);

      const loop = config.provider === "openai"
        ? runOpenAI(config, messages, toolDefs, ctx)
        : runGemini(config, messages, toolDefs, ctx);

      yield* loop;
    } catch (err) {
      logger.error(`[agent] run failed: ${err.message}`);
      yield { type: "error", error: err.message };
    }
  }
}

module.exports = { AgentEngine };
