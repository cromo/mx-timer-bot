import * as Database from "better-sqlite3";
import { IFilterInfo, IStorageProvider } from "matrix-bot-sdk";

export function getDatabase(filename: string) {
    const db = new Database(filename);

    db.exec(`
    create table if not exists matrixSync (
        id integer primary key not null,
        syncToken text,
        filter text
    )`);

    db.exec(`
    create table if not exists timers (
        eventId text primary key not null,
        roomId text not null,
        time text not null,
        message text not null
    )`);

    return db;
}

export class SqliteDbStorageProvider implements IStorageProvider {
    constructor(private readonly db)
    {
        if (this.db.prepare(`select count(*) as count from matrixSync`).get().count === 0) {
            this.db.exec(`
                insert into matrixSync (id, syncToken, filter)
                values (1, null, null)
            `);
        }
    }

    setSyncToken(token: string | null): void {
        this.db.prepare(`
            update matrixSync
            set syncToken = ?
        `).run(token);
    }

    getSyncToken(): string {
        return this.db.prepare(`
            select syncToken
            from matrixSync
        `).get().syncToken;
    }

    setFilter(filter: IFilterInfo): void {
        this.db.prepare(`
            update matrixSync
            set filter = ?
        `).run(JSON.stringify(filter));
    }

    getFilter(): IFilterInfo {
        const sync = this.db.prepare(`
            select filter
            from matrixSync
        `).get();
        return JSON.parse(sync.filter) as IFilterInfo;
    }
}

export class Timer {
    constructor(
        readonly eventId: string,
        readonly roomId: string,
        readonly time: Date,
        readonly message: string) {
    }

    static getAll(db): Timer[] {
        return db.prepare(`
            select eventId, roomId, time, message
            from timers
        `).all().map(t => new Timer(t.eventId, t.roomId, new Date(t.time), t.message));
    }

    save(db) {
        return db.prepare(`
            insert into timers (eventId, roomId, time, message)
            values (?, ?, ?, ?)
        `).run(this.eventId, this.roomId, this.time.toISOString(), this.message);
    }

    static delete(db, eventId: string) {
        return db.prepare(`delete from timers where eventId = ?`).run(eventId);
    }
}