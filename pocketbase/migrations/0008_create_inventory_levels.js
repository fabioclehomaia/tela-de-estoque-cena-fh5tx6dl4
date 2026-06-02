migrate(
  (app) => {
    const collection = new Collection({
      name: 'inventory_levels',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'manager')",
      updateRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'manager')",
      deleteRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'manager')",
      fields: [
        {
          name: 'product_id',
          type: 'relation',
          required: true,
          collectionId: app.findCollectionByNameOrId('products').id,
          maxSelect: 1,
        },
        {
          name: 'subarea_id',
          type: 'relation',
          required: true,
          collectionId: app.findCollectionByNameOrId('subareas').id,
          maxSelect: 1,
        },
        { name: 'quantity', type: 'number', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_inv_levels_prod_sub ON inventory_levels (product_id, subarea_id)',
      ],
    })
    app.save(collection)

    try {
      app
        .db()
        .newQuery(`
      INSERT INTO inventory_levels (id, product_id, subarea_id, quantity, created, updated)
      SELECT lower(hex(randomblob(7))), id, subarea_id, 0, datetime('now'), datetime('now')
      FROM products WHERE subarea_id IS NOT NULL AND subarea_id != ''
    `)
        .execute()
    } catch (err) {
      console.log('Migration query failed: ' + err)
    }

    const products = app.findCollectionByNameOrId('products')
    products.fields.removeByName('subarea_id')
    app.save(products)
  },
  (app) => {
    const products = app.findCollectionByNameOrId('products')
    products.fields.add(
      new RelationField({
        name: 'subarea_id',
        collectionId: app.findCollectionByNameOrId('subareas').id,
        maxSelect: 1,
        required: false,
      }),
    )
    app.save(products)

    const collection = app.findCollectionByNameOrId('inventory_levels')
    app.delete(collection)
  },
)
