# Orientações do projeto home-ia-platform-web

Este repositório é independente e contém o remote React de administração da plataforma Home IA. Leia o `README.md` e o contexto compartilhado em `../../docs/` antes de alterar código.

## Fronteiras

- O shell `home-ia-web` é autoridade de sessão, autenticação, navegação principal, tema, idioma e CSS global.
- O portal .NET é autoridade de identidade, autorização, catálogo de módulos, perfis/permissões e auditoria.
- Este remote apresenta os módulos `AccessModule` (usuários, perfis e solicitações) e `SystemsModule` (catálogo de módulos/integrações registrados) e envia comandos autorizados.
- Não autenticar, não decidir autorização, não persistir segredos e não criar integrações fictícias sem contrato no backend.
- Pessoas, câmeras, captura, clipes, saúde e dependências do monitoramento pertencem ao `home-ia-monitoring-web`.

## Comandos

Usar exclusivamente o entrypoint raiz:

```sh
./garage web                  # sobe shell, Monitoramento e Plataforma em HMR
./garage verify-platform-web
./garage format-platform-web
./garage lock-platform-web
```

Não executar `docker compose` diretamente neste diretório. Não iniciar, parar ou substituir captura real sem autorização operacional.

## Qualidade

- Manter acessibilidade, foco/teclado, responsividade e estados de carregamento, vazio e erro.
- Testes de comportamento com Testing Library e `fetch` controlado apenas na fronteira HTTP.
- CSS global e i18n pertencem a `home-ia-shared`; não criar estilos privados não documentados.
- Toda alteração de contrato ou fronteira exige atualização da documentação compartilhada e evidência.
