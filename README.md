# WOF Arena X1 BR

Plataforma oficial da comunidade competitiva **WOF Arena X1 BR (AXB)** para eventos de x1 no World of Football e partidas ranqueadas.

O projeto usa Next.js App Router, React, TypeScript, Tailwind CSS, Framer Motion, Lucide e Supabase. Ele continua independente de provedor de hospedagem.

## Sistemas separados

- **Arena oficial:** jogadores, eventos, rankings por categoria e cinturões administrados pela organização.
- **Ranked Matchmaking:** contas públicas, fila global, lobbies, resultados e MMR próprios.

Uma conta ranked nunca cria ou altera um jogador da Arena oficial.

## Requisitos

- Node.js 22.13 ou superior;
- npm 10 ou superior;
- projeto Supabase para habilitar contas e partidas reais;
- aplicação Discord para habilitar o login social.

## Executar localmente no Windows

No PowerShell, use o executável `npm.cmd` caso a política do Windows bloqueie `npm.ps1`:

```powershell
npm.cmd install
npm.cmd run dev
```

Abra `http://localhost:3000` no navegador. Não use a extensão **Go Live**: ela serve apenas arquivos estáticos e não executa uma aplicação Next.js.

Validações:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run test:e2e
npm.cmd run build
```

## Configuração do Supabase

1. Crie um projeto em `https://database.new`.
2. Copie `.env.example` para `.env.local`.
3. Preencha a URL, a chave publicável e a chave `service_role` do projeto.
4. Aplique, na ordem, as migrations versionadas da pasta `supabase/migrations`.
5. Em Authentication, mantenha e-mail/senha habilitado e exija confirmação de e-mail.
6. Ative **Manual Identity Linking** para permitir conectar Discord e senha à mesma conta.
7. Cadastre nas URLs permitidas o endereço local e o domínio final, ambos com `/auth/callback`.
8. Em Supabase Cron, agende periodicamente `select public.ranked_reconcile();` para reconciliar prazos mesmo quando nenhum navegador estiver ativo.

Exemplo local:

```text
http://localhost:3000/auth/callback
```

As migrations criam o bucket `ranked-avatars`, as políticas RLS, os índices, os gatilhos e as funções transacionais. Nunca coloque a chave `service_role` em uma variável iniciada por `NEXT_PUBLIC_`.

## Login com Discord

1. Crie uma aplicação no Discord Developer Portal.
2. Em OAuth2, cadastre a callback exibida no provedor Discord do Supabase, no formato `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Copie o Client ID e o Client Secret para Authentication → Providers → Discord no Supabase.
4. Adicione o domínio local e o domínio publicado à lista de redirecionamentos do Supabase.

O código usa OAuth com PKCE e troca o código da sessão somente no servidor.

## Suporte

Existe um único nível de permissão: **Suporte**. Não há tela para promover outras contas.

Depois que as contas responsáveis forem criadas, copie os UUIDs de `auth.users` e informe-os, separados por vírgula, em:

```text
SUPABASE_SUPPORT_USER_IDS=id-um,id-dois
```

Com a lista vazia, ninguém recebe acesso. A autorização é revalidada no servidor e todas as decisões são registradas na auditoria.

## Ranked

Elos:

- Novato: 800–999;
- Pro: 1.000–1.249;
- Craque: 1.250–1.799;
- Desafiante: 1.800–2.099;
- Immortal: 2.100–2.499;
- Champion: 2.500+ e Top 10 global.

As cinco colocações ocultam MMR e Elo. O resultado revelado é 800, 900, 1.000, 1.100, 1.200 ou 1.400 MMR para zero a cinco vitórias. Depois disso, a variação Elo usa K=40, fica entre 10 e 40 pontos e nunca reduz alguém abaixo de 800.

O matchmaking começa em uma janela de ±150 MMR. Depois de 60 segundos, a busca se torna global. Todos os prazos e resultados são decididos pelo banco; o navegador apenas exibe o estado em tempo real.

## Rotas principais

- `/` — início;
- `/matchmaking` — lobby e fila ranked;
- `/matchmaking/ranking` — Top 50 global;
- `/ranked/[username]` — perfil ranked público;
- `/auth/entrar` e `/cadastro` — acesso à ranked;
- `/conta` — segurança e métodos vinculados;
- `/conta/perfil` — nome e avatar ranked;
- `/suporte` — operação protegida;
- `/eventos`, `/rankings`, `/categorias`, `/jogadores`, `/regulamento` e `/sobre` — Arena oficial.

## Teste com duas contas

1. Configure Supabase e Discord.
2. Abra uma janela normal e uma janela anônima, ou dois perfis diferentes do navegador.
3. Crie uma conta em cada janela e finalize os dois perfis ranked.
4. Entre na fila com ambas.
5. Confirme o aceite, o lobby, o placar, a contestação e o histórico.

Os testes E2E também criam dois contextos de navegador independentes. Fluxos autenticados dependem de um projeto Supabase de teste configurado; nenhuma credencial é armazenada no repositório.

## Dados oficiais atuais

- Itz — Peso Médio;
- João00325 — Peso Médio;
- Vtzinn021 — Peso Médio;
- Vwyxz — categoria a definir.

O card inaugural, rankings oficiais, campeões e resultados continuam vazios até a organização publicar dados reais.

## Segurança

- Row Level Security em todas as tabelas expostas;
- senha de lobby restrita aos participantes e suporte;
- mutações competitivas feitas por RPC transacional;
- MMR e estatísticas não podem ser alterados pelo navegador;
- ações idempotentes contra reenvio;
- validação server-side;
- auditoria de suporte;
- avatares limitados a PNG, JPG ou WebP quadrado de até 5 MB.

## Pendências externas antes do lançamento

O código pode ser construído sem segredos, mas contas, fila e lobby só ficam operacionais depois de:

- criar o projeto Supabase;
- aplicar as migrations;
- preencher `.env.local` e as variáveis da hospedagem;
- ativar o provedor Discord;
- cadastrar as URLs finais de callback;
- informar os IDs de suporte.

## Créditos

Criadores informados pela comunidade: **Itz**, **Vtzinn021** e **Apenas João00325**.
