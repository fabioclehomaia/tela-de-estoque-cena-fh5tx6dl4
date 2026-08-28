migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('inventory_levels')

    const quantityField = collection.fields.getByName('quantity')
    if (quantityField) {
      quantityField.required = false
    }

    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('inventory_levels')

    const quantityField = collection.fields.getByName('quantity')
    if (quantityField) {
      quantityField.required = true
    }

    app.save(collection)
  },
)
