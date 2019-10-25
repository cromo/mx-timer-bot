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

function extractDurationAndMessage(str: string): [number, string] | undefined {
    const match = /^(\d+) ?(m|s)?\s+(.*)$/.exec(str);
    if (!match) return undefined;
    const [, quantity, unit, message] = match;
    if (unit === 'm') return [+quantity * 60 * 1000, message];
    if (unit === 's') return [+quantity * 1000, message];
    return [+quantity * 60 * 1000, message];
}