#!/usr/bin/env bun

import { drizzleConfigFromFile } from "./utils";

const conf = await drizzleConfigFromFile();
console.log(conf);
