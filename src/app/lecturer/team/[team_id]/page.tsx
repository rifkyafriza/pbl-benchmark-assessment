import { notFound } from 'next/navigation';
import { getTeamForGrading } from '@/lib/lecturerActions';
import TeamGradingClient from './TeamGradingClient';

export default async function TeamGradingPage({ params }: { params: Promise<{ team_id: string }> }) {
  const { team_id } = await params;
  const data = await getTeamForGrading(team_id);
  if (!data) return notFound();

  const { team, students, grades, period } = data;

  const gradesMap: Record<string, any> = {};
  for (const s of students) {
    const existing = grades.find((g: any) => g.student_id === s.id);
    gradesMap[s.id] = {
      implementation_score: existing?.implementation_score ?? 0,
      document_score: existing?.document_score ?? 0,
      english_score: existing?.english_score ?? 0,
      comment: existing?.comment ?? '',
    };
  }
  const isLocked = grades.length > 0 && grades.every((g: any) => g.is_locked);

  return <TeamGradingClient team={team} students={students} initialGrades={gradesMap} isLocked={isLocked} period={period} />;
}
