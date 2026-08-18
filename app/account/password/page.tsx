import { redirect } from "next/navigation";
import { connection } from "next/server";
import { requireAuth } from "@/lib/auth-context";
import PasswordForm from "./PasswordForm";

export default async function AccountPasswordPage() {
  await connection();
  let account;
  try {
    account = await requireAuth();
  } catch {
    redirect("/");
  }

  return <PasswordForm displayName={account.profile.display_name} role={account.profile.role} />;
}
