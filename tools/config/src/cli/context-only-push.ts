#!/usr/bin/env node
// Entry point of the `softure-context-only-push` bin; the behaviour is in context-only-push-command.ts.
import { runContextOnlyPush } from "./context-only-push-command.js";

process.exitCode = runContextOnlyPush(process.argv.slice(2), { cwd: process.cwd() });
