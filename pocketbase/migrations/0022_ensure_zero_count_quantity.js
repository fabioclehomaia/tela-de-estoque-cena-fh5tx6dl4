migrate(
  (app) => {
    var counts = app.findCollectionByNameOrId('inventory_counts')

    var countedField = counts.fields.getByName('counted_quantity')
    if (countedField) {
      countedField.required = false
    }

    var previousField = counts.fields.getByName('previous_quantity')
    if (previousField) {
      previousField.required = false
    }

    app.save(counts)
  },
  (app) => {
    var counts = app.findCollectionByNameOrId('inventory_counts')

    var countedField = counts.fields.getByName('counted_quantity')
    if (countedField) {
      countedField.required = true
    }

    var previousField = counts.fields.getByName('previous_quantity')
    if (previousField) {
      previousField.required = true
    }

    app.save(counts)
  },
)
