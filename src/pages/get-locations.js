/**
 * Sample of using a PlanetScale database. Probably best choice for
 * CloudFlare, Netlify, and Vercel. Not a good choice if not using
 * a PlanetScale database.
 */

import {connect} from "@planetscale/database";

export async function GET({request}) {
	const url = new URL(request.url);
	const queryParams = new URLSearchParams(url.search);
	const token = queryParams.get("token");

	if (!token) {
		return new Response(JSON.stringify({success: false, message: "Invalid token"}), { status: 400 });
	}

	const env = import.meta.env;
	const config = {
		host: env.DATABASE_HOST,
		username: env.DATABASE_USERNAME,
		password: env.DATABASE_PASSWORD,
	};

	const conn = await connect(config);

	const results = await conn.execute('SELECT * FROM locations WHERE user_token = ?', [token]);

	return new Response(JSON.stringify(results.rows));
}
