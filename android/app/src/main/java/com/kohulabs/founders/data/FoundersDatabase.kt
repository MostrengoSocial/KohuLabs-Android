package com.kohulabs.founders.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/**
 * The database on the phone (SQLite, through Room). Its structure is exported to app/schemas/ on every build;
 * when it changes, raise the version, add a Room migration here and the matching file in db/migrations/.
 */
@Database(
    version = 2,
    exportSchema = true,
    entities = [
        Workspace::class, Task::class, Chunk::class, Goal::class, Nudge::class, FollowUp::class, Alarm::class,
        Message::class, DayReview::class, Meeting::class, Usage::class, Setting::class, OutboxEntry::class,
    ],
)
abstract class FoundersDatabase : RoomDatabase() {
    abstract fun dao(): FoundersDao

    companion object {
        @Volatile private var instance: FoundersDatabase? = null

        fun get(context: Context): FoundersDatabase = instance ?: synchronized(this) {
            instance ?: Room.databaseBuilder(context.applicationContext, FoundersDatabase::class.java, "founders.db")
                .addMigrations(V1_TO_V2)
                .build().also { instance = it }
        }

        /** 2: the outbox, for syncing. Everything already on the phone is queued, so the first sync uploads it. */
        val V1_TO_V2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("CREATE TABLE IF NOT EXISTS `outbox` (`table_name` TEXT NOT NULL, `row_id` TEXT NOT NULL, `queued_at` INTEGER NOT NULL, PRIMARY KEY(`table_name`, `row_id`))")
                for (t in Sync.TABLES) db.execSQL("INSERT OR IGNORE INTO outbox (table_name, row_id, queued_at) SELECT '$t', id, updated_at FROM $t")
            }
        }
    }
}
