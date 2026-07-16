migrate(
  (app) => {
    const products = app.findCollectionByNameOrId('products')
    products.deleteRule = "@request.auth.role = 'admin'"
    products.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'manager')"
    app.save(products)
  },
  (app) => {
    const products = app.findCollectionByNameOrId('products')
    products.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'manager')"
    products.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'manager')"
    app.save(products)
  },
)
