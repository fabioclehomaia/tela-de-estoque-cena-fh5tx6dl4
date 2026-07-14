migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('product_price_history')
    col.listRule = "@request.auth.id != ''"
    col.viewRule = "@request.auth.id != ''"
    col.createRule = "@request.auth.id != ''"
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('product_price_history')
    col.listRule = null
    col.viewRule = null
    col.createRule = null
    app.save(col)
  },
)
