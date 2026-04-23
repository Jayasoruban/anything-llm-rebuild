#!/usr/bin/env node
// Quick CLI smoke test for the OpenAI provider.
// Usage:  node scripts/test-openai.js "hello, who are you?"

require("dotenv").config();
const { getProvider } = require("../utils/AiProviders");

(async () => {
  const userMessage = process.argv.slice(2).join(" ") || "Say hi in one short sentence.";
  console.log(`[>] prompt: ${userMessage}`);
  console.log(`[>] model:  ${process.env.OPENAI_MODEL ?? "gpt-4o-mini"}`);

  const provider = getProvider();
  const reply = await provider.sendChat([
    { role: "system", content: "You are a concise assistant." },
    { role: "user", content: userMessage },
  ]);
  console.log(`[<] reply:  ${reply}`);
})().catch((err) => {
  console.error("[x]", err.message);
  process.exit(1);
});
