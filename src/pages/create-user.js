import {connect} from "@planetscale/database";
import crypto from "crypto";

function validateEmail(email) {
	if (!email || typeof email !== "string" || email.length < 6) {
		return false;
	}

	const validRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;

	return !!email.match(validRegex);
}

export const POST = async ({ request }) => {
	if (request.headers.get("Content-Type") !== "application/json") {
		return new Response(JSON.stringify({success: false}), { status: 400 });
	}

	let sql;

	const data = await request.json();
	let {email} = data;

	// Connect to database
	const env = import.meta.env;
	const config = {
		host: env.DATABASE_HOST,
		username: env.DATABASE_USERNAME,
		password: env.DATABASE_PASSWORD,
	};

	const conn = await connect(config);

	try {
		// Valid email - basic check?
		if (!validateEmail(email)) {
			return new Response(JSON.stringify({success: false, message: "Invalid email"}), { status: 400 });
		}

		sql = `SELECT * FROM users WHERE email = ?`;
		const users = await conn.execute(sql, [email]);
		if (users.rows.length > 0) {
			return new Response(JSON.stringify({success: false, message: "Invalid email, already in use."}), { status: 400 });
		}

		// Create user
		const token = "GR" + crypto.randomBytes(15).toString('hex');
		sql = `
			INSERT INTO users
			SET
				user_token = ?,
				email = ?,
				request_count = 1,
				last_request_at = NOW(),
				created_at = NOW()
		`;
		await conn.execute(sql, [token, email]);

		return new Response(JSON.stringify({success: true, ...data}), {status: 200});
	} catch (ex) {
		console.log(ex);
		return new Response(JSON.stringify({success: false}), { status: 400 });
	}
}
