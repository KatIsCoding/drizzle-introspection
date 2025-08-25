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
	ignoreFirstAndLastChar: boolean,
) {
	const regex = ignoreFirstAndLastChar ? /(?<!^)'(?!$)/g : /'/g;
	return str.replace(/''/g, "'").replace(regex, "\\'");
}
