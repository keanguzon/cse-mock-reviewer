export type AdminContext = { adminId: string; sessionId: string; reauthenticatedAt: string | null };
export type DataState = { generation: number; revision: number; status: 'active' | 'deleting' | 'deleted'; progressCoverage?: string; incompleteAttemptCount?: number };
export type Page<T> = { items: T[]; total: number; page: number; pageSize: number };
export type SelectionPreview = { selectionId: string; userId: string; count: number; ids: string[]; generation: number; revision: number; expiresAt: string };
export type UserSummary = { id: string; email: string; displayName: string | null; createdAt: string; examCount: number; lastCompletedAt: string | null; protectedAdmin: boolean; status: string };
