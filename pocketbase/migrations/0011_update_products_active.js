migrate(
  (app) => {
    const products = app.findCollectionByNameOrId('products')
    if (!products.fields.getByName('active')) {
      products.fields.add(
        new BoolField({
          name: 'active',
          system: false,
        }),
      )
      app.save(products)
      app.db().newQuery('UPDATE products SET active = 1').execute()
    }
  },
  (app) => {
    const products = app.findCollectionByNameOrId('products')
    if (products.fields.getByName('active')) {
      products.fields.removeByName('active')
      app.save(products)
    }
  },
)
