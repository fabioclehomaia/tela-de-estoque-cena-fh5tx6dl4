migrate(
  (app) => {
    const counts = app.findCollectionByNameOrId('inventory_counts')

    const countedField = counts.fields.getByName('counted_quantity')
    if (countedField) {
      countedField.required = false
    }

    const previousField = counts.fields.getByName('previous_quantity')
    if (previousField) {
      previousField.required = false
    }

    app.save(counts)
  },
  (app) => {
    const counts = app.findCollectionByNameOrId('inventory_counts')

    const countedField = counts.fields.getByName('counted_quantity')
    if (countedField) {
      countedField.required = true
    }

    const previousField = counts.fields.getByName('previous_quantity')
    if (previousField) {
      previousField.required = true
    }

    app.save(counts)
  },
)
