const { getEmbedder } = require("../../EmbeddingEngines");
const { getVectorDb } = require("../../vectorDbProviders");
const { WorkspaceDocument } = require("../../../models/workspaceDocument");

// Tool definition sent to the LLM so it knows when/how to call this tool.
const DEFINITION = {
  name: "search_documents",
  description:
    "Search the workspace's uploaded documents for relevant information. " +
    "Use this when the user asks about something that may be in the uploaded files.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query to find relevant document chunks.",
      },
    },
    required: ["query"],
  },
};

// Execute: embed the query, search LanceDB, return top chunks as text.
async function run({ query }, { workspaceSlug, workspaceId }) {
  const docCount = await WorkspaceDocument.countForWorkspace(workspaceId);
  if (docCount === 0) {
    return "No documents have been uploaded to this workspace yet.";
  }

  const embedder = await getEmbedder();
  const queryVector = await embedder.embedSingle(query);
  const vectorDb = getVectorDb();
  const results = await vectorDb.similaritySearch(workspaceSlug, queryVector, 4);

  if (!results.length) {
    return "No relevant document chunks found for that query.";
  }

  return results
    .map((r, i) => `[Chunk ${i + 1} — relevance ${(r.score * 100).toFixed(0)}%]\n${r.text}`)
    .join("\n\n---\n\n");
}

module.exports = { DEFINITION, run };
