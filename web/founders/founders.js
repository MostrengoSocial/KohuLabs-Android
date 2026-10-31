/* Kohu Founders: Kō runs the day, you do the chunks.
 *
 * The app for the Kohu Labs founder (João Duarte), from the Claude Design project "Kohu Founders App"
 * (file "Ko Phone"). The data, copy (EN and PT) and behaviour below are the design's own; Kō's replies are
 * scripted until he is wired to OpenRouter. index.html holds the screens, dc.js renders them.
 *
 * Deep links set the starting point, using the design's props: ?screen=spend, ?mode=revolut, ?lang=pt,
 * ?homeVariant=timeline, ?homeOpen=true, ?meetTab=after, ?mcpSheet=add, ?ringPhase=brief, ?koDemo=alarm ...
 */
(function () {
'use strict';

  const DAY = [
    ['c1','08:30',15,'Inbox triage','Triagem do email','ops'],
    ['c2','08:45',25,'Review cash position','Rever posição de caixa','fin'],
    ['c3','09:15',25,'Investor update: outline','Update a investidores: estrutura','inv'],
    ['c4','09:45',25,'Investor update: metrics','Update a investidores: métricas','inv'],
    ['c5','10:20',30,'Call with design lead','Chamada com a lead de design','team'],
    ['c6','11:00',25,'Screen three CVs','Analisar três CVs','hire'],
    ['c7','14:00',25,'Pricing page: review copy','Página de preços: rever texto','prod'],
    ['c8','14:30',15,'Send October invoices','Enviar faturas de outubro','fin'],
    ['c9','15:00',45,'Weekly ops review','Revisão semanal de operações','ops'],
  ];
  const GROUPS = { ops:['Operations','Operações'], fin:['Finance','Finanças'], inv:['Investor update','Investidores'], team:['Team','Equipa'], hire:['Hiring','Recrutamento'], prod:['Product','Produto'] };
  const MODELS = ['anthropic/claude-sonnet-4.5','openai/gpt-5','google/gemini-2.5-pro'];
  const T = {
    en: { date:'Thu 29 Oct', navToday:'Today', navWeek:'Stats', navKo:'Kō', navInbox:'Inbox', navYou:'You',
      left:n=>`${n} chunks left.`, leftB:'One at a time.', now:'Now', later:'Today', done:'Done', split:'Split', skip:'Skip', upNext:'Up next', leftSuffix:'left', elapsed:'in',
      dayA:'Day complete.', dayB:'Rest well.', focusKo:'Metrics come after this. I already pulled last month\u2019s numbers into the doc.',
      mapA:'Your day,', mapB:'mapped.', lgDone:'Done', lgPlanned:'Planned', lgFree:'Free', stDone:'Done', stLeft:'Left', stFree:'Free',
      taskEyebrow:'Task · due Fri', taskA:'Investor update.', taskB:'Five chunks.', taskKo:'I split this by section, so each chunk ends with something you can send for review.', startNext:'Start next chunk', resplit:'Ask Kō to re-split',
      stages:['Outline','Metrics','Wins','Asks','Send'], sub:[['Outline','Today 09:15'],['Metrics section','Today 09:45'],['Wins and misses','Fri 09:00'],['Asks for investors','Fri 09:30'],['Send and log','Fri 10:00']],
      weekEyebrow:'Week', weekA:'38 chunks.', weekB:'21.5 hours of focus.', kpi:['Chunks done','Focus time','On plan','Split by Kō'], vs:'vs last week', chart:'Chunks per day', days:['M','T','W','T','F','S','S'], noticed:'Kō noticed', insight:'Your best focus is 09:00 to 11:00. I am keeping it clear of calls.',
      status:{idle:'Awake',listening:'Listening',thinking:'Thinking',speaking:'Speaking'}, hint:'Say \u201cHi Kō\u201d or just \u201cKō\u201d anytime, or tap the mic.', placeholder:'Ask Kō or give him a task', send:'Send', mic:'Mic',
      hello:'Morning, João. You have 9 chunks today and 2 are done. Want me to split anything bigger?',
      chips:['Split the investor update','What\u2019s next?','Move my calls to the afternoon'],
      inboxEyebrow:'Nudges from Kō', inbox:n=>n?`${n} nudge${n>1?'s':''}.`:'All clear.', inboxB:n=>n?'Decide when you have a minute.':'Kō will nudge you if something slips.',
      founder:'Founder', sModel:'Model', sKey:'OpenRouter key', connected:'Connected', sChunk:'Chunk length', sNudges:'Proactive nudges', sApp:'App', sLang:'Language', sTheme:'Theme', dark:'Dark', signOut:'Sign out',
      welA:'Your day.', welB:'In small pieces.', welBody:'Kō plans with you, splits big work into chunks you can finish, and wakes up when you call him.', signIn:'Continue with Google Workspace', oauthNote:'OAuth 2.0 with PKCE. Tokens live in the Android Keystore, no password ever touches the app.', chooseAcc:'Choose an account', toContinue:'to continue to Kohu Founders', otherAcc:'Use another account', consentTitle:'Kohu Founders wants to access your account', scopes:['See your name and email','See and edit your calendar events','Read email subjects to spot deadlines'], revokeNote:'You can revoke access anytime in Settings.', cancel:'Cancel', allow:'Allow', signingIn:'Signing in', signedIn:'Signed in', connectOR:'Connect OpenRouter', orTitle:'Authorize Kohu Founders', orBody:'Kō gets his own OpenRouter key with a monthly spend cap. You can change the cap anytime.', authorize:'Authorize', creatingKey:'Creating key', perMonth:'/ month',
      sAccount:'Account', scopeRows:[['Calendar','Read and write'],['Gmail','Subjects only'],['Session','Keystore · 89 days']], revokeAll:'Revoke all access', revoke:'Revoke',
      statsTabs:['Focus','Spend'], spEyebrow:'OpenRouter · October', spA:m=>m+' this month.', spB:m=>m+' left.', spProjected:'Projected', spCap:'Cap', spDaily:'Daily spend, last 14 days', spByModel:'By model', spByUse:'By use', uses:['Chat and voice','Task splitting','Nudges'], spK:['Today','Requests','Per day','Tokens'], spN:['vs daily avg','this month','average','this month'], spCapLabel:'Monthly cap', spInsight:'Nudges run on Sonnet. Moving them to Gemini would save about $5 a month.',
      conA:'Connect', conB:'Kō\u2019s brain.', conBody:'Kō thinks through OpenRouter. Connect your account and he gets his own key, with a spend cap.', keyLabel:'OpenRouter API key', modelLabel:'Model', cont:'Continue',
      wakA:'Call him.', wakB:'Anytime.', wakBody:'Kō listens for his name, even with the screen locked. Audio stays on the phone until he wakes.', wakePhrase:'Wake phrases', lock:'Listen when locked', provCloud:'Cloud', provCloudSub:'OpenRouter', provLocal:'Your computer', provLocalSub:'Ollama · LM Studio', localPitch:'Kō runs on a model on your own computer. Nothing leaves your network and it costs nothing per request.', pairBtn:'Pair with your computer', pairTitle:'Pair with your computer', pairBody:'Open Kohu Bridge on your computer. Kō finds it on your Wi-Fi or over Tailscale when you are away.', found:'Found on your network', codeLabel:'Code shown on your computer', pair:'Pair', pairing:'Pairing', localModels:'Local models', localFallback:'If the computer is asleep, Kō falls back to OpenRouter. Turn this off in Settings.', brain:'Brain', local:'Local', lockDate:'Thursday, 29 October', wListening:'Kō is listening for \u201cHi Kō\u201d', wSimulate:'Say \u201cHi Kō, what\u2019s next?\u201d', wUnlock:'Swipe up to unlock', wOnDevice:'Wake word on device', wHeard:'What\u2019s next?', wAnswer:'Metrics section, 13 minutes left on the outline first. I put last month\u2019s numbers in the doc. Your 10:20 call is still on.', wOpen:'Open Kō', wStart:'Got it', tryWake:'Try a wake-up', finish:'Plan my day' },
    pt: { date:'Qui 29 out', navToday:'Hoje', navWeek:'Dados', navKo:'Kō', navInbox:'Avisos', navYou:'Eu',
      left:n=>`Faltam ${n} blocos.`, leftB:'Um de cada vez.', now:'Agora', later:'Hoje', done:'Feito', split:'Dividir', skip:'Saltar', upNext:'A seguir', leftSuffix:'restam', elapsed:'há',
      dayA:'Dia concluído.', dayB:'Descansa bem.', focusKo:'As métricas vêm a seguir. Já pus os números do mês passado no documento.',
      mapA:'O teu dia,', mapB:'em mapa.', lgDone:'Feito', lgPlanned:'Planeado', lgFree:'Livre', stDone:'Feitos', stLeft:'Faltam', stFree:'Livre',
      taskEyebrow:'Tarefa · entrega sex', taskA:'Update a investidores.', taskB:'Cinco blocos.', taskKo:'Dividi por secção, para cada bloco acabar com algo que podes enviar para revisão.', startNext:'Começar próximo bloco', resplit:'Pedir ao Kō para redividir',
      stages:['Estrutura','Métricas','Vitórias','Pedidos','Enviar'], sub:[['Estrutura','Hoje 09:15'],['Secção de métricas','Hoje 09:45'],['Vitórias e falhas','Sex 09:00'],['Pedidos aos investidores','Sex 09:30'],['Enviar e registar','Sex 10:00']],
      weekEyebrow:'Semana', weekA:'38 blocos.', weekB:'21,5 horas de foco.', kpi:['Blocos feitos','Tempo de foco','No plano','Divididos'], vs:'vs semana passada', chart:'Blocos por dia', days:['S','T','Q','Q','S','S','D'], noticed:'O Kō reparou', insight:'O teu melhor foco é das 09:00 às 11:00. Estou a mantê-lo livre de chamadas.',
      status:{idle:'Acordado',listening:'A ouvir',thinking:'A pensar',speaking:'A falar'}, hint:'Diz \u201cHi Kō\u201d ou só \u201cKō\u201d a qualquer momento, ou toca no micro.', placeholder:'Pergunta ou dá uma tarefa ao Kō', send:'Enviar', mic:'Micro',
      hello:'Bom dia, João. Tens 9 blocos hoje e 2 estão feitos. Queres que divida alguma coisa maior?',
      chips:['Divide o update a investidores','O que vem a seguir?','Passa as chamadas para a tarde'],
      inboxEyebrow:'Avisos do Kō', inbox:n=>n?`${n} aviso${n>1?'s':''}.`:'Tudo em ordem.', inboxB:n=>n?'Decide quando tiveres um minuto.':'O Kō avisa se algo escapar.',
      founder:'Fundador', sModel:'Modelo', sKey:'Chave OpenRouter', connected:'Ligada', sChunk:'Duração dos blocos', sNudges:'Avisos proativos', sApp:'App', sLang:'Idioma', sTheme:'Tema', dark:'Escuro', signOut:'Terminar sessão',
      welA:'O teu dia.', welB:'Em pequenos blocos.', welBody:'O Kō planeia contigo, divide o trabalho grande em blocos que consegues acabar e acorda quando o chamas.', signIn:'Continuar com Google Workspace', oauthNote:'OAuth 2.0 com PKCE. Os tokens ficam no Android Keystore, nenhuma palavra-passe passa pela app.', chooseAcc:'Escolha uma conta', toContinue:'para continuar para Kohu Founders', otherAcc:'Usar outra conta', consentTitle:'Kohu Founders quer aceder à sua conta', scopes:['Ver o seu nome e email','Ver e editar eventos do calendário','Ler assuntos de email para detetar prazos'], revokeNote:'Pode revogar o acesso a qualquer momento nas Definições.', cancel:'Cancelar', allow:'Permitir', signingIn:'A entrar', signedIn:'Sessão iniciada', connectOR:'Ligar OpenRouter', orTitle:'Autorizar Kohu Founders', orBody:'O Kō recebe uma chave OpenRouter própria com limite mensal de gastos. Podes mudar o limite quando quiseres.', authorize:'Autorizar', creatingKey:'A criar chave', perMonth:'/ mês',
      sAccount:'Conta', scopeRows:[['Calendário','Ler e escrever'],['Gmail','Só assuntos'],['Sessão','Keystore · 89 dias']], revokeAll:'Revogar todos os acessos', revoke:'Revogar',
      statsTabs:['Foco','Gastos'], spEyebrow:'OpenRouter · outubro', spA:m=>m+' este mês.', spB:m=>'Restam '+m+'.', spProjected:'Previsto', spCap:'Limite', spDaily:'Gasto diário, últimos 14 dias', spByModel:'Por modelo', spByUse:'Por uso', uses:['Chat e voz','Divisão de tarefas','Avisos'], spK:['Hoje','Pedidos','Por dia','Tokens'], spN:['vs média diária','este mês','média','este mês'], spCapLabel:'Limite mensal', spInsight:'Os avisos usam o Sonnet. Passá-los para o Gemini poupa cerca de 5 $ por mês.',
      conA:'Liga o', conB:'cérebro do Kō.', conBody:'O Kō pensa através do OpenRouter. Liga a tua conta e ele recebe uma chave própria, com limite de gastos.', keyLabel:'Chave API do OpenRouter', modelLabel:'Modelo', cont:'Continuar',
      wakA:'Chama-o.', wakB:'A qualquer hora.', wakBody:'O Kō está atento ao nome dele, mesmo com o ecrã bloqueado. O áudio fica no telemóvel até ele acordar.', wakePhrase:'Frases de ativação', lock:'Ouvir com ecrã bloqueado', provCloud:'Cloud', provCloudSub:'OpenRouter', provLocal:'O teu computador', provLocalSub:'Ollama · LM Studio', localPitch:'O Kō corre num modelo no teu próprio computador. Nada sai da tua rede e não custa nada por pedido.', pairBtn:'Emparelhar com o computador', pairTitle:'Emparelhar com o computador', pairBody:'Abre o Kohu Bridge no computador. O Kō encontra-o no Wi-Fi, ou pelo Tailscale quando estás fora.', found:'Encontrados na tua rede', codeLabel:'Código no ecrã do computador', pair:'Emparelhar', pairing:'A emparelhar', localModels:'Modelos locais', localFallback:'Se o computador estiver a dormir, o Kō usa o OpenRouter. Podes desligar isto nas Definições.', brain:'Cérebro', local:'Local', lockDate:'Quinta, 29 de outubro', wListening:'O Kō está atento a \u201cHi Kō\u201d', wSimulate:'Dizer \u201cHi Kō, o que vem a seguir?\u201d', wUnlock:'Desliza para desbloquear', wOnDevice:'Ativação no dispositivo', wHeard:'O que vem a seguir?', wAnswer:'A secção de métricas, depois de acabares a estrutura (faltam 13 minutos). Já pus os números do mês passado no documento. A chamada das 10:20 mantém-se.', wOpen:'Abrir Kō', wStart:'Percebido', tryWake:'Testar ativação', finish:'Planear o meu dia' },
  };
  const DAY_P = [
    ['p1','08:00',20,'Morning run','Corrida da manhã','health'],
    ['p2','09:45',15,'Book the dentist','Marcar o dentista','admin'],
    ['p3','12:30',30,'Groceries for the week','Compras da semana','home'],
    ['p4','17:30',25,'Read 20 pages','Ler 20 páginas','mind'],
    ['p5','19:00',15,'Call mum','Ligar à mãe','family'],
    ['p6','20:00',25,'Plan the Comporta weekend','Planear o fim de semana em Comporta','trip'],
  ];
  const DAY_R = [
    ['r1','09:00',15,'Standup notes','Notas do standup','rteam'],
    ['r2','09:30',25,'Review the fraud rules PRD','Rever o PRD de regras de fraude','rprod'],
    ['r3','10:30',30,'1:1 with your manager','1:1 com a chefia','rteam'],
    ['r4','11:15',25,'Draft Q4 OKRs','Rascunho dos OKR do T4','rplan'],
    ['r5','14:00',45,'Sprint planning','Planeamento do sprint','rteam'],
    ['r6','15:00',25,'Answer compliance questions','Responder ao compliance','rops'],
  ];
  Object.assign(GROUPS, { rteam:['Team','Equipa'], rprod:['Product','Produto'], rplan:['Planning','Planeamento'], rops:['Compliance','Compliance'] });
  Object.assign(GROUPS, { health:['Health','Saúde'], admin:['Admin','Burocracia'], home:['Home','Casa'], mind:['Reading','Leitura'], family:['Family','Família'], trip:['Weekend','Fim de semana'], fed:['Fed by you','Dado por ti'] });
  const SOURCE = { ops:'Gmail', fin:'Notion', inv:'Notion', team:'Calendar', hire:'Linear', prod:'Linear' };
  const SERVERS = [['gw','Google Workspace',null,9],['linear','Linear','mcp.linear.app',14],['notion','Notion','mcp.notion.com',11],['slack','Slack','mcp.slack.com',8],['github','GitHub','api.githubcopilot.com/mcp',30]];
  const STRIPE_TOOLS = [['list_customers','r'],['list_invoices','r'],['retrieve_balance','r'],['list_subscriptions','r'],['create_invoice','w'],['create_refund','w']];
  const TOOL_LOG = [['gmail.search',12,0],['linear.list_issues',4,0],['notion.get_page',3,0],['calendar.update_event',1,1]];
  Object.assign(T.en, { modes:['Kohu','Personal','Revolut'], feedIdleR:'Revolut workspace. No tools allowed here, so Kō only knows what you tell him.', hintR:'Revolut workspace. Tell Kō a task and he fits it into your day.', helloR:'Morning, João. Revolut workspace, so no tools here. Tell me what\u2019s on your plate and I\u2019ll fit it in.', chipsR:['Add: prep notes for sprint planning','Wake me at 06:45 for a run','What\u2019s next?','Plan my afternoon'], feedVoiceR:'prep notes for sprint planning', sMode:'Mode', sTools:'Tools (MCP)', toolsOff:'Off in this workspace', synced:'Synced from Gmail, Calendar, Linear, Notion · 2 min ago', feedLabel:'Feed Kō', feedPh:'A task, in your own words', add:'Add', feedIdle:'Personal mode. No tools, so Kō only knows what you tell him.', fedNote:(x,n,tm)=>`Added \u201c${x}\u201d. One ${n} min chunk at ${tm}.`, hintP:'Personal mode. Tell Kō a task and he fits it into your day.', helloP:'Morning, João. Personal mode, so I can\u2019t see your tools. Tell me what\u2019s on your mind and I\u2019ll fit it in.', chipsW:['Split the investor update','Triage my inbox','Wake me at 06:45 for a run','What\u2019s next?','Move my calls to the afternoon'], chipsP:['Add: renew my passport','Wake me at 06:45 for a run','What\u2019s next?','Plan my evening'], feedVoice:'renew my passport',
    tlBack:'You', tlEyebrow:'Work mode · MCP servers', tlA:n=>`${n} connected.`, tlB:'Kō asks before he writes.', tlBody:'Each server gives Kō tools. Choose how far he can go with each one.', builtIn:'Built in · OAuth', toolsN:n=>`${n} tools`, off:'Off', perms:['Read','Ask','Auto'], tlPerm:'Permission', tlAdd:'Add an MCP server', tlLog:'Today Kō used', logModes:['Auto','Asked you'], toolsCount:n=>`${n} on`,
    mcpTitle:'Add an MCP server', mcpBody:'Paste the server URL. Kō connects over Streamable HTTP and lists its tools before anything runs.', mcpUrl:'Server URL', mcpAuth:'Sign in with', auths:['OAuth','API token'], discover:'Find tools', discovering:'Finding tools', mcpFound:n=>`${n} tools found.`, mcpFoundBody:'Untick anything Kō should never call. Write tools follow the permission below.', connect:'Connect', read:'Read', write:'Write' });
  Object.assign(T.pt, { modes:['Kohu','Pessoal','Revolut'], feedIdleR:'Espaço Revolut. Aqui não há ferramentas, o Kō só sabe o que lhe contas.', hintR:'Espaço Revolut. Dá uma tarefa ao Kō e ele encaixa-a no teu dia.', helloR:'Bom dia, João. Espaço Revolut, por isso sem ferramentas. Diz-me o que tens em mãos e eu encaixo.', chipsR:['Junta: notas para o planeamento do sprint','Acorda-me às 06:45 para correr','O que vem a seguir?','Planeia a minha tarde'], feedVoiceR:'notas para o planeamento do sprint', sMode:'Modo', sTools:'Ferramentas (MCP)', toolsOff:'Desligadas aqui', synced:'Sincronizado com Gmail, Calendário, Linear, Notion · há 2 min', feedLabel:'Dá ao Kō', feedPh:'Uma tarefa, por palavras tuas', add:'Juntar', feedIdle:'Modo pessoal. Sem ferramentas, o Kō só sabe o que lhe contas.', fedNote:(x,n,tm)=>`Juntei \u201c${x}\u201d. Um bloco de ${n} min às ${tm}.`, hintP:'Modo pessoal. Dá uma tarefa ao Kō e ele encaixa-a no teu dia.', helloP:'Bom dia, João. Modo pessoal, por isso não vejo as tuas ferramentas. Diz-me o que tens em mente e eu encaixo.', chipsW:['Divide o update a investidores','Faz a triagem do email','Acorda-me às 06:45 para correr','O que vem a seguir?','Passa as chamadas para a tarde'], chipsP:['Junta: renovar o passaporte','Acorda-me às 06:45 para correr','O que vem a seguir?','Planeia a minha noite'], feedVoice:'renovar o passaporte',
    tlBack:'Eu', tlEyebrow:'Modo trabalho · servidores MCP', tlA:n=>`${n} ligados.`, tlB:'O Kō pergunta antes de escrever.', tlBody:'Cada servidor dá ferramentas ao Kō. Escolhe até onde ele pode ir com cada um.', builtIn:'Integrado · OAuth', toolsN:n=>`${n} ferramentas`, off:'Desligado', perms:['Ler','Perguntar','Auto'], tlPerm:'Permissão', tlAdd:'Juntar servidor MCP', tlLog:'Hoje o Kō usou', logModes:['Auto','Perguntou'], toolsCount:n=>`${n} ligados`,
    mcpTitle:'Juntar servidor MCP', mcpBody:'Cola o URL do servidor. O Kō liga-se por Streamable HTTP e mostra as ferramentas antes de correr seja o que for.', mcpUrl:'URL do servidor', mcpAuth:'Entrar com', auths:['OAuth','Token API'], discover:'Procurar', discovering:'A procurar ferramentas', mcpFound:n=>`${n} ferramentas encontradas.`, mcpFoundBody:'Desmarca o que o Kō nunca deve chamar. As de escrita seguem a permissão abaixo.', connect:'Ligar', read:'Ler', write:'Escrever' });
  const ALARMS = [
    { id:'a1', time:'07:00', label:['Wake up','Acordar'], days:['Weekdays','Dias úteis'], on:true, byKo:false, brief:true },
    { id:'a2', time:'10:15', label:['Design lead call in 5 min','Chamada com a lead de design em 5 min'], days:['Today','Hoje'], on:true, byKo:true },
    { id:'a3', time:'18:00', label:['Leave for padel','Sair para o padel'], days:['Thu','Qui'], on:false, byKo:true },
  ];
  Object.assign(T.en, { sAlarms:'Alarms', alarmsN:n=>`${n} on`, alEyebrow:'Alarms · on this phone', alA:n=>`${n} alarm${n===1?'':'s'} on.`, alB:'Kō sets them for you.', alKo:'Say \u201cKō, wake me at 7\u201d from anywhere, even locked. Alarms ring in every workspace, and the morning one ends with your brief.', alAsk:'Ask Kō to set one', alTest:'Test the 07:00 alarm', setByKo:'Set by Kō', briefAfter:'Brief after', alarm:'Alarm', ringDate:'Friday, 30 October', ringUp:'I\u2019m up', ringSnooze:'Snooze 10 min', ringIdle:'Kō will read your brief when you stop it', ringSnoozed:'Snoozed until 07:10. Tap I\u2019m up when ready.', briefTitle:'Morning brief', ringToday:'Open Today', alarmAsk:'Wake me at 06:45 for a run',
    brief:{ kohu:'Morning, João. 9 chunks today and the investor update is due tomorrow.', personal:'Morning, João. A light day: six things, nothing urgent.', revolut:'Morning. Standup at 09:00 and your OKR draft is due Monday.' },
    briefItems:{ kohu:[['08:30','Inbox triage, first chunk'],['Due tomorrow','Investor update, 3 chunks left'],['Decision','Pricing page, Friday or Monday']], personal:[['09:45','Book the dentist'],['12:30','Groceries for the week'],['19:00','Call mum']], revolut:[['09:00','Standup notes'],['10:30','1:1 with your manager'],['Monday','Q4 OKR draft']] } });
  Object.assign(T.pt, { sAlarms:'Alarmes', alarmsN:n=>`${n} ligados`, alEyebrow:'Alarmes · neste telemóvel', alA:n=>`${n} alarme${n===1?'':'s'} ligado${n===1?'':'s'}.`, alB:'O Kō marca-os por ti.', alKo:'Diz \u201cKō, acorda-me às 7\u201d em qualquer lado, mesmo bloqueado. Os alarmes tocam em todos os espaços, e o da manhã acaba com o teu resumo.', alAsk:'Pedir ao Kō um alarme', alTest:'Testar o alarme das 07:00', setByKo:'Marcado pelo Kō', briefAfter:'Resumo depois', alarm:'Alarme', ringDate:'Sexta, 30 de outubro', ringUp:'Já acordei', ringSnooze:'Adiar 10 min', ringIdle:'O Kō lê o teu resumo quando o desligares', ringSnoozed:'Adiado até às 07:10. Toca em Já acordei quando estiveres pronto.', briefTitle:'Resumo da manhã', ringToday:'Abrir Hoje', alarmAsk:'Acorda-me às 06:45 para correr',
    brief:{ kohu:'Bom dia, João. 9 blocos hoje e o update a investidores é amanhã.', personal:'Bom dia, João. Dia leve: seis coisas, nada urgente.', revolut:'Bom dia. Standup às 09:00 e o rascunho dos OKR é para segunda.' },
    briefItems:{ kohu:[['08:30','Triagem do email, primeiro bloco'],['Amanhã','Update a investidores, faltam 3 blocos'],['Decisão','Página de preços, sexta ou segunda']], personal:[['09:45','Marcar o dentista'],['12:30','Compras da semana'],['19:00','Ligar à mãe']], revolut:[['09:00','Notas do standup'],['10:30','1:1 com a chefia'],['Segunda','Rascunho dos OKR do T4']] } });
  const WS = { kohu:['Kohu','Kohu'], personal:['Personal','Pessoal'], revolut:['Revolut','Revolut'] };
  const GOALS = { kohu:[['g1','Send the investor update draft','Enviar o rascunho do update'],['g2','Inbox to zero','Email a zero'],['g3','Approve the pricing copy','Aprovar o texto de preços']], personal:[['g4','Run 5 km','Correr 5 km'],['g5','Call mum','Ligar à mãe'],['g6','Read 20 pages','Ler 20 páginas']], revolut:[['g7','Finish the PRD review','Acabar a revisão do PRD'],['g8','Draft two OKRs','Rascunhar dois OKR'],['g9','Answer compliance','Responder ao compliance']] };
  // General shows each workspace's first daily goal (a workspace can have none on a new day).
  const firstGoals = () => ['kohu','personal','revolut'].filter(w => GOALS[w] && GOALS[w][0]).map(w => [...GOALS[w][0], w]);
  const GUARD = [['kohu','09:18','Slack · #general','3 messages','3 mensagens'],['kohu','09:20','Gmail · Stripe','Payout sent','Pagamento enviado'],['revolut','09:22','Slack · sprint channel','2 messages','2 mensagens'],['personal','09:24','WhatsApp · family','5 messages','5 mensagens'],['personal','09:25','Instagram','12 likes','12 gostos']];
  const VIPS = [['Marta Silva','Marta Silva'],['Ana Reis','Ana Reis'],['Mum','Mãe']];
  const SLIP = { kohu:['c8','c7'], personal:['p3'], revolut:['r4','r6'], general:['c8','r4','p3'] };
  const FOL_YOU = [
    { id:'y1', ws:'kohu', name:'Ana Reis', what:['Lisbon VC, waiting on the deck follow-up','VC de Lisboa, à espera do seguimento do deck'], days:4, src:'Gmail' },
    { id:'y2', ws:'kohu', name:'Rui, accountant', what:['Needs your sign-off on Q3 VAT','Precisa da tua aprovação do IVA do T3'], days:3, src:'Gmail' },
    { id:'y3', ws:'revolut', name:'Priya, compliance', what:['Questions on the fraud rules','Perguntas sobre as regras de fraude'], days:2, src:null },
    { id:'y4', ws:'personal', name:'Landlord', what:['Confirm the plumber visit','Confirmar a visita do canalizador'], days:5, src:null },
  ];
  const FOL_THEM = [
    { id:'o1', ws:'kohu', name:'Marta Silva', what:['Mocks v2','Mocks v2'], days:2, src:'Gmail' },
    { id:'o2', ws:'personal', name:'Insurance', what:['Claim reply','Resposta ao sinistro'], days:9, src:null },
    { id:'o3', ws:'revolut', name:'Your manager', what:['OKR feedback','Feedback dos OKR'], days:1, src:null },
  ];
  const TOK = [['in',6.1,18.9,'var(--accent)'],['out',1.4,27.1,'var(--ink)'],['cr',2.1,0.7,'var(--muted)'],['cw',0.2,1.5,'var(--line)']];
  Object.assign(T.en, { modes:['Kohu','Personal','Revolut','General'], syncedG:'Kohu synced from 4 tools · Personal and Revolut fed by you', goesTo:'Goes to', inWs:w=>` In ${w}.`, helloG:'Morning, João. All three workspaces in one list. Pick a tab to see just one.', hintG:'General view. Kohu has tools, Personal and Revolut are fed by you.', chipsG:['What\u2019s next?','Triage my inbox','Add: renew my passport','Wake me at 06:45 for a run'],
    goalsLabel:'Daily goals', guardOn:n=>`Focus guard · ${n} held`, guardOffL:'Focus guard off · tap to turn on', guardEyebrow:x=>`Focus guard · until ${x}`, guardA:n=>n?`${n} held.`:'All clear.', guardB:n=>n?'Nothing urgent.':'Nothing waiting.', guardHeld:'Held for later', guardAuto:'Start with every chunk', guardVip:'Let VIPs through', guardVips:'VIPs', guardKo:'When the chunk ends I read these out, grouped by workspace. Your VIPs ring straight through.', guardRelease:'Release now', guardOffBtn:'Turn off for today', guardOnBtn:'Turn back on',
    revOpen:'Review the day', revEyebrow:'Day review', revA:n=>`${n} done.`, revB:n=>n?`${n} slipped.`:'Nothing slipped.', revDone:'Done today', revMore:n=>`And ${n} more`, revSlipped:'Slipped · what now?', slipOpts:['Tomorrow','Split','Drop'], revFeel:'How did today feel?', feels:['Drained','OK','Good'], revKo:'Your best stretch was the first two hours. I will keep the same window clear tomorrow.', revClose:'Close the day',
    meetEyebrow:'10:20 · 30 min · Google Meet', meetA:'Call with Marta.', meetB:'Design lead.', meetTabs:['Prep','After'], meetWho:'Design lead · last met 14 Oct', meetThread:'Last thread · Gmail · 2 days ago', meetThreadText:'She sent the pricing page mocks and asked for final copy by Thursday.', meetAsks:'Open asks', asks:[['Pricing page copy','You owe · Thu'],['Junior designer budget','Marta owes · this week']], meetPoints:'Talking points from Kō', points:['Confirm Thursday for the copy, or move launch to Monday','Agree a budget range for the junior designer','Ask what she needs from you before Friday'], meetSources:'gmail.search · notion.get_page · calendar.get_event', meetJoin:'Join call', meetAdd:'Add a point', meetSumLabel:'Summary · from the Meet transcript', meetSum:'Copy is due Thursday and launch stays Friday. The junior designer budget is approved up to \u20ac2,400 a month. Marta shares mocks v2 tomorrow.', meetActions:'Action items', meetActs:[['Write the final pricing copy','You · Thu'],['Post the junior designer role','You · Mon'],['Share mocks v2','Marta · Fri']], makeTasks:n=>`Make ${n} tasks`, tasksMade:n=>`${n} tasks added to Today`, recap:'Recap to Marta · draft', recapText:'Thanks for today. Copy by Thursday, launch Friday, junior role budget up to \u20ac2,400. I will post the role on Monday.', recapSend:'Send', recapEdit:'Edit', recapSent:'Sent · gmail.send · you approved',
    inboxTabs:['Nudges','Follow-ups'], folEyebrow:'Follow-ups', folA:n=>n?`${n} waiting on you.`:'Nobody waiting.', folB:n=>`${n} waiting on others.`, folYou:'Waiting on you', folThem:'Waiting on them', daysN:n=>n===1?'1 day':`${n} days`, draft:'Draft reply', remind:'Remind me', snooze:'Snooze 2d', toldYou:'Told by you', nudgeThem:'Nudge', nudged:'Nudged', folKo:'I flag anyone past 3 days. In Personal and Revolut I only track what you tell me.',
    tokTitle:'Tokens this month', tokTypes:{ in:'Input', out:'Output', cr:'Cache read', cw:'Cache write' }, ctxTitle:'Context now · Kō chat', ctxNote:'Kō compacts the chat at 80%', ctxAvg:'Per request · 7.6K in · 1.1K out · 41% from cache', spByModel:'By model and provider', viaOR:'via OpenRouter', tokensW:'tokens', yourComputer:'Your computer' });
  Object.assign(T.en.brief, { general:'Morning, João. 21 chunks across three workspaces, 4 already done.' });
  Object.assign(T.en.briefItems, { general:[['09:15','Kohu · investor update outline'],['10:30','Revolut · 1:1 with your manager'],['19:00','Personal · call mum']] });
  Object.assign(T.pt, { modes:['Kohu','Pessoal','Revolut','Geral'], syncedG:'Kohu sincronizado com 4 ferramentas · Pessoal e Revolut dados por ti', goesTo:'Vai para', inWs:w=>` Em ${w}.`, helloG:'Bom dia, João. Os três espaços numa só lista. Escolhe um separador para ver só um.', hintG:'Vista geral. O Kohu tem ferramentas, Pessoal e Revolut são dados por ti.', chipsG:['O que vem a seguir?','Faz a triagem do email','Junta: renovar o passaporte','Acorda-me às 06:45 para correr'],
    goalsLabel:'Objetivos do dia', guardOn:n=>`Guarda de foco · ${n} retidos`, guardOffL:'Guarda de foco desligada · toca para ligar', guardEyebrow:x=>`Guarda de foco · até às ${x}`, guardA:n=>n?`${n} retidos.`:'Tudo limpo.', guardB:n=>n?'Nada urgente.':'Nada à espera.', guardHeld:'Retidos para depois', guardAuto:'Ligar em cada bloco', guardVip:'Deixar passar VIPs', guardVips:'VIPs', guardKo:'Quando o bloco acabar leio-os, agrupados por espaço. Os teus VIPs passam sempre.', guardRelease:'Libertar agora', guardOffBtn:'Desligar hoje', guardOnBtn:'Voltar a ligar',
    revOpen:'Rever o dia', revEyebrow:'Revisão do dia', revA:n=>`${n} feitos.`, revB:n=>n?`${n} escaparam.`:'Nada escapou.', revDone:'Feito hoje', revMore:n=>`E mais ${n}`, revSlipped:'Escaparam · e agora?', slipOpts:['Amanhã','Dividir','Largar'], revFeel:'Como foi o dia?', feels:['Exausto','OK','Bom'], revKo:'O teu melhor período foram as duas primeiras horas. Amanhã mantenho a mesma janela livre.', revClose:'Fechar o dia',
    meetEyebrow:'10:20 · 30 min · Google Meet', meetA:'Chamada com a Marta.', meetB:'Lead de design.', meetTabs:['Preparar','Depois'], meetWho:'Lead de design · última vez a 14 out', meetThread:'Última conversa · Gmail · há 2 dias', meetThreadText:'Enviou os mocks da página de preços e pediu o texto final até quinta.', meetAsks:'Pendentes', asks:[['Texto da página de preços','Deves tu · qui'],['Orçamento do designer júnior','Deve a Marta · esta semana']], meetPoints:'Pontos do Kō', points:['Confirmar quinta para o texto, ou passar o lançamento para segunda','Acordar o orçamento para o designer júnior','Perguntar o que ela precisa de ti antes de sexta'], meetSources:'gmail.search · notion.get_page · calendar.get_event', meetJoin:'Entrar', meetAdd:'Juntar ponto', meetSumLabel:'Resumo · da transcrição do Meet', meetSum:'O texto é para quinta e o lançamento mantém-se na sexta. O orçamento do designer júnior está aprovado até 2400 \u20ac por mês. A Marta partilha os mocks v2 amanhã.', meetActions:'Ações', meetActs:[['Escrever o texto final de preços','Tu · qui'],['Publicar a vaga de designer júnior','Tu · seg'],['Partilhar mocks v2','Marta · sex']], makeTasks:n=>`Criar ${n} tarefas`, tasksMade:n=>`${n} tarefas juntas ao Hoje`, recap:'Resumo para a Marta · rascunho', recapText:'Obrigado por hoje. Texto até quinta, lançamento na sexta, vaga júnior até 2400 \u20ac. Publico a vaga na segunda.', recapSend:'Enviar', recapEdit:'Editar', recapSent:'Enviado · gmail.send · aprovaste',
    inboxTabs:['Avisos','Pendentes'], folEyebrow:'Pendentes', folA:n=>n?`${n} à tua espera.`:'Ninguém à espera.', folB:n=>`${n} à espera de outros.`, folYou:'À tua espera', folThem:'À espera deles', daysN:n=>n===1?'1 dia':`${n} dias`, draft:'Rascunho', remind:'Lembrar', snooze:'Adiar 2d', toldYou:'Dito por ti', nudgeThem:'Lembrar', nudged:'Lembrado', folKo:'Assinalo quem passa dos 3 dias. No Pessoal e no Revolut só acompanho o que me contas.',
    tokTitle:'Tokens este mês', tokTypes:{ in:'Entrada', out:'Saída', cr:'Cache lida', cw:'Cache escrita' }, ctxTitle:'Contexto agora · chat do Kō', ctxNote:'O Kō compacta o chat aos 80%', ctxAvg:'Por pedido · 7,6K entrada · 1,1K saída · 41% de cache', spByModel:'Por modelo e fornecedor', viaOR:'via OpenRouter', tokensW:'tokens', yourComputer:'O teu computador' });
  Object.assign(T.pt.brief, { general:'Bom dia, João. 21 blocos em três espaços, 4 já feitos.' });
  Object.assign(T.pt.briefItems, { general:[['09:15','Kohu · estrutura do update'],['10:30','Revolut · 1:1 com a chefia'],['19:00','Pessoal · ligar à mãe']] });
  const BEH = { stroll:['happy','idle',6,3], dash:['surprised','speaking',2.6,1], wander:['curious','idle',7,3], peek:['curious','listening',5,2], nap:['sleepy','idle',6,2], ponder:['neutral','thinking',5,2], hum:['happy','speaking',3.5,2] };
  Object.assign(T.en, { beh:{ stroll:'Strolling', dash:'Dashing', wander:'Wandering', peek:'Peeking in', nap:'Napping', ponder:'Pondering', hum:'Humming', lost:'Where was I?' }, tapKo:'tap him', hFocus:'Focus', hChunks:n=>`${n} chunks left`, hTalk:'Talk', hMap:'Day map', hGuard:'Focus guard', hHeld:n=>`${n} held`, goalsShort:'goals' });
  Object.assign(T.pt, { beh:{ stroll:'A passear', dash:'A correr', wander:'Às voltas', peek:'A espreitar', nap:'A dormir', ponder:'A pensar', hum:'A cantarolar', lost:'Onde é que eu ia?' }, tapKo:'toca-lhe', hFocus:'Foco', hChunks:n=>`Faltam ${n} blocos`, hTalk:'Falar', hMap:'Mapa do dia', hGuard:'Guarda de foco', hHeld:n=>`${n} retidos`, goalsShort:'objetivos' });
  const SPLIT_ITEMS = l => T[l].sub.map(s => ({ b: s[0], s: s[1] + ' · 25 min' }));
  const R = {
    split: { en:'Here it is in five chunks of 25 minutes. The first two fit before your 10:20 call.', pt:'Aqui está em cinco blocos de 25 minutos. Os dois primeiros cabem antes da chamada das 10:20.', items:true },
    next: { en:'Metrics section, 25 minutes. I already pulled last month\u2019s numbers into the doc.', pt:'Secção de métricas, 25 minutos. Já pus os números do mês passado no documento.' },
    move: { en:'Done. Your 10:20 call is now at 15:45, so the morning stays clear for focus.', pt:'Feito. A chamada das 10:20 passou para as 15:45, a manhã fica livre para foco.' },
    other: { en:'Got it. I would split that into three chunks of 25 minutes. Once OpenRouter is connected I can plan it properly.', pt:'Percebi. Dividia isso em três blocos de 25 minutos. Quando o OpenRouter estiver ligado, planeio a sério.' },
  };
  const R2 = {
    triage:{ en:'Triaged 23 emails. Three need you today, two became Linear issues, the rest are archived.', pt:'Triei 23 emails. Três precisam de ti hoje, dois passaram a issues no Linear, o resto está arquivado.', tools:'gmail.search · linear.create_issue', list:{ en:[['Reply','Ana, Lisbon VC: deck follow-up'],['Reply','Accountant: Q3 VAT'],['Decide','Design lead: offer terms']], pt:[['Responder','Ana, VC de Lisboa: seguimento do deck'],['Responder','Contabilista: IVA do T3'],['Decidir','Lead de design: termos da oferta']] } },
    nextP:{ en:'Book the dentist, 15 minutes. After that, nothing until groceries at 12:30.', pt:'Marcar o dentista, 15 minutos. Depois, nada até às compras das 12:30.' },
    evening:{ en:'Tonight: call mum at 19:00, then 25 minutes on the Comporta weekend. I kept 21:00 onward free.', pt:'Esta noite: ligar à mãe às 19:00, depois 25 minutos para o fim de semana em Comporta. Deixei livre a partir das 21:00.' },
    nextR:{ en:'Fraud rules PRD, 25 minutes. Your 1:1 is at 10:30, so you have room.', pt:'PRD de regras de fraude, 25 minutos. O 1:1 é às 10:30, tens folga.' },
    afternoon:{ en:'Afternoon: sprint planning at 14:00, then compliance answers. I kept 15:30 to 17:00 for deep work.', pt:'Tarde: planeamento do sprint às 14:00, depois o compliance. Deixei das 15:30 às 17:00 para trabalho focado.' },
    moveP:{ en:'I can\u2019t see your calendar in this workspace. Tell me the new time and I\u2019ll plan around it.', pt:'Neste espaço não vejo o teu calendário. Diz-me a nova hora e eu planeio à volta.' },
  };
  R2.alarm = { en:'Done. Alarm at 06:45 tomorrow, \u201cRun before work\u201d. When you stop it I\u2019ll read your morning brief.', pt:'Feito. Alarme às 06:45 amanhã, \u201cCorrida antes do trabalho\u201d. Quando o desligares leio-te o resumo da manhã.', tools:'clock.set_alarm · on device', device:true };
  Object.assign(R, R2); R.next.tools = 'notion.get_page'; R.move.tools = 'calendar.update_event · asked first';
  const NUDGES = [
    { id:'n1', kind:['Decision','Decisão'], pill:'k-pill k-pill-build', time:['08:52','08:52'], title:['Ship the pricing page Friday or Monday?','Página de preços na sexta ou na segunda?'], body:['Copy review is at 14:00. Friday works if it passes.','A revisão do texto é às 14:00. Sexta dá se passar.'], actions:[['Friday','Sexta'],['Monday','Segunda']] },
    { id:'n2', kind:['Risk','Risco'], pill:'k-pill k-pill-live', time:['08:40','08:40'], title:['Investor update is due tomorrow','O update a investidores é amanhã'], body:['Three chunks are not scheduled yet. I can put them in tomorrow morning.','Há três blocos por agendar. Posso pô-los amanhã de manhã.'], actions:[['Schedule them','Agendar'],['Later','Mais tarde']] },
    { id:'n3', kind:['Break','Pausa'], pill:'k-pill', time:['Yesterday','Ontem'], title:['You worked 95 minutes without a break','Trabalhaste 95 minutos sem pausa'], body:['I moved the ops review 10 minutes later.','Adiei a revisão de operações 10 minutos.'], actions:[['Thanks','Obrigado']] },
  ];
  NUDGES[0].mode = 'work'; NUDGES[1].mode = 'work';
  NUDGES.push({ id:'n4', mode:'personal', kind:['Reminder','Lembrete'], pill:'k-pill k-pill-build', time:['Mon','Seg'], title:['You told Kō: renew passport before December','Disseste ao Kō: renovar o passaporte antes de dezembro'], body:['It is one 25 minute chunk. Want it Saturday morning?','É um bloco de 25 minutos. Queres no sábado de manhã?'], actions:[['Saturday','Sábado'],['Later','Mais tarde']] });
  NUDGES.push({ id:'n6', kind:['Review','Revisão'], pill:'k-pill', time:['18:00','18:00'], title:['Your day review is ready','A revisão do dia está pronta'], body:['Sixty seconds: what got done, what slipped, and tomorrow.','Sessenta segundos: o que ficou feito, o que escapou, e amanhã.'], actions:[['Review now','Rever agora'],['Later','Mais tarde']], go:'review' });
  NUDGES.push({ id:'n5', mode:'revolut', kind:['Risk','Risco'], pill:'k-pill k-pill-live', time:['08:30','08:30'], title:['Q4 OKR draft is due Monday','O rascunho dos OKR do T4 é para segunda'], body:['You gave me this on Tuesday. One chunk is planned, it probably needs two.','Deste-me isto na terça. Há um bloco planeado, deve precisar de dois.'], actions:[['Add a chunk','Juntar bloco'],['It is fine','Está bem']] });
  const HOSTS = [['MacBook Pro de João','Ollama · 192.168.1.24:11434'],['Studio PC','LM Studio · 100.86.4.12:1234 · Tailscale']];
  const LOCAL_MODELS = [['qwen2.5:14b','9.0 GB'],['llama3.1:8b','4.9 GB'],['mistral-nemo:12b','7.1 GB']];
  const CAPS = [50,200,500]; const SPENT = 48.2;
  const DAILY = [1.2,1.9,2.6,1.4,1.1,0.4,0.3,1.8,2.9,2.2,1.7,1.5,1.9,2.14];
  const BY_MODEL = [['claude-sonnet-4.5',31.4,'Anthropic','6.4M'],['gpt-5',12.1,'OpenAI','2.3M'],['gemini-2.5-pro',4.7,'Google','1.1M']]; const BY_USE = [22.8,17.6,7.8];
  const money = (v,L,d=2) => L ? v.toFixed(d).replace('.',',')+' $' : '$'+v.toFixed(d);
  const fmt = s => { s = Math.max(0, Math.round(s)); return String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0'); };

  class Component extends DC.DCLogic {
    state = { homeView:null, homeOpen:null, tilesIn:false, beh:'stroll', lost:false, feedTarget:'personal', goalsDone:['g4'], guardOn:true, guardAuto:true, guardVip:true, vipOff:[], released:false, slipPick:{}, feel:null, meetTab:null, meetOff:[], meetMade:false, recapSent:false, folDone:[], nudgedThem:[], alarms:ALARMS, ringPhase:null, snoozed:false, mode:null, fed:[], feedInput:'', feedNote:null, feedListening:false, mcp:undefined, mcpUrl:'https://mcp.stripe.com', mcpAuth:0, mcpOff:[], mcpPermNew:1, stripe:false, srvOn:{ gw:true, linear:true, notion:true }, srvPerm:{ notion:0 }, provider:'or', localOn:false, host:0, localModel:0, wakePhase:null, heardN:0, screen:null, lang:null, step:null, oauth:undefined, orConnected:null, cap:1, scopeOff:[], done:['c1','c2','p1','r1'], skipped:[], split:{}, elapsed:708, model:0, wake:[0,1], lock:true, nudgesOn:true, chunk:1, dismissed:[], input:'', koState:'idle', messages:[{ who:'ko', key:'hello' }] };
    logRef = DC.createRef();
    timers = [];
    wakeUp = () => {
      const txt = T[this.lang()].wHeard; this.setState({ wakePhase:'listening', heardN:0 });
      let n = 0; const step = () => { n++; this.setState({ heardN:n }); if (n < txt.length) this.later(step, 55); else { this.later(() => this.setState({ wakePhase:'thinking' }), 500); this.later(() => this.setState({ wakePhase:'speaking' }), 1500); this.later(() => this.setState({ wakePhase:'answered' }), 3200); } };
      this.later(step, 600);
    };
    componentDidMount() {
      if (this.props.homeOpen) this.setState({ tilesIn:true });
      this.raf = requestAnimationFrame(this.step); if (this.props.koDemo === 'alarm') this.setState({ messages:[{ who:'ko', key:'hello' }, { who:'user', text:T[this.lang()].alarmAsk }, { who:'ko', key:'alarm' }], alarms:[{ id:'a4', time:'06:45', label:['Run before work','Corrida antes do trabalho'], days:['Tomorrow','Amanhã'], on:true, byKo:true, brief:true }, ...ALARMS] }); if (this.props.ringPhase === 'brief') this.setState({ ringPhase:'brief' }); if (this.props.wakePhase === 'answered') this.setState({ wakePhase:'answered', heardN:99 }); this.tick = setInterval(() => { if (this.scr() === 'home') this.setState(s => ({ elapsed: s.elapsed + 1 })); }, 1000); }
    componentWillUnmount() { clearInterval(this.tick); cancelAnimationFrame(this.raf); clearTimeout(this.lostT); this.timers.forEach(clearTimeout); }
    componentDidUpdate() { const el = this.logRef.current; if (el) el.scrollTop = el.scrollHeight; }
    later(fn, ms) { this.timers.push(setTimeout(fn, ms)); }
    stepV() { return this.state.step ?? this.props.step ?? 0; }
    oauthV() { return this.state.oauth !== undefined ? this.state.oauth : (this.props.oauth ?? null); }
    orV() { return this.state.orConnected ?? (this.props.orConnected ?? false); }
    scr() { return this.state.screen ?? this.props.screen ?? 'home'; }
    koRef = DC.createRef(); stageRef = DC.createRef();
    k = { x:80, y:170, vx:0, vy:0, beh:'stroll', t:0, dur:6, a:0, baseY:170, cx:0, cy:0, tx:0, init:false, resume:false, returning:false };
    pickBeh() { const W = this.W || 360, H = this.H || 600, k = this.k; if (k.x < -20 || k.x > W - 180 || k.y < 0 || k.y > H - 230) { k.returning = true; return this.enterBeh('stroll'); } const keys = Object.keys(BEH).filter(b => b !== this.k.beh); let r = Math.random() * keys.reduce((a,b) => a + BEH[b][3], 0); let nb = keys[0]; for (const b of keys) { r -= BEH[b][3]; if (r <= 0) { nb = b; break; } } this.enterBeh(nb); }
    enterBeh(b) {
      const k = this.k, W = this.W || 360; k.beh = b; k.t = 0; k.dur = BEH[b][2] * (0.8 + Math.random() * 0.4); const dir = Math.random() < 0.5 ? -1 : 1;
      if (b === 'stroll') { k.vx = dir * 45; k.baseY = k.y; k.turn = false; }
      if (b === 'dash') { k.vx = dir * 260; k.vy = (Math.random() - 0.5) * 60; }
      if (b === 'wander') k.a = Math.random() * Math.PI * 2;
      if (b === 'peek') k.tx = dir < 0 ? -70 : W - 130;
      if (b === 'nap' && !k.vx) k.vx = dir * 20;
      if (b === 'ponder') { k.a = 0; k.cx = k.x - 28; k.cy = k.y; }
      if (b === 'hum') k.baseY = k.y;
      this.setState({ beh:b });
    }
    step = ts => {
      this.raf = requestAnimationFrame(this.step);
      const el = this.koRef.current, st = this.stageRef.current; if (!el || !st) { this.lastTs = ts; return; }
      const dt = Math.min(0.05, (ts - (this.lastTs || ts)) / 1000); this.lastTs = ts;
      const W = this.W = st.clientWidth, H = this.H = st.clientHeight, S = 200, k = this.k;
      const minX = -20, maxX = W - S + 20, minY = 0, maxY = Math.max(0, H - S - 30);
      if (!k.init) { k.init = true; k.x = (W - S) / 2; k.y = H * 0.28; this.enterBeh('stroll'); }
      if (this.homeOpenV()) { const e = Math.min(1, dt * 3.5); k.x += ((W - S) / 2 - k.x) * e; k.y += (0 - k.y) * e; k.resume = true; }
      else {
        if (k.resume) { k.resume = false; this.enterBeh('stroll'); }
        k.t += dt; const b = k.beh;
        if (b === 'stroll') { k.x += k.vx * dt; k.y = k.baseY + Math.sin(k.t * 1.6) * 8; }
        else if (b === 'dash') { k.x += k.vx * dt; k.y += k.vy * dt; }
        else if (b === 'wander') { k.a += (Math.random() - 0.5) * dt * 3; k.x += Math.cos(k.a) * 55 * dt; k.y += Math.sin(k.a) * 55 * dt; }
        else if (b === 'peek') k.x += (k.tx - k.x) * Math.min(1, dt * 1.6);
        else if (b === 'nap') { k.x += k.vx * dt; k.vx *= Math.max(0, 1 - dt * 1.5); k.y += 3 * dt; }
        else if (b === 'ponder') { k.a += dt * 1.3; k.x = k.cx + Math.cos(k.a) * 28; k.y = k.cy + Math.sin(k.a) * 18; }
        else if (b === 'hum') k.y = k.baseY - Math.abs(Math.sin(k.t * 5)) * 12;
        if (k.returning) {
          const cx = (W - S) / 2, cy = H * 0.3, dx = cx - k.x, dy = cy - k.y, d = Math.hypot(dx, dy) || 1;
          k.x += dx / d * 80 * dt; k.y += dy / d * 80 * dt; if (b === 'stroll') k.baseY = k.y;
          if (k.x >= minX && k.x <= maxX && k.y >= minY && k.y <= maxY) k.returning = false;
        }
        const free = b === 'dash' || k.returning;
        if (!free) {
          const M = 60;
          if (b === 'stroll') { const near = (k.vx > 0 && k.x > maxX - M) || (k.vx < 0 && k.x < minX + M); if (near) k.turn = true; if (k.turn) { const goal = (k.x > (W - S) / 2 ? -1 : 1) * 45; k.vx += (goal - k.vx) * Math.min(1, dt * 1.1); if (Math.abs(k.vx - goal) < 3) k.turn = false; } }
          if (b === 'wander') { const inX = k.x < minX + M || k.x > maxX - M, inY = k.y < minY + M || k.y > maxY - M; if (inX || inY) { const ta = Math.atan2((H * 0.3) - k.y, (W - S) / 2 - k.x); let d = ta - k.a; d = Math.atan2(Math.sin(d), Math.cos(d)); k.a += d * Math.min(1, dt * 1.4); } }
          if (b === 'ponder') { k.cx += (Math.min(Math.max(k.cx, minX + 30), maxX - 30) - k.cx) * Math.min(1, dt * 1.5); k.cy += (Math.min(Math.max(k.cy, minY + 20), maxY - 20) - k.cy) * Math.min(1, dt * 1.5); }
          if (b === 'stroll' || b === 'hum') k.baseY += (Math.min(Math.max(k.baseY, minY + 14), maxY - 14) - k.baseY) * Math.min(1, dt * 1.5);
          const e = Math.min(1, dt * 2);
          if (k.x < minX) k.x += (minX - k.x) * e; else if (k.x > maxX) k.x += (maxX - k.x) * e;
          if (k.y < minY) k.y += (minY - k.y) * e; else if (k.y > maxY) k.y += (maxY - k.y) * e;
        }
        let wrapped = false;
        if (b === 'dash') {
          if (k.x > W) { k.x = -S; wrapped = true; } else if (k.x < -S) { k.x = W; wrapped = true; }
          if (k.y > H) { k.y = -S; wrapped = true; } else if (k.y < -S) { k.y = H; wrapped = true; }
        }
        if (wrapped) {
          if (b === 'stroll' || b === 'hum') k.baseY = k.y;
          if (b === 'ponder') { k.cx = k.x; k.cy = k.y; }
          if (wrapped) { this.setState({ lost:true }); clearTimeout(this.lostT); this.lostT = setTimeout(() => this.setState({ lost:false }), 1400); }
        }
        if (k.t > k.dur) this.pickBeh();
      }
      el.style.transform = 'translate(' + k.x.toFixed(1) + 'px,' + k.y.toFixed(1) + 'px)';
    };
    variantV() { return this.state.homeView ?? this.props.homeVariant ?? 'ko'; }
    homeOpenV() { return this.state.homeOpen ?? this.props.homeOpen ?? false; }
    mode() { const m = this.state.mode ?? this.props.mode ?? 'kohu'; return m === 'work' ? 'kohu' : m; }
    inMode(ws) { const m = this.mode(); return m === 'general' || m === ws; }
    mcpV() { return this.state.mcp !== undefined ? this.state.mcp : (this.props.mcpSheet ?? null); }
    feed(raw) {
      const x = raw.trim(); if (!x) return '';
      const title = x[0].toUpperCase() + x.slice(1); const min = [15,25,45][this.state.chunk];
      const md = this.mode() === 'general' ? this.state.feedTarget : this.mode(); const mine = this.state.fed.filter(f => f.mode === md);
      const start = mine.reduce((a,f) => a + f.min + 5, md === 'revolut' ? 15*60+30 : 20*60+30);
      const time = String(Math.floor(start/60)).padStart(2,'0') + ':' + String(start%60).padStart(2,'0');
      this.setState(s => ({ fed:[...s.fed, { id:'f'+s.fed.length, mode:md, time, min, title }] }));
      return T[this.lang()].fedNote(title, min, time) + (this.mode() === 'general' ? T[this.lang()].inWs(WS[md][this.lang()==='pt'?1:0]) : '');
    }
    lang() { return this.state.lang ?? this.props.lang ?? 'en'; }
    go = s => this.setState({ screen: s });
    chunks() {
      const L = this.lang() === 'pt' ? 1 : 0; const out = [];
      const md = this.mode();
      const tag = (arr, ws) => arr.map(d => [...d, ws]);
      const fedOf = ws => this.state.fed.filter(f => f.mode === ws).map(f => [f.id, f.time, f.min, f.title, f.title, 'fed', ws]);
      const src = md === 'general' ? [...tag(DAY,'kohu'), ...fedOf('kohu'), ...tag(DAY_P,'personal'), ...fedOf('personal'), ...tag(DAY_R,'revolut'), ...fedOf('revolut')].sort((a,b) => a[1].localeCompare(b[1])) : md === 'kohu' ? [...tag(DAY,'kohu'), ...fedOf('kohu')] : [...tag(md === 'revolut' ? DAY_R : DAY_P, md), ...fedOf(md)];
      src.forEach(d => {
        const base = { time:d[1], min:d[2], title:d[3+L], group:d[5], task:GROUPS[d[5]][L], ws:d[6] };
        if (this.state.split[d[0]]) {
          const h = Math.round(d[2]/2); const [hh, mm] = d[1].split(':').map(Number); const t2 = hh*60+mm+h;
          out.push({ ...base, id:d[0]+'a', min:h, title:base.title+' (1/2)' });
          out.push({ ...base, id:d[0]+'b', min:d[2]-h, time:String(Math.floor(t2/60)).padStart(2,'0')+':'+String(t2%60).padStart(2,'0'), title:base.title+' (2/2)' });
        } else out.push({ ...base, id:d[0] });
      });
      const now = out.find(c => !this.state.done.includes(c.id) && !this.state.skipped.includes(c.id));
      return out.map(c => ({ ...c, isDone:this.state.done.includes(c.id), isNow: now && c.id === now.id }));
    }
    send(text) {
      if (!text.trim()) return;
      const q = text.toLowerCase(); const md = this.mode(); const P = md === 'personal' || md === 'revolut'; const RV = md === 'revolut';
      const key = /alarm|wake me|acorda-me/.test(q) ? 'alarm' : !P && /triag|inbox/.test(q) ? 'triage' : !P && /split|divid|re-split|redivid/.test(q) ? 'split' : /next|seguir/.test(q) ? (RV ? 'nextR' : P ? 'nextP' : 'next') : RV && /afternoon|tarde/.test(q) ? 'afternoon' : P && /evening|noite/.test(q) ? 'evening' : /call|chamada|move|passa/.test(q) ? (P ? 'moveP' : 'move') : 'other';
      let msg = { who:'ko', key };
      if (key === 'alarm') this.later(() => this.setState(s => s.alarms.some(a => a.id === 'a4') ? null : ({ alarms:[{ id:'a4', time:'06:45', label:['Run before work','Corrida antes do trabalho'], days:['Tomorrow','Amanhã'], on:true, byKo:true, brief:true }, ...s.alarms] })), 1100);
      if ((P || md === 'general') && key === 'other') msg = { who:'ko', text: this.feed(text.replace(/^\s*(add|junta)\s*:?\s*/i, '')) };
      this.setState(s => ({ messages:[...s.messages, { who:'user', text }], input:'', koState:'thinking' }));
      this.later(() => this.setState(s => ({ messages:[...s.messages, msg], koState:'speaking' })), 1100);
      this.later(() => this.setState({ koState:'idle' }), 2600);
    }
    renderVals() {
      const lang = this.lang(); const L = lang === 'pt' ? 1 : 0; const t = T[lang]; const scr = this.scr();
      const variant = this.variantV(); const S = this.state; const mode = this.mode(); const RV = mode === 'revolut'; const GEN = mode === 'general'; const P = mode === 'personal' || RV;
      const list = this.chunks(); const now = list.find(c => c.isNow); const left = list.filter(c => !c.isDone).length;
      const nowIdx = now ? list.indexOf(now) : -1; const next = now ? list.slice(nowIdx+1).find(c => !c.isDone) : null;
      const len = now ? now.min*60 : 1; const el = Math.min(S.elapsed, len);
      const tappable = g => g === 'inv' || g === 'team';
      const openTask = g => g === 'inv' ? () => this.go('task') : g === 'team' ? () => this.go('meeting') : undefined;
      const sel = on => on ? 'k-chip k-primary' : 'k-chip';
      const tog = on => ({ border: on ? 'var(--accent)' : 'var(--line)', bg: on ? 'var(--accent)' : 'transparent', knob: on ? '23px' : '3px', dot: on ? 'var(--accent-ink)' : 'var(--muted)' });
      const lk = tog(S.lock), nd = tog(S.nudgesOn);
      const toMin = x => { const [h,m] = x.split(':').map(Number); return h*60+m; };
      const busy = list.reduce((a,c) => a + c.min, 0);
      const freeMin = Math.max(0, 600 - busy - 90);
      const mapRows = [];
      for (let h = 8; h < 18; h++) {
        const cells = [0,30].map(off => {
          const st = h*60+off; const c = list.find(x => { const a = toMin(x.time); return a >= st && a < st+30; });
          const lunch = h === 12 || (h === 13 && off === 0);
          if (!c) return { label: lunch ? (L?'Almoço':'Lunch') : '', bg:'transparent', border:'var(--line)', borderStyle:'dashed', color:'var(--muted)', isNow:false, cursor:'default' };
          if (c.isDone) return { label:c.title, bg:'var(--accent)', border:'var(--accent)', borderStyle:'solid', color:'var(--accent-ink)', isNow:false, cursor:tappable(c.group)?'pointer':'default', onClick:openTask(c.group) };
          if (c.isNow) return { label:c.title, bg:'var(--surface)', border:'var(--accent)', borderStyle:'solid', color:'var(--ink)', isNow:true, cursor:'pointer', onClick:openTask(c.group) };
          return { label:c.title, bg:'var(--bg-2)', border:'var(--accent)', borderStyle:'solid', color:'var(--ink)', isNow:false, cursor:tappable(c.group)?'pointer':'default', onClick:openTask(c.group) };
        });
        mapRows.push({ hour:String(h).padStart(2,'0')+':00', cells });
      }
      const invDone = ['c3','c3a','c3b','c4','c4a','c4b'];
      const taskDoneCount = (S.done.includes('c3') || (S.done.includes('c3a') && S.done.includes('c3b')) ? 1 : 0) + (S.done.includes('c4') || (S.done.includes('c4a') && S.done.includes('c4b')) ? 1 : 0);
      const nudges = NUDGES.filter(n => (!n.mode || n.mode === mode || GEN) && !S.dismissed.includes(n.id)).map(n => ({ kind:n.kind[L], pillCls:n.pill, time:n.time[L], title:n.title[L], body:n.body[L],
        actions:n.actions.map((a,i) => ({ label:a[L], cls: i===0 ? 'k-chip k-primary' : 'k-chip', onClick:() => { this.setState(s => ({ dismissed:[...s.dismissed, n.id], nudgeAnswers:{ ...s.nudgeAnswers, [n.id]:a[L] } })); if (i === 0 && n.go) this.go(n.go); } })) }));
      const tabs = [['home',t.navToday],['week',t.navWeek],['ko',t.navKo],['inbox',t.navInbox],['you',t.navYou]];
      const activeTab = scr === 'task' ? 'home' : scr === 'spend' ? 'week' : (scr === 'tools' || scr === 'alarms') ? 'you' : ['guard','review','meeting'].includes(scr) ? 'home' : scr === 'follow' ? 'inbox' : scr;
      const servers = [...SERVERS.map(s => ({ id:s[0], name:s[1], url:s[2] || t.builtIn, tools:s[3] })), ...(S.stripe ? [{ id:'stripe', name:'Stripe', url:'mcp.stripe.com', tools:STRIPE_TOOLS.length - S.mcpOff.length }] : [])].map(s => {
        const on = !!S.srvOn[s.id]; const g = tog(on); const perm = S.srvPerm[s.id] ?? 1;
        return { name:s.name, meta:s.url + ' · ' + (on ? t.toolsN(s.tools) : t.off), on, border:g.border, bg:g.bg, knob:g.knob, dot:g.dot,
          onToggle:() => this.setState(st => ({ srvOn:{ ...st.srvOn, [s.id]:!on } })),
          perms:t.perms.map((p,i) => ({ label:p, cls:sel(perm===i), onClick:() => this.setState(st => ({ srvPerm:{ ...st.srvPerm, [s.id]:i } })) })) };
      });
      const nOn = servers.filter(s => s.on).length; const mcp = this.mcpV();
      const setMode = k => this.setState(s => ({ mode:k, screen: (s.screen ?? this.props.screen) === 'tools' && (k === 'personal' || k === 'revolut') ? 'you' : s.screen }));
      const koColor = { idle:'var(--acid)', listening:'var(--accent)', thinking:'var(--muted)', speaking:'var(--acid)' }[S.koState];
      const bars = [6,8,5,9,7,2,1].map((n,i) => ({ n, h: (n/9*80)+'px', bg: i===3 ? 'var(--accent)' : 'transparent', d:t.days[i], dayColor: i===3 ? 'var(--ink)' : 'var(--muted)' }));
      return {
        t, otherLang: L ? 'EN' : 'PT', toggleLang: () => this.setState({ lang: L ? 'en' : 'pt' }),
        isOnboarding: scr === 'onboarding', isStep0: this.stepV() === 0, isStep1: this.stepV() === 1, isStep2: this.stepV() === 2, stepNum: '0' + (this.stepV()+1),
        nextStep: () => this.setState({ step: this.stepV()+1 }), finishOnboarding: () => this.setState({ screen:'home', step:0 }),
        orConnected: S.provider==='or' && this.orV(), orNotConnected: S.provider==='or' && !this.orV(),
        localConnected: S.provider==='local' && S.localOn, localNotConnected: S.provider==='local' && !S.localOn, isLocalProv: S.provider==='local' && S.localOn,
        brainReady: S.provider==='or' ? this.orV() : S.localOn,
        providerOpts: [['or',t.provCloud,t.provCloudSub],['local',t.provLocal,t.provLocalSub]].map(([k,l,s]) => ({ label:l, sub:s, bg: S.provider===k ? 'var(--accent)' : 'transparent', color: S.provider===k ? 'var(--accent-ink)' : 'var(--ink)', onClick:() => this.setState({ provider:k }) })),
        providerChips: [['or','OpenRouter'],['local',t.local]].map(([k,l]) => ({ label:l, cls:sel(S.provider===k), onClick:() => this.setState(k==='local' && !S.localOn ? { provider:k, localOn:true } : { provider:k }) })),
        hosts: HOSTS.map((d,i) => ({ name:d[0], meta:d[1], border: S.host===i ? 'var(--accent)' : 'var(--line)', dot: S.host===i ? 'var(--accent)' : 'transparent', onClick:() => this.setState({ host:i }) })),
        localHost: { name:HOSTS[S.host][0], meta:HOSTS[S.host][1] },
        localModels: LOCAL_MODELS.map((m,i) => ({ name:m[0], size:m[1], border: S.localModel===i ? 'var(--accent)' : 'var(--line)', dot: S.localModel===i ? 'var(--accent)' : 'transparent', onClick:() => this.setState({ localModel:i }) })),
        pairCode: ['4','8','2','1'].map(d => ({ d })),
        startLocal: () => this.setState({ oauth:'local' }),
        pairLocal: () => { this.setState({ oauth:'localLoading' }); this.later(() => this.setState({ oauth:null, localOn:true }), 1100); },
        sheetLocal: this.oauthV()==='local',
        startOAuth: () => this.setState({ oauth:'account' }), pickAccount: () => this.setState({ oauth:'consent' }), cancelSheet: () => this.setState({ oauth:null, mcp:null }),
        allowOAuth: () => { this.setState({ oauth:'loading' }); this.later(() => this.setState({ oauth:null, step:1 }), 1100); },
        startOR: () => this.setState({ oauth:'or' }),
        authorizeOR: () => { this.setState({ oauth:'orLoading' }); this.later(() => this.setState({ oauth:null, orConnected:true }), 1100); },
        isWork: !P, isPersonal: P,
        modeOpts: [['general',t.modes[3]],['kohu',t.modes[0]],['personal',t.modes[1]],['revolut',t.modes[2]]].map(([k,l]) => ({ label:l, bg: mode===k ? 'var(--accent)' : 'transparent', color: mode===k ? 'var(--accent-ink)' : 'var(--muted)', dot: mode===k ? 'var(--acid)' : ((k==='kohu' || k==='general') ? 'var(--accent)' : 'var(--line)'), onClick:() => setMode(k) })),
        modeChips: [['general',t.modes[3]],['kohu',t.modes[0]],['personal',t.modes[1]],['revolut',t.modes[2]]].map(([k,l]) => ({ label:l, cls:sel(mode===k), onClick:() => setMode(k) })),
        feedInput: S.feedInput, feedNote: (S.feedNote && S.feedNoteMode === mode) ? S.feedNote : (GEN ? t.feedIdle : RV ? t.feedIdleR : t.feedIdle),
        onFeedInput: e => this.setState({ feedInput:e.target.value }),
        addFeed: () => { const n = this.feed(this.state.feedInput); if (n) this.setState({ feedInput:'', feedNote:n, feedNoteMode:this.mode() }); },
        onFeedKey: e => { if (e.key === 'Enter') { const n = this.feed(this.state.feedInput); if (n) this.setState({ feedInput:'', feedNote:n, feedNoteMode:this.mode() }); } },
        feedMic: () => { if (S.feedListening) return; this.setState({ feedListening:true, feedInput:'' }); this.later(() => this.setState({ feedListening:false, feedInput: (this.mode()==='revolut' || (this.mode()==='general' && this.state.feedTarget==='revolut')) ? T[this.lang()].feedVoiceR : T[this.lang()].feedVoice }), 1200); },
        feedMicBorder: S.feedListening ? 'var(--accent)' : 'var(--line)', feedMicBg: S.feedListening ? 'var(--accent)' : 'transparent', feedMicColor: S.feedListening ? 'var(--accent-ink)' : 'var(--ink)',
        koHint: GEN ? t.hintG : RV ? t.hintR : P ? t.hintP : t.hint,
        isGeneral: GEN, canFeed: P || GEN, showSynced: mode==='kohu' || GEN, syncedText: GEN ? t.syncedG : t.synced,
        feedTargets: ['kohu','personal','revolut'].map(k => ({ label:WS[k][L], cls:sel(S.feedTarget===k), onClick:() => this.setState({ feedTarget:k }) })),
        goals: (GEN ? firstGoals() : GOALS[mode].map(g => [...g, mode])).map(g => { const d = S.goalsDone.includes(g[0]); return { label:g[1+L], ws: GEN ? WS[g[3]][L] : '', check: d ? '✓' : '', bg: d ? 'var(--accent)' : 'transparent', color: d ? 'var(--muted)' : 'var(--ink)', deco: d ? 'line-through' : 'none', onClick:() => this.setState(s => ({ goalsDone: s.goalsDone.includes(g[0]) ? s.goalsDone.filter(x => x!==g[0]) : [...s.goalsDone, g[0]] })) }; }),
        goalsCount: (() => { const ids = GEN ? firstGoals().map(g => g[0]) : GOALS[mode].map(g => g[0]); return ids.filter(i => S.goalsDone.includes(i)).length + '/' + ids.length; })(),
        openGuard: () => this.go('guard'), isGuard: scr==='guard',
        guardDot: S.guardOn ? 'var(--acid)' : 'var(--line)',
        guardLine: S.guardOn ? t.guardOn(S.released ? 0 : GUARD.filter(g => this.inMode(g[0])).length) : t.guardOffL,
        guardEyebrow: t.guardEyebrow(now ? (() => { const [hh,mm] = now.time.split(':').map(Number); const e = hh*60+mm+now.min; return String(Math.floor(e/60)).padStart(2,'0')+':'+String(e%60).padStart(2,'0'); })() : '18:00'),
        held: S.released ? [] : GUARD.filter(g => this.inMode(g[0])).map(g => ({ time:g[1], app:g[2], text:g[3+L], ws:WS[g[0]][L] })),
        guardA: t.guardA(S.released ? 0 : GUARD.filter(g => this.inMode(g[0])).length), guardB: t.guardB(S.released ? 0 : 1),
        guardToggles: [['guardAuto',t.guardAuto],['guardVip',t.guardVip]].map(([k,l]) => { const g = tog(S[k]); return { label:l, ...g, onClick:() => this.setState(s => ({ [k]:!s[k] })) }; }),
        vips: VIPS.map((v,i) => ({ label:v[L], cls:sel(!S.vipOff.includes(i)), onClick:() => this.setState(s => ({ vipOff: s.vipOff.includes(i) ? s.vipOff.filter(x => x!==i) : [...s.vipOff, i] })) })),
        releaseGuard: () => this.setState({ released:true }),
        guardOffToday: () => this.setState(s => ({ guardOn:!s.guardOn })), guardOffLabel: S.guardOn ? t.guardOffBtn : t.guardOnBtn,
        openReview: () => this.go('review'), isReview: scr==='review',
        ...(() => {
          const slipIds = SLIP[mode]; const doneL = list.filter(c => !slipIds.includes(c.id.replace(/[ab]$/,'')) && c.time < '18:00');
          const slipL = list.filter(c => slipIds.includes(c.id));
          return { revA: t.revA(doneL.length), revB: t.revB(slipL.length),
            revDoneRows: doneL.slice(0,6).map(c => ({ title:c.title, ws: GEN ? WS[c.ws][L] : c.min + ' min' })),
            hasRevMore: doneL.length > 6, revMore: t.revMore(doneL.length - 6),
            slipped: slipL.map(c => ({ title:c.title, meta: GEN ? WS[c.ws][L] : c.min + ' min', opts: t.slipOpts.map((o,i) => ({ label:o, cls:sel((S.slipPick[c.id] ?? 0) === i), onClick:() => this.setState(s => ({ slipPick:{ ...s.slipPick, [c.id]:i } })) })) })) };
        })(),
        feelOpts: t.feels.map((f,i) => ({ label:f, cls:sel(S.feel===i), onClick:() => this.setState({ feel:i }) })),
        isMeeting: scr==='meeting',
        ...(() => { const mt = S.meetTab ?? this.props.meetTab ?? 'prep'; const picked = t.meetActs.filter((a,i) => !S.meetOff.includes(i)).length;
          return { meetPrep: mt==='prep', meetAfter: mt==='after',
            meetTabs: t.meetTabs.map((l,i) => { const on = (i===1) === (mt==='after'); return { label:l, color: on ? 'var(--ink)' : 'var(--muted)', bar: on ? 'var(--accent)' : 'transparent', onClick:() => this.setState({ meetTab: i ? 'after' : 'prep' }) }; }),
            meetGoAfter: () => this.setState({ meetTab:'after' }),
            meetItems: t.meetActs.map((a,i) => { const on = !S.meetOff.includes(i); return { b:a[0], s:a[1], check: on ? '✓' : '', bg: on ? 'var(--accent)' : 'transparent', onClick:() => !S.meetMade && this.setState(s => ({ meetOff: s.meetOff.includes(i) ? s.meetOff.filter(x => x!==i) : [...s.meetOff, i] })) }; }),
            makeTasksLabel: t.makeTasks(picked), tasksMadeLabel: t.tasksMade(picked), meetNotMade: !S.meetMade, meetMade: S.meetMade,
            makeTasks: () => this.setState({ meetMade:true }) }; })(),
        asks: t.asks.map(a => ({ b:a[0], s:a[1] })), points: t.points.map((p,i) => ({ n:'0'+(i+1), text:p })),
        meetAddPoint: () => { this.go('ko'); },
        recapPending: !S.recapSent, recapSent: S.recapSent, sendRecap: () => this.setState({ recapSent:true }),
        showInboxTabs: scr==='inbox' || scr==='follow', isFollow: scr==='follow',
        inboxTabs: t.inboxTabs.map((l,i) => { const on = (i===1) === (scr==='follow'); return { label:l, color: on ? 'var(--ink)' : 'var(--muted)', bar: on ? 'var(--accent)' : 'transparent', onClick:() => this.go(i ? 'follow' : 'inbox') }; }),
        ...(() => { const you = FOL_YOU.filter(f => this.inMode(f.ws) && !S.folDone.includes(f.id)); const them = FOL_THEM.filter(f => this.inMode(f.ws));
          const done = id => () => this.setState(s => ({ folDone:[...s.folDone, id] }));
          return { folA: t.folA(you.length), folB: t.folB(them.length),
            folYou: you.map(f => ({ name:f.name, what:f.what[L], age:t.daysN(f.days), ageColor: f.days > 3 ? 'var(--accent)' : 'var(--muted)', meta: WS[f.ws][L] + ' · ' + (f.src || t.toldYou),
              actions: [[f.src ? t.draft : t.remind, true],[t.snooze,false],[t.done,false]].map(([l,p]) => ({ label:l, cls: p ? 'k-chip k-primary' : 'k-chip', onClick: done(f.id) })) })),
            folThem: them.map(f => { const n = S.nudgedThem.includes(f.id); return { name:f.name, what:f.what[L], age:t.daysN(f.days), meta: WS[f.ws][L] + ' · ' + (f.src || t.toldYou), nudgeLabel: n ? t.nudged : t.nudgeThem, onNudge:() => this.setState(s => ({ nudgedThem: s.nudgedThem.includes(f.id) ? s.nudgedThem : [...s.nudgedThem, f.id] })) }; }) }; })(),
        isAlarms: scr==='alarms', openAlarms: () => this.go('alarms'),
        alarmRows: S.alarms.map(a => { const g = tog(a.on); return { time:a.time, label:a.label[L], byKo:a.byKo, meta:[a.days[L], a.byKo ? t.setByKo : null, a.brief ? t.briefAfter : null].filter(Boolean).join(' · '), opacity: a.on ? 1 : 0.45, border:g.border, bg:g.bg, knob:g.knob, dot:g.dot, onToggle:() => this.setState(s => ({ alarms:s.alarms.map(x => x.id === a.id ? { ...x, on:!x.on } : x) })) }; }),
        alA: t.alA(S.alarms.filter(a => a.on).length), alarmCountLabel: t.alarmsN(S.alarms.filter(a => a.on).length),
        askAlarm: () => { this.go('ko'); this.send(t.alarmAsk); },
        openRing: () => this.setState({ screen:'ring', ringPhase:null, snoozed:false }),
        isRing: scr==='ring', ringOn: S.ringPhase !== 'brief', ringBrief: S.ringPhase === 'brief',
        ringLabel: S.alarms[0] && S.alarms[0].id === 'a4' ? S.alarms[0].label[L] : (ALARMS[0] ? ALARMS[0].label[L] : t.alarm), ringTime: S.snoozed ? '07:10' : (S.alarms[0] && S.alarms[0].id === 'a4' ? '06:45' : '07:00'), ringTimeAfter: S.snoozed ? '07:11' : (S.alarms[0] && S.alarms[0].id === 'a4' ? '06:46' : '07:01'),
        ringNote: S.snoozed ? t.ringSnoozed : t.ringIdle,
        ringUp: () => this.setState({ ringPhase:'brief' }), ringSnooze: () => this.setState({ snoozed:true }),
        ringToKo: () => this.setState({ screen:'ko', ringPhase:null }), ringToToday: () => this.setState({ screen:'home', ringPhase:null }),
        modeLabel: t.modes[['kohu','personal','revolut','general'].indexOf(mode)], briefText: t.brief[mode], briefItems: t.briefItems[mode].map(x => ({ k:x[0], v:x[1] })),
        isTools: scr==='tools', goYou: () => this.go('you'), openTools: () => this.go('tools'),
        servers, tlA: t.tlA(nOn), toolsCountLabel: t.toolsCount(nOn),
        logRows: TOOL_LOG.map(r => ({ name:r[0], n:r[1]+'×', mode:t.logModes[r[2]], color: r[2] ? 'var(--accent)' : 'var(--muted)' })),
        openAddMcp: () => this.setState({ mcp:'add' }),
        mcpUrl: S.mcpUrl, onMcpUrl: e => this.setState({ mcpUrl:e.target.value }),
        authOpts: t.auths.map((a,i) => ({ label:a, cls:sel(S.mcpAuth===i), onClick:() => this.setState({ mcpAuth:i }) })),
        discoverMcp: () => { this.setState({ mcp:'loading' }); this.later(() => this.setState({ mcp:'found' }), 1200); },
        sheetMcpAdd: mcp==='add', sheetMcpFound: mcp==='found',
        mcpFoundTitle: 'Stripe. ' + t.mcpFound(STRIPE_TOOLS.length - S.mcpOff.length),
        mcpTools: STRIPE_TOOLS.map((x,i) => { const on = !S.mcpOff.includes(i); const w = x[1]==='w'; return { name:x[0], kind: w ? t.write : t.read, kindColor: w ? 'var(--accent)' : 'var(--muted)', bg: on ? 'var(--accent)' : 'transparent', check: on ? '✓' : '', onClick:() => this.setState(s => ({ mcpOff: s.mcpOff.includes(i) ? s.mcpOff.filter(v => v!==i) : [...s.mcpOff, i] })) }; }),
        newPermOpts: t.perms.map((p,i) => ({ label:p, cls:sel(S.mcpPermNew===i), onClick:() => this.setState({ mcpPermNew:i }) })),
        connectMcp: () => this.setState(s => ({ mcp:null, stripe:true, srvOn:{ ...s.srvOn, stripe:true }, srvPerm:{ ...s.srvPerm, stripe:s.mcpPermNew } })),
        showSheet: (!!this.oauthV() && scr === 'onboarding') || (!!mcp && scr === 'tools'), sheetAccount: this.oauthV()==='account', sheetConsent: this.oauthV()==='consent', sheetOR: this.oauthV()==='or', sheetLoading: (scr==='onboarding' && ['loading','orLoading','localLoading'].includes(this.oauthV())) || (scr==='tools' && mcp==='loading'), sheetLoadingMeta: scr==='tools' ? 'initialize · tools/list' : this.oauthV()==='localLoading' ? 'TLS · '+HOSTS[S.host][1].split(' · ')[1] : 'code_challenge · S256',
        sheetDomain: scr==='tools' ? (S.mcpUrl.replace(/^https?:\/\//,'') || 'mcp') : ['local','localLoading'].includes(this.oauthV()) ? 'kohu-bridge.local' : ['or','orLoading'].includes(this.oauthV()) ? 'openrouter.ai/auth' : 'accounts.google.com', sheetLoadingLabel: scr==='tools' ? t.discovering : this.oauthV()==='localLoading' ? t.pairing : this.oauthV()==='orLoading' ? t.creatingKey : t.signingIn,
        scopes: t.scopes.map((s,i) => { const on = !S.scopeOff.includes(i) || i===0; return { label:s, bg: on ? 'var(--accent)' : 'transparent', check: on ? '✓' : '', onClick: () => i && this.setState(st => ({ scopeOff: st.scopeOff.includes(i) ? st.scopeOff.filter(x=>x!==i) : [...st.scopeOff, i] })) }; }),
        scopeRows: t.scopeRows.map(r => ({ name:r[0], value:r[1] })),
        capOpts: [50,200,500].map((c,i) => ({ label: money(c,L,0), cls: sel(S.cap===i), onClick:() => this.setState({ cap:i }) })),
        capLabel: money(CAPS[S.cap],L,0),
        showStatsTabs: scr==='week' || scr==='spend', isSpend: scr==='spend',
        statsTabs: t.statsTabs.map((l,i) => { const on = (i===1) === (scr==='spend'); return { label:l, color: on ? 'var(--ink)' : 'var(--muted)', bar: on ? 'var(--accent)' : 'transparent', onClick:() => this.go(i ? 'spend' : 'week') }; }),
        spA: t.spA(money(SPENT,L)), spB: t.spB(money(Math.max(0, CAPS[S.cap]-SPENT),L)),
        spUsed: Math.min(100, SPENT/CAPS[S.cap]*100).toFixed(1)+'%', spProj: Math.min(100, SPENT/29*31/CAPS[S.cap]*100).toFixed(1)+'%', spProjVal: money(SPENT/29*31,L), spPct: Math.round(SPENT/CAPS[S.cap]*100)+'%',
        spKpis: [[money(2.14,L),'-8%'],[L?'1 284':'1,284','+9%'],[money(1.66,L),''],['9.8M','']].map((k,i) => ({ label:t.spK[i], value:k[0], delta:k[1], note:t.spN[i] })),
        spBars: DAILY.map((v,i) => ({ h: (v/3*100).toFixed(0)+'%', bg: i===DAILY.length-1 ? 'var(--accent)' : 'transparent' })),
        spGroups: [{ title:t.spByModel, rows: (S.provider==='local' && S.localOn ? [['local/'+LOCAL_MODELS[S.localModel][0],0,t.yourComputer,'0.3M'], ...BY_MODEL] : BY_MODEL).map(r => ({ name:r[0], amount:money(r[1],L), w:(r[1]/SPENT*100).toFixed(0)+'%', font:'var(--font-mono)', hasSub:true, sub: r[2] + (r[0].startsWith('local/') ? '' : ' · ' + t.viaOR) + ' · ' + r[3] + ' ' + t.tokensW })) }, { title:t.spByUse, rows: BY_USE.map((v,i) => ({ name:t.uses[i], amount:money(v,L), w:(v/SPENT*100).toFixed(0)+'%', font:'var(--font-sans)', hasSub:false, sub:'' })) }],
        tokRows: TOK.map(k => ({ name:t.tokTypes[k[0]], tokens:(L ? String(k[1]).replace('.',',') : k[1]) + 'M', cost:money(k[2],L), w:(k[1]/9.8*100).toFixed(1)+'%', color:k[3] })),
        ctxLine: this.state.provider==='local' && this.state.localOn ? 'local/' + LOCAL_MODELS[this.state.localModel][0] + ' · ' + t.ctxNote : MODELS[this.state.model] + ' · ' + t.ctxNote,
        models: MODELS.map((m,i) => ({ name:m, border: S.model===i ? 'var(--accent)' : 'var(--line)', dot: S.model===i ? 'var(--accent)' : 'transparent', onClick:() => this.setState({ model:i }) })),
        modelName: S.provider==='local' && S.localOn ? 'local/' + LOCAL_MODELS[S.localModel][0] : MODELS[S.model],
        wakeOpts: ['Hi Kō', 'Kō'].map((w,i) => ({ label:w, cls:sel(S.wake.includes(i)), onClick:() => this.setState(s => { const on = s.wake.includes(i); if (on && s.wake.length === 1) return null; return { wake: on ? s.wake.filter(x => x !== i) : [...s.wake, i] }; }) })),
        toggleLock: () => this.setState(s => ({ lock:!s.lock })), lockBorder:lk.border, lockBg:lk.bg, lockKnob:lk.knob, lockDot:lk.dot,
        toggleNudges: () => this.setState(s => ({ nudgesOn:!s.nudgesOn })), nudgeBorder:nd.border, nudgeBg:nd.bg, nudgeKnob:nd.knob, nudgeDot:nd.dot,
        chunkOpts: ['15','25','45'].map((c,i) => ({ label:c, cls:sel(S.chunk===i), onClick:() => this.setState({ chunk:i }) })),
        langOpts: ['EN','PT'].map((c,i) => ({ label:c, cls:sel(L===i), onClick:() => this.setState({ lang: i ? 'pt' : 'en' }) })),
        signOut: () => this.setState({ screen:'onboarding', step:0, oauth:null, orConnected:false, localOn:false, provider:'or' }),
        showTopBar: ['home','week','spend','inbox','follow','you'].includes(scr), showNav: scr !== 'onboarding' && scr !== 'wake' && scr !== 'ring',
        isHomeKo: scr==='home' && variant==='ko', showTabs: !(scr==='home' && variant==='ko'),
        ...(() => { const open = this.homeOpenV(); const bh = BEH[S.beh] || BEH.stroll;
          const view = v => () => this.setState({ homeView:v, homeOpen:false, tilesIn:false });
          const heldN = S.released ? 0 : GUARD.filter(g => this.inMode(g[0])).length;
          const fr = mapRows.reduce((a,r) => a + r.cells.filter(c => c.borderStyle === 'dashed' && !c.label).length * 30, 0);
          return { homeIsOpen: open, homeClosed: !open, koRef: this.koRef, stageRef: this.stageRef,
            homeMood: open ? 'happy' : S.lost ? 'confused' : bh[0], homeState: open || S.lost ? 'idle' : bh[1],
            behLabel: S.lost ? t.beh.lost : t.beh[S.beh], behDot: S.lost ? 'var(--muted)' : { listening:'var(--accent)', thinking:'var(--muted)', speaking:'var(--acid)', idle:'var(--acid)' }[bh[1]],
            tilesOp: S.tilesIn ? 1 : 0, tilesY: S.tilesIn ? '0px' : '12px',
            toggleHome: () => { if (this.homeOpenV()) this.setState({ homeOpen:false, tilesIn:false }); else { this.setState({ homeOpen:true, tilesIn:false }); this.later(() => this.setState({ tilesIn:true }), 700); } },
            showHomeBack: !!S.homeView && S.homeView !== 'ko',
            backToKo: () => { this.setState({ homeView:'ko', homeOpen:true, tilesIn:false }); this.later(() => this.setState({ tilesIn:true }), 400); },
            homeTiles: [
              { label:t.hFocus, meta: now ? fmt(len-el) + ' ' + t.leftSuffix : t.dayA, onClick:view('focus') },
              { label:t.navToday, meta:t.hChunks(left), onClick:view('timeline') },
              { label:t.hTalk, meta:'Hi Kō', onClick:() => this.go('ko') },
              { label:t.hMap, meta:t.lgFree + ' ' + Math.floor(fr/60) + 'h' + String(fr%60).padStart(2,'0'), onClick:view('map') },
              { label:t.hGuard, meta: S.guardOn ? t.hHeld(heldN) : t.off, onClick:() => this.go('guard') },
              { label:t.revOpen, meta: (() => { const ids = GEN ? firstGoals().map(g => g[0]) : GOALS[mode].map(g => g[0]); return ids.filter(i => S.goalsDone.includes(i)).length + '/' + ids.length + ' ' + t.goalsShort; })(), onClick:() => this.go('review') },
            ] }; })(),
        isHomeTimeline: scr==='home' && variant==='timeline', isHomeFocus: scr==='home' && variant==='focus', isHomeMap: scr==='home' && variant==='map',
        isWake: scr==='wake', wakeAsleep: !S.wakePhase, wakeAwake: !!S.wakePhase, wakeAnswered: S.wakePhase==='answered', wakeDim: S.wakePhase ? 0.35 : 1,
        wakeHeard: S.wakePhase ? 'Hi Kō, ' + t.wHeard.slice(0, S.heardN).toLowerCase() : '', wakeCaret: S.wakePhase==='listening' ? '|' : '',
        wakeSignal: { listening:'listening', thinking:'thinking', speaking:'speaking', answered:'idle' }[S.wakePhase] || 'idle',
        wakeStatus: t.status[{ listening:'listening', thinking:'thinking', speaking:'speaking', answered:'idle' }[S.wakePhase] || 'idle'],
        wakeEye: { listening:'14px', thinking:'3px', speaking:'10px' }[S.wakePhase] || '7px',
        wakeDot: { listening:'var(--accent)', thinking:'var(--muted)', speaking:'var(--acid)', answered:'var(--acid)' }[S.wakePhase] || 'var(--acid)',
        wakeUp: this.wakeUp, sleepKo: () => this.setState({ wakePhase:null, heardN:0 }), exitWake: () => this.setState({ screen:'ko', wakePhase:null, heardN:0 }), openWake: () => this.setState({ screen:'wake', wakePhase:null, heardN:0 }),
        isTask: scr==='task', isWeek: scr==='week', isKo: scr==='ko', isInbox: scr==='inbox', isYou: scr==='you',
        leftA: t.left(left), hasNow: !!now, dayDone: !now, hasNext: !!next,
        now: now ? { ...now, onClick: openTask(now.group), cursor: tappable(now.group) ? 'pointer' : 'default' } : {},
        next: next || {},
        progress: (el/len*100).toFixed(1)+'%', remaining: fmt(len-el)+' '+t.leftSuffix, elapsedLabel: fmt(el), remainingClock: fmt(len-el),
        markDone: () => now && this.setState(s => ({ done:[...s.done, now.id], elapsed:0 })),
        skipNow: () => now && this.setState(s => ({ skipped:[...s.skipped, now.id], elapsed:0 })),
        splitNow: () => { if (!now) return; const base = now.id.replace(/[ab]$/,''); if (this.state.split[base]) return; this.setState(s => ({ split:{ ...s.split, [base]:true }, elapsed:0 })); },
        others: list.filter(c => !c.isNow).map(c => ({ ...c, meta: c.task + ' · ' + c.min + ' min' + (GEN ? ' · ' + WS[c.ws][L] : (!P && SOURCE[c.group] ? ' · ' + SOURCE[c.group] : '')), deco: c.isDone ? 'line-through' : 'none', opacity: c.isDone ? 0.5 : 1, mark: c.isDone ? t.done : (tappable(c.group) ? '›' : ''), markColor: c.isDone ? 'var(--muted)' : 'var(--accent)', cursor: tappable(c.group) ? 'pointer' : 'default', onClick: openTask(c.group) })),
        mapStats: [{ label:t.stDone, value:String(list.length-left) }, { label:t.stLeft, value:String(left) }, { label:t.stFree, value: (() => { const f = mapRows.reduce((a,r) => a + r.cells.filter(c => c.borderStyle === 'dashed' && !c.label).length * 30, 0); return Math.floor(f/60)+'h'+String(f%60).padStart(2,'0'); })() }],
        mapRows,
        goHome: () => this.go('home'), askResplit: () => { this.go('ko'); this.send(t.chipsW[0]); },
        taskDoneCount, taskStages: t.stages,
        taskRows: t.sub.map((r,i) => { const d = i < taskDoneCount; const n = i === taskDoneCount; return { name:r[0], when:r[1], check: d ? '✓' : '', boxBorder: d || n ? 'var(--accent)' : 'var(--line)', boxBg: d ? 'var(--accent)' : 'transparent', color: d ? 'var(--muted)' : 'var(--ink)', deco: d ? 'line-through' : 'none' }; }),
        kpis: [{ label:t.kpi[0], value:'38', delta:'+6', note:t.vs }, { label:t.kpi[1], value:L?'21,5h':'21.5h', delta:'+12%', note:t.vs }, { label:t.kpi[2], value:'84%', delta:'+4%', note:t.vs }, { label:t.kpi[3], value:'12', delta:'+3', note:t.vs }],
        bars,
        koState: S.koState, koStatus: t.status[S.koState], koDot: koColor, logRef: this.logRef,
        messages: S.messages.map(m => { if (m.who === 'user') return { isUser:true, isKo:false, text:m.text }; if (m.text) return { isUser:false, isKo:true, text:m.text, hasItems:false, items:[], hasTools:false }; const r = m.key === 'hello' ? (GEN ? { en:T.en.helloG, pt:T.pt.helloG } : RV ? { en:T.en.helloR, pt:T.pt.helloR } : P ? { en:T.en.helloP, pt:T.pt.helloP } : { en:T.en.hello, pt:T.pt.hello }) : R[m.key]; const items = r.items ? SPLIT_ITEMS(lang) : r.list ? r.list[lang].map(x => ({ b:x[0], s:x[1] })) : []; return { isUser:false, isKo:true, text:r[lang], hasItems:items.length>0, items, hasTools:(!P || !!r.device) && !!r.tools, tools:r.tools || '' }; }),
        chips: (GEN ? t.chipsG : RV ? t.chipsR : P ? t.chipsP : t.chipsW).map(c => ({ label:c, onClick:() => this.send(c) })),
        input: S.input, onInput: e => this.setState({ input:e.target.value }), onKey: e => { if (e.key === 'Enter') this.send(this.state.input); }, sendInput: () => this.send(this.state.input),
        toggleMic: () => { if (S.koState === 'listening') return this.setState({ koState:'idle' }); this.setState({ koState:'listening' }); this.later(() => { if (this.state.koState === 'listening') this.send(T[this.lang()].chips[1]); }, 2200); },
        micBorder: S.koState==='listening' ? 'var(--accent)' : 'var(--line)', micBg: S.koState==='listening' ? 'var(--accent)' : 'transparent', micColor: S.koState==='listening' ? 'var(--accent-ink)' : 'var(--ink)',
        isInboxX:false, nudges, inboxA: t.inbox(nudges.length), inboxB: t.inboxB(nudges.length),
        navItems: tabs.map(([k,label]) => { const on = activeTab === k; return { label, isKo:k==='ko', isTab:k!=='ko', hasBadge: k==='inbox' && nudges.length>0 && S.nudgesOn, color: on ? 'var(--ink)' : 'var(--muted)', bar: on ? 'var(--accent)' : 'transparent', ring: on ? 'var(--accent)' : 'var(--line)', eye: on ? 'var(--acid)' : 'var(--ink)', onClick: k === 'home' ? () => this.setState({ screen:'home', homeView: this.props.homeVariant ? null : 'ko', homeOpen:false, tilesIn:false }) : () => this.go(k) }; }),
      };
    }
  }

  // ---- boot ----
  const STORE = 'kohulabs-android';
  const saved = (() => { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; } })();
  const save = v => { try { localStorage.setItem(STORE, JSON.stringify(v)); } catch (e) { /* private mode: nothing kept */ } };
  const props = {
    screen: saved.signedIn ? 'home' : 'onboarding',
    mode: 'general',
    lang: saved.lang || (/^pt\b/i.test(navigator.language || '') ? 'pt' : 'en')
  };
  const NUM = ['step'], BOOL = ['homeOpen', 'orConnected'];
  new URLSearchParams(location.search).forEach((v, k) => {
    const key = k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    props[key] = NUM.includes(key) ? Number(v) : BOOL.includes(key) ? v === 'true' : v;
  });

  // In the Android app (android/), the phone is reachable as window.KohuAndroid (KohuBridge.kt).
  const phone = window.KohuAndroid || null;
  const PARENT = { spend:'week', follow:'inbox', tools:'you', alarms:'you', task:'home', guard:'home', review:'home', meeting:'home', ring:'home', wake:'home' };

  // ---- the day from the phone's database (Android app only; in a browser it stays the design's sample day) ----
  // FoundersStore.kt seeds the first day, rolls unfinished work over to a new day and keeps every change. Here the
  // design's data (DAY, GOALS, NUDGES, ...) is filled from it, and each change is written back after it renders.
  const store = phone && typeof phone.today === 'function' ? phone : null;
  const pad = n => String(n).padStart(2, '0');
  const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = dateKey(new Date());
  const NAMES = {
    en: { d:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], dl:['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'], m:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], ml:['January','February','March','April','May','June','July','August','September','October','November','December'] },
    pt: { d:['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'], dl:['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'], m:['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'], ml:['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'] }
  };
  const SETTINGS = ['lang','mode','chunk','cap','model','nudgesOn','lock','wake','guardOn','guardAuto','guardVip','vipOff','provider','localOn','host','localModel','srvOn','srvPerm','stripe','mcpOff','scopeOff','orConnected','feedTarget'];
  const PILL = { decision:'k-pill k-pill-build', risk:'k-pill k-pill-live', info:'k-pill' };
  const fill = (arr, items) => { arr.length = 0; arr.push(...items); };
  const PULL_AT = 80; // px to drag before a release refreshes
  const canListen = !!(phone && typeof phone.canListen === 'function' && phone.canListen());
  const ids = {}; // chunks named in this session (f0, f1 ...) → their id in the database

  let day = null;
  if (store) {
    try { day = JSON.parse(store.today(today, props.lang)); } catch (e) { console.warn('Kohu Founders: no database, showing the sample day', e); }
  }
  const settings = {};
  if (day) {
    for (const [k, v] of Object.entries(day.settings || {})) { try { settings[k] = JSON.parse(v); } catch (e) { /* skip a bad value */ } }
    if (settings.lang) props.lang = settings.lang;
    // Today's real date, in both languages.
    const now = new Date(), tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const long = (l, x) => l === 'pt' ? `${NAMES.pt.dl[x.getDay()]}, ${x.getDate()} de ${NAMES.pt.ml[x.getMonth()]}` : `${NAMES.en.dl[x.getDay()]}, ${x.getDate()} ${NAMES.en.ml[x.getMonth()]}`;
    for (const l of ['en', 'pt']) Object.assign(T[l], { date:`${NAMES[l].d[now.getDay()]} ${now.getDate()} ${NAMES[l].m[now.getMonth()]}`, lockDate:long(l, now), ringDate:long(l, tomorrow) });
    // Meetings imported from Calendar (api/google-import.js); not tappable (the design's meeting screen is its sample).
    GROUPS.meet = ['Meeting', 'Reunião']; SOURCE.meet = 'Calendar';
    const rows = ws => day.chunks.filter(c => c.ws === ws).map(c => { if (!GROUPS[c.category]) GROUPS[c.category] = [c.category, c.category]; return [c.id, c.start, c.minutes, c.title, c.title, c.category]; });
    fill(DAY, rows('kohu')); fill(DAY_P, rows('personal')); fill(DAY_R, rows('revolut'));
    for (const ws of ['kohu', 'personal', 'revolut']) GOALS[ws] = day.goals.filter(g => g.ws === ws).map(g => [g.id, g.title, g.title]);
    fill(NUDGES, day.nudges.map(n => ({ id:n.id, mode:n.ws || undefined, kind:[n.kind, n.kind], pill:PILL[n.tone] || 'k-pill', time:[n.time, n.time], title:[n.title, n.title], body:[n.body, n.body], actions:n.actions.map(a => [a, a]), go:n.go || undefined })));
    const fol = f => ({ id:f.id, ws:f.ws, name:f.person, what:[f.what, f.what], days:f.days, src:f.source });
    fill(FOL_YOU, day.followUps.filter(f => f.direction === 'you').map(fol));
    fill(FOL_THEM, day.followUps.filter(f => f.direction === 'them').map(fol));
    fill(ALARMS, day.alarms.map(a => ({ id:a.id, time:a.time, label:[a.label, a.label], days:[a.days, a.days], on:a.on, byKo:a.byKo, brief:a.brief })));
    // The day review lists whatever is still open as slipped (the design names its sample chunks).
    const open = () => { const app = window.kohuFounders; return app ? app.chunks().filter(c => !c.isDone).flatMap(c => [c.id, c.id.replace(/[ab]$/, '')]) : []; };
    for (const ws of ['kohu', 'personal', 'revolut', 'general']) Object.defineProperty(SLIP, ws, { get:open });
  }

  // Remembers the language and whether onboarding is done, so a reload opens on Today.
  class App extends Component {
    constructor(p) {
      super(p);
      if (!day) return;
      const has = st => day.chunks.filter(c => c.status === st).map(c => c.id);
      Object.assign(this.state, {
        done:has('done'), skipped:has('skipped'), goalsDone:day.goals.filter(g => g.done).map(g => g.id), alarms:ALARMS.slice(),
        nudgedThem:day.followUps.filter(f => f.nudged).map(f => f.id), nudgeAnswers:{},
        messages:[{ who:'ko', key:'hello' }, ...day.messages.map(m => m.key ? { who:m.who, key:m.key } : { who:m.who, text:m.text || '' })],
        feel:day.review ? day.review.feel : null, slipPick:day.review ? day.review.slips : {},
      });
      for (const k of SETTINGS) if (k in settings) this.state[k] = settings[k];
      // The timer runs from when the current chunk started, even across restarts.
      const cur = this.chunks().find(c => c.isNow), row = cur && day.chunks.find(c => c.id === cur.id);
      this.state.elapsed = row && row.startedAt ? Math.max(0, Math.round((Date.now() - row.startedAt) / 1000)) : 0;
      this.persisted = this.snap();
      this.persisted.cur = null; // record when the first chunk started
    }
    // In the app, Google sign-in is real (MainActivity: a browser tab, then the cloud gives the app its token).
    renderVals() {
      const v = super.renderVals();
      v.demo = !day;
      v.showMic = !day;
      if (phone && typeof phone.signIn === 'function') {
        v.startOAuth = () => phone.signIn();
        const signOut = v.signOut;
        v.signOut = () => { phone.signOut(); signOut(); };
      }
      if (day) Object.assign(v, this.honest(v));
      return v;
    }

    // ---- the app shows only what is true ----------------------------------------------------------------------------
    // The design fills every screen with its sample. In the app (day from the phone's database) the parts that are not
    // built yet are hidden (demo: false in index.html) or show real numbers, and Kō only says what it knows.
    say(en, pt) { return this.lang() === 'pt' ? pt : en; }
    dayFacts() {
      const list = this.chunks(), now = list.find(c => c.isNow), left = list.filter(c => !c.isDone).length;
      const next = now ? list.slice(list.indexOf(now) + 1).find(c => !c.isDone) : null;
      return { list, now, next, left, done: list.length - left, meetings: list.filter(c => c.group === 'meet' && !c.isDone).length };
    }
    weekData() {
      if (typeof phone.week !== 'function') return null;
      if (!this.weekCache || Date.now() - this.weekCache.at > 30_000) {
        try { this.weekCache = { at: Date.now(), data: JSON.parse(phone.week(today)).days }; } catch (e) { this.weekCache = { at: Date.now(), data: null }; }
      }
      return this.weekCache.data;
    }
    honest(v) {
      const say = (en, pt) => this.say(en, pt), f = this.dayFacts(), L = this.lang() === 'pt' ? 1 : 0;
      const t = Object.create(v.t);   // the design's copy, with the parts below made true
      const out = { t, showSynced: false };
      t.focusKo = f.next ? say(`Up next: ${f.next.title} at ${f.next.time}.`, `A seguir: ${f.next.title} às ${f.next.time}.`) : say('This is the last chunk today.', 'É o último bloco de hoje.');
      t.revKo = say(`You finished ${f.done} of ${f.list.length} chunks today.`, `Acabaste ${f.done} de ${f.list.length} blocos hoje.`);
      t.alKo = say('Ask Kō for an alarm (“wake me at 6:45”) and it goes into your phone’s Clock app. Change or delete it there.', 'Pede um alarme ao Kō (“acorda-me às 6:45”) e ele vai para a app Relógio do telemóvel. Muda-o ou apaga-o lá.');
      t.folKo = say('Unread mail from your inbox, refreshed every hour. Promotions, social and updates are left out.', 'Email por ler da tua caixa de entrada, atualizado de hora a hora. Promoções, social e atualizações ficam de fora.');
      // Home: no focus guard yet; Kō's message says what is planned and what is waiting (tap it for Today).
      out.homeTiles = v.homeTiles.filter(b => b.label !== v.t.hGuard);
      out.homeNote = this.homeNote(f);
      out.openNote = () => this.setState({ homeView:'timeline', homeOpen:false, tilesIn:false });
      // Pull to refresh (touch handling in componentDidMount): Calendar and Gmail now, Kō thinks while it checks.
      const S = this.state, pullD = S.pullD || 0;
      out.pullShow = !!(S.refreshing || pullD > 0 || S.refreshMsg);
      out.pullY = `${S.refreshing || S.refreshMsg ? 0 : Math.min(pullD, 120) / 2 - 20}px`;
      out.pullBorder = pullD > PULL_AT || S.refreshing ? 'var(--accent)' : 'var(--line)';
      out.pullClass = S.refreshing ? 'kf-thinking' : '';
      out.pullText = S.refreshing ? say('Checking Calendar and Gmail', 'A ver o Calendário e o Gmail') : S.refreshMsg || (pullD > PULL_AT ? say('Release to refresh', 'Larga para atualizar') : say('Pull to refresh', 'Puxa para atualizar'));
      if (S.refreshing) { out.homeState = 'thinking'; out.homeMood = 'neutral'; out.behLabel = say('Checking Calendar and Gmail', 'A ver o Calendário e o Gmail'); }
      // Voice: the phone's speech-to-text, for telling Kō a task (the way in for anything from Revolut).
      out.showMic = canListen;
      out.feedMic = () => this.listenFor('feed');
      out.toggleMic = () => this.listenFor('ko');
      if (S.listening) Object.assign(out, S.listening === 'feed' ? { feedMicBorder: 'var(--accent)', feedMicBg: 'var(--accent)', feedMicColor: 'var(--accent-ink)' } : { micBorder: 'var(--accent)', micBg: 'var(--accent)', micColor: 'var(--accent-ink)' });
      // Kō: no AI yet, so a greeting from the real day and replies only for what it can really do (send()).
      out.modelName = say('Kō · no AI yet', 'Kō · ainda sem IA');
      out.koHint = say('Ask what’s next, add a task (“add: …”) or set an alarm.', 'Pergunta o que vem a seguir, junta uma tarefa (“junta: …”) ou marca um alarme.');
      const hello = f.list.length ? say(`Hi. ${f.left} of ${f.list.length} chunks left today${f.meetings ? `, ${f.meetings} of them meetings` : ''}.`, `Olá. Faltam ${f.left} de ${f.list.length} blocos hoje${f.meetings ? `, ${f.meetings} deles reuniões` : ''}.`)
        : say('Hi. Nothing planned today yet. Add a task with “add: …”.', 'Olá. Ainda nada planeado hoje. Junta uma tarefa com “junta: …”.');
      // (scripted replies saved before this version are left out: they were the design's sample answers)
      out.messages = v.messages.map((m, i) => i === 0 && m.isKo ? { ...m, text: hello, hasItems: false, hasTools: false } : m)
        .filter((m, i) => i === 0 || !(this.state.messages[i] && this.state.messages[i].key));
      out.chips = [[say('What’s next?', 'O que vem a seguir?'), true], [say('What’s today?', 'Como está o dia?'), true], [say('Add: ', 'Junta: '), false], [say('Wake me at 7:00', 'Acorda-me às 7:00'), true]]
        .map(([label, send]) => ({ label, onClick: send ? () => this.send(label) : () => this.setState({ input: label }) }));
      out.askAlarm = () => { this.go('ko'); this.setState({ input: say('Wake me at ', 'Acorda-me às ') }); };
      // Follow-ups from Gmail: open the thread, or mark it done.
      const you = FOL_YOU.filter(x => this.inMode(x.ws) && !this.state.folDone.includes(x.id));
      const done = id => () => this.setState(s => ({ folDone: [...s.folDone, id] }));
      out.folYou = v.folYou.map((x, i) => ({ ...x, actions: [
        ...(you[i] && you[i].id.startsWith('gm:') ? [{ label: say('Open in Gmail', 'Abrir no Gmail'), cls: 'k-chip k-primary', onClick: () => { location.href = 'https://mail.google.com/mail/u/0/#all/' + you[i].id.slice(3); } }] : []),
        { label: v.t.done, cls: 'k-chip', onClick: done(you[i] && you[i].id) }] }));
      // Settings: what the app really has access to.
      out.scopeRows = [[say('Calendar', 'Calendário'), say('Read only', 'Só leitura')], ['Gmail', say('Senders and subjects', 'Remetentes e assuntos')], [say('Session', 'Sessão'), say('90 days', '90 dias')]].map(([name, value]) => ({ name, value }));
      // Stats: this week from the database. Spend waits for Kō's AI.
      out.statsTabs = v.statsTabs.slice(0, 1);
      const week = this.weekData();
      if (week) {
        const n = week.reduce((a, d) => a + d.done, 0), mins = week.reduce((a, d) => a + d.minutes, 0), top = Math.max(1, ...week.map(d => d.done));
        const hours = (mins / 60).toFixed(1).replace(/\.0$/, ''), hoursL = L ? hours.replace('.', ',') : hours;
        t.weekA = say(`${n} chunk${n === 1 ? '' : 's'} done.`, `${n} bloco${n === 1 ? '' : 's'} feito${n === 1 ? '' : 's'}.`);
        t.weekB = say(`${hoursL} hours of focus.`, `${hoursL} horas de foco.`);
        t.insight = say('Kō will point out patterns here once there are a few weeks of days.', 'O Kō vai apontar padrões aqui quando houver algumas semanas de dias.');
        out.kpis = [{ label: v.t.kpi[0], value: String(n), delta: '', note: say('this week', 'esta semana') }, { label: v.t.kpi[1], value: `${hoursL}h`, delta: '', note: say('this week', 'esta semana') }];
        out.bars = week.map((d, i) => ({ n: d.done, h: (d.done / top * 80) + 'px', bg: d.date === today ? 'var(--accent)' : 'transparent', d: v.t.days[i], dayColor: d.date === today ? 'var(--ink)' : 'var(--muted)' }));
        const d = new Date(), thu = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() + 3 - ((d.getDay() + 6) % 7)));
        out.weekNo = String(Math.ceil(((thu - Date.UTC(thu.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7));
      }
      return out;
    }

    // Kō's line on the home screen: the day so far and what is waiting on you, from the real data.
    homeNote(f) {
      const say = (en, pt) => this.say(en, pt), n = (k, one, many) => `${k} ${k === 1 ? one : many}`;
      const parts = [];
      if (!f.list.length) parts.push(say('Nothing planned for today yet. Tell me what you need to do.', 'Ainda nada planeado para hoje. Diz-me o que tens de fazer.'));
      else if (!f.left) parts.push(say(`Day done: all ${f.list.length} chunks finished.`, `Dia feito: os ${f.list.length} blocos estão acabados.`));
      else {
        const meet = f.list.find(c => c.group === 'meet' && !c.isDone);
        parts.push(say(`Today: ${n(f.left, 'chunk', 'chunks')} left`, `Hoje: ${n(f.left, 'bloco', 'blocos')} por fazer`) +
          (meet ? say(`, next meeting ${meet.time} ${meet.title}`, `, próxima reunião ${meet.time} ${meet.title}`) : '') + '.');
      }
      const mail = FOL_YOU.filter(x => this.inMode(x.ws) && !this.state.folDone.includes(x.id) && x.id.startsWith('gm:')).length;
      if (mail) parts.push(say(`${n(mail, 'email', 'emails')} waiting on you.`, `${n(mail, 'email', 'emails')} à tua espera.`));
      const r = this.lastRefresh;
      if (r && r.ok === false && r.error !== 'no_google') parts.push(say('I couldn’t reach Google just now.', 'Não consegui chegar ao Google agora.'));
      return parts.join(' ');
    }
    // Pull to refresh: ask the phone (KohuBridge.refresh); it answers in refreshed().
    refreshNow() {
      if (this.state.refreshing || typeof phone.refresh !== 'function') return;
      this.setState({ refreshing: true, refreshMsg: null });
      phone.refresh();
    }
    refreshed(res) {
      this.lastRefresh = res;
      if (res && res.pulled > 0) return location.reload();      // the store reads the new day (and clears the sample once)
      const say = (en, pt) => this.say(en, pt);
      const msg = !res || res.ok === false ? (res && res.error === 'no_google' ? say('Sign in again to connect Google', 'Entra outra vez para ligar o Google') : say('No connection', 'Sem ligação')) : say('Up to date', 'Tudo em dia');
      this.setState({ refreshing: false, refreshMsg: msg });
      this.later(() => this.setState({ refreshMsg: null }), 2200);
    }
    // Voice: one phrase from the phone's speech-to-text, into the task box or straight to Kō.
    listenFor(target) {
      if (this.state.listening || !canListen) return;
      this.setState({ listening: target });
      phone.listen(this.lang());
    }
    heard(text) {
      const target = this.state.listening;
      this.setState({ listening: null });
      if (!text) return;
      if (target === 'feed') this.setState({ feedInput: text });
      else this.send(text);
    }

    // Called by the app when sign-in finished. In the app there is nothing else to set up yet (Kō's AI and the wake
    // word are not built), so it goes straight to Kō's home. account is null when the cloud is not set up yet and the
    // app carries on, on this phone only.
    cloudSignedIn(account) {
      this.cloudAccount = account;
      if (this.scr() !== 'onboarding') return;
      if (day) this.setState({ screen:'home', homeView:'ko', homeOpen:false, step:0, oauth:null });
      else if (this.stepV() === 0) this.setState({ oauth:null, step:1 });
    }
    settingValue(k) { return k === 'lang' ? this.lang() : k === 'mode' ? this.mode() : k === 'orConnected' ? this.orV() : this.state[k]; }
    snap() {
      const S = this.state, cur = this.chunks().find(c => c.isNow);
      return { fed:S.fed.slice(), split:{ ...S.split }, done:S.done.slice(), skipped:S.skipped.slice(), cur:cur ? cur.id : null, goalsDone:S.goalsDone.slice(),
        dismissed:S.dismissed.slice(), folDone:S.folDone.slice(), nudgedThem:S.nudgedThem.slice(), alarms:S.alarms.map(a => ({ ...a })), messages:S.messages.slice(),
        settings:Object.fromEntries(SETTINGS.map(k => [k, JSON.stringify(this.settingValue(k))])), feel:S.feel, slipPick:JSON.stringify(S.slipPick) };
    }
    // Writes what changed since the last render to the database, as FoundersStore.apply operations.
    persist() {
      const S = this.state, P = this.persisted, ops = [], L = this.lang() === 'pt' ? 1 : 0;
      const id = x => ids[x] || (/[ab]$/.test(x) && ids[x.slice(0, -1)] ? ids[x.slice(0, -1)] + x.slice(-1) : x);
      const added = (was, now) => now.filter(x => !was.includes(x));
      // Tasks you gave Kō first, so the store names them before anything refers to them.
      const fed = S.fed.slice(P.fed.length);
      if (fed.length) Object.assign(ids, JSON.parse(store.apply(JSON.stringify(fed.map(f => ({ op:'add', clientId:f.id, ws:f.mode, title:f.title, minutes:f.min, start:f.time, date:today }))))).ids);
      for (const b of Object.keys(S.split)) if (!P.split[b]) ops.push({ op:'split', id:id(b) });
      for (const c of added(P.done, S.done)) ops.push({ op:'chunk', id:id(c), status:'done' });
      for (const c of added(P.skipped, S.skipped)) ops.push({ op:'chunk', id:id(c), status:'skipped' });
      const cur = this.chunks().find(c => c.isNow);
      if (cur && cur.id !== P.cur) ops.push({ op:'started', id:id(cur.id), at:Date.now() });
      for (const g of new Set([...S.goalsDone, ...P.goalsDone])) if (S.goalsDone.includes(g) !== P.goalsDone.includes(g)) ops.push({ op:'goal', id:g, done:S.goalsDone.includes(g) });
      for (const n of added(P.dismissed, S.dismissed)) ops.push({ op:'nudge', id:n, answer:(S.nudgeAnswers || {})[n] || 'dismissed' });
      for (const f of added(P.folDone, S.folDone)) ops.push({ op:'followUp', id:f, done:true });
      for (const f of added(P.nudgedThem, S.nudgedThem)) ops.push({ op:'followUp', id:f, nudged:true });
      for (const a of S.alarms) { const was = P.alarms.find(x => x.id === a.id); if (!was || was.on !== a.on) ops.push({ op:'alarm', id:a.id, time:a.time, label:a.label[L], days:a.days[L], on:a.on, byKo:!!a.byKo, brief:!!a.brief }); }
      for (const m of S.messages.slice(P.messages.length)) ops.push({ op:'message', date:today, ws:this.mode(), who:m.who, text:m.text == null ? null : m.text, key:m.key || null });
      for (const k of SETTINGS) { const v = JSON.stringify(this.settingValue(k)); if (v !== undefined && v !== P.settings[k]) ops.push({ op:'setting', key:k, value:v }); }
      if (S.feel !== P.feel || JSON.stringify(S.slipPick) !== P.slipPick) ops.push({ op:'review', date:today, feel:S.feel, slips:Object.fromEntries(Object.entries(S.slipPick).map(([k, v]) => [id(k), v])) });
      if (ops.length) store.apply(JSON.stringify(ops));
      this.persisted = this.snap();
    }
    // Kō sets the alarm on the phone too: the same request the scripted reply answers ("Done. Alarm at 06:45").
    send(text) {
      if (!day) {
        // The design's scripted Kō (browser preview); its alarm request also sets the phone's alarm.
        super.send(text);
        if (phone && text.trim() && /alarm|wake me|acorda-me/.test(text.toLowerCase())) phone.setAlarm(6, 45, this.lang() === 'pt' ? 'Corrida antes do trabalho' : 'Run before work');
        return;
      }
      const q = text.trim();
      if (!q) return;
      const reply = this.reply(q);
      this.setState(s => ({ messages:[...s.messages, { who:'user', text:q }], input:'', koState:'thinking' }));
      this.later(() => this.setState(s => ({ messages:[...s.messages, { who:'ko', text:reply }], koState:'speaking' })), 500);
      this.later(() => this.setState({ koState:'idle' }), 1600);
    }
    // What Kō can honestly answer without its AI: the next chunk, the day, adding a task, an alarm.
    reply(q) {
      const say = (en, pt) => this.say(en, pt), low = q.toLowerCase(), f = this.dayFacts();
      const pad = n => String(n).padStart(2, '0');
      if (/alarm|wake me|acorda|despert/.test(low)) {
        const m = low.match(/(\d{1,2})(?:\s*[:h.]\s*(\d{2}))?/);
        if (!m || +m[1] > 23 || +(m[2] || 0) > 59) return say('What time? For example: “wake me at 6:45”.', 'A que horas? Por exemplo: “acorda-me às 6:45”.');
        const time = `${pad(+m[1])}:${pad(+(m[2] || 0))}`, label = say('Kō alarm', 'Alarme do Kō');
        if (!phone.setAlarm(+m[1], +(m[2] || 0), label)) return say('I couldn’t find a clock app on this phone.', 'Não encontrei uma app de relógio neste telemóvel.');
        this.setState(s => ({ alarms:[{ id:'k' + Date.now(), time, label:[label, label], days:[say('Once', 'Uma vez'), say('Once', 'Uma vez')], on:true, byKo:true, brief:false }, ...s.alarms] }));
        return say(`Done: an alarm at ${time} in your Clock app.`, `Feito: um alarme às ${time} na app Relógio.`);
      }
      const add = q.match(/^\s*(?:add|junta|adiciona)\s*:?\s*(.+)$/i);
      if (add) return this.feed(add[1]);
      if (/next|now|seguir|agora/.test(low)) {
        if (!f.now) return say('Nothing left today.', 'Já não há nada hoje.');
        return say(`Now: ${f.now.title}, ${f.now.min} min.`, `Agora: ${f.now.title}, ${f.now.min} min.`) + (f.next ? say(` Then ${f.next.title} at ${f.next.time}.`, ` Depois ${f.next.title} às ${f.next.time}.`) : '');
      }
      if (/today|day|plan|hoje|dia/.test(low)) {
        if (!f.list.length) return say('Nothing planned today yet.', 'Ainda nada planeado hoje.');
        const items = f.list.filter(c => !c.isDone).slice(0, 6).map(c => `${c.time} ${c.title}`).join('; ');
        return say(`${f.left} of ${f.list.length} left${f.meetings ? `, ${f.meetings} meetings` : ''}: ${items}.`, `Faltam ${f.left} de ${f.list.length}${f.meetings ? `, ${f.meetings} reuniões` : ''}: ${items}.`);
      }
      return say('I can’t answer that yet: my AI comes in a next update. For now I can tell you what’s next or how today looks, add a task (“add: …”) or set an alarm (“wake me at 6:45”).',
        'Ainda não sei responder a isso: a minha IA chega numa próxima atualização. Por agora digo-te o que vem a seguir ou como está o dia, junto uma tarefa (“junta: …”) ou marco um alarme (“acorda-me às 6:45”).');
    }
    // The Android back button: close a sheet, step back a screen, then back to Kō. False lets the app close.
    back() {
      const scr = this.scr();
      if ((scr === 'onboarding' && this.oauthV()) || (scr === 'tools' && this.mcpV())) { this.setState({ oauth:null, mcp:null }); return true; }
      if (scr === 'onboarding') { if (this.stepV() === 0) return false; this.setState({ step:this.stepV() - 1 }); return true; }
      if (PARENT[scr]) { this.setState({ screen:PARENT[scr], wakePhase:null, ringPhase:null }); return true; }
      if (scr !== 'home') { this.setState({ screen:'home', homeView:'ko', homeOpen:false, tilesIn:false }); return true; }
      if (this.variantV() !== 'ko') { this.setState({ homeView:'ko', homeOpen:true, tilesIn:false }); this.later(() => this.setState({ tilesIn:true }), 400); return true; }
      if (this.homeOpenV()) { this.setState({ homeOpen:false, tilesIn:false }); return true; }
      return false;
    }
    componentDidMount() {
      super.componentDidMount();
      if (!day) return;
      this.persist(); // the current chunk's start, at once
      // Pull to refresh: a drag down from the top of the screen (not in Kō's chat, which scrolls on its own).
      const root = document.getElementById('app');
      const atTop = () => { const sc = root.querySelector('.kf-scroll'); return !sc || sc.scrollTop <= 0; };
      root.addEventListener('touchstart', (e) => {
        this.pull = !this.state.refreshing && atTop() && !['ko', 'onboarding', 'wake', 'ring'].includes(this.scr()) ? { y: e.touches[0].clientY, d: 0 } : null;
      }, { passive: true });
      root.addEventListener('touchmove', (e) => {
        if (!this.pull) return;
        this.pull.d = Math.max(0, e.touches[0].clientY - this.pull.y);
        this.setState({ pullD: this.pull.d });
      }, { passive: true });
      const end = () => {
        if (!this.pull) return;
        const go = this.pull.d > PULL_AT;
        this.pull = null;
        this.setState({ pullD: 0 });
        if (go) this.refreshNow();
      };
      root.addEventListener('touchend', end);
      root.addEventListener('touchcancel', end);
    }
    componentDidUpdate() {
      super.componentDidUpdate();
      if (day) this.persist();
      const lang = this.lang(), scr = this.scr();
      document.documentElement.lang = lang === 'pt' ? 'pt-PT' : 'en';
      // Signed in once the app itself has moved past onboarding (Plan my day); Sign out goes back to it.
      const signedIn = scr !== 'onboarding' && (!!saved.signedIn || this.state.screen != null);
      if (lang !== saved.lang || signedIn !== saved.signedIn) { saved.lang = lang; saved.signedIn = signedIn; save(saved); }
    }
  }

  // A new day while the app is open (past midnight): reload, so the store rolls the day over.
  if (day) document.addEventListener('visibilitychange', () => { if (!document.hidden && dateKey(new Date()) !== today) location.reload(); });

  // The phone is the whole screen in the app, whatever its size (no frame, no drawn status bar).
  if (phone) document.documentElement.classList.add('kf-native');
  DC.fontUrl = '../assets/fonts/dm-mono-latin-500-normal.woff2';
  document.documentElement.lang = props.lang === 'pt' ? 'pt-PT' : 'en';
  window.kohuFounders = DC.mount(App, props, document.getElementById('app'), document.getElementById('ko-phone'));
})();
