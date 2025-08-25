import { Minimatch } from "minimatch";
import { preparePostgresDB } from "./internal/connections";
import type { Entities } from "./internal/validations/cli";
import type { Casing, Prefix } from "./internal/validations/common";
import type { PostgresCredentials } from "./internal/validations/postgres";
import { IntrospectProgress } from "./cli/views";
import { renderWithTask } from "hanji";
import { fromDatabase } from "./internal/pg_serializer";
import type { PgSchema } from "./internal/schemas/pgSchema";
import { originUUID } from "./internal/global";

export async function introspectPostgres(
	casing: Casing,
	out: string,
	breakpoints: boolean,
	credentials: PostgresCredentials,
	tablesFilter: string[],
	schemasFilter: string[],
	prefix: Prefix,
	entities: Entities,
) {
	const db = await preparePostgresDB(credentials);

	const matchers = tablesFilter.map((it) => {
		return new Minimatch(it);
	});

	const filter = (tableName: string) => {
		if (matchers.length === 0) return true;

		let flags: boolean[] = [];

		for (let matcher of matchers) {
			if (matcher.negate) {
				if (!matcher.match(tableName)) {
					flags.push(false);
				}
			}

			if (matcher.match(tableName)) {
				flags.push(true);
			}
		}

		if (flags.length > 0) {
			return flags.every(Boolean);
		}
		return false;
	};

	const progress = new IntrospectProgress(true);

	const res = await renderWithTask(
		progress,
		fromDatabase(
			db,
			filter,
			schemasFilter,
			entities,
			(stage, count, status) => {
				progress.update(stage, count, status);
			},
		),
	);

	const schema = { id: originUUID, prevId: "", ...res } as PgSchema;
	const ts = postgresSchemaToTypeScript(schema, casing);
	const relationsTs = relationsToTypeScript(schema, casing);
	const { internal, ...schemaWithoutInternals } = schema;
}
