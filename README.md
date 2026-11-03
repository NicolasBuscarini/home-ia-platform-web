# home-ia-platform-web

Remote de Module Federation para os módulos administrativos genéricos do portal Home IA.

Expõe:

- `./AccessModule`: gestão de usuários, perfis/permissões e solicitações de acesso.
- `./SystemsModule`: catálogo de módulos registrados no portal, com contrato, menu, permissão exigida e ativação.

O shell `home-ia-web` é dono de sessão, autenticação, autorização, navegação principal, tema, idioma e CSS global. Este remote apenas apresenta dados e envia comandos autorizados; não autentica, não decide autorização e não acessa segredos.

## Desenvolvimento

O projeto é operado exclusivamente pelo entrypoint raiz:

```sh
./garage web                  # sobe shell, Monitoramento e Plataforma em HMR
./garage verify-platform-web
./garage format-platform-web
./garage lock-platform-web
```

O Vite de desenvolvimento usa a porta `5175` e o build estático é servido pelo portal em `/platform/`. Pessoas e câmeras continuam no remote `home-ia-monitoring-web`; operações de captura, saúde e dependências do monitoramento também permanecem lá.

## Verificação

`npm run verify` executa Biome, Vitest, TypeScript e build. Os testes usam Testing Library e executam os fluxos reais dos painéis com `fetch` controlado nas fronteiras HTTP.
