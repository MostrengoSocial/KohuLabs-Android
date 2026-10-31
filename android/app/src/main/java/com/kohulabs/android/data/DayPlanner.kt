package com.kohulabs.android.data

/**
 * What happens to unfinished work when a new day starts. Plain Kotlin, no database, so it is easy to test.
 *
 * Each chunk from an earlier day that is still planned follows the choice made for it in that day's review
 * (Slipped · what now?): 0 Tomorrow (the default, also when there was no review), 1 Split, 2 Drop.
 * A carried chunk keeps its time slot and links back to the original (carried_from); the original is marked
 * moved, so history and Stats still see the day as it was. Unfinished daily goals from the last day with goals
 * carry over too. Meetings imported from Calendar stay on their own day.
 */
object DayPlanner {
    const val TOMORROW = 0
    const val SPLIT = 1
    const val DROP = 2
    /** The category of chunks imported from Calendar (api/google-import.js). */
    const val MEETING = "meet"

    data class Result(val changed: List<Chunk>, val goals: List<Goal>)

    fun rollover(
        today: String,
        unfinished: List<Chunk>,
        slips: (date: String) -> Map<String, Int>,
        lastGoals: List<Goal>,
        now: Long,
        newId: () -> String,
    ): Result {
        val changed = mutableListOf<Chunk>()
        val choices = unfinished.map { it.date }.distinct().associateWith(slips)
        // Meetings (from Calendar) happened or not on their day; they never move to the next.
        for (c in unfinished.filter { it.date < today && it.status == Chunk.PLANNED && it.category != MEETING }) {
            when (choices[c.date]?.get(c.id) ?: TOMORROW) {
                DROP -> changed += c.copy(status = Chunk.DROPPED, updatedAt = now)
                SPLIT -> {
                    changed += c.copy(status = Chunk.MOVED, updatedAt = now)
                    changed += halves(c, newId(), newId()).map { it.copy(date = today, carriedFrom = c.id, updatedAt = now) }
                }
                else -> {
                    changed += c.copy(status = Chunk.MOVED, updatedAt = now)
                    changed += c.copy(id = newId(), date = today, status = Chunk.PLANNED, startedAt = null, carriedFrom = c.id, updatedAt = now)
                }
            }
        }
        val goals = lastGoals.filter { !it.done && it.date < today }
            .map { it.copy(id = newId(), date = today, updatedAt = now) }
        return Result(changed, goals)
    }

    // ---- Kō's plan for a day --------------------------------------------------------------------------------------

    /** Working hours on one day, in minutes from midnight. Lunch is kept free. */
    data class Hours(val start: Int, val end: Int, val lunch: Int? = 13 * 60, val lunchMinutes: Int = 60)

    /** A task and the minutes of it still to plan. */
    data class Need(val task: Task, val minutes: Int)

    const val SHORTEST = 15  // no chunk shorter than this, unless that is all a task has left
    const val BREAK = 5      // between chunks

    /**
     * Kō's proposal for [date]: the open tasks, in order (soonest deadline first), as chunks of [chunk] minutes in the
     * free time of the working [hours], after [from] (minutes from midnight: now, on today), around what is already
     * [busy] (meetings, chunks planned or done), with [BREAK] minutes between. The chunks are [Chunk.PROPOSED] and named
     * by their slot (plan:date:HHMM), so planning the same day again updates them instead of making new ones.
     */
    fun propose(date: String, hours: Hours, from: Int, busy: List<Chunk>, needs: List<Need>, chunk: Int, now: Long): List<Chunk> {
        val blocked = busy.map { minutes(it.start) to minutes(it.start) + it.minutes }.toMutableList()
        hours.lunch?.let { blocked += it to it + hours.lunchMinutes }
        blocked.sortBy { it.first }
        // The free windows: working hours from now on, minus what is blocked.
        val windows = mutableListOf<Pair<Int, Int>>()
        var t = maxOf(hours.start, (from + 4) / 5 * 5)
        for ((a, b) in blocked) {
            if (a > t) windows += t to minOf(a - BREAK, hours.end)
            t = maxOf(t, b + if (a < b) BREAK else 0)
        }
        if (t < hours.end) windows += t to hours.end
        val left = needs.filter { it.minutes > 0 }.map { it.task to it.minutes }.toMutableList()
        val out = mutableListOf<Chunk>()
        for ((a, b) in windows.filter { it.first < it.second }) {
            var at = a
            while (left.isNotEmpty()) {
                val (task, rest) = left.first()
                val len = minOf(chunk, rest, b - at)
                if (len < minOf(SHORTEST, rest)) break
                out += Chunk("plan:$date:${clock(at).replace(":", "")}", task.id, task.workspaceId, date, clock(at), len, task.title, task.category,
                    status = Chunk.PROPOSED, updatedAt = now)
                if (rest - len > 0) left[0] = task to rest - len else left.removeAt(0)
                at += len + BREAK
            }
        }
        return out
    }

    fun minutes(hhmm: String): Int = hhmm.split(":").let { (h, m) -> h.toInt() * 60 + m.toInt() }
    fun clock(minutes: Int): String = "%02d:%02d".format(minutes / 60, minutes % 60)

    /** A chunk in two: the first half at its time, the second straight after, titled (1/2) and (2/2). */
    fun halves(c: Chunk, idA: String, idB: String): List<Chunk> {
        val first = (c.minutes + 1) / 2
        return listOf(
            c.copy(id = idA, minutes = first, title = "${c.title} (1/2)", status = Chunk.PLANNED, startedAt = null),
            c.copy(id = idB, minutes = c.minutes - first, start = addMinutes(c.start, first), title = "${c.title} (2/2)", status = Chunk.PLANNED, startedAt = null),
        )
    }

    fun addMinutes(hhmm: String, minutes: Int): String {
        val (h, m) = hhmm.split(":").map { it.toInt() }
        val t = (h * 60 + m + minutes).coerceIn(0, 24 * 60 - 1)
        return "%02d:%02d".format(t / 60, t % 60)
    }
}
