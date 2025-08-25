import type { MigrationConfig } from "drizzle-orm/migrator";
import { withStyle } from "../cli/validations/outputs";
import type { DB, Proxy, TransactionProxy } from "../utils";
import type { PostgresCredentials } from "./validations/postgres";

export const preparePostgresDB = async (
	credentials: PostgresCredentials,
): Promise<
	DB & {
		packageName: "postgres";
		proxy: Proxy;
		transactionProxy: TransactionProxy;
		migrate: (config: MigrationConfig) => Promise<void>;
	}
> => {
	if ("driver" in credentials) {
		const { driver } = credentials;

		console.log(
			withStyle.info(`Using 'postgres' driver for database querying`),
		);
		const postgres = await import("postgres");

		const { drizzle } = await import("drizzle-orm/postgres-js");
		const { migrate } = await import("drizzle-orm/postgres-js/migrator");

		const client =
			"url" in credentials
				? postgres.default(credentials.url, { max: 1 })
				: postgres.default({ ...credentials, max: 1 });

		const transparentParser = (val: any) => val;

		// Override postgres.js default date parsers: https://github.com/porsager/postgres/discussions/761
		for (const type of ["1184", "1082", "1083", "1114"]) {
			client.options.parsers[type as any] = transparentParser;
			client.options.serializers[type as any] = transparentParser;
		}
		client.options.serializers["114"] = transparentParser;
		client.options.serializers["3802"] = transparentParser;

		const db = drizzle(client);
		const migrateFn = async (config: MigrationConfig) => {
			return migrate(db, config);
		};

		const query = async (sql: string, params?: any[]) => {
			const result = await client.unsafe(sql, params ?? []);
			return result as any[];
		};

		const proxy: Proxy = async (params) => {
			if (params.mode === "array") {
				return await client.unsafe(params.sql, params.params).values();
			}
			return await client.unsafe(params.sql, params.params);
		};

		const transactionProxy: TransactionProxy = async (queries) => {
			const results: any[] = [];
			try {
				await client.begin(async (sql) => {
					for (const query of queries) {
						const result = await sql.unsafe(query.sql);
						results.push(result);
					}
				});
			} catch (error) {
				results.push(error as Error);
			}
			return results;
		};

		return {
			packageName: "postgres",
			query,
			proxy,
			transactionProxy,
			migrate: migrateFn,
		};
	}

	console.error(
		"To connect to Postgres database - please install 'postgres-js'.",
	);
	process.exit(1);
};
