import { z } from 'zod';
import type { Provenance } from './contracts';

const boundedId = z.string().min(1).max(160);
export const assistantScopeSchema = z.object({ studentId: boundedId.optional(), templateId: boundedId.optional(), lessonId: boundedId.optional() }).strict();
export type AssistantScope = z.infer<typeof assistantScopeSchema>;
export const assistantRequestSchema = z.object({ message: z.string().trim().min(1).max(4000), requestId: boundedId, scope: assistantScopeSchema.optional(), mode: z.enum(['fixture', 'live']).optional() }).strict();
export const classroomBriefRequestSchema = assistantRequestSchema.omit({ message: true });
export const teacherGoalsSchema = z.object({ text: z.string().trim().max(4000), expectedRevision: z.number().int().nonnegative().optional() }).strict();
export type AssistantRequestInput = z.infer<typeof assistantRequestSchema>;
export type ClassroomBriefInput = z.infer<typeof classroomBriefRequestSchema>;
export type TeacherGoals = { text: string; revision: number; updatedAt: string | null };
export type AssistantCitation = { id: string; kind: 'response' | 'finding' | 'lesson' | 'assignment' | 'student' | 'calendar' | 'goals'; label: string; href: string; excerpt: string };
export type AssistantAction = { id: string; title: string; description: string; citationId: string; href: string };
export type AssistantContextDisclosure = { scope: AssistantScope; assignmentCount: number; responseCount: number; conversationTurnsIncluded: number; conversationTurnsOmitted: number; historicalNotesIncluded: number; historicalNotesOmitted: number; historicalPlansIncluded: number; historicalPlansOmitted: number; text: string };
export type AssistantTurn = { id: string; requestId: string; role: 'user' | 'assistant'; content: string; createdAt: string; scope: AssistantScope; citations: AssistantCitation[]; actions: AssistantAction[]; provenance: Provenance | null; contextDisclosure: AssistantContextDisclosure | null };
export type ClassroomBrief = { id: string; requestId: string; title: string; content: string; createdAt: string; scope: AssistantScope; citations: AssistantCitation[]; actions: AssistantAction[]; provenance: Provenance; contextDisclosure: AssistantContextDisclosure; stale?: boolean };
export type AssistantRequest = { requestId: string; kind: 'chat' | 'brief'; requestHash: string; contextFingerprint: string; status: 'pending' | 'completed' | 'failed'; attemptId?: string; startedAt: string; completedAt?: string; resultId?: string; errorCode?: string };
export type AssistantState = { revision: number; goals: TeacherGoals; turns: AssistantTurn[]; briefs: ClassroomBrief[]; brief?: ClassroomBrief; requests: AssistantRequest[] };
export type AssistantReplyResult = { turn: AssistantTurn; assistant: AssistantState; reused: boolean };
export type ClassroomBriefResult = { brief: ClassroomBrief; assistant: AssistantState; reused: boolean };

/** The provider selects source IDs; links and excerpts are always server authored. */
export const assistantOutputSchema = z.object({ answer: z.string().trim().min(1).max(7000), sourceIds: z.array(boundedId).min(1).max(12), actions: z.array(z.object({ title: z.string().min(1).max(120), description: z.string().min(1).max(600), sourceId: boundedId }).strict()).max(5) }).strict();
export type AssistantOutput = z.infer<typeof assistantOutputSchema>;
