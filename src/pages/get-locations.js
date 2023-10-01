/**
 * Sample of using a PlanetScale database. Probably best choice for
 * CloudFlare, Netlify, and Vercel. Not a good choice if not using
 * a PlanetScale database.
 */

import {connect} from "@planetscale/database";

export async function GET({params, request}) {
	const env = import.meta.env;
	const config = {
		host: env.DATABASE_HOST,
		username: env.DATABASE_USERNAME,
		password: env.DATABASE_PASSWORD,
	};

	const conn = await connect(config);

	const results = await conn.execute('SELECT * FROM locations WHERE user_token = ?', ["GRc202d76ce7dd7724a8182b3ab7ab5b"]);

	return new Response(JSON.stringify(results.rows));
}
