// ============================================================================
//  McpClientManager — connects to external MCP servers and exposes their tools
//  to our AgentEngine.
//
//  What is an MCP server?
//  ----------------------
//  A separate program (e.g. GitHub MCP server) that runs as a child process
//  on your machine. Our server talks to it through its standard input/output
//  (stdin/stdout) using a JSON protocol. Think of it like two people passing
//  notes through a slot in a wall.
//
//  How MCP servers are configured:
//  --------------------------------
//  Set MCP_SERVERS in server/.env as a JSON string:
//
//  MCP_SERVERS={"github":{"command":"npx","args":["-y","@modelcontextprotocol/server-github"],"env":{"GITHUB_TOKEN":"ghp_..."}}}
//
//  Each key ("github") is a friendly name you choose.
//  "command" + "args" is how to start the server (like running it in terminal).
//  "env" is extra environment variables the server needs (e.g. API tokens).
// ============================================================================

const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const logger = require("../logger");

class McpClientManager {
  constructor() {
    // Map of serverName → { client, tools[] }
    // Once connected, we keep clients alive for the lifetime of the Node process.
    this.servers = new Map();
  }

  // ── Read config ──────────────────────────────────────────────────────────────

  // Reads MCP_SERVERS from .env and parses it.
  // Returns: { serverName: { command, args, env } }
  // Returns {} if not set or invalid JSON.
  static parseConfig() {
    const raw = process.env.MCP_SERVERS;
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      logger.warn("[mcp] MCP_SERVERS env var is not valid JSON — no MCP servers loaded");
      return {};
    }
  }

  // ── Connect ───────────────────────────────────────────────────────────────────

  // Connect to one MCP server by name + config.
  // Spawns the child process, does the MCP handshake, lists available tools.
  async connect(name, { command, args = [], env = {} }) {
    if (this.servers.has(name)) {
      logger.info(`[mcp] ${name} already connected — skipping`);
      return;
    }

    try {
      // StdioClientTransport spawns the MCP server as a child process.
      // Communication happens through the process's stdin and stdout pipes.
      const transport = new StdioClientTransport({
        command,
        args,
        env: { ...process.env, ...env }, // merge our env + extra vars (e.g. GITHUB_TOKEN)
      });

      // MCP Client — handles the protocol handshake and message framing.
      const client = new Client(
        { name: "anything-llm-rebuild", version: "1.0.0" },
        { capabilities: {} }
      );

      await client.connect(transport);

      // Ask the MCP server "what tools do you have?"
      // Returns a list of tool definitions with name, description, inputSchema.
      const { tools } = await client.listTools();

      this.servers.set(name, { client, tools });
      logger.info(`[mcp] connected to "${name}" — ${tools.length} tools: ${tools.map((t) => t.name).join(", ")}`);
    } catch (err) {
      logger.error(`[mcp] failed to connect to "${name}": ${err.message}`);
      // Don't crash — other servers or built-in tools still work.
    }
  }

  // Connect to all servers defined in MCP_SERVERS env var.
  async connectAll() {
    const config = McpClientManager.parseConfig();
    const names = Object.keys(config);
    if (names.length === 0) {
      logger.info("[mcp] no MCP_SERVERS configured — skipping MCP setup");
      return;
    }
    // Connect to all servers in parallel.
    await Promise.all(names.map((name) => this.connect(name, config[name])));
  }

  // ── Tool access ───────────────────────────────────────────────────────────────

  // Returns all tools from all connected servers, each tagged with its server name.
  // Shape: [{ serverName: "github", tool: { name, description, inputSchema } }]
  getAllTools() {
    const all = [];
    for (const [serverName, { tools }] of this.servers) {
      for (const tool of tools) {
        all.push({ serverName, tool });
      }
    }
    return all;
  }

  // Call a specific tool on a specific server.
  // toolName: the original tool name (without prefix)
  // args: object of arguments the LLM decided to pass
  // Returns: result as a plain string (for the LLM to read)
  async callTool(serverName, toolName, args) {
    const entry = this.servers.get(serverName);
    if (!entry) {
      return `MCP server "${serverName}" is not connected.`;
    }
    try {
      const result = await entry.client.callTool({ name: toolName, arguments: args });
      // MCP tool results come back as an array of content blocks.
      // We join all text blocks into one string for the LLM.
      const text = (result.content ?? [])
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("\n\n");
      return text || JSON.stringify(result.content);
    } catch (err) {
      return `Tool error from "${serverName}/${toolName}": ${err.message}`;
    }
  }

  // ── Status (for admin UI) ─────────────────────────────────────────────────────

  // Returns a status snapshot for the admin settings page.
  // Shows which servers are connected and what tools they have.
  getStatus() {
    const config = McpClientManager.parseConfig();
    const result = [];

    for (const [name, cfg] of Object.entries(config)) {
      const entry = this.servers.get(name);
      result.push({
        name,
        command: `${cfg.command} ${(cfg.args ?? []).join(" ")}`,
        connected: !!entry,
        toolCount: entry?.tools.length ?? 0,
        tools: entry?.tools.map((t) => ({ name: t.name, description: t.description })) ?? [],
      });
    }

    return result;
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────
// One shared instance across the whole server process.
// This is important — we don't want to spawn multiple child processes for the
// same MCP server on every agent request.
const mcpManager = new McpClientManager();

module.exports = { mcpManager, McpClientManager };
