# mx-timer-bot ⏲🤖

A chat bot for [Matrix](https://matrix.org/) servers that echoes a message after a specified amount of time has lapsed. Similar in spirit to reddit's [RemindMeBot](https://www.reddit.com/r/RemindMeBot/).

![Animation mx-timer-bot echoing a message after five seconds](https://github.com/cromo/mx-timer-bot/blob/master/demo.gif)

## User Interface

When in a matrix chat with mx-timer-bot, send a message in this format:

```
!timer <quantity> <unit> [message]
```

e.g.

```
!timer 45 minutes Check the bread in the oven
```

A default message will be used if one is not provided. Many units are allowed, including abbreviations of seconds, minutes, hours, days, and weeks.

## Installation

Ensure you have node installed and can build native modules.

```bash
git clone https://github.com/cromo/mx-timer-bot.git
cd mx-timer-bot
cp config.example.toml config.toml
$EDITOR config.toml
npm install
npm start
```

Using Docker:

```bash
docker run -it --rm -v "$(pwd)":/src/state -e MX_TIMER_BOT_ACCESS_TOKEN='YOUR ACCESS TOKEN' -e MX_TIMER_BOT_DB_FILE=state/mx-timer-bot.db mx-timer-bot
```

This will run mx-timer-bot and store the state of the bot on the host so it can survive restarts.

## Configuration

mx-timer-bot can be configured via it's `config.toml` or via environment variables.

### `config.toml`

- `homeserverUrl` *optional* - the homeserver of the account the bot will use. Defaults to `"https://matrix.org"`.
- `accessToken` - the access token to authenticate the bot. See [T2Bot's documentation for how to get an access token](https://t2bot.io/docs/access_tokens/).
- `dbFile` *optional* - the SQLite database that persists reminders in case the bot gets restarted. Defaults to `"timers.db"`.

### Environment variables

- `MX_TIMER_BOT_HOMESERVER_URL` - same as `homeserverUrl` in `config.toml`.
- `MX_TIMER_BOT_ACCESS_TOKEN` - same as `accessToken` in `config.toml`.
- `MX_TIMER_BOT_DB_FILE` same as `dbFile` in `config.toml`.

## License

MIT