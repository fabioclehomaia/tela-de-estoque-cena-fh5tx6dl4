migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    if (!users.fields.getByName('area_ids')) {
      users.fields.add(
        new RelationField({
          name: 'area_ids',
          collectionId: app.findCollectionByNameOrId('areas').id,
          maxSelect: 999,
        }),
      )
    }

    if (!users.fields.getByName('subarea_ids')) {
      users.fields.add(
        new RelationField({
          name: 'subarea_ids',
          collectionId: app.findCollectionByNameOrId('subareas').id,
          maxSelect: 999,
        }),
      )
    }

    app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    if (users.fields.getByName('area_ids')) {
      users.fields.removeByName('area_ids')
    }
    if (users.fields.getByName('subarea_ids')) {
      users.fields.removeByName('subarea_ids')
    }

    app.save(users)
  },
)
