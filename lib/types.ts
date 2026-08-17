export type UserRole = "WORKER" | "ADMIN";
export type ProfileStatus = "ACTIVE" | "DISABLED";
export type WorkerType = "EMPLOYEE" | "CONTRACTOR" | "SUBCONTRACTOR" | "PARTNER" | "TEMPORARY_WORKER";
export type ProjectStatus = "ACTIVE" | "COMPLETED" | "ARCHIVED";
export type WorkSessionStatus = "OPEN" | "COMPLETE" | "MISSING_CHECKOUT" | "LONG_SESSION" | "MANUALLY_CORRECTED" | "VOID";

export interface Profile {
  id: string;
  auth_user_id: string;
  username: string;
  display_name: string;
  company: string | null;
  worker_type: WorkerType;
  role: UserRole;
  status: ProfileStatus;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  project_code: string;
  project_name: string;
  customer_name: string;
  site_name: string | null;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string | null;
  postal_code: string | null;
  country: string;
  timezone: string;
  map_image_path: string | null;
  start_date: string | null;
  end_date: string | null;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}
