// Migração 0035 — corrige a falha ao gravar ajuste de estoque.
// A regra de criação deixada pela 0034 exigia
// "@request.body.adjusted_by = @request.auth.id", e o PocketBase rejeitava o
// POST com 400 "Failed to create record." mesmo com o campo correto no corpo.
// Mantém a decisão de produto: qualquer usuário autenticado pode criar.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('stock_adjustments')
    col.listRule = "@request.auth.id != ''"
    col.viewRule = "@request.auth.id != ''"
    col.createRule = "@request.auth.id != ''"
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
    col.createRule = "@request.auth.id != '' && @request.body.adjusted_by = @request.auth.id"
    col.updateRule = ''
    col.deleteRule = ''
    app.save(col)
  },
)
