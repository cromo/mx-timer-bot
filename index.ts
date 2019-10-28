import { MatrixClient, SimpleFsStorageProvider, AutojoinRoomsMixin } from "matrix-bot-sdk";
import * as TOML from "@iarna/toml";
import { readFileSync } from "fs";
import { getDatabase, Timer } from "./model";

interface Config {
  homeserverUrl: string;
  accessToken: string;
  syncFile?: string;
  dbFile?: string;
};

const config = getConfig();
const db = getDatabase(config.dbFile);

const client = new MatrixClient(config.homeserverUrl, config.accessToken, new SimpleFsStorageProvider(config.syncFile));
AutojoinRoomsMixin.setupOnClient(client);

client.start().then(() => {
    console.log("Client started");

    const now = new Date();
    const [pastDue, upcoming] = partition(t => t.time <= now, Timer.getAll(db));
    upcoming.forEach(scheduleReminder);
    console.log(`Restarted ${upcoming.length} timers`);

    pastDue.forEach(scheduleReminder);
    console.log(`Sent notifications for ${pastDue.length} past due timers`);
});
client.on('room.message', (roomId, event) => {
    if (![hasContent, startsWithBangCommand("timer")].every(f => f(event))) {
        return;
    }
    const timer = extractDurationAndMessage(event.content.body.substring("!timer".length).trim());
    if (!timer) return client.sendNotice(roomId, "Unrecognized format");
    const [delay, message] = timer;
    const reminder = new Timer(event.event_id, roomId, new Date(+new Date() + delay), message);
    const changes = reminder.save(db);
    console.log("Database rows added", changes);
    scheduleReminder(reminder);
});

function partition<T>(p: (t: T) => boolean, ts: T[]): [T[], T[]] {
    return ts.reduce(([passed, failed], cur) =>
        p(cur) ?
            [[...passed, cur], failed] :
            [passed, [...failed, cur]],
        [[], []]);
}

function sendReminder(roomId: string, message: string, eventId: string) {
    client.sendNotice(roomId, message);
    const deletions = Timer.delete(db, eventId);
    console.log("Database rows deleted", deletions);
}

function scheduleReminder(timer: Timer) {
    const delay = +timer.time - +new Date();
    if (delay <= 0) {
        sendReminder(timer.roomId, timer.message, timer.eventId);
    } else {
        setTimeout(() => sendReminder(timer.roomId, timer.message, timer.eventId), delay);
    }
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