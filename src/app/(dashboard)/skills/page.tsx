import { getSkillMatrix } from "@/app/actions/user";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SkillMatrixView } from "@/components/skills/skill-matrix-view";

export default async function SkillsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  // Get user's framework preferences
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { displayFrameworks: true },
  });

  const frameworks = user?.displayFrameworks ?? ["js", "react"];
  const result = await getSkillMatrix(frameworks);

  if (!result.success || !result.data) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          {result.error ?? "Failed to load skill matrix"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Skill Matrix</h1>
        <p className="text-muted-foreground">
          Your Glicko-2 ratings across all topic markers
        </p>
      </div>

      <SkillMatrixView
        initialData={result.data}
        initialFrameworks={frameworks}
      />
    </div>
  );
}
