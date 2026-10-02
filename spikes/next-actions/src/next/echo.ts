import { getSoftureConfig } from "@softure-ai/core/next";

export interface EchoState {
  readonly text: string;
  readonly tag: string;
  readonly appOrigin: string;
  readonly moduleIds: readonly string[];
}

/** What the action and the route handler answer: the input plus what the registry holds. */
export function createEcho(text: string, tag: string): EchoState {
  const config = getSoftureConfig();
  return { text, tag, appOrigin: config.appOrigin, moduleIds: config.modules.map((module) => module.id) };
}
