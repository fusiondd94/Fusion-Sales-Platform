import { redirect } from "next/navigation";
import { getFusionAdminUser } from "@/lib/auth";
import { FusionAdminLoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function FusionAdminLoginPage() {
  const user = await getFusionAdminUser();
  if (user?.isAllowed) redirect("/fusionadmin");
  return <main className="login-shell"><a className="brand login-brand" href="/"><span className="brand-mark">FDD</span><span>Fusion Digital Dynamics</span></a><FusionAdminLoginForm /></main>;
}
