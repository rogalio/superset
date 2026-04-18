import {
	CircleDot,
	GitMerge,
	GitPullRequest,
	GitPullRequestClosed,
	GitPullRequestDraft,
} from "lucide-react";
import { useMemo, useState } from "react";
import type {
	DashboardSidebarProject,
	DashboardSidebarWorkspace,
} from "../../types";
import { PullRequestStatusIcon } from "../DashboardSidebarWorkspaceItem/components/DashboardSidebarWorkspaceIcon/components/PullRequestStatusIcon";

interface StatusGroup {
	key: string;
	label: string;
	icon: React.ReactNode;
	workspaces: Array<{
		workspace: DashboardSidebarWorkspace;
		projectLabel: string;
	}>;
}

function getStatusKey(workspace: DashboardSidebarWorkspace): string {
	const pr = workspace.pullRequest;
	if (!pr) return "no-pr";
	if (pr.state === "merged") return "merged";
	if (pr.state === "closed") return "closed";
	if (pr.state === "draft") return "draft";
	if (pr.reviewDecision === "approved") return "approved";
	if (pr.reviewDecision === "changes_requested") return "changes-requested";
	return "in-review";
}

const STATUS_CONFIG: Record<
	string,
	{ label: string; icon: React.ReactNode; order: number }
> = {
	"in-review": {
		label: "In Review",
		icon: (
			<GitPullRequest className="size-3.5 text-sky-400/70" strokeWidth={1.75} />
		),
		order: 0,
	},
	"changes-requested": {
		label: "Changes Requested",
		icon: (
			<GitPullRequest
				className="size-3.5 text-amber-400/80"
				strokeWidth={1.75}
			/>
		),
		order: 1,
	},
	approved: {
		label: "Ready to Merge",
		icon: (
			<GitPullRequest
				className="size-3.5 text-emerald-400/80"
				strokeWidth={1.75}
			/>
		),
		order: 2,
	},
	merged: {
		label: "Merged",
		icon: (
			<GitMerge className="size-3.5 text-violet-400/80" strokeWidth={1.75} />
		),
		order: 3,
	},
	draft: {
		label: "Draft",
		icon: (
			<GitPullRequestDraft
				className="size-3.5 text-muted-foreground/70"
				strokeWidth={1.75}
			/>
		),
		order: 4,
	},
	closed: {
		label: "Closed",
		icon: (
			<GitPullRequestClosed
				className="size-3.5 text-rose-400/70"
				strokeWidth={1.75}
			/>
		),
		order: 5,
	},
	"no-pr": {
		label: "No Pull Request",
		icon: (
			<CircleDot
				className="size-3.5 text-muted-foreground/50"
				strokeWidth={1.75}
			/>
		),
		order: 6,
	},
};

interface DashboardSidebarStatusGroupsProps {
	groups: DashboardSidebarProject[];
}

export function DashboardSidebarStatusGroups({
	groups,
}: DashboardSidebarStatusGroupsProps) {
	const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
		new Set(),
	);

	const statusGroups = useMemo<StatusGroup[]>(() => {
		const grouped = new Map<
			string,
			Array<{ workspace: DashboardSidebarWorkspace; projectLabel: string }>
		>();

		for (const project of groups) {
			const projectLabel = project.githubOwner
				? `${project.githubOwner}/${project.githubRepoName}`
				: project.name;

			for (const child of project.children) {
				if (child.type !== "workspace") continue;
				const key = getStatusKey(child.workspace);
				if (!grouped.has(key)) grouped.set(key, []);
				grouped.get(key)?.push({
					workspace: child.workspace,
					projectLabel,
				});
			}
		}

		return Array.from(grouped.entries())
			.map(([key, workspaces]) => ({
				key,
				label: STATUS_CONFIG[key]?.label ?? key,
				icon: STATUS_CONFIG[key]?.icon ?? null,
				workspaces,
			}))
			.sort(
				(a, b) =>
					(STATUS_CONFIG[a.key]?.order ?? 99) -
					(STATUS_CONFIG[b.key]?.order ?? 99),
			);
	}, [groups]);

	const toggleGroup = (key: string) => {
		setCollapsedGroups((prev) => {
			const next = new Set(prev);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	};

	return (
		<div className="flex flex-col gap-1 px-1">
			{statusGroups.map((group) => {
				const isCollapsed = collapsedGroups.has(group.key);
				return (
					<div key={group.key}>
						<button
							type="button"
							onClick={() => toggleGroup(group.key)}
							className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground/70 hover:bg-accent/30 transition-colors"
						>
							{group.icon}
							<span className="flex-1 text-left">{group.label}</span>
							<span className="text-[10px] tabular-nums text-muted-foreground/50">
								{group.workspaces.length}
							</span>
						</button>

						{!isCollapsed && (
							<div className="flex flex-col">
								{group.workspaces.map(({ workspace, projectLabel }) => (
									<div
										key={workspace.id}
										className="flex items-center gap-2 rounded-md px-3 py-1 ml-2 text-sm text-foreground/80 hover:bg-accent/30 cursor-pointer transition-colors"
									>
										{workspace.pullRequest && (
											<PullRequestStatusIcon
												pr={workspace.pullRequest}
												className="size-3.5 shrink-0"
											/>
										)}
										{!workspace.pullRequest && (
											<CircleDot
												className="size-3.5 shrink-0 text-muted-foreground/50"
												strokeWidth={1.75}
											/>
										)}
										<div className="flex flex-col min-w-0">
											<span className="truncate">{workspace.name}</span>
											<span className="text-[10px] text-muted-foreground/50 truncate">
												{projectLabel}
											</span>
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}
