import { TaskView } from "hanji";
import chalk from "chalk";

class Spinner {
	private offset: number = 0;
	private readonly iterator: () => void;

	constructor(private readonly frames: string[]) {
		this.iterator = () => {
			this.offset += 1;
			this.offset %= frames.length - 1;
		};
	}

	public tick = () => {
		this.iterator();
	};

	public value = () => {
		return this.frames[this.offset];
	};
}
type ValueOf<T> = T[keyof T];
export type IntrospectStatus = "fetching" | "done";
export type IntrospectStage =
	| "tables"
	| "columns"
	| "enums"
	| "indexes"
	| "policies"
	| "checks"
	| "fks"
	| "views";

type IntrospectState = {
	[key in IntrospectStage]: {
		count: number;
		name: string;
		status: IntrospectStatus;
	};
};

export class IntrospectProgress extends TaskView {
	private readonly spinner: Spinner = new Spinner("⣷⣯⣟⡿⢿⣻⣽⣾".split(""));
	private timeout: NodeJS.Timeout | undefined;

	private state: IntrospectState = {
		tables: {
			count: 0,
			name: "tables",
			status: "fetching",
		},
		columns: {
			count: 0,
			name: "columns",
			status: "fetching",
		},
		enums: {
			count: 0,
			name: "enums",
			status: "fetching",
		},
		indexes: {
			count: 0,
			name: "indexes",
			status: "fetching",
		},
		fks: {
			count: 0,
			name: "foreign keys",
			status: "fetching",
		},
		policies: {
			count: 0,
			name: "policies",
			status: "fetching",
		},
		checks: {
			count: 0,
			name: "check constraints",
			status: "fetching",
		},
		views: {
			count: 0,
			name: "views",
			status: "fetching",
		},
	};

	constructor(private readonly hasEnums: boolean = false) {
		super();
		this.timeout = setInterval(() => {
			this.spinner.tick();
			this.requestLayout();
		}, 128);

		this.on("detach", () => clearInterval(this.timeout));
	}

	public update(
		stage: IntrospectStage,
		count: number,
		status: IntrospectStatus,
	) {
		this.state[stage].count = count;
		this.state[stage].status = status;
		this.requestLayout();
	}

	private formatCount = (count: number) => {
		const width: number = Math.max.apply(
			null,
			Object.values(this.state).map((it) => it.count.toFixed(0).length),
		);

		return count.toFixed(0).padEnd(width, " ");
	};

	private statusText = (spinner: string, stage: ValueOf<IntrospectState>) => {
		const { name, count } = stage;
		const isDone = stage.status === "done";

		const prefix = isDone ? `[${chalk.green("✓")}]` : `[${spinner}]`;

		const formattedCount = this.formatCount(count);
		const suffix = isDone
			? `${formattedCount} ${name} fetched`
			: `${formattedCount} ${name} fetching`;

		return `${prefix} ${suffix}\n`;
	};

	render(): string {
		let info = "";
		const spin = this.spinner.value();
		if (!spin) {
			return info;
		}
		info += this.statusText(spin, this.state.tables);
		info += this.statusText(spin, this.state.columns);
		info += this.hasEnums ? this.statusText(spin, this.state.enums) : "";
		info += this.statusText(spin, this.state.indexes);
		info += this.statusText(spin, this.state.fks);
		info += this.statusText(spin, this.state.policies);
		info += this.statusText(spin, this.state.checks);
		info += this.statusText(spin, this.state.views);

		return info;
	}
}
