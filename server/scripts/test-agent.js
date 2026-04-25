// Smoke-test the agent engine using OpenAI (gpt-4o-mini has great tool use).
// Run: node scripts/test-agent.js
require("dotenv").config();

const OpenAI = require("openai");
const http = require("http");

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

// ── Test 1: plain call, no tools ──────────────────────────────────────────────
async function testNoTools() {
  console.log("\n=== Test 1: OpenAI plain call (no tools) ===");
  const r = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: "Say hello in one sentence." }],
  });
  console.log("response:", r.choices[0].message.content);
}

// ── Test 2: with a tool ───────────────────────────────────────────────────────
async function testWithTool() {
  console.log("\n=== Test 2: OpenAI with web_search tool ===");
  const r = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: "Search the web for RAG pipeline overview" }],
    tools: [{
      type: "function",
      function: {
        name: "web_search",
        description: "Search the web for information",
        parameters: {
          type: "object",
          properties: { query: { type: "string" } },
          required: ["query"],
        },
      },
    }],
    temperature: 0.5,
  });

  const msg = r.choices[0].message;
  console.log("content:", msg.content);
  console.log("tool_calls:", JSON.stringify(msg.tool_calls, null, 2));
  console.log("finish_reason:", r.choices[0].finish_reason);
}

// ── Test 3: full agent stream via HTTP ────────────────────────────────────────
function streamAgent(prompt) {
  return new Promise((resolve, reject) => {
    console.log(`\n=== Test 3: Agent SSE stream ===`);
    console.log(`📤 Sending: "${prompt}"`);

    const body = JSON.stringify({ message: prompt });
    const req = http.request({
      hostname: "localhost",
      port: 3001,
      path: "/api/workspace/default/agent-chat",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        // Grab the JWT from env or set a valid one here
        Authorization: `Bearer ${process.env.TEST_JWT ?? ""}`,
      },
    }, (res) => {
      let buf = "";
      res.on("data", (chunk) => {
        buf += chunk.toString();
        const lines = buf.split("\n");
        buf = lines.pop(); // keep incomplete last line
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            switch (evt.type) {
              case "agent_start": console.log("🚀 agent_start"); break;
              case "tool_call":   console.log(`🔧 tool_call: ${evt.tool}(${JSON.stringify(evt.args)})`); break;
              case "tool_result": console.log(`📥 tool_result: ${String(evt.result).slice(0, 80)}…`); break;
              case "chunk":       process.stdout.write(evt.text); break;
              case "done":        console.log(`\n🏁 done: response="${evt.response?.slice(0, 80)}"`); break;
              case "saved":       console.log(`💾 saved: id=${evt.id}`); resolve(); break;
              case "error":       console.log(`❌ error: ${evt.error}`); resolve(); break;
            }
          } catch (_) {}
        }
      });
      res.on("end", resolve);
      res.on("error", reject);
    });

    req.on("error", (e) => {
      console.log("HTTP error (is server running?):", e.message);
      resolve();
    });

    req.write(body);
    req.end();
  });
}

async function main() {
  console.log(`Model: ${model}`);

  await testNoTools();
  await testWithTool();

  // Only run the HTTP test if a JWT is provided
  if (process.env.TEST_JWT) {
    await streamAgent("Search GitHub for repositories about RAG pipeline");
  } else {
    console.log("\n=== Test 3: skipped (set TEST_JWT=<token> to test agent HTTP stream) ===");
  }
}

main().catch(console.error);
