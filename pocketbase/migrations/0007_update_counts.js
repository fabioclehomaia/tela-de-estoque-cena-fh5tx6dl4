migrate(
  (app) => {
    const counts = app.findCollectionByNameOrId('inventory_counts')
    counts.fields.add(
      new RelationField({
        name: 'subarea_id',
        collectionId: app.findCollectionByNameOrId('subareas').id,
        maxSelect: 1,
        required: false,
      }),
    )
    app.save(counts)
  },
  (app) => {
    const counts = app.findCollectionByNameOrId('inventory_counts')
    counts.fields.removeByName('subarea_id')
    app.save(counts)
  },
)
