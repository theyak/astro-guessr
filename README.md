# AstroGuessr

Server for for my TamperMonkey [GeoGuessr Recorder](https://github.com/theyak/geoguessr-recorder) script.

I'm trying to do it in Astro just because I wanted to try to do something in Astro.
Might not be the best choice since this app will probably be more dynamic than
a typical Astro site, but that's OK.

# Setup
This application currently assumes the use of Netlify for serving and PlanetScale
for its database. Make accounts for those if you have not already.

## Database Schema

In PlanetScale, create a database called geoguessr and in the control panel,
create the following schema:

```sql
CREATE TABLE IF NOT EXISTS `locations` (
	`id` INT NOT NULL AUTO_INCREMENT,
	`user_token` CHAR(32) NOT NULL,
	`map` CHAR(32) NOT NULL,
	`game` CHAR(32) NOT NULL,
	`round` INT NOT NULL,
	`type` enum('start','guess','travel') NOT NULL,
	`lat` DOUBLE NOT NULL,
	`lng` DOUBLE NOT NULL,
	`created_at` DATETIME NOT NULL,
	PRIMARY KEY (`id`),
	INDEX `user_lat_lng` (`user_token`, `lat`, `lng`),
	UNIQUE INDEX `game` (`game`, `type`, `lat`, `lng`)
) ENGINE = InnoDB;
```

```sql
CREATE TABLE IF NOT EXISTS `users` (
	`user_token` CHAR(32) NOT NULL,
	`email` VARCHAR(128) NULL DEFAULT NULL,
	`sso_provider` CHAR (32) NULL DEFAULT NULL,
	`sso_data` TEXT NULL DEFAULT NULL,
	`user_id` CHAR(32) NULL DEFAULT NULL,
	`user_nick` VARCHAR(128) NULL DEFAULT NULL,
	`games_played` BIGINT UNSIGNED NOT NULL DEFAULT 0,
	`request_count` BIGINT UNSIGNED NOT NULL DEFAULT 0,
	`last_request_at` DATETIME NOT NULL,
	`created_at` DATETIME NOT NULL,
	PRIMARY KEY (`user_token`)
) ENGINE = InnoDB;
```

```sql
CREATE TABLE IF NOT EXISTS `games` (
	`game` CHAR(32) NOT NULL,
	`user_token` CHAR(32) NOT NULL,
	`user_id` CHAR(32) NULL DEFAULT NULL,
	`map` CHAR(32) NOT NULL,
	`rounds` INT UNSIGNED NOT NULL,
	`moving` INT UNSIGNED NOT NULL,
	`zooming` INT UNSIGNED NOT NULL,
	`rotating` INT UNSIGNED NOT NULL,
	`timeLimit` INT UNSIGNED NOT NULL,
	`distance` DOUBLE NOT NULL,
	`time` INT UNSIGNED NOT NULL,
	`score` INT UNSIGNED NOT NULL,
	`created_at` DATETIME NOT NULL,
	PRIMARY KEY (`game`),
	INDEX `token_map` (`user_token`, `map`),
	INDEX `map` (`map`)
) ENGINE = InnoDB;
```

```sql
CREATE TABLE IF NOT EXISTS `maps` (
	`map` CHAR(32) NOT NULL,
	`mapName` VARCHAR(128) NOT NULL,
	`times_played` BIGINT UNSIGNED NOT NULL DEFAULT 0,
	PRIMARY KEY (`map`)
) ENGINE = InnoDB;
```

You can create an initial user with a query similar to:

```sql
INSERT INTO users SET user_token = 'my-token', email = 'email@example.com', request_count = 1, last_request_at = NOW(), created_at = NOW();
```

## Environment Variables
*DATABASE_HOST*: PlanetScale host name

*DATABASE_USERNAME*: PlanetScale database username

*DATABASE_PASSWORD*: PlanetScale database password

*PUBLIC_MAPKEY*: Google Maps API key. Keys can be set up managed at
managed at https://console.cloud.google.com/apis/credentials.
As the API key for maps needs to be public, it is recommended that you
make the key only valid for your website so that others can't use your API key.
