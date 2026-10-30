package com.kohulabs.android.data

import java.time.LocalDate

/**
 * The first day on a new install: the design's sample day (Kohu Founders App, "Ko Phone"), dated today and
 * written in the app's language. It is ordinary data from then on: done, skipped and carried like anything
 * else. When Calendar and Gmail are connected, real tasks take its place.
 *
 * Fixed ids (c1, g1, n1, y1, a1, ...) are the design's own: some screens refer to them (the investor update's
 * chunks, the day review's examples). They are only ever seeded once, so they stay unique.
 */
object SampleDay {
    private data class C(val id: String, val ws: String, val start: String, val min: Int, val en: String, val pt: String, val cat: String, val task: String? = null)

    private val CHUNKS = listOf(
        C("c1", "kohu", "08:30", 15, "Inbox triage", "Triagem do email", "ops"),
        C("c2", "kohu", "08:45", 25, "Review cash position", "Rever posição de caixa", "fin"),
        C("c3", "kohu", "09:15", 25, "Investor update: outline", "Update a investidores: estrutura", "inv", "t-investor-update"),
        C("c4", "kohu", "09:45", 25, "Investor update: metrics", "Update a investidores: métricas", "inv", "t-investor-update"),
        C("c5", "kohu", "10:20", 30, "Call with design lead", "Chamada com a lead de design", "team"),
        C("c6", "kohu", "11:00", 25, "Screen three CVs", "Analisar três CVs", "hire"),
        C("c7", "kohu", "14:00", 25, "Pricing page: review copy", "Página de preços: rever texto", "prod"),
        C("c8", "kohu", "14:30", 15, "Send October invoices", "Enviar faturas de outubro", "fin"),
        C("c9", "kohu", "15:00", 45, "Weekly ops review", "Revisão semanal de operações", "ops"),
        C("p1", "personal", "08:00", 20, "Morning run", "Corrida da manhã", "health"),
        C("p2", "personal", "09:45", 15, "Book the dentist", "Marcar o dentista", "admin"),
        C("p3", "personal", "12:30", 30, "Groceries for the week", "Compras da semana", "home"),
        C("p4", "personal", "17:30", 25, "Read 20 pages", "Ler 20 páginas", "mind"),
        C("p5", "personal", "19:00", 15, "Call mum", "Ligar à mãe", "family"),
        C("p6", "personal", "20:00", 25, "Plan the Comporta weekend", "Planear o fim de semana em Comporta", "trip"),
        C("r1", "revolut", "09:00", 15, "Standup notes", "Notas do standup", "rteam"),
        C("r2", "revolut", "09:30", 25, "Review the fraud rules PRD", "Rever o PRD de regras de fraude", "rprod"),
        C("r3", "revolut", "10:30", 30, "1:1 with your manager", "1:1 com a chefia", "rteam"),
        C("r4", "revolut", "11:15", 25, "Draft Q4 OKRs", "Rascunho dos OKR do T4", "rplan"),
        C("r5", "revolut", "14:00", 45, "Sprint planning", "Planeamento do sprint", "rteam"),
        C("r6", "revolut", "15:00", 25, "Answer compliance questions", "Responder ao compliance", "rops"),
    )
    private val SOURCE = mapOf("ops" to "gmail", "fin" to "notion", "inv" to "notion", "team" to "calendar", "hire" to "linear", "prod" to "linear")
    private val DONE = setOf("c1", "c2", "p1", "r1")

    private val GOALS = listOf(
        listOf("g1", "kohu", "Send the investor update draft", "Enviar o rascunho do update"),
        listOf("g2", "kohu", "Inbox to zero", "Email a zero"),
        listOf("g3", "kohu", "Approve the pricing copy", "Aprovar o texto de preços"),
        listOf("g4", "personal", "Run 5 km", "Correr 5 km"),
        listOf("g5", "personal", "Call mum", "Ligar à mãe"),
        listOf("g6", "personal", "Read 20 pages", "Ler 20 páginas"),
        listOf("g7", "revolut", "Finish the PRD review", "Acabar a revisão do PRD"),
        listOf("g8", "revolut", "Draft two OKRs", "Rascunhar dois OKR"),
        listOf("g9", "revolut", "Answer compliance", "Responder ao compliance"),
    )

    private class N(val id: String, val ws: String?, val kind: Pair<String, String>, val tone: String, val time: Pair<String, String>,
                    val title: Pair<String, String>, val body: Pair<String, String>, val actions: List<Pair<String, String>>, val go: String? = null)

