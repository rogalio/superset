import { Checkbox } from "@superset/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@superset/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@superset/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@superset/ui/tooltip";
import { cn } from "@superset/ui/utils";
import {
	ChevronDown,
	CircleCheck,
	CircleDashed,
	CircleDot,
	CircleDotDashed,
	CircleX,
} from "lucide-react";
import { useMemo, useState } from "react";
import { LuListFilter } from "react-icons/lu";
import {
	ALL_STATUS_BUCKETS,
	useV2SidebarGroupingStore,
	type V2SidebarStatusBucket,
} from "renderer/stores/v2-sidebar-grouping";
import type { DashboardSidebarProject } from "../../../../types";

const STATUS_META: Record<
	V2SidebarStatusBucket,
	{
		label: string;
		icon: React.ComponentType<{ className?: string }>;
		color: string;
	}
> = {
	"in-progress": {
		label: "In progress",
		icon: CircleDotDashed,
		color: "text-amber-400/80",
	},
	"in-review": {
		label: "In review",
		icon: CircleDot,
		color: "text-emerald-400/80",
	},
	"ready-to-merge": {
		label: "Ready to merge",
		icon: CircleCheck,
		color: "text-emerald-400/80",
	},
	done: { label: "Done", icon: CircleCheck, color: "text-violet-400/70" },
	canceled: {
		label: "Canceled",
		icon: CircleX,
		color: "text-muted-foreground/50",
	},
	backlog: {
		label: "Backlog",
		icon: CircleDashed,
		color: "text-muted-foreground/50",
	},
};

interface SidebarGroupingPopoverProps {
	/** Raw project list (before filtering) so the repo list shows all available repos */
	availableProjects: DashboardSidebarProject[];
}

