import { Minimatch } from "minimatch";
import { preparePostgresDB } from "./internal/connections";
import type { Entities } from "./internal/validations/cli";
import type { Casing, Prefix } from "./internal/validations/common";
import type { PostgresCredentials } from "./internal/validations/postgres";
import { IntrospectProgress } from "./cli/views";
import { renderWithTask } from "hanji";
import { fromDatabase } from "./internal/pg_serializer";
import type { PgSchema } from "./internal/schemas/pgSchema";
import { assertUnreachable, originUUID } from "./internal/global";
import { paramNameFor, schemaToTypeScript } from "./internal/pg_introspection";
import { plural, singular } from "pluralize";
import { join, resolve } from "node:path";
import { mkdirSync, writeFileSync } from "fs";
import "./@types/utils";

const withCasing = (value: string, casing: Casing) => {
	if (casing === "preserve") {
		return value;
	}
	if (casing === "camel") {
		return value.camelCase();
	}

	assertUnreachable(casing);
};

export const relationsToTypeScript = (
	schema: {
		tables: Record<
			string,
			{
				schema?: string;
				foreignKeys: Record<
					string,
					{
						name: string;
						tableFrom: string;
						columnsFrom: string[];
						tableTo: string;
						schemaTo?: string;
						columnsTo: string[];
						onUpdate?: string | undefined;
						onDelete?: string | undefined;
					}
				>;
			}
		>;
	},
	casing: Casing,
) => {
	const imports: string[] = [];
	const tableRelations: Record<
		string,
		{
			name: string;
			type: "one" | "many";
			tableFrom: string;
			schemaFrom?: string;
			columnFrom: string;
			tableTo: string;
			schemaTo?: string;
			columnTo: string;
			relationName?: string;
		}[]
	> = {};

	Object.values(schema.tables).forEach((table) => {
		Object.values(table.foreignKeys).forEach((fk) => {
			const tableNameFrom = paramNameFor(fk.tableFrom, table.schema);
			const tableNameTo = paramNameFor(fk.tableTo, fk.schemaTo);
			const tableFrom = withCasing(tableNameFrom.replace(/:+/g, ""), casing);
			const tableTo = withCasing(tableNameTo.replace(/:+/g, ""), casing);
			const columnFrom = withCasing(fk.columnsFrom[0] || "", casing);
			const columnTo = withCasing(fk.columnsTo[0] || "", casing);

			imports.push(tableTo, tableFrom);

			// const keyFrom = `${schemaFrom}.${tableFrom}`;
			const keyFrom = tableFrom;

			if (!tableRelations[keyFrom]) {
				tableRelations[keyFrom] = [];
			}

			tableRelations[keyFrom].push({
				name: singular(tableTo),
				type: "one",
				tableFrom,
				columnFrom,
				tableTo,
				columnTo,
			});

			// const keyTo = `${schemaTo}.${tableTo}`;
			const keyTo = tableTo;

			if (!tableRelations[keyTo]) {
				tableRelations[keyTo] = [];
			}

			tableRelations[keyTo].push({
				name: plural(tableFrom),
				type: "many",
				tableFrom: tableTo,
				columnFrom: columnTo,
				tableTo: tableFrom,
				columnTo: columnFrom,
			});
		});
	});

	const uniqueImports = [...new Set(imports)];

	const importsTs = `import { relations } from "drizzle-orm/relations";\nimport { ${uniqueImports.join(
		", ",
	)} } from "./schema";\n\n`;

	const relationStatements = Object.entries(tableRelations).map(
		([table, relations]) => {
			const hasOne = relations.some((it) => it.type === "one");
			const hasMany = relations.some((it) => it.type === "many");

			// * change relation names if they are duplicated or if there are multiple relations between two tables
			const preparedRelations = relations.map(
				(relation, relationIndex, originArray) => {
					let name = relation.name;
					let relationName;
					const hasMultipleRelations = originArray.some(
						(it, originIndex) =>
							relationIndex !== originIndex && it.tableTo === relation.tableTo,
					);
					if (hasMultipleRelations) {
						relationName =
							relation.type === "one"
								? `${relation.tableFrom}_${relation.columnFrom}_${relation.tableTo}_${relation.columnTo}`
								: `${relation.tableTo}_${relation.columnTo}_${relation.tableFrom}_${relation.columnFrom}`;
					}
					const hasDuplicatedRelation = originArray.some(
						(it, originIndex) =>
							relationIndex !== originIndex && it.name === relation.name,
					);
					if (hasDuplicatedRelation) {
						name = `${relation.name}_${relation.type === "one" ? relation.columnFrom : relation.columnTo}`;
					}
					return {
						...relation,
						name,
						relationName,
					};
				},
			);

			const fields = preparedRelations.map((relation) => {
				if (relation.type === "one") {
					return `\t${relation.name}: one(${relation.tableTo}, {\n\t\tfields: [${relation.tableFrom}.${relation.columnFrom}],\n\t\treferences: [${relation.tableTo}.${relation.columnTo}]${
						relation.relationName
							? `,\n\t\trelationName: "${relation.relationName}"`
							: ""
					}\n\t}),`;
				} else {
					return `\t${relation.name}: many(${relation.tableTo}${
						relation.relationName
							? `, {\n\t\trelationName: "${relation.relationName}"\n\t}`
							: ""
					}),`;
				}
			});

			return `export const ${table}Relations = relations(${table}, ({${hasOne ? "one" : ""}${
				hasOne && hasMany ? ", " : ""
			}${hasMany ? "many" : ""}}) => ({\n${fields.join("\n")}\n}));`;
		},
	);

	return {
		file: importsTs + relationStatements.join("\n\n"),
	};
};

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
	const ts = schemaToTypeScript(schema, casing);
	const relationsTs = relationsToTypeScript(schema, casing);
	const { internal, ...schemaWithoutInternals } = schema;
	// try {
	// 	mkdirSync(out, {
	// 		recursive: true,
	// 	});
	// } catch {}

	const schemaFile = join(import.meta.dir, out, "schema.ts");
	console.log("Writting to: ", schemaFile);
	await Bun.write(schemaFile, ts.file, {
		createPath: true,
	});
	const relationsFile = join(import.meta.dir, out, "relations.ts");
	await Bun.write(relationsFile, relationsTs.file, {
		createPath: true,
	});
	// console.log();
}
