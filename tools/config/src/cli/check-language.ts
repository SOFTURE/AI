#!/usr/bin/env node
// Entry point of the `softure-check-language` bin; the behaviour is in check-language-command.ts.
import { listGitTrackedFiles, runCheckLanguage } from "./check-language-command.js";

const result = runCheckLanguage(process.argv.slice(2), { cwd: process.cwd(), listTrackedFiles: listGitTrackedFiles });
if (result.output) console.error(result.output);
process.exitCode = result.exitCode;
