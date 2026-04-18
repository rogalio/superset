import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

export type V2SidebarGroupingMode = "project" | "status";

export type V2SidebarStatusBucket =
	| "in-progress"
	| "in-review"
	| "ready-to-merge"
	| "done"
	| "canceled"
	| "backlog";

export const ALL_STATUS_BUCKETS: V2SidebarStatusBucket[] = [
	"in-progress",
	"in-review",
	"ready-to-merge",
	"done",
	"canceled",
	"backlog",
];

interface V2SidebarGroupingState {
	mode: V2SidebarGroupingMode;
	hiddenStatuses: V2SidebarStatusBucket[];
	hiddenProjectIds: string[];
	setMode: (mode: V2SidebarGroupingMode) => void;
	toggle: () => void;
	toggleStatus: (status: V2SidebarStatusBucket) => void;
	resetHiddenStatuses: () => void;
	toggleProjectId: (projectId: string) => void;
	resetHiddenProjects: () => void;
}

export const useV2SidebarGroupingStore = create<V2SidebarGroupingState>()(
	devtools(
		persist(
			(set) => ({
				mode: "project",
				hiddenStatuses: [],
				hiddenProjectIds: [],
				setMode: (mode) => set({ mode }),
				toggle: () =>
					set((s) => ({ mode: s.mode === "project" ? "status" : "project" })),
				toggleStatus: (status) =>
					set((s) => ({
						hiddenStatuses: s.hiddenStatuses.includes(status)
							? s.hiddenStatuses.filter((x) => x !== status)
							: [...s.hiddenStatuses, status],
					})),
				resetHiddenStatuses: () => set({ hiddenStatuses: [] }),
				toggleProjectId: (projectId) =>
					set((s) => ({
						hiddenProjectIds: s.hiddenProjectIds.includes(projectId)
							? s.hiddenProjectIds.filter((x) => x !== projectId)
							: [...s.hiddenProjectIds, projectId],
					})),
				resetHiddenProjects: () => set({ hiddenProjectIds: [] }),
			}),
			{ name: "v2-sidebar-grouping", version: 3 },
		),
		{ name: "V2SidebarGroupingStore" },
	),
);
