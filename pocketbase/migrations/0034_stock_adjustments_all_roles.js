// Migração 0034 — Ajuste de Estoque para todos os perfis:
// libera a leitura e a criação de ajustes para qualquer usuário autenticado
// (a aba passa a ficar visível também para funcionários).
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('stock_adjustments')
    col.listRule = "@request.auth.id != ''"
    col.viewRule = "@request.auth.id != ''"
    col.createRule = "@request.auth.id != '' && @request.body.adjusted_by = @request.auth.id"
    col.updateRule = ''
    col.deleteRule = ''
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('stock_adjustments')
    col.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'manager')"
    col.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'manager')"
    col.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'manager')"
    col.updateRule = ''
    col.deleteRule = ''
    app.save(col)
  },
)
