# home-ia-platform-web

Remote de Module Federation para os módulos administrativos genéricos do portal Home IA.

Expõe:

- `./AccessModule`: gestão de usuários, perfis/permissões e solicitações de acesso. O editor de perfis apresenta o catálogo v2 (módulo, risco, escopos permitidos, chaves reservadas/indisponíveis) e a atribuição de perfis aceita escopos `global`, `module`, `context` ou `camera`, limitados pela interseção das permissões do perfil.
- `./SystemsModule`: catálogo de módulos registrados no portal, com contrato, menu, permissão exigida e ativação, além da saúde agregada do portal, dos módulos e das integrações.
- `./AuditModule`: consulta da auditoria da plataforma (`GET /api/v1/admin/events` e detalhe), com filtros agrupados, tabela, cursor e verificação de integridade. É montado pelo shell na área de topo **Auditoria** quando a projeção do portal inclui o submenu `audit` (`events.read`); os textos vêm do catálogo compartilhado `audit.*` em `home-ia-shared`, sem cópia local.

O shell `home-ia-web` é dono de sessão, autenticação, autorização, navegação principal, tema, idioma e CSS global. Este remote apenas apresenta dados e envia comandos autorizados; não autentica, não decide autorização e não acessa segredos.

## Desenvolvimento

O projeto é operado exclusivamente pelo entrypoint raiz:

```sh
./garage web                  # sobe shell, Monitoramento e Plataforma em HMR
./garage verify-platform-web
./garage format-platform-web
./garage lock-platform-web
```

O Vite de desenvolvimento usa a porta `5175` e o build estático é servido pelo portal em `/platform/`. Pessoas e câmeras continuam no remote `home-ia-monitoring-web`; operações de captura e a saúde operacional/dependências do Monitoramento também permanecem lá. Este remote mostra somente o agregado do portal/módulos/integrações (`GET /api/v1/portal/health`), sem URLs, segredos ou payloads.

## Verificação

`npm run verify` executa Biome, Vitest, TypeScript e build. Os testes usam Testing Library e executam os fluxos reais dos painéis com `fetch` controlado nas fronteiras HTTP.
