import {
	boolean,
	coerce,
	literal,
	object,
	string,
	undefined,
	union,
} from "zod";
import type { TypeOf } from "zod";

export const postgresCredentials = union([
	object({
		driver: undefined(),
		host: string().min(1),
		port: coerce.number().min(1).optional(),
		user: string().min(1).optional(),
		password: string().min(1).optional(),
		database: string().min(1),
		ssl: union([
			literal("require"),
			literal("allow"),
			literal("prefer"),
			literal("verify-full"),
			boolean(),
			object({}).passthrough(),
		]).optional(),
	}).transform((o) => {
		delete o.driver;
		return o as Omit<typeof o, "driver">;
	}),
	object({
		driver: undefined(),
		url: string().min(1),
	}).transform<{ url: string }>((o) => {
		delete o.driver;
		return o;
	}),
	object({
		driver: literal("aws-data-api"),
		database: string().min(1),
		secretArn: string().min(1),
		resourceArn: string().min(1),
	}),
	object({
		driver: literal("pglite"),
		url: string().min(1),
	}),
]);

export type PostgresCredentials = TypeOf<typeof postgresCredentials>;