export function SidebarGroupingPopover({
	availableProjects,
}: SidebarGroupingPopoverProps) {
	const mode = useV2SidebarGroupingStore((s) => s.mode);
	const setMode = useV2SidebarGroupingStore((s) => s.setMode);
	const hiddenStatuses = useV2SidebarGroupingStore((s) => s.hiddenStatuses);
	const toggleStatus = useV2SidebarGroupingStore((s) => s.toggleStatus);
	const resetHiddenStatuses = useV2SidebarGroupingStore(
		(s) => s.resetHiddenStatuses,
	);
	const hiddenProjectIds = useV2SidebarGroupingStore((s) => s.hiddenProjectIds);
	const toggleProjectId = useV2SidebarGroupingStore((s) => s.toggleProjectId);
	const resetHiddenProjects = useV2SidebarGroupingStore(
		(s) => s.resetHiddenProjects,
	);

	const sortedProjects = useMemo(
		() => [...availableProjects].sort((a, b) => a.name.localeCompare(b.name)),
		[availableProjects],
	);

	// Expand repos section automatically when there are active repo filters
	const [reposExpanded, setReposExpanded] = useState(
		() => hiddenProjectIds.length > 0,
	);

	const totalFilters = hiddenStatuses.length + hiddenProjectIds.length;

	return (
		<Popover>
			<Tooltip delayDuration={300}>
				<TooltipTrigger asChild>
					<PopoverTrigger asChild>
						<button
							type="button"
							className="relative flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
							aria-label="Grouping & filters"
						>
							<LuListFilter className="size-4" />
							{totalFilters > 0 && (
								<span className="absolute -top-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-medium text-primary-foreground">
									{totalFilters}
								</span>
							)}
						</button>
					</PopoverTrigger>
				</TooltipTrigger>
				<TooltipContent side="right">Grouping & filters</TooltipContent>
			</Tooltip>
			<PopoverContent
				side="right"
				align="start"
				className="w-56 p-0"
				sideOffset={8}
			>
				{/* GROUP BY — compact segmented */}
				<div className="border-b border-border px-2.5 py-1.5">
					<div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
						Group by
					</div>
					<ToggleGroup
						type="single"
						value={mode}
						onValueChange={(v) => v && setMode(v as typeof mode)}
						className="grid w-full grid-cols-2 gap-0 rounded bg-muted/40 p-0.5"
					>
						<ToggleGroupItem
							value="project"
							size="sm"
							className="h-5 rounded-sm px-2 text-[11px] font-medium data-[state=on]:bg-background data-[state=on]:shadow-sm"
						>
							Project
						</ToggleGroupItem>
						<ToggleGroupItem
							value="status"
							size="sm"
							className="h-5 rounded-sm px-2 text-[11px] font-medium data-[state=on]:bg-background data-[state=on]:shadow-sm"
						>
							Status
						</ToggleGroupItem>
					</ToggleGroup>
				</div>

				{/* REPO FILTER — collapsible */}
				{sortedProjects.length > 0 && (
					<div className="border-b border-border">
						<button
							type="button"
							onClick={() => setReposExpanded((x) => !x)}
							className="flex h-8 w-full items-center gap-2 px-2.5 text-left transition-colors hover:bg-accent/40"
						>
							<ChevronDown
								className={cn(
									"size-3 shrink-0 text-muted-foreground/70 transition-transform duration-150",
									!reposExpanded && "-rotate-90",
								)}
							/>
							<span className="text-[12px] font-medium text-foreground/80">
								Filter repos
							</span>
							<span className="ml-auto text-[11px] text-muted-foreground/70">
								{hiddenProjectIds.length > 0
									? `${sortedProjects.length - hiddenProjectIds.length}/${sortedProjects.length}`
									: "all"}
							</span>
						</button>
						{reposExpanded && (
							<div className="px-2.5 pb-1.5">
								{hiddenProjectIds.length > 0 && (
									<div className="mb-1 flex justify-end">
										<button
											type="button"
											onClick={resetHiddenProjects}
											className="text-[10px] text-muted-foreground/70 hover:text-foreground"
										>
											Reset
										</button>
									</div>
								)}
								<div className="flex max-h-40 flex-col overflow-y-auto">
									{sortedProjects.map((project) => {
										const checked = !hiddenProjectIds.includes(project.id);
										const label = project.githubOwner
											? `${project.githubOwner}/${project.githubRepoName ?? project.name.toLowerCase()}`
											: project.name;
										return (
											// biome-ignore lint/a11y/noLabelWithoutControl: Checkbox is inside label
											<label
												key={project.id}
												className="flex h-7 cursor-pointer items-center gap-2 rounded px-1.5 text-[13px] hover:bg-accent/40"
											>
												<Checkbox
													checked={checked}
													onCheckedChange={() => toggleProjectId(project.id)}
												/>
												<span className="flex-1 truncate lowercase text-foreground/75">
													{label}
												</span>
											</label>
										);
									})}
								</div>
							</div>
						)}
					</div>
				)}

				{/* STATUS FILTER — only in status mode */}
				{mode === "status" && (
					<div className="px-2.5 py-1.5">
						<div className="mb-1 flex items-center justify-between">
							<div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
								Statuses
							</div>
							{hiddenStatuses.length > 0 && (
								<button
									type="button"
									onClick={resetHiddenStatuses}
									className="text-[10px] text-muted-foreground/70 hover:text-foreground"
								>
									Reset
								</button>
							)}
						</div>
						<div className="flex flex-col">
							{ALL_STATUS_BUCKETS.map((status) => {
								const meta = STATUS_META[status];
								const Icon = meta.icon;
								const checked = !hiddenStatuses.includes(status);
								return (
									// biome-ignore lint/a11y/noLabelWithoutControl: Checkbox is inside label
									<label
										key={status}
										className="flex h-7 cursor-pointer items-center gap-2 rounded px-1.5 text-[13px] hover:bg-accent/40"
									>
										<Checkbox
											checked={checked}
											onCheckedChange={() => toggleStatus(status)}
										/>
										<Icon className={cn("size-3.5 shrink-0", meta.color)} />
										<span className="flex-1 text-foreground/80">
											{meta.label}
										</span>
									</label>
								);
							})}
						</div>
					</div>
				)}
			</PopoverContent>
		</Popover>
	);
}
