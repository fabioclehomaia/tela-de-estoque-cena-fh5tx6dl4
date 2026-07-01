migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.fields.add(
      new RelationField({
        name: 'subarea_id',
        collectionId: app.findCollectionByNameOrId('subareas').id,
        maxSelect: 1,
      }),
    )
    app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.fields.removeByName('subarea_id')
    app.save(users)
  },
)
