import Link from "next/link";
import { currentStudent } from "@/lib/supabase/auth";
import { GroupDashboard } from "@/components/groups/GroupDashboard";

export default async function GroupsPage() {
  const student = await currentStudent();
  if (!student) return <main style={{ padding: 32 }}><p>Sign in to create or join a housing group.</p><Link href="/">Sign in</Link></main>;
  return <GroupDashboard email={student.email} />;
}
