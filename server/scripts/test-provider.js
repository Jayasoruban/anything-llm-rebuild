#!/usr/bin/env node
// CLI smoke test that can target any provider directly.
// Usage:  node scripts/test-provider.js openai "hello"
//         node scripts/test-provider.js gemini "hello"

require("dotenv").config();
const { OpenAiProvider } = require("../utils/AiProviders/openAi");
const { GeminiProvider } = require("../utils/AiProviders/gemini");

const [, , providerName = "openai", ...rest] = process.argv;
const prompt = rest.join(" ") || "Say hi in one short sentence.";

const PROVIDERS = {
  openai: () => new OpenAiProvider(),
  gemini: () => new GeminiProvider(),
};

(async () => {
  const factory = PROVIDERS[providerName.toLowerCase()];
  if (!factory) {
    console.error(`[x] unknown provider "${providerName}". try: openai | gemini`);
    process.exit(1);
  }

  const provider = factory();
  console.log(`[>] provider: ${providerName}`);
  console.log(`[>] model:    ${provider.model}`);
  console.log(`[>] prompt:   ${prompt}`);

  process.stdout.write(`[<] streaming: `);
  let full = "";
  for await (const chunk of provider.streamChat([
    { role: "system", content: "You are a concise assistant." },
    { role: "user", content: prompt },
  ])) {
    process.stdout.write(chunk);
    full += chunk;
  }
  process.stdout.write("\n");
  console.log(`[<] total chars: ${full.length}`);
})().catch((err) => {
  console.error("[x]", err.message);
  process.exit(1);
});
