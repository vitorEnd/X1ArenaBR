# WOF Arena X1 BR

Plataforma da comunidade competitiva **WOF Arena X1 BR (AXB)** para eventos semanais de x1 dentro do World of Football.

O projeto é uma aplicação Next.js padrão com App Router, React, TypeScript, Tailwind CSS, Framer Motion e Lucide Icons. Ele não depende de nenhum provedor de hospedagem e pode ser publicado onde você preferir.

## Executar localmente

Requisitos:

- Node.js 22.13 ou superior;
- npm 10 ou superior.

Instale as dependências e inicie o ambiente de desenvolvimento:

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`. Para executar a versão de produção localmente:

```bash
npm run build
npm run start
```

Validações disponíveis:

```bash
npm run typecheck
npm run lint
npm test
```

Nenhuma variável de ambiente é necessária na versão atual.

## Rotas

- `/` — homepage editorial;
- `/eventos` — agenda, card demonstrativo e histórico;
- `/rankings` — classificação por categoria e busca por jogador;
- `/categorias` — comparação de atributos e cinturões;
- `/jogadores` — diretório de jogadores;
- `/jogadores/[slug]` — perfil individual;
- `/regulamento` — regras completas e glossário;
- `/sobre` — proposta, comunidade e criadores.

## Estrutura principal

```text
app/                  Rotas, metadados, sitemap e robots
components/           Componentes reutilizáveis e interativos
data/arena.ts         Conteúdo oficial e dados demonstrativos centralizados
lib/types.ts          Interfaces e tipos do domínio
lib/ranking.ts        Fórmulas, ordenação e separação do campeão
public/images/        Imagens fornecidas para a AXB
tests/                Testes da lógica de ranking
```

## Dados oficiais e demonstrativos

Não foram fornecidos campeões, cards, resultados ou registros oficiais. Por isso:

- os estados oficiais permanecem vazios;
- cinturões exibem **“Cinturão a definir”**;
- a agenda exibe **“Próximo card a ser anunciado”**;
- qualquer nome, placar ou número usado para demonstrar filtros, cards e perfis recebe o rótulo persistente **“Dados demonstrativos — não oficiais”**.

Os pontos e o saldo nunca são armazenados duplicados:

```text
Pontos = (vitórias × 2) − derrotas
Saldo de gols = gols marcados − gols sofridos
```

O campeão é removido da classificação numérica e identificado por `C`. O primeiro desafiante continua sendo `#1`.

## Atualização de conteúdo

Os dados ficam em `data/arena.ts`. Para conectar uma API no futuro, mantenha os contratos de `lib/types.ts` e substitua apenas a fonte dos arrays. A lógica de classificação em `lib/ranking.ts` já prevê confronto direto e decisão manual da organização para desempates.

## Imagens e logo

As três imagens fornecidas foram organizadas em:

- `public/images/arena-field.jfif` (original fornecido);
- `public/images/arena-field.jpg` (cópia com MIME compatível para uso no navegador);
- `public/images/player-yellow.png`;
- `public/images/player-yellow-glasses.png`.

O arquivo oficial do logo AXB não estava acessível no workspace. O site usa temporariamente um wordmark tipográfico “AXB”, sem inventar um novo escudo. Quando o logo for anexado, salve-o como `public/images/axb-logo.png` e substitua o conteúdo visual do componente `components/brand-mark.tsx` por `next/image`. A mesma imagem poderá então gerar o favicon oficial.

## Acessibilidade e movimento

- navegação semântica e foco visível;
- menu mobile acessível por teclado e tecla `Esc`;
- tabelas convertidas em cards no celular;
- áreas de toque amplas;
- suporte global a `prefers-reduced-motion`;
- intro exibida apenas na primeira visita da sessão.

## Créditos

Criadores informados pela comunidade: **Itz**, **Vtzinn021** e **Apenas João00325**.

Projeto comunitário e fan-made, sem afiliação declarada com o UFC ou com os responsáveis por World of Football.
