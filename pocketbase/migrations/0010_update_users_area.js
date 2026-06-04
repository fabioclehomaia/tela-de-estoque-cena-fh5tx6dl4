migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    if (!users.fields.getByName('area_id')) {
      users.fields.add(
        new RelationField({
          name: 'area_id',
          type: 'relation',
          collectionId: app.findCollectionByNameOrId('areas').id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
      app.save(users)
    }
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    if (users.fields.getByName('area_id')) {
      users.fields.removeByName('area_id')
      app.save(users)
    }
  },
)
