import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AppNav from "@/components/layout/AppNav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav user={user} />
      <main className="max-w-screen-xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
