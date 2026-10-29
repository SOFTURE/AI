#!/usr/bin/env node
// Entry point of the `softure-merge-push-scope` bin; the behaviour is in merge-push-scope-command.ts.
import { runMergePushScope } from "./merge-push-scope-command.js";

process.exitCode = runMergePushScope(process.argv.slice(2), { cwd: process.cwd() });
