migrate(
  (app) => {
    const collection = new Collection({
      name: 'product_price_history',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: 'product_id',
          type: 'relation',
          required: true,
          collectionId: app.findCollectionByNameOrId('products').id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'price', type: 'number', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('product_price_history')
    app.delete(collection)
  },
)
