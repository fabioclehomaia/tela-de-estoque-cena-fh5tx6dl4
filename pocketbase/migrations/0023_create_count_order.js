migrate(
  (app) => {
    const collection = new Collection({
      name: 'count_order',
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
        { name: 'sort_order', type: 'number', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_count_order_prod_sub ON count_order (product_id, subarea_id)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('count_order')
    app.delete(collection)
  },
)
