#!/usr/bin/env bun

import type { Casing } from "./internal/validations/common";
import { introspectPostgres } from "./introspect";
import { drizzleConfigFromFile } from "./utils";

const conf = await drizzleConfigFromFile();
const casingConv: Casing = conf.casing === "snake_case" ? "preserve" : "camel";
let schemaFilter: string[] = [];
if (typeof conf.schemaFilter === "string") {
	schemaFilter = [conf.schemaFilter];
} else {
	schemaFilter = conf.schemaFilter;
}
await introspectPostgres(
	casingConv,
	conf.out || "./db",
	conf.breakpoints,
	conf.dbCredentials,
	conf.tablesFilter && typeof conf.tablesFilter === "string"
		? [conf.tablesFilter]
		: [],
	schemaFilter,
	"none",
	undefined,
);
