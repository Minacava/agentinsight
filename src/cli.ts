#!/usr/bin/env node

import { Command } from "commander";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

const program = new Command();

program
  .name("agentinsight")
  .description("Inspect and debug LangGraph and Claude Agent SDK agents from the terminal")
  .version(version);

program.parse(process.argv);