    private val NUDGES = listOf(
        N("n1", "kohu", "Decision" to "Decisão", "decision", "08:52" to "08:52", "Ship the pricing page Friday or Monday?" to "Página de preços na sexta ou na segunda?",
            "Copy review is at 14:00. Friday works if it passes." to "A revisão do texto é às 14:00. Sexta dá se passar.", listOf("Friday" to "Sexta", "Monday" to "Segunda")),
        N("n2", "kohu", "Risk" to "Risco", "risk", "08:40" to "08:40", "Investor update is due tomorrow" to "O update a investidores é amanhã",
            "Three chunks are not scheduled yet. I can put them in tomorrow morning." to "Há três blocos por agendar. Posso pô-los amanhã de manhã.", listOf("Schedule them" to "Agendar", "Later" to "Mais tarde")),
        N("n3", null, "Break" to "Pausa", "info", "Yesterday" to "Ontem", "You worked 95 minutes without a break" to "Trabalhaste 95 minutos sem pausa",
            "I moved the ops review 10 minutes later." to "Adiei a revisão de operações 10 minutos.", listOf("Thanks" to "Obrigado")),
        N("n4", "personal", "Reminder" to "Lembrete", "decision", "Mon" to "Seg", "You told Kō: renew passport before December" to "Disseste ao Kō: renovar o passaporte antes de dezembro",
            "It is one 25 minute chunk. Want it Saturday morning?" to "É um bloco de 25 minutos. Queres no sábado de manhã?", listOf("Saturday" to "Sábado", "Later" to "Mais tarde")),
        N("n6", null, "Review" to "Revisão", "info", "18:00" to "18:00", "Your day review is ready" to "A revisão do dia está pronta",
            "Sixty seconds: what got done, what slipped, and tomorrow." to "Sessenta segundos: o que ficou feito, o que escapou, e amanhã.", listOf("Review now" to "Rever agora", "Later" to "Mais tarde"), go = "review"),
        N("n5", "revolut", "Risk" to "Risco", "risk", "08:30" to "08:30", "Q4 OKR draft is due Monday" to "O rascunho dos OKR do T4 é para segunda",
            "You gave me this on Tuesday. One chunk is planned, it probably needs two." to "Deste-me isto na terça. Há um bloco planeado, deve precisar de dois.", listOf("Add a chunk" to "Juntar bloco", "It is fine" to "Está bem")),
    )

    private class F(val id: String, val ws: String, val person: String, val what: Pair<String, String>, val days: Long, val source: String?, val direction: String)

    private val FOLLOW_UPS = listOf(
        F("y1", "kohu", "Ana Reis", "Lisbon VC, waiting on the deck follow-up" to "VC de Lisboa, à espera do seguimento do deck", 4, "Gmail", "you"),
        F("y2", "kohu", "Rui, accountant", "Needs your sign-off on Q3 VAT" to "Precisa da tua aprovação do IVA do T3", 3, "Gmail", "you"),
        F("y3", "revolut", "Priya, compliance", "Questions on the fraud rules" to "Perguntas sobre as regras de fraude", 2, null, "you"),
        F("y4", "personal", "Landlord", "Confirm the plumber visit" to "Confirmar a visita do canalizador", 5, null, "you"),
        F("o1", "kohu", "Marta Silva", "Mocks v2" to "Mocks v2", 2, "Gmail", "them"),
        F("o2", "personal", "Insurance", "Claim reply" to "Resposta ao sinistro", 9, null, "them"),
        F("o3", "revolut", "Your manager", "OKR feedback" to "Feedback dos OKR", 1, null, "them"),
    )

    class Rows(
        val workspaces: List<Workspace>, val tasks: List<Task>, val chunks: List<Chunk>, val goals: List<Goal>,
        val nudges: List<Nudge>, val followUps: List<FollowUp>, val alarms: List<Alarm>,
    )

    fun rows(today: LocalDate, lang: String, now: Long, updatedAt: Long = now): Rows {
        val pt = lang == "pt"
        fun <T> pick(p: Pair<T, T>) = if (pt) p.second else p.first
        val date = today.toString()
        val workspaces = listOf(
            Workspace("kohu", "Kohu", toolsAllowed = true, sort = 0, updatedAt = updatedAt),
            Workspace("personal", if (pt) "Pessoal" else "Personal", sort = 1, updatedAt = updatedAt),
            Workspace("revolut", "Revolut", sort = 2, updatedAt = updatedAt),
        )
        val chunks = CHUNKS.map {
            Chunk(it.id, it.task ?: "t-${it.id}", it.ws, date, it.start, it.min, if (pt) it.pt else it.en, it.cat,
                status = if (it.id in DONE) Chunk.DONE else Chunk.PLANNED, updatedAt = updatedAt)
        }
        val tasks = CHUNKS.groupBy { it.task ?: "t-${it.id}" }.map { (id, cs) ->
            val c = cs.first()
            val title = if (c.task != null) (if (pt) "Update a investidores" else "Investor update") else if (pt) c.pt else c.en
            Task(id, c.ws, title, c.cat, source = if (c.ws == "kohu") SOURCE[c.cat] else "you",
                dueDate = if (c.task != null) today.plusDays(1).toString() else date, createdAt = now, updatedAt = updatedAt)
        }
        val goals = GOALS.map { Goal(it[0], it[1], date, if (pt) it[3] else it[2], done = it[0] == "g4", updatedAt = updatedAt) }
        val nudges = NUDGES.mapIndexed { i, n ->
            Nudge(n.id, n.ws, pick(n.kind), n.tone, pick(n.time), pick(n.title), pick(n.body),
                actions = n.actions.joinToString(",", "[", "]") { quote(pick(it)) }, go = n.go, createdAt = now - i, updatedAt = updatedAt)
        }
        val followUps = FOLLOW_UPS.map {
            FollowUp(it.id, it.ws, if (pt && it.person == "Your manager") "A tua chefia" else it.person, pick(it.what), it.direction,
                today.minusDays(it.days).toString(), it.source, updatedAt = updatedAt)
        }
        val alarms = listOf(
            Alarm("a1", "07:00", if (pt) "Acordar" else "Wake up", if (pt) "Dias úteis" else "Weekdays", enabled = true, brief = true, updatedAt = updatedAt),
            Alarm("a2", "10:15", if (pt) "Chamada com a lead de design em 5 min" else "Design lead call in 5 min", if (pt) "Hoje" else "Today", enabled = true, byKo = true, updatedAt = updatedAt),
            Alarm("a3", "18:00", if (pt) "Sair para o padel" else "Leave for padel", if (pt) "Qui" else "Thu", enabled = false, byKo = true, updatedAt = updatedAt),
        )
        return Rows(workspaces, tasks, chunks, goals, nudges, followUps, alarms)
    }

    private fun quote(s: String) = "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""
}
