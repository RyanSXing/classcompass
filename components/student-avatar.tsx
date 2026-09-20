import Image from "next/image";
import { UserRound } from "lucide-react";

const portraits: Record<string, string> = {
  "stu-01": "avery", "stu-02": "blake", "stu-03": "casey", "stu-04": "devon",
  "stu-05": "emery", "stu-06": "finley", "stu-07": "gray", "stu-08": "harper",
};

/** Illustrations identify fictional learners; the adjacent text supplies the name. */
export function StudentAvatar({studentId, size = 40}: {studentId: string; size?: number}) {
  const portrait = portraits[studentId];
  return <span className="student-portrait" style={{width: size, height: size}} aria-hidden="true">
    {portrait ? <Image src={`/avatars/${portrait}.png`} width={size} height={size} sizes={`${size}px`} alt="" /> : <UserRound size={size * .55} />}
  </span>;
}
