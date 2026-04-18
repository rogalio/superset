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
	return pr.state;
}

const STROKE_WIDTH = 1.75;

const STATUS_CONFIG: Record<
	string,
	{ label: string; icon: React.ReactNode; order: number }
> = {
	open: {
		label: "Open",
		icon: (
			<GitPullRequest
				className="size-3.5 text-emerald-400/80"
				strokeWidth={STROKE_WIDTH}
			/>
		),
		order: 0,
	},
	draft: {
		label: "Draft",
		icon: (
			<GitPullRequestDraft
				className="size-3.5 text-muted-foreground/70"
				strokeWidth={STROKE_WIDTH}
			/>
		),
		order: 1,
	},
	merged: {
		label: "Merged",
		icon: (
			<GitMerge
				className="size-3.5 text-violet-400/80"
				strokeWidth={STROKE_WIDTH}
			/>
		),
		order: 2,
	},
	closed: {
		label: "Closed",
		icon: (
			<GitPullRequestClosed
				className="size-3.5 text-rose-400/70"
				strokeWidth={STROKE_WIDTH}
			/>
		),
		order: 3,
	},
	"no-pr": {
		label: "No Pull Request",
		icon: (
			<CircleDot
				className="size-3.5 text-muted-foreground/50"
				strokeWidth={STROKE_WIDTH}
			/>
		),
		order: 4,
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
										{workspace.pullRequest ? (
											<PullRequestStatusIcon
												pr={workspace.pullRequest}
												className="size-3.5 shrink-0"
											/>
										) : (
											<CircleDot
												className="size-3.5 shrink-0 text-muted-foreground/50"
												strokeWidth={STROKE_WIDTH}
											/>
										)}
										<div className="flex min-w-0 flex-col">
											<span className="truncate">{workspace.name}</span>
											<span className="truncate text-[10px] text-muted-foreground/50">
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
