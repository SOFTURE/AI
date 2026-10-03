import type { ModuleContext } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";

/** What the privacy server functions receive; contributors get the same with `db` as a transaction. */
export type PrivacyContext = ModuleContext<Queryable>;
