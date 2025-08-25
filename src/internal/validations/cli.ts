import {
	array,
	boolean,
	intersection,
	literal,
	object,
	string,
	union,
} from "zod";
import type { TypeOf } from "zod";
import { dialect } from "../../schemaValidator";
import { casing, prefix } from "./common";

export const pullParams = object({
	config: string().optional(),
	dialect: dialect,
	out: string().optional().default("drizzle"),
	tablesFilter: union([string(), string().array()]).optional(),
	schemaFilter: union([string(), string().array()])
		.optional()
		.default(["public"]),
	extensionsFilters: literal("postgis").array().optional(),
	casing,
	breakpoints: boolean().optional().default(true),
	migrations: object({
		prefix: prefix.optional().default("index"),
	}).optional(),
	entities: object({
		roles: boolean()
			.or(
				object({
					provider: string().optional(),
					include: string().array().optional(),
					exclude: string().array().optional(),
				}),
			)
			.optional()
			.default(false),
	}).optional(),
}).passthrough();

export type Entities = TypeOf<typeof pullParams>["entities"];
