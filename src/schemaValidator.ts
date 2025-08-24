import { enum as enumType, union } from "zod";

export const dialects = [
	"postgresql",
	"mysql",
	"sqlite",
	"turso",
	"singlestore",
	"gel",
] as const;
export const dialect = enumType(dialects);
