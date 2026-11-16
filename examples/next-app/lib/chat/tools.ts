// The chat's one tool: its validated output is drawn as a card in the chat (app/account/chat/chat.tsx).
import { tool, type InferUITools, type UIDataTypes, type UIMessage } from "ai";
import { z } from "zod";

export const PROJECT_STATUSES = ["on_track", "at_risk", "blocked"] as const;

/** The tool's output, parsed before it leaves `execute` and re-checked by `safeValidateUIMessages` on every request. */
export const projectStatusSchema = z.object({
  projectId: z.string().max(64),
  name: z.string().max(120),
  status: z.enum(PROJECT_STATUSES),
  progressPercent: z.number().int().min(0).max(100),
  openTasks: z.number().int().min(0),
});

export type ProjectStatus = z.infer<typeof projectStatusSchema>;

/** The example has no project data: every id answers with this project. A real tool checks the caller's access first. */
const PROJECT_FIXTURE: ProjectStatus = {
  projectId: "apollo",
  name: "Apollo website relaunch",
  status: "at_risk",
  progressPercent: 64,
  openTasks: 7,
};

export const chatTools = {
  getProjectStatus: tool({
    description: "Look up the delivery status of one project by its id.",
    inputSchema: z.object({ projectId: z.string().min(1).max(64) }),
    outputSchema: projectStatusSchema,
    execute: ({ projectId }) => Promise.resolve(projectStatusSchema.parse({ ...PROJECT_FIXTURE, projectId })),
  }),
};

export type ChatTools = InferUITools<typeof chatTools>;
export type ChatMessage = UIMessage<unknown, UIDataTypes, ChatTools>;
