import { MatrixClient, SimpleFsStorageProvider, AutojoinRoomsMixin } from "matrix-bot-sdk";
import * as TOML from "@iarna/toml";
import { readFileSync } from "fs";
import * as Database from "better-sqlite3";

interface Config {
  homeserverUrl: string;
  accessToken: string;
  syncFile?: string;
  dbFile?: string;
};

const config = getConfig();
const db = new Database(config.dbFile);

db.exec(`
create table if not exists timers (
    eventId text primary key not null,
    roomId text not null,
    time text not null,
    message text not null
)`);

const client = new MatrixClient(config.homeserverUrl, config.accessToken, new SimpleFsStorageProvider(config.syncFile));
AutojoinRoomsMixin.setupOnClient(client);

client.start().then(() => {
    console.log("Client started");
    const existingTimers = db.prepare(`
        select eventId, roomId, time, message
        from timers
    `).all().map(t => ({...t, time: new Date(t.time)}));

    const now = new Date();
    const remaining = existingTimers.filter(t => now < t.time);
    remaining.forEach(t => setTimeout(() => sendReminder(t.roomId, t.message, t.eventId), t.time - +now));
    console.log(`Restarted ${remaining.length} timers`);

    const pastDue = existingTimers.filter(t => t.time <= now);
    pastDue.forEach(t => sendReminder(t.roomId, t.message, t.eventId));
    console.log(`Sent notifications for ${pastDue.length} past due timers`);
});
client.on('room.message', (roomId, event) => {
    if (![hasContent, startsWithBangCommand("timer")].every(f => f(event))) {
        return;
    }
    const timer = extractDurationAndMessage(event.content.body.substring("!timer".length).trim());
    if (!timer) return client.sendNotice(roomId, "Unrecognized format");
    const [delay, message] = timer;
    const changes = db.prepare('insert into timers (eventId, roomId, time, message) values (?, ?, ?, ?)').run(event.event_id, roomId, new Date(+new Date() + delay).toISOString(), message);
    console.log("Database rows added", changes);
    setTimeout(() => sendReminder(roomId, message, event.event_id), delay);
});

function sendReminder(roomId: string, message: string, eventId: string) {
    client.sendNotice(roomId, message);
    const deletions = db.prepare(`delete from timers where eventId = ?`).run(eventId);
    console.log("Database rows deleted", deletions);
}

function getConfig(): Config {
    const fileConfig = TOML.parse(readFileSync("config.toml", {encoding: "utf-8"})) as unknown as Config;
    return {
        homeserverUrl: process.env.MX_TIMER_BOT_HOMESERVER_URL || fileConfig.homeserverUrl || "https://matrix.org",
        accessToken: process.env.MX_TIMER_BOT_ACCESS_TOKEN || fileConfig.accessToken || "TOKEN NOT SET",
        syncFile: process.env.MX_TIMER_BOT_SYNC_FILE || fileConfig.syncFile || "sync.json",
        dbFile: process.env.MX_TIMER_BOT_DB_FILE || fileConfig.dbFile || "timers.db"
    } as Config;
}

function hasContent(event: any): boolean {
    return !!event.content;
}

function startsWithBangCommand(command: string): (event: any) => boolean {
    return event => event.content.body.startsWith(`!${command}`);
}

const unitNormalizations: Map<string, string> = new Map([
    ["m", "minutes"],
    ["min", "minutes"],
    ["mins", "minutes"],
    ["minute", "minutes"],
    ["minutes", "minutes"],
    ["s", "seconds"],
    ["sec", "seconds"],
    ["secs", "seconds"],
    ["second", "seconds"],
    ["seconds", "seconds"],
    ["h", "hours"],
    ["hr", "hours"],
    ["hrs", "hours"],
    ["hour", "hours"],
    ["hours", "hours"],
    ["d", "days"],
    ["day", "days"],
    ["days", "days"],
    ["w", "weeks"],
    ["wk", "weeks"],
    ["wks", "weeks"],
    ["week", "weeks"],
    ["weeks", "weeks"]
]);
const durationMultipliers: Map<string, number> = new Map([
    ["seconds", 1000],
    ["minutes", 60 * 1000],
    ["hours", 60 * 60 * 1000],
    ["days", 24 * 60 * 60 * 1000],
    ["weeks", 7 * 24 * 60 * 60 * 1000]
]);

function extractDurationAndMessage(str: string): [number, string] | undefined {
    const match = /^(\d+) ?(w|wks?|weeks?|d|days?|h|hrs?|hours?|m|mins?|minutes?|s|secs?|seconds?)?(?:\s+(.*))?$/.exec(str);
    if (!match) return undefined;

    let [, quantityStr, unit, message] = match;
    const quantity = +quantityStr;
    unit = unitNormalizations.get(unit);
    // Should pass in default message instead since it has access to more
    // information from the event.
    message = message || `Timer set ${quantity} ${unit} ago finished.`;

    return [quantity * durationMultipliers.get(unit), message];
}