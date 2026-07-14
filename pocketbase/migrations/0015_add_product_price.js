migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('products')
    if (!col.fields.getByName('price')) {
      col.fields.add(new NumberField({ name: 'price' }))
      app.save(col)
    }
  },
  (app) => {
    const col = app.findCollectionByNameOrId('products')
    if (col.fields.getByName('price')) {
      col.fields.removeByName('price')
      app.save(col)
    }
  },
)
