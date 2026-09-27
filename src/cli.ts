#!/usr/bin/env node

import { Command } from "commander";
import { createRequire } from "node:module";
import { registerCheckCommand } from "./commands/check.js";
import { registerDiffCommand } from "./commands/diff.js";
import { registerExportCommand } from "./commands/export.js";
import { registerInspectCommand } from "./commands/inspect.js";
import { registerListCommand } from "./commands/list.js";
import { registerReplayCommand } from "./commands/replay.js";
import { registerRunCommand } from "./commands/run.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

const program = new Command();

program
  .name("agentinsight")
  .description("Inspect and debug LangGraph, Claude Agent SDK, and custom agents from the terminal")
  .version(version);

registerRunCommand(program);
registerReplayCommand(program);
registerListCommand(program);
registerDiffCommand(program);
registerCheckCommand(program);
registerInspectCommand(program);
registerExportCommand(program);

program.parse(process.argv);
