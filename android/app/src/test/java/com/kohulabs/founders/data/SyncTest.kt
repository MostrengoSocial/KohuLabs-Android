package com.kohulabs.founders.data

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import org.json.JSONArray
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.net.HttpURLConnection
import java.net.URL

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class SyncTest {
    private val context: Context = ApplicationProvider.getApplicationContext()
    private val open = mutableListOf<FoundersDatabase>()

    private fun phone(name: String): Triple<FoundersDatabase, FoundersStore, android.content.SharedPreferences> {
        val db = Room.inMemoryDatabaseBuilder(context, FoundersDatabase::class.java).allowMainThreadQueries().build().also { open += it }
        var n = 0
        return Triple(db, FoundersStore(db, clock = { System.currentTimeMillis() }, newId = { "$name-${++n}" }), context.getSharedPreferences("sync-$name", Context.MODE_PRIVATE))
    }

    @After fun close() = open.forEach { it.close() }

    /** The cloud, as api/sync.js behaves: newest updated_at wins, and a seq per accepted row. */
    private class FakeCloud : SyncApi {
        val rows = linkedMapOf<String, Pair<Long, JSONObject>>() // "table/id" → (seq, row)
        var seq = 0L
        val pushed = mutableListOf<String>()
        override fun sync(body: JSONObject): JSONObject {
            val changes = body.getJSONObject("changes")
            for (t in changes.keys()) {
                val list = changes.getJSONArray(t)
                for (i in 0 until list.length()) {
                    val r = list.getJSONObject(i)
                    pushed += "$t/${r.getString("id")}"
                    val have = rows["$t/${r.getString("id")}"]
                    if (have == null || r.getLong("updated_at") > have.second.getLong("updated_at")) rows["$t/${r.getString("id")}"] = ++seq to r
                }
            }
            val cursor = body.getLong("cursor")
            val out = JSONObject()
            for ((key, v) in rows) if (v.first > cursor) {
                val t = key.substringBefore("/")
                (out.optJSONArray(t) ?: JSONArray().also { out.put(t, it) }).put(v.second)
            }
            return JSONObject().put("cursor", seq).put("more", false).put("changes", out)
        }
    }

    private fun ops(store: FoundersStore, vararg o: Pair<String, Map<String, Any>>) =
        store.apply(JSONArray(o.map { (op, kv) -> JSONObject(kv).put("op", op) }))

    private fun statusOf(store: FoundersStore, date: String, id: String) =
        store.today(date, "en").getJSONArray("chunks").let { a -> (0 until a.length()).map { a.getJSONObject(it) }.first { it.getString("id") == id }.getString("status") }

    @Test fun whatOnePhoneDoesReachesAnother() {
        val cloud = FakeCloud()
        val (dbA, a, prefsA) = phone("a")
        a.today("2026-10-29", "en")
        ops(a, "chunk" to mapOf("id" to "c3", "status" to "done"), "goal" to mapOf("id" to "g2", "done" to true))
        val up = Sync(dbA, cloud, prefsA).run()
        assertTrue(up.pushed > 50)                           // the first day, and the changes
        assertEquals(0, dbA.dao().outboxSize())

        val (dbB, b, prefsB) = phone("b")
        val down = Sync(dbB, cloud, prefsB).run()
        assertEquals(up.pushed, down.pulled)
        assertEquals("done", statusOf(b, "2026-10-29", "c3"))

        // B changes it back later; A gets that, and A's older copy does not win.
        Thread.sleep(2)
        ops(b, "chunk" to mapOf("id" to "c3", "status" to "planned"))
        Sync(dbB, cloud, prefsB).run()
        Sync(dbA, cloud, prefsA).run()
        assertEquals("planned", statusOf(a, "2026-10-29", "c3"))
    }

    @Test fun aChangeMadeDuringASyncIsNotLost() {
        val (db, store, prefs) = phone("c")
        store.today("2026-10-29", "en")
        val cloud = object : SyncApi {
            val inner = FakeCloud()
            override fun sync(body: JSONObject): JSONObject {
                Thread.sleep(2)
                ops(store, "chunk" to mapOf("id" to "c5", "status" to "done")) // the person taps while the upload is on its way
                return inner.sync(body)
            }
        }
        Sync(db, cloud, prefs).run()
        assertTrue(db.dao().outbox(10).any { it.tableName == "chunks" && it.rowId == "c5" })
    }

    // The phone in your hand has version 1 (no outbox): upgrading keeps everything and queues it all for the first sync.
    // Version 1 is built from Room's own record of it (schemas/…/1.json); Room checks the result matches version 2.
    @Test fun upgradingFromVersion1QueuesEverythingForTheFirstSync() {
        val file = context.getDatabasePath("upgrade.db").apply { parentFile?.mkdirs(); delete() }
        val v1 = JSONObject(java.io.File("schemas/com.kohulabs.founders.data.FoundersDatabase/1.json").readText()).getJSONObject("database")
        android.database.sqlite.SQLiteDatabase.openOrCreateDatabase(file, null).use { sql ->
            val entities = v1.getJSONArray("entities")
            for (i in 0 until entities.length()) {
                val e = entities.getJSONObject(i)
                val name = e.getString("tableName")
                sql.execSQL(e.getString("createSql").replace("\${TABLE_NAME}", name))
                e.optJSONArray("indices")?.let { ix -> for (j in 0 until ix.length()) sql.execSQL(ix.getJSONObject(j).getString("createSql").replace("\${TABLE_NAME}", name)) }
            }
            val setup = v1.getJSONArray("setupQueries")
            for (i in 0 until setup.length()) sql.execSQL(setup.getString(i))
            sql.execSQL("INSERT INTO chunks (id, workspace_id, date, start, minutes, title, category, status, updated_at, deleted) VALUES ('c1', 'kohu', '2026-10-29', '08:30', 15, 'Inbox triage', 'ops', 'done', 5, 0)")
            sql.execSQL("INSERT INTO settings (id, value, updated_at, deleted) VALUES ('lang', '\"pt\"', 6, 0)")
            sql.version = 1
        }
        val db = Room.databaseBuilder(context, FoundersDatabase::class.java, "upgrade.db").addMigrations(FoundersDatabase.V1_TO_V2).allowMainThreadQueries().build().also { open += it }
        assertEquals(listOf("chunks/c1", "settings/lang"), db.dao().outbox(10).map { "${it.tableName}/${it.rowId}" }.sorted())
        assertEquals("Inbox triage", db.dao().chunk("c1")?.title)
    }

    // Against the real Worker code (api/dev-server.mjs, with SQLite standing in for D1). Runs when KOHU_E2E_URL is set:
    //   node api/dev-server.mjs 8799 &   KOHU_E2E_URL=http://127.0.0.1:8799 ./gradlew testDebugUnitTest
    @Test fun syncsWithTheRealWorker() {
        val base = System.getenv("KOHU_E2E_URL")
        assumeTrue("KOHU_E2E_URL not set", !base.isNullOrEmpty())
        val token = post(base!!, "/__test/token", JSONObject().put("email", "hello@kohulabs.com"), null).getString("token")
        val api = SyncApi { post(base, "/api/sync", it, token) }
        val (dbA, a, prefsA) = phone("e2e-a")
        a.today("2026-10-29", "pt")
        ops(a, "split" to mapOf("id" to "c4"))
        val up = Sync(dbA, api, prefsA).run()
        val (dbB, b, prefsB) = phone("e2e-b")
        val down = Sync(dbB, api, prefsB).run()
        assertEquals(up.pushed, down.pulled)
        val ids = b.today("2026-10-29", "pt").getJSONArray("chunks").let { arr -> (0 until arr.length()).map { arr.getJSONObject(it).getString("id") } }
        assertTrue("c4a" in ids && "c4b" in ids && "c4" !in ids)
    }

    private fun post(base: String, path: String, body: JSONObject, token: String?): JSONObject {
        val c = URL(base + path).openConnection() as HttpURLConnection
        c.requestMethod = "POST"; c.doOutput = true
        c.setRequestProperty("Content-Type", "application/json")
        token?.let { c.setRequestProperty("Authorization", "Bearer $it") }
        c.outputStream.use { it.write(body.toString().toByteArray()) }
        val text = (if (c.responseCode < 400) c.inputStream else c.errorStream).bufferedReader().use { it.readText() }
        check(c.responseCode == 200) { "$path: ${c.responseCode} $text" }
        return JSONObject(text)
    }
}
