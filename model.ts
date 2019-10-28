import * as Database from "better-sqlite3";

export function getDatabase(filename: string) {
    const db = new Database(filename);

    db.exec(`
    create table if not exists timers (
        eventId text primary key not null,
        roomId text not null,
        time text not null,
        message text not null
    )`);

    return db;
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