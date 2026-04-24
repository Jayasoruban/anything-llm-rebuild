const { GoogleGenAI } = require("@google/genai");
const { SystemSettings, SETTINGS } = require("../../models/systemSettings");
const searchDocuments = require("./tools/searchDocuments");
const webSearch = require("./tools/webSearch");
const logger = require("../logger");

// How many tool-call → result cycles the agent can run before it is forced to answer.
// Prevents runaway loops.
const MAX_ITERATIONS = 5;

// All registered tools: { DEFINITION, run } pairs.
const TOOLS = [searchDocuments, webSearch];

// Build the Gemini "tools" parameter from our tool definitions.
const GEMINI_TOOLS = [
  { functionDeclarations: TOOLS.map((t) => t.DEFINITION) },
];

// Resolve the Gemini API key + model from DB > env.
async function resolveConfig() {
  const [geminiKey, geminiModel] = await Promise.all([
    SystemSettings.getSecret(SETTINGS.GEMINI_API_KEY),
    SystemSettings.get(SETTINGS.GEMINI_MODEL),
  ]);
  return {
    apiKey: geminiKey ?? process.env.GEMINI_API_KEY,
    model: geminiModel ?? process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
  };
}

// Convert OpenAI-shaped message history to Gemini contents format.
// Skips system messages — those go in systemInstruction.
function toGeminiContents(messages) {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
}

// AgentEngine — runs the tool-calling loop and yields SSE-ready event objects.
//
// Usage:
//   const engine = new AgentEngine({ workspaceSlug, workspaceId });
//   for await (const event of engine.run(messages)) {
//     res.write(`data: ${JSON.stringify(event)}\n\n`);
//   }
//
// Events emitted:
//   { type: "agent_start" }
//   { type: "tool_call",   tool, args }
//   { type: "tool_result", tool, result }
//   { type: "chunk",       text }   ← streamed tokens of final answer
//   { type: "done",        response }
//   { type: "error",       error }
class AgentEngine {
  constructor({ workspaceSlug, workspaceId }) {
    this.workspaceSlug = workspaceSlug;
    this.workspaceId = workspaceId;
  }

  async *run(messages) {
    yield { type: "agent_start" };

    try {
      const { apiKey, model } = await resolveConfig();
      const client = new GoogleGenAI({ apiKey });

      const systemInstruction =
        messages.find((m) => m.role === "system")?.content ??
        "You are a helpful AI agent. Use the available tools when needed to answer accurately.";

      // Gemini contents — starts with user conversation history.
      let contents = toGeminiContents(messages);

      for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
        const response = await client.models.generateContent({
          model,
          contents,
          tools: GEMINI_TOOLS,
          config: {
            systemInstruction,
            temperature: 0.5,
          },
        });

        const candidate = response.candidates?.[0];
        if (!candidate) {
          yield { type: "error", error: "No response from model" };
          return;
        }

        const parts = candidate.content?.parts ?? [];

        // Collect all function calls in this response (Gemini can batch multiple).
        const functionCalls = parts.filter((p) => p.functionCall);

        if (functionCalls.length === 0) {
          // No more tool calls — this is the final text answer.
          const text = parts
            .filter((p) => p.text)
            .map((p) => p.text)
            .join("");

          // Simulate streaming by yielding the whole text as one chunk.
          if (text) {
            yield { type: "chunk", text };
          }
          yield { type: "done", response: text };
          return;
        }

        // Append the model's tool-call turn to contents.
        contents.push({ role: "model", parts });

        // Execute each tool and collect results.
        const resultParts = [];
        for (const part of functionCalls) {
          const { name, args } = part.functionCall;
          yield { type: "tool_call", tool: name, args };

          // Find and run the matching tool.
          const tool = TOOLS.find((t) => t.DEFINITION.name === name);
          let result;
          if (!tool) {
            result = `Unknown tool: ${name}`;
          } else {
            try {
              result = await tool.run(args, {
                workspaceSlug: this.workspaceSlug,
                workspaceId: this.workspaceId,
              });
            } catch (err) {
              result = `Tool error: ${err.message}`;
            }
          }

          logger.info(`[agent] ${name}(${JSON.stringify(args)}) → ${String(result).slice(0, 80)}...`);
          yield { type: "tool_result", tool: name, result };

          resultParts.push({
            functionResponse: { name, response: { result } },
          });
        }

        // Append tool results as a "user" turn (Gemini's expected format).
        contents.push({ role: "user", parts: resultParts });
      }

      // Exceeded max iterations — ask for a direct answer with no more tools.
      const finalResponse = await client.models.generateContent({
        model,
        contents,
        config: { systemInstruction, temperature: 0.5 },
        // No tools param — forces a plain text answer.
      });
      const finalText = finalResponse.text ?? "I was unable to complete the task.";
      yield { type: "chunk", text: finalText };
      yield { type: "done", response: finalText };
    } catch (err) {
      logger.error(`[agent] run failed: ${err.message}`);
      yield { type: "error", error: err.message };
    }
  }
}

module.exports = { AgentEngine };
