import {connect} from "@planetscale/database";


/**
 * Check if a coordinate position is valid.
 * Throws on error.
 *
 * @param {{lng: number, lat: number}} param
 */
function checkPosition({lat, lng}) {
	lat = 0 + lat;
	if (lat < -90 || lat > 90) {
		throw new Error("Invalid latitude");
	}

	lng = 0 + lng;
	if (lng < -180 || lat > 180) {
		throw new Error("Invalid longitude");
	}
}

/**
 * Check for valid straing parameter
 *
 * @param {string} str
 * @param {number} len
 * @returns {boolean}
 */
function checkString(str, len = 0, errorStr = "") {
	if (!str || typeof str !== "string") {
		throw new Error(errorStr);
	}

	if (len > 0 && str.length > len) {
		throw new Error(errorStr);
	}

	return true;
}

function checkNumber(num, min = 0, max = Infinity, errorStr = "") {
	if (typeof num === "undefined" || num === null) {
		throw new Error(errorStr);
	}
}

function checkBoolean(bool, errorStr = "") {
	if (bool !== true && bool !== false) {
		throw new Error(errorStr);
	}
}

function validateData(data) {
	let {
		token, game, map, mapName, roundCount,
		moving, zooming, rotating, timeLimit, score,
		distance, time, userId, userNick,
		rounds, guesses
	} = data;

	checkString(token, 32, "Invalid user token");
	checkString(game, 32, "Invalid game ID");
	checkNumber(roundCount, 0, Infinity, "Invalid number of rounds");
	checkBoolean(moving, "Invalid moving flag");
	checkBoolean(zooming, "Invalid zooming flag");
	checkBoolean(rotating, "Invalid rotating flag");
	checkNumber(timeLimit, 0, Infinity, "Invalid time limit");
	checkNumber(score, 0, Infinity, "Invalid score");
	checkNumber(distance, 0, Infinity, "Invalid distance");
	checkNumber(time, 1, Infinity, "Invalid time");
	checkString(userId, 32, "Invalid User ID");
	checkString(userNick, 128, "Invalid nick");
	checkString(map, 32, "Invalid Map ID");
	checkString(mapName, 128, "Invalid map name");
}

/**
 * Record meta information about game
 *
 * @param {*} conn
 * @param {Object} data
 */
async function recordGame(conn, data) {
	let {
		token, game, map, roundCount,
		moving, zooming, rotating, timeLimit, score,
		distance, time, userId, userNick
	} = data;

	const sql = `
		INSERT INTO games
		SET
			game = ?,
			user_token = ?,
			user_id = ?,
			user_nick = ?,
			map = ?,
			rounds = ?,
			moving = ?,
			zooming = ?,
			rotating = ?,
			timeLimit = ?,
			score = ?,
			distance = ?,
			time = ?,
			created_at = NOW()
		ON DUPLICATE KEY UPDATE
			time = ?
	`;

	try {
		await conn.execute(sql, [game, token, userId, userNick, map, roundCount, moving, zooming, rotating, timeLimit, score, distance, time, time]);
	} catch (err) {
		console.log(err);
		throw new Error("Database error");
	}
}

/**
 * Update user's record with game informaion
 *
 * @param {*} conn
 * @param {Object} data
 */
async function recordUser(conn, data) {
	let results = {};
	const {token, userId, userNick} = data;

	try {
		let sql = `
		UPDATE users
		SET last_request_at = NOW(),
			request_count = request_count + 1,
			games_played = games_played + 1,
			user_id = ?,
			user_nick = ?
		WHERE user_token = ?
		`;
		results = await conn.execute(sql, [userId, userNick, token]);
	} catch (err) {
		console.log(err);
		throw new Error("Database error");
	}

	if (results.rowsAffected <= 0) {
		throw new Error("Invalid user token");
	}
}

/**
 * Record start and guess locations
 *
 * @param {*} conn
 * @param {Object} data
 */
async function recordLocations(conn, data) {
	let sql = "";
	const {rounds, guesses, map, token, game} = data;

	for (let round in rounds) {
		const lat = rounds[round].lat;
		const lng = rounds[round].lng;

		try {
			checkPosition({lat, lng});
		} catch (err) {
			throw new Error(`Invalid latitude or longitude, Lng: ${lng}, Lat: ${lat}`);
		}

		sql = `
			INSERT INTO locations
			SET
				user_token = ?,
				map = ?,
				game = ?,
				round = ?,
				type = ?,
				lat = ?,
				lng = ?,
				created_at = NOW()
			ON DUPLICATE KEY UPDATE
				lng = ?
		`;
		try {
			await conn.execute(sql, [token, map, game, (+round) + 1, "start", lat, lng, lng]);
		} catch (err) {
			console.log(err);
			throw new Error("Database error");
		}
	}

	for (let guess in guesses) {
		const lat = guesses[guess].lat;
		const lng = guesses[guess].lng;

		try {
			checkPosition({lat, lng});
		} catch (err) {
			throw new Error(`Invalid latitude or longitude, Lng: ${lng}, Lat: ${lat}`);
		}

		sql = `
			INSERT INTO locations
			SET
				user_token = ?,
				map = ?,
				game = ?,
				round = ?,
				type = ?,
				lat = ?,
				lng = ?,
				created_at = NOW()
			ON DUPLICATE KEY UPDATE
				lng = ?
		`;
		try {
			await conn.execute(sql, [token, map, game, (+guess) + 1, "guess", lat, lng, lng]);
		} catch (err) {
			console.log(err);
			throw new Error("Database error");
		}
	}
}

async function recordMap(conn, data) {
	const {map, mapName} = data;

	const sql = `
		INSERT INTO maps
		SET
			map = ?,
			mapName = ?,
			times_played = 1
		ON DUPLICATE KEY UPDATE
			times_played = times_played + 1`;
	try {
		await conn.execute(sql, [map, mapName]);
	} catch (err) {
		console.log(err);
		throw new Error("Database error");
	}
}

export const POST = async ({ request }) => {
	if (request.headers.get("Content-Type") !== "application/json") {
		return new Response(JSON.stringify({success: false}), { status: 400 });
	}

	const data = await request.json();

	try {
		validateData(data);
	} catch (err) {
		return new Response(JSON.stringify({success: false, message: err.message}), { status: 400 });
	}

	// Connect to database (TODO: Abstract away to server hook)
	const env = import.meta.env;
	const config = {
		host: env.DATABASE_HOST,
		username: env.DATABASE_USERNAME,
		password: env.DATABASE_PASSWORD,
	};

	const conn = await connect(config);

	try {
		await recordMap(conn, data);
		await recordUser(conn, data);
		await recordGame(conn, data);
		await recordLocations(conn, data);
	} catch (err) {
		return new Response(JSON.stringify({success: false, message: err.message}), { status: 400 });
	}

	return new Response(JSON.stringify({success: true, ...data}), {status: 200});
}
