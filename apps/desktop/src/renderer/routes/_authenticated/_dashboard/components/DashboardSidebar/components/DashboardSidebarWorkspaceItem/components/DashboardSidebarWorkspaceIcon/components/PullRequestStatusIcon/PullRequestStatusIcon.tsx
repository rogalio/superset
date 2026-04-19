import { cn } from "@superset/ui/utils";
import {
	GitMerge,
	GitPullRequest,
	GitPullRequestClosed,
	GitPullRequestDraft,
} from "lucide-react";
import type { DashboardSidebarWorkspacePullRequest } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/types";

interface PullRequestStatusIconProps {
	pr: DashboardSidebarWorkspacePullRequest;
	className?: string;
}

export function PullRequestStatusIcon({
	pr,
	className,
}: PullRequestStatusIconProps) {
	const baseClass = cn("size-4", className);
	const strokeWidth = 1.75;

	if (pr.state === "merged") {
		return (
			<GitMerge
				className={cn(baseClass, "text-violet-400/80")}
				strokeWidth={strokeWidth}
			/>
		);
	}
	if (pr.state === "closed") {
		return (
			<GitPullRequestClosed
				className={cn(baseClass, "text-rose-400/70")}
				strokeWidth={strokeWidth}
			/>
		);
	}
	if (pr.state === "draft") {
		return (
			<GitPullRequestDraft
				className={cn(baseClass, "text-amber-400/80")}
				strokeWidth={strokeWidth}
			/>
		);
	}
	const openColor = "text-emerald-400/80";
	return (
		<GitPullRequest
			className={cn(baseClass, openColor)}
			strokeWidth={strokeWidth}
		/>
	);
}
