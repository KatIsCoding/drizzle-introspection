export type DB = {
	query: <T extends any = any>(sql: string, params?: any[]) => Promise<T[]>;
};

export function escapeSingleQuotes(str: string) {
	return str.replace(/'/g, "''");
}

export function isPgArrayType(sqlType: string) {
	return sqlType.match(/.*\[\d*\].*|.*\[\].*/g) !== null;
}
