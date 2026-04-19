import { eq } from "@tanstack/db";
import { useLiveQuery } from "@tanstack/react-db";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { env } from "renderer/env.renderer";
import { authClient } from "renderer/lib/auth-client";
import { getHostServiceClientByUrl } from "renderer/lib/host-service-client";
import { useDashboardSidebarState } from "renderer/routes/_authenticated/hooks/useDashboardSidebarState";
import { useCollections } from "renderer/routes/_authenticated/providers/CollectionsProvider";
import { useLocalHostService } from "renderer/routes/_authenticated/providers/LocalHostServiceProvider";
import { useV2SidebarGroupingStore } from "renderer/stores/v2-sidebar-grouping";
import { MOCK_ORG_ID } from "shared/constants";
import type {
	DashboardSidebarProject,
	DashboardSidebarProjectChild,
	DashboardSidebarSection,
	DashboardSidebarWorkspace,
} from "../../types";

// Pending workspaces are always rendered at the end of the project's workspace list
const PENDING_WORKSPACE_TAB_ORDER = Number.MAX_SAFE_INTEGER;

export function useDashboardSidebarData() {
	const { data: session } = authClient.useSession();
	const collections = useCollections();
	const { machineId, activeHostUrl } = useLocalHostService();
	const { toggleProjectCollapsed } = useDashboardSidebarState();

	// Query pending workspaces from the local collection
	const { data: pendingWorkspaces = [] } = useLiveQuery(
		(q) =>
			q.from({ pw: collections.pendingWorkspaces }).select(({ pw }) => ({
				id: pw.id,
				projectId: pw.projectId,
				name: pw.name,
				branchName: pw.branchName,
				status: pw.status,
			})),
		[collections],
	);
	const activeOrganizationId = env.SKIP_ENV_VALIDATION
		? MOCK_ORG_ID
		: (session?.session?.activeOrganizationId ?? null);
	const activeHostClient = activeHostUrl
		? getHostServiceClientByUrl(activeHostUrl)
		: null;

	const { data: rawSidebarProjects = [] } = useLiveQuery(
		(q) =>
			q
				.from({ sidebarProjects: collections.v2SidebarProjects })
				.innerJoin(
					{ projects: collections.v2Projects },
					({ sidebarProjects, projects }) =>
						eq(sidebarProjects.projectId, projects.id),
				)
				.leftJoin(
					{ repos: collections.githubRepositories },
					({ projects, repos }) => eq(projects.githubRepositoryId, repos.id),
				)
				.orderBy(({ sidebarProjects }) => sidebarProjects.tabOrder, "asc")
				.select(({ sidebarProjects, projects, repos }) => ({
					id: projects.id,
					name: projects.name,
					slug: projects.slug,
					githubRepositoryId: projects.githubRepositoryId,
					githubOwner: repos?.owner ?? null,
					githubRepoName: repos?.name ?? null,
					createdAt: projects.createdAt,
					updatedAt: projects.updatedAt,
					isCollapsed: sidebarProjects.isCollapsed,
				})),
		[collections],
	);

	const sidebarProjects = useMemo(
		() =>
			rawSidebarProjects.map((project) => ({
				...project,
				githubOwner: project.githubOwner ?? null,
				githubRepoName: project.githubRepoName ?? null,
			})),
		[rawSidebarProjects],
	);

	const { data: sidebarSections = [] } = useLiveQuery(
		(q) =>
			q
				.from({ sidebarSections: collections.v2SidebarSections })
				.orderBy(({ sidebarSections }) => sidebarSections.tabOrder, "asc")
				.select(({ sidebarSections }) => ({
					id: sidebarSections.sectionId,
					projectId: sidebarSections.projectId,
					name: sidebarSections.name,
					createdAt: sidebarSections.createdAt,
					isCollapsed: sidebarSections.isCollapsed,
					tabOrder: sidebarSections.tabOrder,
					color: sidebarSections.color,
				})),
		[collections],
	);

	const { data: sidebarWorkspaces = [] } = useLiveQuery(
		(q) =>
			q
				.from({ sidebarWorkspaces: collections.v2WorkspaceLocalState })
				.innerJoin(
					{ workspaces: collections.v2Workspaces },
					({ sidebarWorkspaces, workspaces }) =>
						eq(sidebarWorkspaces.workspaceId, workspaces.id),
				)
				.leftJoin({ hosts: collections.v2Hosts }, ({ workspaces, hosts }) =>
					eq(workspaces.hostId, hosts.id),
				)
				.orderBy(
					({ sidebarWorkspaces }) => sidebarWorkspaces.sidebarState.tabOrder,
					"asc",
				)
				.select(({ sidebarWorkspaces, workspaces, hosts }) => ({
					id: workspaces.id,
					projectId: sidebarWorkspaces.sidebarState.projectId,
					hostId: workspaces.hostId,
					hostMachineId: hosts?.machineId ?? null,
					name: workspaces.name,
					branch: workspaces.branch,
					createdAt: workspaces.createdAt,
					updatedAt: workspaces.updatedAt,
					tabOrder: sidebarWorkspaces.sidebarState.tabOrder,
					sectionId: sidebarWorkspaces.sidebarState.sectionId,
				})),
		[collections],
	);

	const localWorkspaceIds = useMemo(
		() =>
			sidebarWorkspaces
				.filter(
					(workspace) =>
						workspace.hostMachineId != null &&
						workspace.hostMachineId === machineId,
				)
				.map((workspace) => workspace.id)
				.sort(),
		[machineId, sidebarWorkspaces],
	);

	const { data: pullRequestData, refetch: refetchPullRequests } = useQuery({
		queryKey: [
			"dashboard-sidebar",
			"pull-requests",
			activeOrganizationId,
			localWorkspaceIds,
		],
		enabled: activeHostClient !== null && localWorkspaceIds.length > 0,
		refetchInterval: 10_000,
		queryFn: () =>
			activeHostClient?.pullRequests.getByWorkspaces.query({
				workspaceIds: localWorkspaceIds,
			}) ?? Promise.resolve({ workspaces: [] }),
	});

	const refreshWorkspacePullRequest = useCallback(
		async (workspaceId: string) => {
			if (!activeHostClient || !localWorkspaceIds.includes(workspaceId)) {
				return;
			}

			await activeHostClient.pullRequests.refreshByWorkspaces.mutate({
				workspaceIds: [workspaceId],
			});
			await refetchPullRequests();
		},
		[activeHostClient, localWorkspaceIds, refetchPullRequests],
	);

	const localPullRequestsByWorkspaceId = useMemo(
		() =>
			new Map(
				(pullRequestData?.workspaces ?? []).map((workspace) => [
					workspace.workspaceId,
					workspace.pullRequest,
				]),
			),
		[pullRequestData?.workspaces],
	);

	const groups = useMemo<DashboardSidebarProject[]>(() => {
		const projectsById = new Map<
			string,
			DashboardSidebarProject & {
				sectionMap: Map<string, DashboardSidebarSection>;
				childEntries: Array<{
					tabOrder: number;
					child: DashboardSidebarProjectChild;
				}>;
			}
		>();

		for (const project of sidebarProjects) {
			projectsById.set(project.id, {
				...project,
				children: [],
				sectionMap: new Map(),
				childEntries: [],
			});
		}

		for (const section of sidebarSections) {
			const project = projectsById.get(section.projectId);
			if (!project) continue;

			const sidebarSection: DashboardSidebarSection = {
				...section,
				workspaces: [],
			};

			project.sectionMap.set(section.id, sidebarSection);
			project.childEntries.push({
				tabOrder: section.tabOrder,
				child: {
					type: "section",
					section: sidebarSection,
				},
			});
		}

		for (const workspace of sidebarWorkspaces) {
			const project = projectsById.get(workspace.projectId);
			if (!project) continue;

			const hostType: DashboardSidebarWorkspace["hostType"] =
				workspace.hostMachineId == null
					? "cloud"
					: workspace.hostMachineId === machineId
						? "local-device"
						: "remote-device";

			const sidebarWorkspace: DashboardSidebarWorkspace = {
				id: workspace.id,
				projectId: workspace.projectId,
				hostId: workspace.hostId,
				hostType,
				accentColor: null,
				name: workspace.name,
				branch: workspace.branch,
				pullRequest:
					hostType === "local-device"
						? (localPullRequestsByWorkspaceId.get(workspace.id) ?? null)
						: null,
				repoUrl:
					project.githubOwner && project.githubRepoName
						? `https://github.com/${project.githubOwner}/${project.githubRepoName}`
						: null,
				branchExistsOnRemote:
					project.githubOwner !== null && project.githubRepoName !== null,
				previewUrl: null,
				needsRebase: null,
				behindCount: null,
				createdAt: workspace.createdAt,
				updatedAt: workspace.updatedAt,
			};

			if (workspace.sectionId) {
				const section = project.sectionMap.get(workspace.sectionId);
				if (section) {
					section.workspaces.push({
						...sidebarWorkspace,
						accentColor: section.color,
					});
				}
				continue;
			}

			project.childEntries.push({
				tabOrder: workspace.tabOrder,
				child: {
					type: "workspace",
					workspace: sidebarWorkspace,
				},
			});
		}

		// Inject pending workspaces (creating / failed)
		for (const pw of pendingWorkspaces) {
			if (pw.status === "succeeded") continue; // will appear as a real workspace
			const project = projectsById.get(pw.projectId);
			if (!project) continue;

			const pendingItem: DashboardSidebarWorkspace = {
				id: pw.id,
				projectId: pw.projectId,
				hostId: "",
				hostType: "local-device",
				accentColor: null,
				name: pw.name,
				branch: pw.branchName,
				pullRequest: null,
				repoUrl:
					project.githubOwner && project.githubRepoName
						? `https://github.com/${project.githubOwner}/${project.githubRepoName}`
						: null,
				branchExistsOnRemote: false,
				previewUrl: null,
				needsRebase: null,
				behindCount: null,
				createdAt: new Date(),
				updatedAt: new Date(),
				creationStatus: pw.status,
			};

			project.childEntries.push({
				tabOrder: PENDING_WORKSPACE_TAB_ORDER,
				child: {
					type: "workspace",
					workspace: pendingItem,
				},
			});
		}

		return sidebarProjects.flatMap((project) => {
			const resolvedProject = projectsById.get(project.id);
			if (!resolvedProject) return [];
			const {
				childEntries,
				sectionMap: _sectionMap,
				...sidebarProject
			} = resolvedProject;
			sidebarProject.children = childEntries
				.sort((left, right) => left.tabOrder - right.tabOrder)
				.map(({ child }) => child);
			return [sidebarProject];
		});
	}, [
		machineId,
		localPullRequestsByWorkspaceId,
		pendingWorkspaces,
		sidebarProjects,
		sidebarSections,
		sidebarWorkspaces,
	]);

	// DEMO: inject fake projects/workspaces in dev mode so sidebar isn't empty
	const demoGroups = useMemo<DashboardSidebarProject[]>(() => {
		if (!env.SKIP_ENV_VALIDATION) return [];
		const now = new Date();
		const daysAgo = (d: number) =>
			new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
		const mkChecks = (
			statuses: Array<
				"success" | "failure" | "pending" | "skipped" | "cancelled"
			>,
		) =>
			statuses.map((status, i) => ({
				name: ["lint", "typecheck", "test", "build", "e2e"][i] ?? `check-${i}`,
				status,
				url: "https://github.com/example/example/actions/runs/1",
			}));
		const mkWs = (
			id: string,
			name: string,
			branch: string,
			overrides: Partial<DashboardSidebarWorkspace> = {},
			ageDays = 3,
		): DashboardSidebarWorkspace => ({
			id,
			projectId: "",
			deviceId: "demo-device",
			hostType: "local-device",
			accentColor: null,
			name,
			branch,
			pullRequest: null,
			repoUrl: null,
			branchExistsOnRemote: true,
			previewUrl: null,
			needsRebase: false,
			behindCount: 0,
			createdAt: daysAgo(ageDays),
			updatedAt: daysAgo(Math.max(0, ageDays - 1)),
			...overrides,
		});
		const mkProject = (
			id: string,
			name: string,
			githubOwner: string | null,
			children: DashboardSidebarProjectChild[],
		): DashboardSidebarProject => {
			const repoShort = name.toLowerCase();
			const derivedRepoUrl = githubOwner
				? `https://github.com/${githubOwner}/${repoShort}`
				: `https://local/${repoShort}`;
			return {
				id,
				name,
				slug: repoShort,
				githubRepositoryId: null,
				githubOwner,
				githubRepoName: repoShort,
				createdAt: now,
				updatedAt: now,
				isCollapsed: false,
				children: children.map((c) => {
					if (c.type === "workspace")
						return {
							...c,
							workspace: {
								...c.workspace,
								projectId: id,
								repoUrl: c.workspace.repoUrl ?? derivedRepoUrl,
							},
						};
					return c;
				}),
			};
		};
		const prOpen = (
			n: number,
			title: string,
			repo = "superset-sh/superset",
		) => ({
			url: `https://github.com/${repo}/pull/${n}`,
			number: n,
			title,
			state: "open" as const,
			reviewDecision: "pending" as const,
			requestedReviewers: ["octocat", "monalisa"],
			checksStatus: "pending" as const,
			checks: mkChecks(["success", "pending", "pending"]),
		});
		const prApproved = (
			n: number,
			title: string,
			repo = "superset-sh/superset",
		) => ({
			url: `https://github.com/${repo}/pull/${n}`,
			number: n,
			title,
			state: "open" as const,
			reviewDecision: "approved" as const,
			checksStatus: "success" as const,
			checks: mkChecks(["success", "success", "success", "success"]),
		});
		const prDraft = (
			n: number,
			title: string,
			repo = "superset-sh/superset",
		) => ({
			url: `https://github.com/${repo}/pull/${n}`,
			number: n,
			title,
			state: "draft" as const,
			reviewDecision: null,
			checksStatus: "pending" as const,
			checks: mkChecks(["pending", "pending"]),
		});
		const prMerged = (
			n: number,
			title: string,
			repo = "superset-sh/superset",
		) => ({
			url: `https://github.com/${repo}/pull/${n}`,
			number: n,
			title,
			state: "merged" as const,
			reviewDecision: "approved" as const,
			checksStatus: "success" as const,
			checks: mkChecks(["success", "success", "success"]),
		});
		const prClosed = (
			n: number,
			title: string,
			repo = "superset-sh/superset",
		) => ({
			url: `https://github.com/${repo}/pull/${n}`,
			number: n,
			title,
			state: "closed" as const,
			reviewDecision: null,
			checksStatus: "none" as const,
			checks: [],
		});
		const withRepo = (
			ws: DashboardSidebarWorkspace,
			owner: string,
			repo: string,
			previewUrl?: string,
		): DashboardSidebarWorkspace => ({
			...ws,
			repoUrl: `https://github.com/${owner}/${repo}`,
			previewUrl: previewUrl ?? null,
		});
		return [
			mkProject("p-superset", "superset", "superset-sh", [
				{
					type: "workspace",
					workspace: withRepo(
						mkWs(
							"w-1",
							"mcp device presence heartbeat",
							"fix/mcp-device-presence-heartbeat",
							{
								pullRequest: prOpen(
									3475,
									"fix(mcp): restore lightweight device presence heartbeat",
								),
							},
							2,
						),
						"superset-sh",
						"superset",
					),
				},
				{
					type: "workspace",
					workspace: withRepo(
						mkWs(
							"w-2",
							"v2 sidebar conductor style",
							"demo/conductor-style-sidebar",
							{
								pullRequest: prDraft(
									3476,
									"feat(desktop): cleaner conductor-style v2 sidebar",
								),
								needsRebase: true,
								behindCount: 3,
							},
							1,
						),
						"superset-sh",
						"superset",
						"https://pr-3476.preview.superset.sh",
					),
				},
				{
					type: "workspace",
					workspace: withRepo(
						mkWs(
							"w-3",
							"Group by PR status",
							"feat/sidebar-group-by-status",
							{
								pullRequest: prApproved(
									3470,
									"feat(desktop): group v2 sidebar by PR status",
								),
							},
							5,
						),
						"superset-sh",
						"superset",
						"https://pr-3470.preview.superset.sh",
					),
				},
				{
					type: "workspace",
					workspace: withRepo(
						mkWs(
							"w-4",
							"Hide dotfiles toggle",
							"feat/hide-dotfiles",
							{
								pullRequest: prMerged(
									3450,
									"feat(desktop): hide-dotfiles toggle in file tree",
								),
							},
							10,
						),
						"superset-sh",
						"superset",
					),
				},
				{
					type: "workspace",
					workspace: withRepo(
						mkWs(
							"w-5",
							"Right sidebar polish",
							"feat/right-sidebar-polish",
							{
								pullRequest: prClosed(
									3420,
									"feat(desktop): polish right sidebar tabs",
								),
							},
							15,
						),
						"superset-sh",
						"superset",
					),
				},
			]),
			mkProject("p-parlo", "parlo", null, [
				{
					type: "workspace",
					workspace: mkWs(
						"w-6",
						"Onboarding flow redesign",
						"feat/onboarding",
						{
							pullRequest: prOpen(42, "Onboarding flow redesign"),
						},
					),
				},
				{
					type: "workspace",
					workspace: mkWs("w-7", "Product checkout", "feat/checkout", {
						pullRequest: prDraft(44, "Checkout v2"),
					}),
				},
				{
					type: "workspace",
					workspace: mkWs("w-8", "Fix payment webhook", "fix/stripe-webhook", {
						pullRequest: prMerged(40, "Stripe webhook fix"),
					}),
				},
			]),
			mkProject("p-chapchap", "chapchap", null, [
				{
					type: "workspace",
					workspace: mkWs("w-9", "New landing page", "feat/landing", {
						pullRequest: prOpen(18, "New landing page"),
					}),
				},
				{
					type: "workspace",
					workspace: mkWs("w-10", "SEO meta tags", "chore/seo", {
						pullRequest: prMerged(17, "SEO meta tags"),
					}),
				},
			]),
			mkProject("p-alumnai", "alumnai", null, [
				{
					type: "workspace",
					workspace: mkWs("w-11", "Dashboard metrics", "feat/metrics", {
						pullRequest: prApproved(91, "Dashboard metrics"),
					}),
				},
				{
					type: "workspace",
					workspace: mkWs("w-12", "Email digest", "feat/digest", {
						pullRequest: prDraft(92, "Weekly email digest"),
					}),
				},
				{
					type: "workspace",
					workspace: mkWs("w-13", "Auth refactor", "refactor/auth", {
						pullRequest: prMerged(88, "Auth refactor"),
					}),
				},
			]),
			mkProject("p-marketing", "marketing", null, [
				{
					type: "workspace",
					workspace: mkWs("w-14", "Compare pages", "feat/compare", {
						pullRequest: prOpen(7, "Compare pages"),
					}),
				},
			]),
			mkProject("p-highlife", "highlife", null, [
				{
					type: "workspace",
					workspace: mkWs("w-15", "Map rendering perf", "perf/map", {
						pullRequest: prMerged(23, "Map rendering"),
					}),
				},
			]),
			mkProject("p-mailchiore", "Mailchiore", null, [
				{
					type: "workspace",
					workspace: mkWs("w-16", "Template editor", "feat/editor"),
				},
			]),
		];
	}, []);

	const rawBaseGroups = env.SKIP_ENV_VALIDATION ? demoGroups : groups;

	const groupingMode = useV2SidebarGroupingStore((s) => s.mode);
	const hiddenStatuses = useV2SidebarGroupingStore((s) => s.hiddenStatuses);
	const hiddenProjectIds = useV2SidebarGroupingStore((s) => s.hiddenProjectIds);

	const baseGroups = useMemo(() => {
		const hidden = new Set(hiddenProjectIds);
		return rawBaseGroups.filter((p) => !hidden.has(p.id));
	}, [rawBaseGroups, hiddenProjectIds]);

	// Pivot: regroup workspaces by PR status instead of project
	const statusGroups = useMemo<DashboardSidebarProject[]>(() => {
		if (groupingMode !== "status") return [];
		type Bucket =
			| "in-progress"
			| "in-review"
			| "ready-to-merge"
			| "done"
			| "canceled"
			| "backlog";
		const bucketOrder: Bucket[] = [
			"in-progress",
			"in-review",
			"ready-to-merge",
			"done",
			"canceled",
			"backlog",
		];
		const bucketLabel: Record<Bucket, string> = {
			"in-progress": "In progress",
			"in-review": "In review",
			"ready-to-merge": "Ready to merge",
			done: "Done",
			canceled: "Canceled",
			backlog: "Backlog",
		};
		const bucketOf = (ws: DashboardSidebarWorkspace): Bucket => {
			const pr = ws.pullRequest;
			if (!pr) return "backlog";
			if (pr.state === "merged") return "done";
			if (pr.state === "closed") return "canceled";
			if (pr.state === "draft") return "in-progress";
			if (pr.reviewDecision === "approved") return "ready-to-merge";
			return "in-review";
		};
		const buckets = new Map<Bucket, DashboardSidebarWorkspace[]>();
		for (const b of bucketOrder) buckets.set(b, []);
		for (const project of baseGroups) {
			for (const child of project.children) {
				if (child.type !== "workspace") continue;
				buckets.get(bucketOf(child.workspace))?.push(child.workspace);
			}
		}
		const now = new Date();
		const hidden = new Set(hiddenStatuses);
		return bucketOrder
			.filter((b) => !hidden.has(b))
			.map<DashboardSidebarProject>((b) => ({
				id: `status-${b}`,
				name: bucketLabel[b],
				slug: b,
				githubRepositoryId: null,
				githubOwner: null,
				githubRepoName: null,
				createdAt: now,
				updatedAt: now,
				isCollapsed: false,
				statusBucket: b,
				children: (buckets.get(b) ?? []).map<DashboardSidebarProjectChild>(
					(ws) => ({ type: "workspace", workspace: ws }),
				),
			}))
			.filter((g) => g.children.length > 0);
	}, [baseGroups, groupingMode, hiddenStatuses]);

	const effectiveGroups = groupingMode === "status" ? statusGroups : baseGroups;

	return {
		groups: effectiveGroups,
		availableProjects: rawBaseGroups,
		refetchPullRequests,
		refreshWorkspacePullRequest,
		toggleProjectCollapsed,
	};
}
