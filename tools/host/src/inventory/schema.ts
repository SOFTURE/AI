import { z } from "zod";

/** An app's short name: its folder (`/srv/<slug>`), its key comment (`<slug>-release`) and its Traefik prefix. */
const SLUG = /^[a-z][a-z0-9-]{0,39}$/;
/** A Linux user or group name. */
const USER_NAME = /^[a-z_][a-z0-9_-]{0,31}$/;
/** A DNS name or an IP address, nothing a shell or a template could read as more. */
const HOST = /^[A-Za-z0-9.:-]+$/;
/** A Docker network, compose project or systemd unit name. */
const RESOURCE_NAME = /^[a-z0-9][a-z0-9_-]{0,62}$/;
/** A path under a host that Cloudflare Access can match. */
const URL_PATH = /^\/[A-Za-z0-9._~/-]*$/;

const serverSchema = z
  .object({
    host: z.string().regex(HOST, "a host name or IP address"),
    port: z.number().int().min(1).max(65535).default(22),
    ipv4: z.ipv4().optional(),
    ipv6: z.ipv6().optional(),
    adminUser: z.string().regex(USER_NAME, "a user name"),
    adminPublicKey: z.string().min(1).optional(),
    identityFile: z.string().min(1).optional(),
    deployUser: z.string().regex(USER_NAME, "a user name").default("deploy"),
    timezone: z.string().regex(/^[A-Za-z0-9_+/-]+$/, "a time zone such as Europe/Warsaw").default("UTC"),
  })
  .strict();

const edgeSchema = z
  .object({
    name: z.string().regex(RESOURCE_NAME, "a compose project name").default("softure-edge"),
    network: z.string().regex(RESOURCE_NAME, "a Docker network name").optional(),
    certResolver: z.string().regex(/^[A-Za-z0-9_-]+$/, "a resolver name").default("letsencrypt"),
    manage: z.boolean().default(true),
    acmeEmail: z.email().optional(),
    cdn: z.enum(["cloudflare", "none"]).default("none"),
  })
  .strict();

const firewallSchema = z
  .object({
    manage: z.boolean().optional(),
    name: z.string().regex(RESOURCE_NAME, "a systemd unit name").default("softure-cloudflare-only"),
    rangesFile: z.string().regex(/^\/[A-Za-z0-9._/-]+$/, "an absolute path").optional(),
  })
  .strict();

const accessSchema = z
  .object({
    enabled: z.boolean().default(false),
    bypassPaths: z.array(z.string().regex(URL_PATH, "a path starting with /")).default([]),
    emails: z.array(z.email()).default([]),
  })
  .strict()
  .refine((access) => !access.enabled || access.emails.length > 0, {
    message: "access.enabled needs at least one address in access.emails",
    path: ["emails"],
  });

const appSchema = z
  .object({
    slug: z.string().regex(SLUG, "lower-case letters, digits and dashes, starting with a letter"),
    repo: z.string().regex(/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/, "owner/name"),
    host: z.string().regex(HOST, "a host name"),
    database: z.boolean().default(false),
    access: accessSchema.prefault({}),
  })
  .strict();

/** The inventory file as written: one server, its edge, and the apps it hosts. */
export const inventorySchema = z
  .object({
    server: serverSchema,
    edge: edgeSchema.prefault({}),
    firewall: firewallSchema.prefault({}),
    apps: z.array(appSchema).default([]),
  })
  .strict()
  .superRefine((inventory, context) => {
    if (inventory.edge.manage && inventory.edge.acmeEmail === undefined) {
      context.addIssue({ code: "custom", path: ["edge", "acmeEmail"], message: "edge.manage needs edge.acmeEmail" });
    }
    const seen = new Set<string>();
    inventory.apps.forEach((app, index) => {
      if (seen.has(app.slug)) {
        context.addIssue({ code: "custom", path: ["apps", index, "slug"], message: `${app.slug} is listed twice` });
      }
      seen.add(app.slug);
    });
  })
  .transform((inventory) => ({
    ...inventory,
    edge: { ...inventory.edge, network: inventory.edge.network ?? inventory.edge.name },
    firewall: {
      name: inventory.firewall.name,
      manage: inventory.firewall.manage ?? (inventory.edge.manage && inventory.edge.cdn === "cloudflare"),
      rangesFile: inventory.firewall.rangesFile ?? `/srv/${inventory.edge.name}/cloudflare-ips.txt`,
    },
  }));

/** An inventory with every default applied. */
export type Inventory = z.output<typeof inventorySchema>;
export type InventoryApp = Inventory["apps"][number];
