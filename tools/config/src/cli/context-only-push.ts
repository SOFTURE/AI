#!/usr/bin/env node
// Entry point of the `softure-context-only-push` bin; the behaviour is in context-only-push-command.ts.
import { isContextOnlyPush } from "./context-only-push-command.js";

process.exitCode = isContextOnlyPush(process.cwd()) ? 0 : 1;
