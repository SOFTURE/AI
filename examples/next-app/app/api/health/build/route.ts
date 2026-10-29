// The build info shipped by @softure-ai/ops: the release, the commit, the build and start times, which the deploy's
// smoke check compares with the release it just deployed (e2e-deploy.yml).
import { createBuildInfoRoute } from "@softure-ai/ops/next";

export const GET = createBuildInfoRoute();
