import {connect} from "@planetscale/database";
import NodeGeocoder from "node-geocoder";


/**
 * Loop through all visited points and check if the provided
 * point is within in _distance_ range of those points.
 *
 * @param {number} Latitude
 * @param {number} Longitude
 * @param {number} Distance to check from point
 * @return {minLat: number, maxLat: number, minLng: number, maxLng: number} Minimum and Maximums of latitude and longitude
 */
function getBoundingBox(lat, lng, distance) {
	// Degrees change in 1 meter of latitude
	const m = 0.000008983152841195216;
	const dLat = distance * m;
	const dLng = dLat / Math.cos(lat * (Math.PI / 180));

	return {
		minLat: lat - dLat,
		maxLat: lat + dLat,
		minLng: lng - dLng,
		maxLng: lng + dLng,
	};
}

export const POST = async ({ request }) => {
	let sql, results;

	if (request.headers.get("Content-Type") !== "application/json") {
		return new Response(JSON.stringify({success: false}), { status: 400 });
	}

	const data = await request.json();
	let {token, lat, lng, map, game, round, type, location} = data;

	// Connect to database (TODO: Abstract away to server hook)
	const env = import.meta.env;
	const config = {
		host: env.DATABASE_HOST,
		username: env.DATABASE_USERNAME,
		password: env.DATABASE_PASSWORD,
	};

	try {
		// Valid user token?
		if (!token || typeof token !== "string" || token.length > 32) {
			return new Response(JSON.stringify({success: false, message: "Invalid token"}), { status: 400 });
		}

		// Valid latitude and longitude?
		lat = 0 + lat;
		if (lat < -90 || lat > 90) {
			return new Response(JSON.stringify({success: false, message: "Invalid latitude"}), { status: 400 });
		}

		lng = 0 + lng;
		if (lng < -180 || lat > 180) {
			return new Response(JSON.stringify({success: false, message: "Invalid longitude"}), { status: 400 });
		}

		if (!map || typeof map !== "string" || map.length > 32)  {
			return new Response(JSON.stringify({success: false, message: "Invalid map"}), { status: 400 });
		}

		// Valid game id?
		if (!game || typeof game !== "string" || game.length !== 16) {
			return new Response(JSON.stringify({success: false, message: "Invalid game"}), { status: 400 });
		}

		// Valid round
		round = Math.ceil(0 + round);
		if (round <= 0) {
			return new Response(JSON.stringify({success: false, message: "Invalid round"}), { status: 400 });
		}

		// Valid type?
		if (["original", "guess", "travel", "bookmark"].indexOf(type) < 0) {
			return new Response(JSON.stringify({success: false, message: "Invalid type"}), { status: 400 });
		}

		if (location) {
			location = location.trim();
			if (location.length > 64) {
				location = location.substring(0, 64);
			}
		} else {
			location = null;
		}

		const conn = await connect(config);

		// Update user's metadata
		results = await conn.execute(`
			UPDATE users
			SET last_request_at = NOW(),
				request_count = request_count + 1
			WHERE user_token = ?
		`, [token]);
		if (results.rowsAffected <= 0) {
			return new Response(JSON.stringify({success: false, message: "Invalid token"}), { status: 400 });
		}

		// Check if nearby location has already been recorded
		if (type === "travel" || type === "bookmark") {
			const box = getBoundingBox(lat, lng, type === "bookmark" ? 10 : 200);
			sql = `
				SELECT *
				FROM locations
				WHERE
					user_token = ? AND
					lat > ? AND
					lat < ? AND
					lng > ? AND
					lng < ? AND
					type = "${type}"
			`;
			results = await conn.execute(sql, [token, box.minLat, box.maxLat, box.minLng, box.maxLng]);
			if (results.rows.length > 0) {
				return new Response(JSON.stringify({success: true, ...data}), {status: 200});
			}
		}

		// Finally insert the location
		sql = `
			INSERT INTO locations SET
			user_token = ?,
			map = ?,
			game = ?,
			round = ?,
			type = ?,
			lat = ?,
			lng = ?,
			location = ?,
			created_at = NOW()
		`;

		await conn.execute(sql, [token, map, game, round, type, lat, lng, location]);

		return new Response(JSON.stringify({success: true, ...data}), {status: 200});
	} catch (ex) {
		return new Response(JSON.stringify({success: false}), { status: 400 });
	}
}
