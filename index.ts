import { MatrixClient, SimpleFsStorageProvider, AutojoinRoomsMixin } from "matrix-bot-sdk";
import * as TOML from "@iarna/toml";
import { readFileSync } from "fs";

interface Config {
  homeserverUrl: string;
  accessToken: string;
  storage?: string;
};

const config = TOML.parse(readFileSync("config.toml", {encoding: "utf-8"})) as unknown as Config;
config.storage = config.storage || "bot.json";

const client = new MatrixClient(config.homeserverUrl, config.accessToken, new SimpleFsStorageProvider(config.storage));
AutojoinRoomsMixin.setupOnClient(client);

client.start().then(() => console.log("Client started"));
client.on('room.message', (roomId, event) => {
    if (![hasContent, startsWithBangCommand("timer")].every(f => f(event))) {
        return;
    }
    const timer = extractDurationAndMessage(event.content.body.substring("!timer".length).trim());
    if (!timer) return client.sendNotice(roomId, "Unrecognized format");
    const [delay, message] = timer;
    setTimeout(() => {
        client.sendNotice(roomId, message);
    }, delay);
});

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
    const match = /^(\d+) ?(m|s)?(?:\s+(.*))?$/.exec(str);
    if (!match) return undefined;

    let [, quantityStr, unit, message] = match;
    const quantity = +quantityStr;
    unit = unitNormalizations.get(unit);
    // Should pass in default message instead since it has access to more
    // information from the event.
    message = message || `Timer set ${quantity} ${unit} ago finished.`;

    return [quantity * durationMultipliers.get(unit), message];
}