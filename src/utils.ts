import chalk from "chalk";

import { join, resolve } from "path";
import {
	configCommonSchema,
	type CliConfig,
} from "./internal/validations/common";
import { existsSync } from "fs";

export type DB = {
	query: <T extends any = any>(sql: string, params?: any[]) => Promise<T[]>;
};

export function escapeSingleQuotes(str: string) {
	return str.replace(/'/g, "''");
}

export function isPgArrayType(sqlType: string) {
	return sqlType.match(/.*\[\d*\].*|.*\[\].*/g) !== null;
}
export type ProxyParams = {
	sql: string;
	params?: any[];
	typings?: any[];
	mode: "array" | "object";
	method: "values" | "get" | "all" | "run" | "execute";
};
export type Proxy = (params: ProxyParams) => Promise<any[]>;
export type TransactionProxy = (
	queries: { sql: string; method?: ProxyParams["method"] }[],
) => Promise<any[]>;

export function unescapeSingleQuotes(
	str: string,
	ignoreFirstAndLastChar: boolean = false,
): string {
	if (ignoreFirstAndLastChar && str.length >= 2) {
		// Process only the middle part of the string
		const firstChar = str[0];
		const lastChar = str[str.length - 1];
		const middlePart = str.slice(1, -1);

		// Replace escaped single quotes with unescaped single quotes in the middle part
		const unescapedMiddle = middlePart.replace(/\\'/g, "'");

		return firstChar + unescapedMiddle + lastChar;
	} else {
		// Process the entire string
		return str.replace(/\\'/g, "'");
	}
}

export const drizzleConfigFromFile = async (
	configPath?: string,
	isExport?: boolean,
): Promise<CliConfig> => {
	const prefix = process.env.TEST_CONFIG_PATH_PREFIX || "";

	const defaultTsConfigExists = existsSync(
		resolve(join(prefix, "drizzle.config.ts")),
	);
	const defaultJsConfigExists = existsSync(
		resolve(join(prefix, "drizzle.config.js")),
	);
	const defaultJsonConfigExists = existsSync(
		join(resolve("drizzle.config.json")),
	);

	const defaultConfigPath = defaultTsConfigExists
		? "drizzle.config.ts"
		: defaultJsConfigExists
			? "drizzle.config.js"
			: "drizzle.config.json";

	if (!configPath && !isExport) {
		console.log(
			chalk.gray(
				`No config path provided, using default '${defaultConfigPath}'`,
			),
		);
	}

	const path: string = resolve(join(prefix, configPath ?? defaultConfigPath));

	if (!existsSync(path)) {
		console.log(`${path} file does not exist`);
		process.exit(1);
	}

	if (!isExport) console.log(chalk.grey(`Reading config file '${path}'`));

	const { unregister } = await safeRegister();
	const required = require(`${path}`);
	const content = required.default ?? required;
	unregister();

	// --- get response and then check by each dialect independently
	const res = configCommonSchema.safeParse(content);
	if (!res.success) {
		console.log(res.error);
		if (!("dialect" in content)) {
			console.error("Please specify 'dialect' param in config file");
		}
		process.exit(1);
	}

	return res.data;
};

const assertES5 = async (unregister: () => void) => {
	try {
		require("./_es5.ts");
	} catch (e: any) {
		if ("errors" in e && Array.isArray(e.errors) && e.errors.length > 0) {
			const es5Error =
				(e.errors as any[]).filter((it) =>
					it.text?.includes(`("es5") is not supported yet`),
				).length > 0;
			if (es5Error) {
				console.error(
					`Please change compilerOptions.target from 'es5' to 'es6' or above in your tsconfig.json`,
				);
				process.exit(1);
			}
		}
		console.error(e);
		process.exit(1);
	}
};

export const safeRegister = async () => {
	const { register } = await import("esbuild-register/dist/node");
	let res: { unregister: () => void };
	try {
		res = register({
			format: "cjs",
			loader: "ts",
		});
	} catch {
		// tsx fallback
		res = {
			unregister: () => {},
		};
	}

	// has to be outside try catch to be able to run with tsx
	// await assertES5(res.unregister);
	return res;
};
