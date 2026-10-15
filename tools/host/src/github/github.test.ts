import { describe, expect, it } from "vitest";
import { createFakeRunner, formatCall } from "../testing/fake-runner.js";
import {
  addTagPolicy,
  createEnvironment,
  findRequiredNames,
  hasEnvironment,
  hasTagPolicy,
  listSecretNames,
  readRepositoryFile,
  setSecret,
  setVariable,
} from "./index.js";

const NOT_FOUND = { status: 1, stderr: "gh: Not Found (HTTP 404)\n" };

describe("the production Environment", () => {
  it("exists on a 200, does not on a 404, and stops on any other failure", async () => {
    await expect(hasEnvironment(createFakeRunner(), "acme/notes")).resolves.toBe(true);
    await expect(hasEnvironment(createFakeRunner(() => NOT_FOUND), "acme/notes")).resolves.toBe(false);
    const forbidden = createFakeRunner(() => ({ status: 1, stderr: "gh: Resource not accessible (HTTP 403)\n" }));
    await expect(hasEnvironment(forbidden, "acme/notes")).rejects.toThrow("cannot read the production environment of acme/notes: gh: Resource not accessible (HTTP 403)");
  });

  it("is created with custom policies, the body on stdin", async () => {
    const runner = createFakeRunner();
    await createEnvironment(runner, "acme/notes");
    expect(runner.calls[0]).toEqual({
      kind: "capture",
      program: "gh",
      args: ["api", "-X", "PUT", "repos/acme/notes/environments/production", "--input", "-"],
      input: '{"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}',
    });
  });

  it("knows its v* tag policy and adds it", async () => {
    const withTag = createFakeRunner(() => ({ stdout: '{"total_count":1,"branch_policies":[{"id":1,"name":"v*","type":"tag"}]}' }));
    await expect(hasTagPolicy(withTag, "acme/notes")).resolves.toBe(true);
    const withBranch = createFakeRunner(() => ({ stdout: '{"branch_policies":[{"name":"v*","type":"branch"}]}' }));
    await expect(hasTagPolicy(withBranch, "acme/notes")).resolves.toBe(false);
    await expect(hasTagPolicy(createFakeRunner(() => ({ stdout: "<html>" })), "acme/notes")).rejects.toThrow("did not answer with JSON");
    const runner = createFakeRunner();
    await addTagPolicy(runner, "acme/notes");
    expect(runner.calls.map(formatCall)).toEqual([
      "gh api -X POST repos/acme/notes/environments/production/deployment-branch-policies -f name=v* -f type=tag",
    ]);
  });
});

describe("secrets and variables", () => {
  it("lists secret names", async () => {
    const runner = createFakeRunner(() => ({ stdout: '[{"name":"DEPLOY_SSH_KEY"},{"name":"POSTGRES_PASSWORD"}]' }));
    await expect(listSecretNames(runner, "acme/notes")).resolves.toEqual(new Set(["DEPLOY_SSH_KEY", "POSTGRES_PASSWORD"]));
    expect(formatCall(runner.calls[0] ?? { kind: "capture", program: "", args: [] })).toBe("gh secret list --env production --repo acme/notes --json name");
  });

  it("hands a secret's value to gh on stdin, never on its command line", async () => {
    const runner = createFakeRunner();
    await setSecret(runner, "acme/notes", "POSTGRES_PASSWORD", "s3cret-value");
    expect(runner.calls[0]?.args).toEqual(["secret", "set", "POSTGRES_PASSWORD", "--env", "production", "--repo", "acme/notes"]);
    expect(runner.calls[0]?.input).toBe("s3cret-value");
    expect(runner.calls[0]?.args.join(" ")).not.toContain("s3cret-value");
  });

  it("sets a repository variable and names the failing operation", async () => {
    const runner = createFakeRunner();
    await setVariable(runner, "acme/notes", "APP_HOST", "notes.example.com");
    expect(runner.calls.map(formatCall)).toEqual(["gh variable set APP_HOST --repo acme/notes --body notes.example.com"]);
    const failing = createFakeRunner(() => ({ status: 1, stderr: "HTTP 422: bad\n" }));
    await expect(setVariable(failing, "acme/notes", "APP_HOST", "x")).rejects.toThrow("gh: cannot set the variable APP_HOST of acme/notes: HTTP 422: bad");
  });
});

describe("repository files", () => {
  it("reads a raw file and answers null for a missing one", async () => {
    const runner = createFakeRunner(() => ({ stdout: "#!/usr/bin/env bash\n" }));
    await expect(readRepositoryFile(runner, "acme/notes", "docker/server/deploy.sh")).resolves.toBe("#!/usr/bin/env bash\n");
    expect(runner.calls[0]?.args).toEqual(["api", "-H", "Accept: application/vnd.github.raw", "repos/acme/notes/contents/docker/server/deploy.sh"]);
    await expect(readRepositoryFile(createFakeRunner(() => NOT_FOUND), "acme/notes", "x")).resolves.toBeNull();
  });
});

describe("findRequiredNames", () => {
  it("takes ${NAME:?} and ${NAME?}, once each, sorted, and skips optional, bare and escaped forms", () => {
    const compose = [
      "POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?}",
      "URL: postgresql://app:${SOFTURE_APP_PASSWORD:?}@postgres/app ${SOFTURE_APP_PASSWORD:?}",
      "KEY: ${API_KEY?set it}",
      "OPTIONAL: ${ADMIN_EMAILS:-}",
      "TAG: ${TAG}",
      "LITERAL: $${NOT_A_SECRET:?}",
    ].join("\n");
    expect(findRequiredNames(compose)).toEqual(["API_KEY", "POSTGRES_PASSWORD", "SOFTURE_APP_PASSWORD"]);
    expect(findRequiredNames("")).toEqual([]);
  });
});
