import { z } from "zod";

export const workerCreateSchema = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,40}$/),
  password: z.string().min(8).max(128),
  display_name: z.string().trim().min(2).max(100),
  company: z.string().trim().max(120).nullable().optional(),
  worker_type: z.enum(["EMPLOYEE", "CONTRACTOR", "SUBCONTRACTOR", "PARTNER", "TEMPORARY_WORKER"]).default("EMPLOYEE"),
  role: z.enum(["WORKER", "ADMIN"]).default("WORKER"),
});

export const workerUpdateSchema = z.object({
  display_name: z.string().trim().min(2).max(100).optional(),
  company: z.string().trim().max(120).nullable().optional(),
  worker_type: z.enum(["EMPLOYEE", "CONTRACTOR", "SUBCONTRACTOR", "PARTNER", "TEMPORARY_WORKER"]).optional(),
  role: z.enum(["WORKER", "ADMIN"]).optional(),
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
}).refine((value) => Object.keys(value).length > 0, "NO_CHANGES");

export const projectSchema = z.object({
  project_code: z.string().trim().min(2).max(40),
  project_name: z.string().trim().min(2).max(160),
  customer_name: z.string().trim().min(2).max(160),
  site_name: z.string().trim().max(160).nullable().optional(),
  address_line_1: z.string().trim().min(2).max(200),
  address_line_2: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().max(100).nullable().optional(),
  postal_code: z.string().trim().max(30).nullable().optional(),
  country: z.string().trim().min(2).max(100).default("United States"),
  timezone: z.string().trim().min(3).max(100),
  start_date: z.string().date().nullable().optional(),
  end_date: z.string().date().nullable().optional(),
  status: z.enum(["ACTIVE", "COMPLETED", "ARCHIVED"]).default("ACTIVE"),
});

export const projectUpdateSchema = projectSchema.partial().refine((value) => Object.keys(value).length > 0, "NO_CHANGES");

export function parseBody<T>(schema: z.ZodType<T>, body: unknown) {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const error = new Error(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "));
    error.name = "VALIDATION_ERROR";
    throw error;
  }
  return parsed.data;
}
