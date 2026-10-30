package com.kohulabs.android.data

/**
 * What happens to unfinished work when a new day starts. Plain Kotlin, no database, so it is easy to test.
 *
 * Each chunk from an earlier day that is still planned follows the choice made for it in that day's review
 * (Slipped · what now?): 0 Tomorrow (the default, also when there was no review), 1 Split, 2 Drop.
 * A carried chunk keeps its time slot and links back to the original (carried_from); the original is marked
 * moved, so history and Stats still see the day as it was. Unfinished daily goals from the last day with goals
 * carry over too.
 */
object DayPlanner {
    const val TOMORROW = 0
    const val SPLIT = 1
    const val DROP = 2

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
        for (c in unfinished.filter { it.date < today && it.status == Chunk.PLANNED }) {
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
